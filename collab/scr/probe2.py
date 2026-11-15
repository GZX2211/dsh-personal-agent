# collab/scr/probe2.py
# 参考图几何与配色测量：区域直方图、扫描线色段、文本行带。
import sys
from collections import Counter
from PIL import Image

SRC = r"D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent\collab\img\p3-ref.png"


def hist(px, box, top=8):
    x0, y0, x1, y1 = box
    counter = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            counter[px[x, y]] += 1
    total = sum(counter.values())
    print(f"region {box} total={total}")
    for color, count in counter.most_common(top):
        print(f"  {color}  {count:6d}  {count * 100 / total:5.2f}%")


def scan(px, box, axis="y"):
    """沿一行/一列输出连续同色段（容差 2）。"""
    x0, y0, x1, y1 = box
    runs = []
    if axis == "y":
        pos, limit, fixed = y0, y1, x0
        get = lambda p: px[fixed, p]
        label = "y"
    else:
        pos, limit, fixed = x0, x1, y0
        get = lambda p: px[p, fixed]
        label = "x"
    start = pos
    prev = get(pos)
    for p in range(pos + 1, limit):
        color = get(p)
        if max(abs(a - b) for a, b in zip(color, prev)) > 2:
            runs.append((start, p - 1, p - start, prev))
            start = p
        prev = color
    runs.append((start, limit - 1, limit - start, prev))
    for run in runs:
        print(f"{label} {run[0]:4d}..{run[1]:4d} len={run[2]:4d} {run[3]}")


def bands(px, box, threshold=90):
    """逐行统计亮像素，找文本行带。"""
    x0, y0, x1, y1 = box
    out = []
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
            out.append((start, y - 1, y - start))
            start = None
    if start is not None:
        out.append((start, y1 - 1, y1 - start))
    for band in out:
        print(f"band y {band[0]:4d}..{band[1]:4d} h={band[2]:3d}")


def main():
    px = Image.open(SRC).convert("RGB").load()
    mode = sys.argv[1]
    box = tuple(map(int, sys.argv[2:6]))
    if mode == "hist":
        hist(px, box, int(sys.argv[6]) if len(sys.argv) > 6 else 8)
    elif mode == "scan":
        scan(px, box, sys.argv[6] if len(sys.argv) > 6 else "y")
    elif mode == "bands":
        bands(px, box, int(sys.argv[6]) if len(sys.argv) > 6 else 90)


if __name__ == "__main__":
    main()
