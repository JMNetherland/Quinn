"""
Quinn PWA Icon Generator
Generates placeholder icons and splash screens for PWA installation.
Run once: python generate_icons.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

ICONS_DIR = "C:/Dev/personal/web-apps/Quinn/icons"
os.makedirs(ICONS_DIR, exist_ok=True)

ICON_BG    = (26, 16, 53)   # #1a1035
SPLASH_BG  = (13, 13, 26)   # #0d0d1a
TEXT_COLOR = (255, 255, 255)

# Font candidates — tries each in order, falls back to default
FONT_CANDIDATES = [
    "arialbd.ttf",     # Arial Bold (Windows)
    "arial.ttf",       # Arial (Windows)
    "calibrib.ttf",    # Calibri Bold (Windows)
    "calibri.ttf",     # Calibri (Windows)
    "segoeui.ttf",     # Segoe UI (Windows)
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]

def get_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def create_square_icon(px, filename, bg=ICON_BG):
    """Create a square icon with centered Q."""
    img = Image.new("RGBA", (px, px), bg + (255,))
    draw = ImageDraw.Draw(img)

    font_size = int(px * 0.55)
    font = get_font(font_size)

    bbox = draw.textbbox((0, 0), "Q", font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (px - tw) / 2 - bbox[0]
    y = (px - th) / 2 - bbox[1]

    draw.text((x, y), "Q", fill=TEXT_COLOR, font=font)

    out = os.path.join(ICONS_DIR, filename)
    img.save(out, "PNG")
    print(f"  ok {filename} ({px}x{px})")


def create_splash(width, height, filename):
    """Create a splash screen with centered Q."""
    img = Image.new("RGBA", (width, height), SPLASH_BG + (255,))
    draw = ImageDraw.Draw(img)

    font_size = int(min(width, height) * 0.18)
    font = get_font(font_size)

    bbox = draw.textbbox((0, 0), "Q", font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (width  - tw) / 2 - bbox[0]
    y = (height - th) / 2 - bbox[1]

    draw.text((x, y), "Q", fill=TEXT_COLOR, font=font)

    out = os.path.join(ICONS_DIR, filename)
    img.save(out, "PNG")
    print(f"  ok {filename} ({width}x{height})")


print("Generating Quinn PWA icons...")

# Standard icons
for size in [72, 96, 128, 144, 152, 192, 384, 512]:
    create_square_icon(size, f"icon-{size}x{size}.png")

# Apple touch icon
create_square_icon(180, "apple-touch-icon.png")

# iOS splash screens
splashes = [
    (1170, 2532, "splash-1170x2532.png"),  # iPhone 12/13/14 Pro
    (1284, 2778, "splash-1284x2778.png"),  # iPhone 12/13/14 Pro Max
    (750,  1334, "splash-750x1334.png"),   # iPhone SE / 8
]
for w, h, name in splashes:
    create_splash(w, h, name)

print(f"\nDone! {8 + 1 + 3} files written to {ICONS_DIR}")
