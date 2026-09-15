#!/usr/bin/env python3
"""Generate Rightful's light, dark, and tinted 1024px app icons."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SIZE = 1024
OUTPUT = Path(__file__).parents[1] / "Rightful/Resources/Assets.xcassets/AppIcon.appiconset"
FONT = Path(__file__).parents[1] / "Rightful/Resources/Fonts/HankenGrotesk.ttf"


def icon(background: str, seal: str, ink: str, filename: str) -> None:
    image = Image.new("RGB", (SIZE, SIZE), background)
    draw = ImageDraw.Draw(image)

    # A filed-claim sheet with a clipped corner, held inside Rightful's seal.
    draw.rounded_rectangle((152, 152, 872, 872), radius=176, fill=seal)
    draw.rounded_rectangle((292, 234, 732, 790), radius=70, fill=ink)
    draw.polygon(((616, 234), (732, 350), (616, 350)), fill=seal)

    font = ImageFont.truetype(FONT, 310)
    draw.text((345, 280), "R", font=font, fill=seal, stroke_width=2)

    # The rising check conveys a completed claim and payout.
    draw.line((444, 660, 520, 726), fill=seal, width=40)
    draw.line((520, 726, 660, 552), fill=seal, width=40)

    image.save(OUTPUT / filename, format="PNG", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    icon("#F4F0E6", "#176B4D", "#FFFFFF", "Rightful-AppIcon-1024.png")
    icon("#111712", "#42B883", "#F7FAF7", "Rightful-AppIcon-Dark-1024.png")
    icon("#FFFFFF", "#1A1A1A", "#FFFFFF", "Rightful-AppIcon-Tinted-1024.png")


if __name__ == "__main__":
    main()
