# Picks one icon per company and writes 128px squares; also draws a review sheet.
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
res = json.load(open("results.json")); picks = json.load(open("appstore_pick.json"))
over = json.load(open("overrides.json")) if os.path.exists("overrides.json") else {}
def slug(n): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", n.lower().replace("&", "and").replace("+", "plus")))
def load(path):
    try:
        im = Image.open(path)
        if getattr(im, "n_frames", 1) > 1 or im.format == "ICO":
            sizes = getattr(im, "info", {}).get("sizes") or (im.ico.sizes() if hasattr(im, "ico") else None)
            if sizes: im.size = max(sizes)  # pick the largest frame of an .ico
        im.load(); return im.convert("RGBA")
    except Exception: return None
def site_best(name):
    best = None
    for s in res.get(name, {}).get("saved", []):
        if s["file"].endswith(".svg"): continue
        im = load(s["file"])
        if not im: continue
        side = min(im.size)
        rank = (side, s["rel"] in ("apple-touch-icon", "apple-touch-icon-precomposed", "default-touch", "manifest"))
        if not best or rank > best[0]: best = (rank, im, s["file"])
    return best
def square(im, pad_bg=None):
    a = im.getchannel("A")
    transparent = sum(1 for v in a.resize((32, 32)).getdata() if v < 200) > 40
    if transparent:
        bbox = a.point(lambda v: 255 if v > 20 else 0).getbbox() or (0, 0, *im.size)
        im = im.crop(bbox)
        side = int(max(im.size) * 1.36)
        bg = Image.new("RGBA", (side, side), pad_bg or (255, 255, 255, 255))
        bg.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
        im = bg
    else:
        im = ImageOps.fit(im, (min(im.size),) * 2)
    return im.convert("RGB").resize((128, 128), Image.LANCZOS)
chosen = {}
for name in res:
    o = over.get(name)
    if o == "none": continue
    s = site_best(name)
    app = f"appstore/{slug(name)}.jpg" if os.path.exists(f"appstore/{slug(name)}.jpg") else None
    if o and o.startswith("file:"): chosen[name] = ("file", square(load(o[5:]))); continue
    if o == "app" and app: chosen[name] = ("app", square(load(app))); continue
    if o == "site-dark" and s: chosen[name] = ("site", square(s[1], (17, 17, 17, 255))); continue
    if o == "site" and s: chosen[name] = ("site", square(s[1])); continue
    if s and s[0][0] >= 120: chosen[name] = ("site", square(s[1]))
    elif app: chosen[name] = ("app", square(load(app)))
    elif s and s[0][0] >= 48: chosen[name] = ("site", square(s[1]))
os.makedirs("final", exist_ok=True)
for f in os.listdir("final"): os.remove(f"final/{f}")
for name, (src, im) in chosen.items(): im.save(f"final/{slug(name)}.webp", "WEBP", quality=88, method=6)
# Review sheet: chosen icon at 40px on the dark app background, with the name.
names = sorted(res, key=str.lower); cols = 8; cw, ch = 150, 74
sheet = Image.new("RGB", (cols * cw, ((len(names) + cols - 1) // cols) * ch), (16, 22, 18))
d = ImageDraw.Draw(sheet); font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
for i, n in enumerate(names):
    x, y = (i % cols) * cw, (i // cols) * ch
    if n in chosen:
        t = chosen[n][1].resize((44, 44), Image.LANCZOS); m = Image.new("L", (44, 44), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, 43, 43), 12, fill=255); sheet.paste(t, (x + 53, y + 6), m)
        tag = chosen[n][0][0]
    else:
        d.rounded_rectangle((x + 53, y + 6, x + 97, y + 50), 12, fill=(90, 40, 40)); tag = "-"
    d.text((x + 75, y + 60), f"{n[:20]} {tag}", fill=(220, 230, 220), font=font, anchor="mm")
sheet.save("sheet.png"); print(len(chosen), "logos;", "missing:", [n for n in names if n not in chosen])
