#!/usr/bin/env python3
"""Draws ClaimRightful's app icons and splash images. The app icon is a big "R" on its own (like
Google's "G"); the splash keeps the dashed seal with an "R", the mark the website uses as its favicon. Run from mobile/: python3 scripts/generate-icons.py"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"

PAPER = "#F1F5F0"
PAPER_DARK = "#0B120F"
MONEY = "#0E7A4B"
MONEY_DARK = "#3FC486"
SCALE = 4  # draw large, then downsample for smooth edges


def seal(size: int, diameter: float, background, color: str) -> Image.Image:
    big = size * SCALE
    image = Image.new("RGBA", (big, big), background)
    draw = ImageDraw.Draw(image)
    radius = diameter * SCALE / 2
    stroke = diameter * SCALE * 3 / 58  # favicon: 3px stroke on a 58px circle
    center = big / 2

    # Dashes of 5 and gaps of 4 along a 29-radius circle, like the favicon.
    circumference = 2 * math.pi * 29
    dash = 5 / circumference * 360
    gap = 4 / circumference * 360
    box = (center - radius, center - radius, center + radius, center + radius)
    angle = -90.0
    while angle < 270 - 0.01:
        draw.arc(box, angle, min(angle + dash, 270), fill=color, width=round(stroke))
        angle += dash + gap

    font = ImageFont.truetype(str(FONT), round(diameter * SCALE * 0.5))
    draw.text((center, center + diameter * SCALE * 0.02), "R", font=font, fill=color, anchor="mm")
    return image.resize((size, size), Image.LANCZOS)


def letter(size: int, height: float, background, color: str) -> Image.Image:
    """Just the "R", its capital height `height` px, centered on its actual outline."""
    big = size * SCALE
    image = Image.new("RGBA", (big, big), background)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT), 100)
    left, top, right, bottom = draw.textbbox((0, 0), "R", font=font)
    font = ImageFont.truetype(str(FONT), round(100 * height * SCALE / (bottom - top)))
    left, top, right, bottom = draw.textbbox((0, 0), "R", font=font)
    draw.text(((big - (right - left)) / 2 - left, (big - (bottom - top)) / 2 - top), "R", font=font, fill=color)
    return image.resize((size, size), Image.LANCZOS)


def save(image: Image.Image, name: str, flatten: str | None = None) -> None:
    if flatten:
        base = Image.new("RGB", image.size, flatten)
        base.paste(image, mask=image.split()[3])
        image = base
    image.save(ASSETS / name, format="PNG", optimize=True)


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    # iOS icon: full-bleed paper, a big "R" centered.
    save(letter(1024, 620, PAPER, MONEY), "icon.png", flatten=PAPER)
    # Android adaptive icon: the system crops to the middle ~66%, so the "R" stays inside it.
    save(letter(1024, 420, (0, 0, 0, 0), MONEY), "android-icon-foreground.png")
    save(Image.new("RGBA", (1024, 1024), PAPER), "android-icon-background.png")
    save(letter(1024, 420, (0, 0, 0, 0), "#000000"), "android-icon-monochrome.png")
    # Splash: just the seal; the splash plugin supplies the background color.
    save(seal(512, 440, (0, 0, 0, 0), MONEY), "splash-icon.png")
    save(seal(512, 440, (0, 0, 0, 0), MONEY_DARK), "splash-icon-dark.png")
    save(seal(64, 58, PAPER, MONEY), "favicon.png", flatten=PAPER)


if __name__ == "__main__":
    main()
