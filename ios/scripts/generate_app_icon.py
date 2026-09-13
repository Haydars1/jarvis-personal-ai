#!/usr/bin/env python3
import json
import math
import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONSET = ROOT / "JARVIS" / "Assets.xcassets" / "AppIcon.appiconset"

ICONS = [
    ("iphone", "20x20", "2x", 40),
    ("iphone", "20x20", "3x", 60),
    ("iphone", "29x29", "2x", 58),
    ("iphone", "29x29", "3x", 87),
    ("iphone", "40x40", "2x", 80),
    ("iphone", "40x40", "3x", 120),
    ("iphone", "60x60", "2x", 120),
    ("iphone", "60x60", "3x", 180),
    ("ios-marketing", "1024x1024", "1x", 1024),
]

def clamp(v):
    return max(0, min(255, int(round(v))))

def blend(dst, src):
    sr, sg, sb, sa = src
    if sa <= 0:
        return dst
    a = sa / 255.0
    return (
        clamp(src[0] * a + dst[0] * (1 - a)),
        clamp(src[1] * a + dst[1] * (1 - a)),
        clamp(src[2] * a + dst[2] * (1 - a)),
    )

def put(px, x, y, color):
    h = len(px)
    w = len(px[0])
    if 0 <= x < w and 0 <= y < h:
        px[y][x] = blend(px[y][x], color)

def draw_circle(px, cx, cy, r, color, width=None):
    h = len(px)
    w = len(px[0])
    r2 = r * r
    inner = 0 if width is None else max(0, r - width)
    inner2 = inner * inner
    x0, x1 = max(0, int(cx - r - 2)), min(w, int(cx + r + 3))
    y0, y1 = max(0, int(cy - r - 2)), min(h, int(cy + r + 3))
    for y in range(y0, y1):
        for x in range(x0, x1):
            d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2
            if inner2 <= d2 <= r2:
                edge = min(abs(math.sqrt(max(d2, 0.1)) - r), abs(math.sqrt(max(d2, 0.1)) - inner) if width else 99)
                alpha = color[3] if len(color) > 3 else 255
                aa = min(1.0, max(0.0, 1.5 - edge))
                put(px, x, y, (color[0], color[1], color[2], clamp(alpha * aa)))

def draw_round_rect(px, x0, y0, x1, y1, radius, color):
    for y in range(max(0, y0), min(len(px), y1)):
        for x in range(max(0, x0), min(len(px[0]), x1)):
            dx = max(x0 + radius - x, 0, x - (x1 - radius - 1))
            dy = max(y0 + radius - y, 0, y - (y1 - radius - 1))
            if dx * dx + dy * dy <= radius * radius:
                put(px, x, y, color)

def draw_line_round(px, x0, y0, x1, y1, width, color):
    steps = max(1, int(math.hypot(x1 - x0, y1 - y0)))
    r = width / 2
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        draw_circle(px, x, y, r, color)

def write_png(path, pixels):
    h = len(pixels)
    w = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b in row:
            raw.extend((r, g, b))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xffffffff)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)

def render(size):
    px = []
    for y in range(size):
        row = []
        for x in range(size):
            nx = x / max(1, size - 1)
            ny = y / max(1, size - 1)
            glow = max(0, 1 - math.hypot(nx - 0.5, ny - 0.42) * 1.65)
            r = 9 + 18 * ny + 6 * glow
            g = 12 + 22 * ny + 120 * glow
            b = 22 + 38 * ny + 110 * glow
            row.append((clamp(r), clamp(g), clamp(b)))
        px.append(row)

    s = size
    draw_circle(px, s * 0.5, s * 0.5, s * 0.34, (19, 210, 180, 255))
    draw_circle(px, s * 0.5, s * 0.5, s * 0.285, (5, 9, 22, 255))
    draw_circle(px, s * 0.5, s * 0.5, s * 0.34, (92, 231, 255, 255), width=max(2, s * 0.018))
    draw_circle(px, s * 0.5, s * 0.5, s * 0.215, (26, 169, 244, 70))

    bars = [
        (-0.15, 0.15),
        (-0.09, 0.26),
        (-0.03, 0.38),
        (0.03, 0.30),
        (0.09, 0.20),
        (0.15, 0.12),
    ]
    bw = max(3, int(s * 0.035))
    for offset, height in bars:
        x = s * (0.5 + offset)
        y0 = s * (0.5 - height / 2)
        y1 = s * (0.5 + height / 2)
        draw_line_round(px, x, y0, x, y1, bw, (255, 255, 255, 245))

    draw_circle(px, s * 0.5, s * 0.5, s * 0.43, (255, 255, 255, 45), width=max(1, s * 0.006))
    return px

def main():
    ICONSET.mkdir(parents=True, exist_ok=True)
    images = []
    for idiom, point_size, scale, pixels in ICONS:
        filename = f"AppIcon-{pixels}.png"
        write_png(ICONSET / filename, render(pixels))
        images.append({
            "idiom": idiom,
            "size": point_size,
            "scale": scale,
            "filename": filename,
        })

    contents = {
        "images": images,
        "info": {"author": "xcode", "version": 1}
    }
    (ICONSET / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
