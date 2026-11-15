# collab/scr/probe.py
# 参考图取色与几何测量：像素取样、行亮带、列边界。
import sys
from PIL import Image

SRC = r"D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent\collab\img\p3-ref.png"


def sample(px, points):
    for name, x, y in points:
        print(f"{name:24s} ({x:4d},{y:4d}) = {px[x, y]}")


def row_bands(px, x0, x1, y0, y1, threshold):
    """在区域内逐行统计亮度，输出连续「有字」行段。"""
    bands = []
    start = None
    for y in range(y0, y1):
        lit = 0
        for x in range(x0, x1):
            r, g, b = px[x, y]
            if max(r, g, b) > threshold:
                lit += 1
        if lit > 0 and start is None:
            start = y
        elif lit == 0 and start is not None:
            bands.append((start, y - 1, y - start))
            start = None
    if start is not None:
        bands.append((start, y1 - 1, y1 - start))
    return bands


def col_profile(px, x0, x1, y0, y1):
    """每列的平均颜色，用来找卡片左右边界。"""
    out = []
    for x in range(x0, x1):
        total = [0, 0, 0]
        for y in range(y0, y1):
            r, g, b = px[x, y]
            total[0] += r
            total[1] += g
            total[2] += b
        n = y1 - y0
        out.append((x, tuple(v // n for v in total)))
    return out


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    px = src.load()
    mode = sys.argv[1]
    if mode == "colors":
        sample(px, [
            ("panel-bg", *map(int, sys.argv[2:4])),
            ("probe", *map(int, sys.argv[4:6])),
        ])
    elif mode == "rows":
        x0, x1, y0, y1, th = map(int, sys.argv[2:7])
        for band in row_bands(px, x0, x1, y0, y1, th):
            print("band", band)
    elif mode == "cols":
        x0, x1, y0, y1 = map(int, sys.argv[2:6])
        prev = None
        for x, color in col_profile(px, x0, x1, y0, y1):
            if prev is not None and color != prev:
                print(f"x={x:4d} {prev} -> {color}")
            prev = color
    elif mode == "point":
        for arg in sys.argv[2:]:
            x, y = map(int, arg.split(","))
            print(f"({x},{y}) = {px[x, y]}")


if __name__ == "__main__":
    main()
