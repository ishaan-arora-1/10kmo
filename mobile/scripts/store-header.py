#!/usr/bin/env python3
"""Draws the App Store product-page "Header" asset: a 3840x1646 banner. iPhone shows only a centered
safe area (about x 1097-2743, y 493-1154, per measurements of Apple's templates), so the headline
sits there; phones and the green ribbon fill the sides, which wider screens show. Reuses the
search-result drawing (fonts, ribbon, phone frame). Run from mobile/: python3 scripts/store-header.py
Output: store/out/header.png"""

import importlib.util
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location("search", Path(__file__).with_name("store-search-result.py"))
search = importlib.util.module_from_spec(spec)
spec.loader.exec_module(search)

W, H = 3840, 1646
SAFE = (1097, 493, 2743, 1154)
LEFT_SHOTS = ["02-brand-picker.png", "04-results.png"]
RIGHT_SHOTS = ["07-dashboard.png", "08-claim.png"]
PHONE_W = 470
GAP = 50


def main() -> None:
    # The shared helpers draw on a canvas of the module's size; point them at this banner instead.
    search.W, search.H = W, H
    search.PHONE_W, search.PHONE_TOP = PHONE_W, 260
    search.BEZEL_PX, search.RADIUS = 16, 74
    search.RIBBON_HALF = 36
    # Low across the middle (under the headline), rising toward both edges behind the phones.
    search.ribbon_y = lambda x: 1330 - 360 * math.cos(math.pi * x / W) ** 2

    canvas = Image.new("RGBA", (W, H), search.PAPER)
    search.draw_ribbon(canvas)

    for i, name in enumerate(LEFT_SHOTS):
        search.draw_phone(canvas, 110 + i * (PHONE_W + GAP), name)
    right_start = W - 110 - len(RIGHT_SHOTS) * PHONE_W - (len(RIGHT_SHOTS) - 1) * GAP
    for i, name in enumerate(RIGHT_SHOTS):
        search.draw_phone(canvas, right_start + i * (PHONE_W + GAP), name)

    # Everything that has to read on iPhone stays inside the safe area.
    draw = ImageDraw.Draw(canvas)
    center = (SAFE[0] + SAFE[2]) / 2
    font = ImageFont.truetype(str(search.DISPLAY), 168)
    draw.text((center, 700), "Money that’s", font=font, fill=search.INK, anchor="ms")
    draw.text((center, 880), "rightfully yours", font=font, fill=search.MONEY, anchor="ms")
    sub = ImageFont.truetype(str(search.BODY), 64)
    draw.text((center, 1010), "Find the settlements that may owe you.", font=sub, fill=search.MUTED, anchor="ms")

    search.OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(search.OUT / "header.png", optimize=True)

    # A guide copy with the iPhone safe area outlined, for checking the crop.
    guide = canvas.convert("RGB")
    ImageDraw.Draw(guide).rectangle(SAFE, outline="#E5484D", width=6)
    guides = search.ROOT / "store/guides"
    guides.mkdir(parents=True, exist_ok=True)
    guide.resize((W // 2, H // 2), Image.LANCZOS).save(guides / "header-safe-area.png")


if __name__ == "__main__":
    main()
