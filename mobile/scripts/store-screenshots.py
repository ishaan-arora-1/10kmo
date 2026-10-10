#!/usr/bin/env python3
"""Draws the App Store screenshots: five portrait panels that read as one strip, with a thin green
ribbon running behind the phones (the "CHECKED · MATCHED" line, like the app's check card). Each
panel has a big headline, a phone showing the app (status bar removed), and the key part of that
screen enlarged as a card popping out of the phone. Screens come from store/app/ (simulator
screenshots, 1320x2868). Run from mobile/: python3 scripts/store-screenshots.py
Output: store/out/1.png … 5.png (1206x2622, App Store Connect's required iPhone 6.3" size) and
store/out/preview.png (all side by side)."""

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

W, H = 1290, 2796  # drawing size
OUTPUT_SIZE = (1206, 2622)  # App Store Connect's required iPhone 6.3" size
STATUS_BAR_PX = 200  # height of the iOS status bar in a 1320x2868 screenshot

# (headline lines as [(text, green?)...], subline, screenshot, crop box for the pop-out card in
#  screenshot pixels; the card floats centered over that part of the phone)
PANELS = [
    ([[("Money that’s", False)], [("rightfully ", True), ("yours", True)]],
     "See which settlements may owe you.", "04-results.png", (60, 455, 1258, 1447)),
    ([[("Tap the apps", False)], [("you’ve ", False), ("used", True)]],
     "No quiz. No bank or email logins.", "02-brand-picker.png", (60, 1272, 1258, 1960)),
    ([[("Your claims,", False)], [("ready to ", False), ("file", True)]],
     "Payouts and deadlines up front.", "07-dashboard.png", (60, 1839, 1258, 2345)),
    ([[("Only the", False)], [("official ", True), ("site", False)]],
     "Verified links to each settlement.", "08-claim.png", (60, 560, 1258, 1358)),
    ([[("Not a law firm.", False)], [("No cut", True), (", ever.", False)]],
     "Whatever you’re paid is yours.", "12-paywall.png", (60, 1660, 1258, 2080)),
]

PHONE_W = 860
PHONE_TOP = 700
BEZEL_PX = 24
PHONE_RADIUS = 112
CARD_W = 1080

RIBBON_TEXT = "CHECKED · MATCHED · FILED · PAID · "
RIBBON_HALF = 40


def ribbon_y(x: float) -> float:
    """The ribbon's center line across the whole strip: one long, gentle wave."""
    return 1350 + 420 * math.sin(2 * math.pi * x / (W * 2.1) + 0.9)


def draw_ribbon(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    top, bottom = [], []
    for x in range(-40, canvas.width + 41, 6):
        slope = (ribbon_y(x + 1) - ribbon_y(x - 1)) / 2
        nx, ny = -slope / math.hypot(1, slope), 1 / math.hypot(1, slope)
        y = ribbon_y(x)
        top.append((x - nx * RIBBON_HALF, y - ny * RIBBON_HALF))
        bottom.append((x + nx * RIBBON_HALF, y + ny * RIBBON_HALF))
    draw.polygon(top + bottom[::-1], fill=MONEY)

    # Text along the ribbon, one character at a time, turned to follow the curve.
    font = ImageFont.truetype(str(MONO), 38)
    x, i = 10.0, 0
    while x < canvas.width:
        ch = RIBBON_TEXT[i % len(RIBBON_TEXT)]
        advance = font.getlength(ch) + 6
        slope = (ribbon_y(x + 1) - ribbon_y(x - 1)) / 2
        glyph = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((40, 40), ch, font=font, fill=PAPER, anchor="mm")
        glyph = glyph.rotate(-math.degrees(math.atan(slope)), resample=Image.BICUBIC)
        canvas.alpha_composite(glyph, (round(x + advance / 2 - 40), round(ribbon_y(x + advance / 2) - 40)))
        x += advance / math.cos(math.atan(slope))
        i += 1


def load_screen(name: str) -> Image.Image:
    """The screenshot with its status bar painted over in the app's background color."""
    shot = Image.open(SCREENS / name).convert("RGB")
    background = shot.getpixel((8, STATUS_BAR_PX + 20))
    ImageDraw.Draw(shot).rectangle((0, 0, shot.width, STATUS_BAR_PX), fill=background)
    return shot


def shadow(canvas: Image.Image, box: tuple[float, float, float, float], radius: int, alpha: int, blur: int) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius, fill=(11, 18, 15, alpha))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def draw_phone(canvas: Image.Image, left: int, shot: Image.Image) -> None:
    inner_w = PHONE_W - 2 * BEZEL_PX
    phone_h = round(inner_w * shot.height / shot.width) + 2 * BEZEL_PX
    frame = Image.new("RGBA", (PHONE_W, phone_h), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, PHONE_W - 1, phone_h - 1), PHONE_RADIUS, fill=BEZEL)
    inner = (inner_w, phone_h - 2 * BEZEL_PX)
    mask = Image.new("L", inner, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner[0] - 1, inner[1] - 1), PHONE_RADIUS - BEZEL_PX, fill=255)
    frame.paste(shot.resize(inner, Image.LANCZOS), (BEZEL_PX, BEZEL_PX), mask)
    island_w = 210
    ImageDraw.Draw(frame).rounded_rectangle(
        ((PHONE_W - island_w) / 2, BEZEL_PX + 26, (PHONE_W + island_w) / 2, BEZEL_PX + 88), 34, fill=BEZEL
    )
    shadow(canvas, (left + 10, PHONE_TOP + 30, left + PHONE_W - 10, PHONE_TOP + phone_h), PHONE_RADIUS, 60, 40)
    canvas.alpha_composite(frame, (left, PHONE_TOP))


