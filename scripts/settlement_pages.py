"""Builds the public settlement pages (claimrightful.com/settlements/...) for search engines.

    python3 scripts/settlement_pages.py

Reads every open, verified settlement from the linked Supabase project (read-only, through the
Supabase CLI) and writes:
  website/public/settlements.html             the list of open settlements
  website/public/settlements/<slug>.html      one page per settlement
  website/public/sitemap.xml                  the site's pages plus the settlement pages
Run it after each weekly settlement check and commit the output. Closed settlements drop off.

The pages explain who qualifies, how much, the deadline and whether proof is needed. Filing
(the verified official claim link) stays in the app, so every page points to the free check.
"""

import datetime as dt
import html
import json
import re
import shutil
import subprocess
from urllib.parse import quote
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "website" / "public"
OUT_DIR = PUBLIC / "settlements"
SITE = "https://claimrightful.com"
STATIC_PAGES = ["/", "/support", "/privacy", "/terms", "/pricing", "/refund", "/settlements"]

QUERY = """
select s.id, s.company, b.name as brand_name, s.title, payout_min, payout_max, payout_typical, deadline, opens_on, proof_required,
       qualifies_summary, eligibility_details, expected_payout_date, eligible_state_codes,
       source_checked_at, is_featured
from public.settlements s
join public.brands b on b.id = s.brand_id
where s.status = 'verified' and not s.is_sample and s.deadline >= current_date
order by s.deadline, s.company
"""

PIXEL = """  <!-- Meta Pixel: measures which ads bring visitors who subscribe. -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1421213039962754');
    fbq('init', '1118375720720754');
    fbq('track', 'PageView');
  </script>"""

FOOTER = """    <footer>
      <div class="row">
        <a class="brand" href="/" aria-label="ClaimRightful home">Claim<span class="brand-accent">Rightful</span></a>
        <nav aria-label="Footer"><a href="/settlements">Settlements</a><a href="/pricing">Pricing</a><a href="/refund">Refunds</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></nav>
      </div>
    </footer>"""

DISCLAIMER = ("ClaimRightful is not a law firm and isn't affiliated with the settlement or the court. Amounts are the "
              "most each settlement pays, from court filings; most people get less. Always file on the official "
              "settlement website.")


def fetch() -> list[dict]:
    out = subprocess.run(
        ["supabase", "db", "query", "--linked", "-o", "json", QUERY],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    data, _ = json.JSONDecoder().raw_decode(out[out.index("{"):])
    return data["rows"]


def slugify(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", "and"))).strip("-")


def day(value: str) -> str:
    d = dt.date.fromisoformat(value[:10])
    return f"{d:%B} {d.day}, {d.year}"


def money(value) -> str:
    return f"${float(value):,.0f}"


def amount(s: dict) -> str:
    low, high = float(s["payout_min"] or 0), float(s["payout_max"] or 0)
    if high <= 0:
        return "Varies: the fund is split among everyone who files"
    if 0 < low < high:
        return f"{money(low)} to {money(high)}"
    return f"Up to {money(high)}"


def group(rows: list[dict]) -> list[dict]:
    """One page per case: the same settlement listed under two brands (Hyundai, Kia) shares a page."""
    cases: dict[tuple, dict] = {}
    for row in rows:
        key = (row["title"], row["qualifies_summary"], row["deadline"])
        if key in cases:
            cases[key]["companies"].append(row["company"])
        else:
            cases[key] = {**row, "companies": [row["company"]]}
    for case in cases.values():
        names = case["companies"]
        case["name"] = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " & " + names[-1]
        # Don't repeat the company in the URL when the title starts with it ("Apple Intelligence").
        title = case["title"]
        if title.lower().startswith(names[0].lower()):
            title = title[len(names[0]):]
        case["slug"] = slugify(f"{' '.join(names)} {title}")
    return list(cases.values())


def is_open(s: dict, today: dt.date) -> bool:
    return not s["opens_on"] or dt.date.fromisoformat(s["opens_on"][:10]) <= today


def page(s: dict, today: dt.date) -> str:
    e = html.escape
    name, title = s["name"], s["title"]
    open_now = is_open(s, today)
    deadline = day(s["deadline"])
    proof = "No receipts needed" if s["proof_required"] is False else "Proof may be needed"
    states = s["eligible_state_codes"] or []
    status = f"Open until {deadline}" if open_now else f"Opens {day(s['opens_on'])} (expected)"
    # "Apple Intelligence & Siri claims" already names the company; "Data breach" doesn't.
    display = title if title.lower().startswith(s["companies"][0].lower()) else f"{name} {title}"
    heading = f"{display[0].upper()}{display[1:]} settlement"
    page_title = f"{heading}: Who Qualifies, Payout and Deadline ({deadline})"
    summary = s["qualifies_summary"] or ""
    description = (summary.split(". ")[0].rstrip(".") + f". Deadline {deadline}.")[:300]
    details = s["eligibility_details"] or []
    brand = s["brand_name"]
    cta = f"/app/start?brand={quote(brand)}"
    checked = day(s["source_checked_at"]) if s["source_checked_at"] else None

    faq = [
        (f"Who qualifies for the {name} settlement?", summary),
        (f"What is the deadline for the {name} settlement?",
         f"Claims must be filed by {deadline}." + ("" if open_now else f" The claim website is expected to open {day(s['opens_on'])}.")),
        (f"How much does the {name} settlement pay?", amount(s) + "."),
    ]
    faq_ld = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq
        ],
    }

    steps = [
        "Check that you qualify. The free check on ClaimRightful matches you against every open settlement for the companies you've used.",
        f"File on the official settlement website before {deadline}. ClaimRightful members get the verified official claim link and a step-by-step guide, so they never land on a fake site.",
        "Keep track until you're paid. Payments come from the settlement administrator"
        + (f", {e(s['expected_payout_date'][0].lower() + s['expected_payout_date'][1:])}" if s.get("expected_payout_date") else "")
        + ".",
    ]

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(page_title)}</title>
  <meta name="description" content="{e(description)}">
  <link rel="canonical" href="{SITE}/settlements/{s['slug']}">
  <meta property="og:title" content="{e(page_title)}">
  <meta property="og:description" content="{e(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400&display=swap">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">{json.dumps(faq_ld)}</script>
{PIXEL}
</head>
<body>
  <div class="wrap">
    <header class="nav">
      <a class="brand" href="/" aria-label="ClaimRightful home">Claim<span class="brand-accent">Rightful</span></a>
      <nav class="nav-links" aria-label="Main"><a href="/settlements">All settlements</a><a class="nav-cta" href="/app">Open the app</a></nav>
    </header>
    <main class="doc settle">
      <p class="crumbs"><a href="/settlements">Settlements</a> / {e(name)}</p>
      <h1>{e(heading)}</h1>
      {f'<p class="updated">Checked against court filings on {checked}</p>' if checked else ''}

      <dl class="facts">
        <div><dt>Payout</dt><dd>{e(amount(s))}</dd></div>
        <div><dt>Deadline</dt><dd>{e(deadline)}</dd></div>
        <div><dt>Proof</dt><dd>{e(proof)}</dd></div>
        <div><dt>Status</dt><dd>{e(status)}</dd></div>
      </dl>

      <div class="cta-box">
        <p><strong>See if you qualify, free.</strong> Pick the companies you've used and ClaimRightful shows every open settlement you may be owed money from, with deadlines.</p>
        <a class="btn" href="{cta}">Check what I'm owed</a>
      </div>

      <h2>Who qualifies</h2>
      <p>{e(summary)}</p>
      {('<ul>' + ''.join(f'<li>{e(d)}</li>' for d in details) + '</ul>') if details else ''}
      {f'<p>Only open to residents of: {e(", ".join(states))}.</p>' if states else ''}

      <h2>How much you could get</h2>
      <p>{e(amount(s))}. {('No receipts are needed for the basic payment.' if s['proof_required'] is False else 'You may need proof, such as a receipt or a notice from the settlement.')} Final amounts depend on how many people file.</p>

      <h2>How to file</h2>
      <ol class="steps">{''.join(f'<li>{step}</li>' for step in steps)}</ol>

      <div class="cta-box">
        <p><strong>Don't miss the {e(deadline)} deadline.</strong> ClaimRightful reminds you before every deadline for the settlements you match.</p>
        <a class="btn" href="{cta}">Check my settlements</a>
      </div>

      <p class="fine">{e(DISCLAIMER)}</p>
      <p><a href="/settlements">See all open settlements →</a></p>
    </main>
{FOOTER}
  </div>
