"""Personal plain-text emails to paying members, people on a free trial, and trials whose first
charge failed (2026-10-20), each listing that person's own open claims. Sent through Resend.

  python3 scripts/retention_emails.py --group member --preview     print every email, send nothing
  python3 scripts/retention_emails.py --group member --test        one sample to the owner's inbox
  python3 scripts/retention_emails.py --group member --send        the real send (only after the owner says yes)

--save FILE writes the group's people to FILE; --people FILE reads them from it instead of the
database (the failed group leaves the query once their unpaid subscriptions are canceled).

Groups: member (paid, active), trial (on a free trial), failed (trial's first charge failed).
The people and their claims come from scripts/retention_emails.sql.
"""
import argparse, json, os, subprocess, urllib.parse, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://claimrightful.com"
OWNER = "ishaana612@gmail.com"

# One plain sentence per claim: who qualifies, what it pays, in the order to suggest them: Pork
# first (closes Oct 29), then the easy no-receipt ones, then the ones needing more. Claims not
# listed here are left out (Amazon pays most people automatically; only notice holders file).
CLAIMS = {
    "38714408-60ba-59e6-959d-0d0e4d77626f": "Pork price-fixing: if you bought pork or bacon at a grocery store in one of 24 covered states between 2014 and 2018. Up to $100.",
    "0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31": "Apple (Siri): if you bought an iPhone 15 Pro, 15 Pro Max or any iPhone 16 between June 2024 and March 2025. $25 to $95 per phone.",
    "13ad194f-c4b3-5071-8afc-59248754e7e4": "ATM fees (Visa & Mastercard): if you've ever paid a fee at a non-bank ATM, like the ones in gas stations or convenience stores. Up to $25.",
    "988e6c93-a552-536c-b3aa-e6807cafe4c6": "CVS: if you've used the CVS website or app. $5 to $10.",
    "a3d7e844-dfed-5361-a9c0-39716b11f211": "Kroger pharmacy: if you paid for prescriptions at a Kroger pharmacy with insurance since December 2018.",
    "72debd1c-8a4c-5a74-81c0-5eadb2b591ec": "Apartment rent (RealPage): if you rented an apartment between 2018 and 2025 at a building that used RealPage pricing. Up to $50.",
}

def claim_link(settlement_id):
    return f"{SITE}/app/sign-in?next=" + urllib.parse.quote(f"/settlements/{settlement_id}", safe="")

def day(iso):
    d = date.fromisoformat(iso[:10])
    return f"{d.strftime('%b')} {d.day}"

def listed(person, limit=3):
    known = [c for c in (person["claims"] or []) if c["id"] in CLAIMS]
    order = list(CLAIMS)
    known.sort(key=lambda c: order.index(c["id"]))
    return known[:limit]

def claim_lines(claims):
    return "\n\n".join(
        f"{i}. {CLAIMS[c['id']]} Closes {day(c['deadline'])}.\n{claim_link(c['id'])}" for i, c in enumerate(claims, 1)
    )

SIGN = "If you get stuck on any of them, just reply to this email. A real person reads every reply.\n\nThe ClaimRightful team"

def member_email(person):
    claims = listed(person)
    total = person["total"]
    return "Your claims are ready to file", f"""Hi,

You have {total} open {'claim' if total == 1 else 'claims'} in your ClaimRightful account. Here are {len(claims)} you can file today. Each takes about 5 minutes:

{claim_lines(claims)}

After you file, tap "Mark as filed" in the app so you can track it until you're paid. We'll keep watching your companies and email you when a new settlement opens.

{SIGN}
"""

def trial_email(person):
    claims = listed(person)
    return "Your claims to file today", f"""Hi,

Welcome to ClaimRightful. Your free trial is on, so you can file your claims right now. These are the best ones to start with. Each takes about 5 minutes:

{claim_lines(claims)}

After you file, tap "Mark as filed" in the app so you can track it until you're paid.

{SIGN}
"""

def failed_email(person):
    claims = listed(person)
    return "Your ClaimRightful payment didn't go through", f"""Hi,

The $39.99 payment for your ClaimRightful yearly plan didn't go through, so your account is back on the free plan.

If you'd still like to file your claims, you can choose the monthly plan instead: $4.99 a month, cancel anytime. Sign in and pick "Monthly":
{SITE}/app/paywall

These are still open for you:

{claim_lines(claims)}

If you have any questions, just reply to this email. A real person reads every reply.

The ClaimRightful team
"""

RENDER = {"member": member_email, "trial": trial_email, "failed": failed_email}

def people():
    out = subprocess.run(
        ["supabase", "db", "query", "--linked", "-o", "json", "-f", os.path.join(ROOT, "scripts/retention_emails.sql")],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    rows = json.JSONDecoder().raw_decode(out[out.index("{"):])[0]["rows"][0]["people"]
    return json.loads(rows) if isinstance(rows, str) else (rows or [])

def send(to, subject, text):
    key = open(os.path.expanduser("~/Desktop/key resend/resend_key.txt")).read().strip().split("=")[-1].strip()
    payload = {"from": "ClaimRightful <hello@claimrightful.com>", "to": [to], "reply_to": "support@claimrightful.com",
               "subject": subject, "text": text}
    request = urllib.request.Request(
        "https://api.resend.com/emails", data=json.dumps(payload).encode(),
        headers={"authorization": f"Bearer {key}", "content-type": "application/json", "user-agent": "claimrightful-script"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read()).get("id")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", required=True, choices=RENDER)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preview", action="store_true")
    mode.add_argument("--test", action="store_true")
    mode.add_argument("--send", action="store_true")
    parser.add_argument("--save")
    parser.add_argument("--people")
    args = parser.parse_args()

    everyone = json.load(open(args.people)) if args.people else people()
    group = [p for p in everyone if p["group"] == args.group and listed(p)]
    if args.save:
        json.dump(group, open(args.save, "w"))
    if not group:
        print("nobody in", args.group)
        return
    if args.preview:
        for p in group:
            subject, text = RENDER[args.group](p)
            print(f"===== to {p['email'][:3]}… | {subject}\n{text}")
        print(f"{len(group)} {args.group} email(s)")
    elif args.test:
        subject, text = RENDER[args.group](group[0])
        print("test sent", send(OWNER, "[TEST] " + subject, text), "to owner")
    else:
        for p in group:
            subject, text = RENDER[args.group](p)
            print("sent", send(p["email"], subject, text), "to", p["email"][:3] + "…")

main()