def draw_card(canvas: Image.Image, center_x: int, shot: Image.Image, crop: tuple[int, int, int, int]) -> None:
    """The key part of the screen, enlarged and floating over the phone where it appears."""
    piece = shot.crop(crop)
    height = round(CARD_W * piece.height / piece.width)
    scale = (PHONE_W - 2 * BEZEL_PX) / shot.width
    middle = PHONE_TOP + BEZEL_PX + (crop[1] + crop[3]) / 2 * scale
    piece = piece.resize((CARD_W, height), Image.LANCZOS)
    pad, radius = 22, 44
    card = Image.new("RGBA", (CARD_W + 2 * pad, height + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius, fill=BEZEL)
    mask = Image.new("L", piece.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, piece.width - 1, piece.height - 1), radius - pad // 2, fill=255)
    card.paste(piece, (pad, pad), mask)
    ImageDraw.Draw(card).rounded_rectangle(
        (1, 1, card.width - 2, card.height - 2), radius, outline=(63, 196, 134, 150), width=4
    )
    left = center_x - card.width // 2
    top = round(middle - card.height / 2)
    shadow(canvas, (left + 20, top + 50, left + card.width - 20, top + card.height + 30), radius, 110, 46)
    canvas.alpha_composite(card, (left, top))


def draw_headline(canvas: Image.Image, offset: int, lines, subline: str) -> None:
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(DISPLAY), 136)
    y = 240
    for line in lines:
        width = sum(font.getlength(text) for text, _ in line)
        x = offset + (W - width) / 2
        for text, green in line:
            draw.text((x, y), text, font=font, fill=MONEY if green else INK, anchor="ls")
            x += font.getlength(text)
        y += 150
    sub = ImageFont.truetype(str(BODY), 58)
    draw.text((offset + W / 2, y + 20), subline, font=sub, fill=MUTED, anchor="ms")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("[0-9].png"):
        old.unlink()
    canvas = Image.new("RGBA", (W * len(PANELS), H), PAPER)
    draw_ribbon(canvas)
    for i, (lines, subline, name, crop) in enumerate(PANELS):
        offset = i * W
        shot = load_screen(name)
        draw_headline(canvas, offset, lines, subline)
        draw_phone(canvas, offset + (W - PHONE_W) // 2, shot)
        draw_card(canvas, offset + W // 2, shot, crop)
    canvas = canvas.convert("RGB")
    for i in range(len(PANELS)):
        panel = canvas.crop((i * W, 0, (i + 1) * W, H)).resize(OUTPUT_SIZE, Image.LANCZOS)
        panel.save(OUT / f"{i + 1}.png", optimize=True)
    preview = canvas.resize((canvas.width // 4, canvas.height // 4), Image.LANCZOS)
    draw = ImageDraw.Draw(preview)
    for i in range(1, len(PANELS)):
        draw.line((i * W // 4, 0, i * W // 4, preview.height), fill="#C9D3CC", width=1)
    preview.save(OUT / "preview.png")


if __name__ == "__main__":
    main()
