from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ICON_SIZES = [16, 24, 32, 48, 64, 128, 256]


def draw_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Warm background with a soft vignette.
    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=size * 0.22,
        fill=(18, 41, 84, 255),
    )
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (size * 0.08, size * 0.04, size * 0.92, size * 0.74),
        fill=(255, 195, 74, 85),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, size // 28)))
    image.alpha_composite(glow)

    draw = ImageDraw.Draw(image)

    # Ticket panel.
    ticket_box = (
        size * 0.17,
        size * 0.2,
        size * 0.83,
        size * 0.86,
    )
    draw.rounded_rectangle(
        ticket_box,
        radius=size * 0.08,
        fill=(248, 242, 225, 255),
        outline=(225, 180, 83, 255),
        width=max(1, size // 64),
    )

    # Tiny cutouts to suggest a lottery ticket.
    cutout_radius = size * 0.04
    for center_y in (size * 0.34, size * 0.72):
        draw.ellipse(
            (
                ticket_box[0] - cutout_radius,
                center_y - cutout_radius,
                ticket_box[0] + cutout_radius,
                center_y + cutout_radius,
            ),
            fill=(18, 41, 84, 255),
        )
        draw.ellipse(
            (
                ticket_box[2] - cutout_radius,
                center_y - cutout_radius,
                ticket_box[2] + cutout_radius,
                center_y + cutout_radius,
            ),
            fill=(18, 41, 84, 255),
        )

    # Three lotto balls with memorable numbers.
    ball_specs = [
        ((size * 0.31, size * 0.42), size * 0.12, (230, 65, 65), "6"),
        ((size * 0.5, size * 0.34), size * 0.125, (62, 117, 232), "49"),
        ((size * 0.68, size * 0.49), size * 0.12, (255, 189, 61), "7"),
    ]
    for (cx, cy), radius, color, label in ball_specs:
        draw.ellipse(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            fill=color + (255,),
            outline=(255, 255, 255, 245),
            width=max(1, size // 56),
        )
        text_scale = 0.72 if len(label) == 1 else 0.52
        font_box = radius * text_scale
        text_width = font_box * (0.55 if len(label) == 1 else 0.95)
        text_height = font_box
        text_x = cx - text_width / 2
        text_y = cy - text_height / 2 - radius * 0.08
        draw.text(
            (text_x, text_y),
            label,
            fill=(255, 255, 255, 255),
        )

    # Footer bars to hint at chosen numbers on a lotto slip.
    for index in range(4):
        top = size * 0.62 + index * size * 0.055
        draw.rounded_rectangle(
            (size * 0.28, top, size * 0.72, top + size * 0.02),
            radius=size * 0.01,
            fill=(90, 106, 141, 255),
        )

    return image


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    electron_dir = root / "web" / "electron"
    electron_dir.mkdir(parents=True, exist_ok=True)

    largest = draw_icon(512)
    png_path = electron_dir / "icon.png"
    ico_path = electron_dir / "icon.ico"
    largest.save(png_path)

    largest.save(ico_path, format="ICO", sizes=[(size, size) for size in ICON_SIZES])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
