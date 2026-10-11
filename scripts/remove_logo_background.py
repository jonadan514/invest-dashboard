from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


def is_background(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    brightness = (red + green + blue) / 3
    chroma = max(pixel) - min(pixel)
    return brightness >= 205 and chroma <= 14


def build_cutout(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGB")
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_background(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for index, removed in enumerate(visited):
        if removed:
            alpha_pixels[index % width, index // width] = 0

    alpha = alpha.filter(ImageFilter.GaussianBlur(0.55))
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha)

    bounds = alpha.getbbox()
    if not bounds:
        raise RuntimeError("No foreground was found")

    padding = 20
    left = max(bounds[0] - padding, 0)
    top = max(bounds[1] - padding, 0)
    right = min(bounds[2] + padding, width)
    bottom = min(bounds[3] + padding, height)
    cutout = rgba.crop((left, top, right, bottom))

    destination.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(destination, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    build_cutout(args.source, args.destination)


if __name__ == "__main__":
    main()
