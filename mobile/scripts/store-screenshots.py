#!/usr/bin/env python3
"""Draws the App Store screenshots: three 1290x2796 panels that read as one picture, with a thin
green ribbon running across all three behind the phones (the "CHECKED · MATCHED" line, like the
app's check card). App screenshots come from store/app/ (any iPhone size);
missing ones get a labeled placeholder. Run from mobile/: python3 scripts/store-screenshots.py
Output: store/out/1.png, 2.png, 3.png and store/out/preview.png (all three side by side)."""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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
PANELS = [
    # (headline lines as [(text, green?)...], subline, app screenshot in store/app/)
    ([[("Money that’s", False)], [("rightfully ", True), ("yours", True)]], "Tap the apps you’ve used.", "02-brand-picker.png"),
    ([[("See what you", False)], [("could ", False), ("claim", True)]], "Your matches and payouts, up front.", "04-results.png"),
    ([[("File, track,", False)], [("get ", False), ("paid", True)]], "Every claim in one place.", "07-dashboard.png"),
    ([[("Only the", False)], [("official ", True), ("site", False)]], "Verified links to each settlement.", "08-claim.png"),
    ([[("One plan,", False)], [("every ", False), ("claim", True)]], "Cancel anytime.", "12-paywall.png"),
    ([[("Not a law firm.", False)], [("No cut", True), (", ever.", False)]], "Whatever you’re paid is yours.", "09-browse.png"),
]

PHONE_W = 880
PHONE_TOP = 790
BEZEL_PX = 26
PHONE_RADIUS = 130

RIBBON_TEXT = "CHECKED · MATCHED · FILED · PAID · "
RIBBON_HALF = 40  # half the ribbon's thickness


def ribbon_y(x: float) -> float:
    """The ribbon's center line across the whole 3-panel strip: one long, gentle wave."""
    return 1500 + 330 * math.sin(2 * math.pi * x / (W * 1.9) + 0.6)


def draw_ribbon(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    xs = range(-40, canvas.width + 41, 6)
    top, bottom = [], []
    for x in xs:
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
        angle = -math.degrees(math.atan(slope))
        glyph = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((40, 40), ch, font=font, fill=PAPER, anchor="mm")
        glyph = glyph.rotate(angle, resample=Image.BICUBIC)
        canvas.alpha_composite(glyph, (round(x + advance / 2 - 40), round(ribbon_y(x + advance / 2) - 40)))
        x += advance / math.cos(math.atan(slope))
        i += 1


def screen_image(name: str, size: tuple[int, int], label: str) -> Image.Image:
    path = SCREENS / name
    if path.exists():
        shot = Image.open(path).convert("RGB")
        # Fill the screen width; crop any extra height from the bottom.
        scale = size[0] / shot.width
        shot = shot.resize((size[0], round(shot.height * scale)), Image.LANCZOS)
        return shot.crop((0, 0, size[0], size[1]))
    placeholder = Image.new("RGB", size, "#FFFFFF")
    draw = ImageDraw.Draw(placeholder)
    draw.text((size[0] / 2, size[1] / 2), f"{label}\nscreenshot", font=ImageFont.truetype(str(BODY), 64),
              fill="#B9C6BD", anchor="mm", align="center")
    return placeholder


def draw_phone(canvas: Image.Image, left: int, name: str, label: str) -> None:
    # A real iPhone screen's proportions (1290x2796), so a whole screenshot fits.
    phone_h = round((PHONE_W - 2 * BEZEL_PX) * 2796 / 1290) + 2 * BEZEL_PX
    frame = Image.new("RGBA", (PHONE_W, phone_h), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, PHONE_W - 1, phone_h - 1), PHONE_RADIUS, fill=BEZEL)
    inner = (PHONE_W - 2 * BEZEL_PX, phone_h - 2 * BEZEL_PX)
    shot = screen_image(name, inner, label)
    mask = Image.new("L", inner, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner[0] - 1, inner[1] - 1), PHONE_RADIUS - BEZEL_PX, fill=255)
    frame.paste(shot, (BEZEL_PX, BEZEL_PX), mask)
    # Dynamic Island.
    island_w = 250
    ImageDraw.Draw(frame).rounded_rectangle(
        ((PHONE_W - island_w) / 2, BEZEL_PX + 30, (PHONE_W + island_w) / 2, BEZEL_PX + 102), 40, fill=BEZEL
    )
    # Soft shadow under the phone.
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left + 10, PHONE_TOP + 30, left + PHONE_W - 10, PHONE_TOP + phone_h), PHONE_RADIUS, fill=(11, 18, 15, 60)
    )
    from PIL import ImageFilter

    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(40)))
    canvas.alpha_composite(frame, (left, PHONE_TOP))


def draw_headline(canvas: Image.Image, offset: int, lines, subline: str) -> None:
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(DISPLAY), 128)
    y = 230
    for line in lines:
        width = sum(font.getlength(text) for text, _ in line)
        x = offset + (W - width) / 2
        for text, green in line:
            draw.text((x, y), text, font=font, fill=MONEY if green else INK, anchor="ls")
            x += font.getlength(text)
        y += 140
    sub = ImageFont.truetype(str(BODY), 54)
    draw.text((offset + W / 2, y + 10), subline, font=sub, fill=MUTED, anchor="ms")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (W * len(PANELS), H), PAPER)
    draw_ribbon(canvas)
    for i, (lines, subline, label) in enumerate(PANELS):
        offset = i * W
        draw_headline(canvas, offset, lines, subline)
        draw_phone(canvas, offset + (W - PHONE_W) // 2, label, label)
    canvas = canvas.convert("RGB")
    for i in range(len(PANELS)):
        # Drawn at 1290x2796; saved at the 6.3" size App Store Connect requires (1206x2622).
        canvas.crop((i * W, 0, (i + 1) * W, H)).resize(OUTPUT_SIZE, Image.LANCZOS).save(OUT / f"{i + 1}.png", optimize=True)
    preview = canvas.resize((canvas.width // 4, canvas.height // 4), Image.LANCZOS)
    draw = ImageDraw.Draw(preview)
    for i in range(1, len(PANELS)):
        draw.line((i * W // 4, 0, i * W // 4, preview.height), fill="#C9D3CC", width=1)
    preview.save(OUT / "preview.png")


if __name__ == "__main__":
    main()
