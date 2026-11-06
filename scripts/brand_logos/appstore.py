# Looks up each company's official iOS app and saves its 512px icon.
import json, os, re, time, urllib.parse, urllib.request
domains = json.load(open("domains.json"))
# Search terms where the brand name alone finds the wrong app.
TERMS = {"Gmail": "Gmail Email by Google", "Google": "Google app", "Max": "Max: Stream HBO", "X": "X twitter",
         "Apartment rent (RealPage)": "RealPage", "Comcast Xfinity": "Xfinity", "Ring": "Ring Always Home",
         "Flo": "Flo Period Tracker", "Visible": "Visible wireless", "Chase": "Chase Mobile", "Citi": "Citi Mobile",
         "Discover": "Discover Mobile", "Ally": "Ally Mobile", "Cox": "Cox App", "Optimum": "Optimum app",
         "Spectrum": "My Spectrum", "Target": "Target app", "Gap": "Gap app", "Hinge": "Hinge Dating",
         "Steam": "Steam Mobile", "TED": "TED", "Enterprise": "Enterprise Rent-A-Car", "Sony": "Sony | Sound Connect"}
def slug(n): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", n.lower().replace("&", "and").replace("+", "plus")))
out = {}
os.makedirs("appstore", exist_ok=True)
for name in domains:
    q = urllib.parse.urlencode({"term": TERMS.get(name, name), "entity": "software", "country": "us", "limit": 5})
    try:
        data = json.load(urllib.request.urlopen(f"https://itunes.apple.com/search?{q}", timeout=20))["results"]
    except Exception as e:
        print("ERR", name, e); time.sleep(3); continue
    out[name] = [{"track": r["trackName"], "seller": r.get("sellerName", ""), "art": r.get("artworkUrl512") or r.get("artworkUrl100"), "url": r.get("sellerUrl", "")} for r in data]
    time.sleep(1.2)  # stay under the Search API's ~20 requests a minute
json.dump(out, open("appstore.json", "w"), indent=1)
print("done", len(out))
