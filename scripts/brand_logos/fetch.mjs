// Visits each company's homepage in headless Chrome and saves every icon it declares.
import { chromium } from "playwright-core";
import fs from "node:fs";
const domains = JSON.parse(fs.readFileSync(process.env.DOMAINS || "domains.json", "utf8"));
const only = process.argv.slice(2);
const entries = Object.entries(domains).filter(([n]) => !only.length || only.includes(n));
const slug = (n) => n.toLowerCase().replace(/&/g, "and").replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-blink-features=AutomationControlled"] });
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 800 }, locale: "en-US",
});
const results = {};
async function one([name, domain]) {
  const dir = `out/${slug(name)}`;
  fs.mkdirSync(dir, { recursive: true });
  const page = await context.newPage();
  const cands = [];
  try {
    await page.goto(`https://${domain}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const found = await page.evaluate(async () => {
      const out = [];
      for (const l of document.querySelectorAll("link[rel]")) {
        const rel = l.rel.toLowerCase();
        if (rel.includes("icon") && !rel.includes("mask")) out.push({ url: l.href, rel, sizes: l.getAttribute("sizes") || "", type: l.type || "" });
      }
      const m = document.querySelector('link[rel="manifest"]');
      if (m) {
        try {
          const j = await (await fetch(m.href)).json();
          for (const i of j.icons || []) out.push({ url: new URL(i.src, m.href).href, rel: "manifest", sizes: i.sizes || "", type: i.type || "" });
        } catch {}
      }
      return { out, origin: location.origin };
    });
    cands.push(...found.out, { url: found.origin + "/apple-touch-icon.png", rel: "default-touch" }, { url: found.origin + "/favicon.ico", rel: "default-ico" });
  } catch (e) {
    cands.push({ url: `https://${domain}/apple-touch-icon.png`, rel: "default-touch" }, { url: `https://www.${domain}/apple-touch-icon.png`, rel: "default-touch" });
    results[name] = { error: String(e).slice(0, 120) };
  }
  const seen = new Set();
  const saved = [];
  for (const c of cands) {
    if (seen.has(c.url) || saved.length >= 12 || c.url.startsWith("data:")) continue;
    seen.add(c.url);
    try {
      const r = await context.request.get(c.url, { timeout: 15000 });
      if (!r.ok()) continue;
      const body = await r.body();
      if (body.length < 100) continue;
      const ct = r.headers()["content-type"] || "";
      if (ct.includes("text/html")) continue;
      const ext = ct.includes("svg") || c.url.split("?")[0].endsWith(".svg") ? "svg" : "img";
      const file = `${dir}/${saved.length}.${ext}`;
      fs.writeFileSync(file, body);
      saved.push({ ...c, file });
    } catch {}
  }
  results[name] = { ...(results[name] || {}), domain, saved };
  await page.close();
  process.stdout.write(`${saved.length ? "ok " : "-- "}${name} (${saved.length})\n`);
}
const queue = [...entries];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()); }));
const prev = fs.existsSync("results.json") ? JSON.parse(fs.readFileSync("results.json", "utf8")) : {};
fs.writeFileSync("results.json", JSON.stringify({ ...prev, ...results }, null, 1));
await browser.close();
