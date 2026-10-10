#!/usr/bin/env python3
"""Draws the App Store product-page "Header" asset: a 3840x1646 banner with the headline on the left,
three phones on the right, and the green ribbon across the full width. Reuses the search-result
drawing (fonts, ribbon, phone frame). Run from mobile/: python3 scripts/store-header.py
Output: store/out/header.png"""

import importlib.util
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location("search", Path(__file__).with_name("store-search-result.py"))
search = importlib.util.module_from_spec(spec)
spec.loader.exec_module(search)

W, H = 3840, 1646
SHOTS = ["04-results.png", "07-dashboard.png", "08-claim.png"]
PHONE_W = 600
GAP = 60
PHONE_TOP = 330


def main() -> None:
    # The shared helpers draw on a canvas of the module's size; point them at this banner instead.
    search.W, search.H = W, H
    search.PHONE_W, search.PHONE_TOP = PHONE_W, PHONE_TOP
    search.BEZEL_PX, search.RADIUS = 20, 96
    search.RIBBON_HALF = 40
    # Low on the left (under the text), rising behind the phones on the right.
    search.ribbon_y = lambda x: 1330 - 260 * math.sin(math.pi * x / W)

    canvas = Image.new("RGBA", (W, H), search.PAPER)
    search.draw_ribbon(canvas)

    draw = ImageDraw.Draw(canvas)
    left = 230
    font = ImageFont.truetype(str(search.DISPLAY), 168)
    draw.text((left, 520), "Money that’s", font=font, fill=search.INK, anchor="ls")
    draw.text((left, 710), "rightfully yours", font=font, fill=search.MONEY, anchor="ls")
    sub = ImageFont.truetype(str(search.BODY), 70)
    draw.text((left, 850), "Find settlements you may qualify for,", font=sub, fill=search.MUTED, anchor="ls")
    draw.text((left, 940), "then file them on the official site.", font=sub, fill=search.MUTED, anchor="ls")

    start = W - 200 - (len(SHOTS) * PHONE_W + (len(SHOTS) - 1) * GAP)
    for i, name in enumerate(SHOTS):
        search.draw_phone(canvas, start + i * (PHONE_W + GAP), name)

    search.OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(search.OUT / "header.png", optimize=True)


if __name__ == "__main__":
    main()