</body>
</html>
"""


def index(cases: list[dict], today: dt.date) -> str:
    e = html.escape
    items = "".join(
        f"""
        <li><a href="/settlements/{c['slug']}"><span class="who">{e(c['name'])}</span>
          <span class="what">{e(c['title'])}</span>
          <span class="meta">{e(amount(c).split(':')[0].replace('Varies', 'Amount varies'))} · {'Deadline ' + e(day(c['deadline'])) if is_open(c, today) else 'Opens ' + e(day(c['opens_on']))}</span></a></li>"""
        for c in cases
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open Class Action Settlements You Can Claim ({today:%B %Y})</title>
  <meta name="description" content="{len(cases)} open class action settlements in the US, with who qualifies, how much they pay and claim deadlines. Updated weekly.">
  <link rel="canonical" href="{SITE}/settlements">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400&display=swap">
  <link rel="stylesheet" href="/styles.css">
{PIXEL}
</head>
<body>
  <div class="wrap">
    <header class="nav">
      <a class="brand" href="/" aria-label="ClaimRightful home">Claim<span class="brand-accent">Rightful</span></a>
      <nav class="nav-links" aria-label="Main"><a class="nav-cta" href="/app">Open the app</a></nav>
    </header>
    <main class="doc settle">
      <h1>Open class action settlements</h1>
      <p class="updated">{len(cases)} open in the US · updated {day(today.isoformat())}</p>
      <p>Who qualifies, how much each one pays and when claims close. Soonest deadline first.</p>
      <div class="cta-box">
        <p><strong>Not sure which ones are yours?</strong> Pick the companies you've used and see every settlement you may qualify for, free.</p>
        <a class="btn" href="/app">Check what I'm owed</a>
      </div>
      <ul class="settle-list">{items}
      </ul>
      <p class="fine">{e(DISCLAIMER)}</p>
    </main>
{FOOTER}
  </div>
</body>
</html>
"""


def sitemap(cases: list[dict]) -> str:
    urls = [f"{SITE}{p if p != '/' else '/'}" for p in STATIC_PAGES] + [f"{SITE}/settlements/{c['slug']}" for c in cases]
    body = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'


def main() -> None:
    today = dt.date.today()
    cases = group(fetch())
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    for case in cases:
        (OUT_DIR / f"{case['slug']}.html").write_text(page(case, today))
    (PUBLIC / "settlements.html").write_text(index(cases, today))
    (PUBLIC / "sitemap.xml").write_text(sitemap(cases))
    print(f"wrote {len(cases)} settlement pages, the index and the sitemap")


if __name__ == "__main__":
    main()
