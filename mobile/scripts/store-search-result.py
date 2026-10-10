#!/usr/bin/env python3
"""Draws the App Store "Search Results" asset: one 3840x2560 landscape image with the headline, three
phones (brand picker, results, dashboard) and the green ribbon behind them, in the same style as the
screenshots. Screens come from store/app/. Run from mobile/: python3 scripts/store-search-result.py
Output: store/out/search-result.png"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "node_modules/@expo-google-fonts"
DISPLAY = FONTS / "bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"
BODY = FONTS / "hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf"
MONO = FONTS / "ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf"
SCREENS = ROOT / "store/app"
OUT = ROOT / "store/out"

PAPER = "#F1F5F0"
INK = "#14201A"
MUTED = "#5B6B62"
MONEY = "#0E7A4B"
BEZEL = "#0B120F"

W, H = 3840, 2560
SHOTS = ["02-brand-picker.png", "04-results.png", "07-dashboard.png"]
PHONE_W = 820
BEZEL_PX = 24
RADIUS = 120
PHONE_TOP = 900
GAP = 150
RIBBON_TEXT = "CHECKED · MATCHED · FILED · PAID · "
RIBBON_HALF = 46


def ribbon_y(x: float) -> float:
    return 1750 + 300 * math.sin(2 * math.pi * x / 2600 + 0.4)


def draw_ribbon(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    top, bottom = [], []
    for x in range(-40, W + 41, 6):
        slope = (ribbon_y(x + 1) - ribbon_y(x - 1)) / 2
        nx, ny = -slope / math.hypot(1, slope), 1 / math.hypot(1, slope)
        y = ribbon_y(x)
        top.append((x - nx * RIBBON_HALF, y - ny * RIBBON_HALF))
        bottom.append((x + nx * RIBBON_HALF, y + ny * RIBBON_HALF))
    draw.polygon(top + bottom[::-1], fill=MONEY)
    font = ImageFont.truetype(str(MONO), 44)
    x, i = 10.0, 0
    while x < W:
        ch = RIBBON_TEXT[i % len(RIBBON_TEXT)]
        advance = font.getlength(ch) + 8
        slope = (ribbon_y(x + 1) - ribbon_y(x - 1)) / 2
        glyph = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((48, 48), ch, font=font, fill=PAPER, anchor="mm")
        glyph = glyph.rotate(-math.degrees(math.atan(slope)), resample=Image.BICUBIC)
        canvas.alpha_composite(glyph, (round(x + advance / 2 - 48), round(ribbon_y(x + advance / 2) - 48)))
        x += advance / math.cos(math.atan(slope))
        i += 1


def draw_phone(canvas: Image.Image, left: int, name: str) -> None:
    inner_w = PHONE_W - 2 * BEZEL_PX
    phone_h = round(inner_w * 2868 / 1320) + 2 * BEZEL_PX
    frame = Image.new("RGBA", (PHONE_W, phone_h), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, PHONE_W - 1, phone_h - 1), RADIUS, fill=BEZEL)
    inner = (inner_w, phone_h - 2 * BEZEL_PX)
    shot = Image.open(SCREENS / name).convert("RGB").resize(inner, Image.LANCZOS)
    mask = Image.new("L", inner, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner[0] - 1, inner[1] - 1), RADIUS - BEZEL_PX, fill=255)
    frame.paste(shot, (BEZEL_PX, BEZEL_PX), mask)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left + 10, PHONE_TOP + 30, left + PHONE_W - 10, PHONE_TOP + phone_h), RADIUS, fill=(11, 18, 15, 70)
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(45)))
    canvas.alpha_composite(frame, (left, PHONE_TOP))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (W, H), PAPER)
    draw_ribbon(canvas)

    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(DISPLAY), 210)
    line = [("Money that’s ", INK), ("rightfully yours", MONEY)]
    width = sum(font.getlength(text) for text, _ in line)
    x = (W - width) / 2
    for text, color in line:
        draw.text((x, 430), text, font=font, fill=color, anchor="ls")
        x += font.getlength(text)
    sub = ImageFont.truetype(str(BODY), 92)
    draw.text((W / 2, 640), "Find the settlements you may qualify for, and file them.", font=sub, fill=MUTED, anchor="ms")

    total = len(SHOTS) * PHONE_W + (len(SHOTS) - 1) * GAP
    start = (W - total) // 2
    for i, name in enumerate(SHOTS):
        draw_phone(canvas, start + i * (PHONE_W + GAP), name)

    canvas.convert("RGB").save(OUT / "search-result.png", optimize=True)


if __name__ == "__main__":
    main()
