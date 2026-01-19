import random
from pathlib import Path
from PIL import Image

# Roots to process
ROOTS = [
    Path("assets/tiles"),
    Path("assets/plants"),
]

# Subtle variation ranges (percent)
HUE_SHIFT_RANGE = (-3, 3)        # degrees-ish, scaled
SATURATION_RANGE = (0.98, 1.02)
BRIGHTNESS_RANGE = (0.98, 1.02)

def vary_image(img: Image.Image) -> Image.Image:
    # Convert to RGBA to preserve alpha
    img = img.convert("RGBA")

    # Split alpha
    r, g, b, a = img.split()

    # Convert RGB → HSV
    rgb = Image.merge("RGB", (r, g, b))
    hsv = rgb.convert("HSV")
    h, s, v = hsv.split()

    # Random adjustments
    hue_shift = random.randint(*HUE_SHIFT_RANGE)
    sat_mult = random.uniform(*SATURATION_RANGE)
    val_mult = random.uniform(*BRIGHTNESS_RANGE)

    # Apply hue shift
    h = h.point(lambda p: (p + hue_shift) % 256)

    # Apply saturation and brightness scaling
    s = s.point(lambda p: max(0, min(255, int(p * sat_mult))))
    v = v.point(lambda p: max(0, min(255, int(p * val_mult))))

    # Recombine
    hsv = Image.merge("HSV", (h, s, v))
    rgb = hsv.convert("RGB")
    r, g, b = rgb.split()

    return Image.merge("RGBA", (r, g, b, a))


def should_skip(path: Path) -> bool:
    return any(part in {"characters", "ui"} for part in path.parts)


def main():
    pngs = []
    for root in ROOTS:
        pngs.extend(p for p in root.rglob("*.png") if not should_skip(p))

    print(f"Processing {len(pngs)} PNGs...\n")

    for path in pngs:
        img = Image.open(path)
        varied = vary_image(img)
        varied.save(path)
        print(f"✔ Varied {path}")

    print("\nDone!")


if __name__ == "__main__":
    main()