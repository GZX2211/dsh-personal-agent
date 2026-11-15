# collab/scr/probe3.py
# 精确定位：面板/卡片边界、色块直方图、文本行带、水平文字起止。
import sys
from collections import Counter
from PIL import Image

SRC = r"D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent\collab\img\p3-ref.png"


def load():
    return Image.open(SRC).convert("RGB").load()


def hist(px, x0, y0, x1, y1, top=6):
    c = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            c[px[x, y]] += 1
    total = sum(c.values())
    print(f"[{x0},{y0}]-[{x1},{y1}] total={total}")
    for color, n in c.most_common(top):
        print(f"   {str(color):18s} {n:6d} {n * 100 / total:5.2f}%")


def runs_row(px, y, x0, x1, tol=3):
    runs = []
    start, prev = x0, px[x0, y]
    for x in range(x0 + 1, x1):
        color = px[x, y]
        if max(abs(a - b) for a, b in zip(color, prev)) > tol:
            runs.append((start, x - 1, x - start, prev))
            start, prev = x, color
    runs.append((start, x1 - 1, x1 - start, prev))
    return [r for r in runs if r[2] >= 2]


def runs_col(px, x, y0, y1, tol=3):
    runs = []
    start, prev = y0, px[x, y0]
    for y in range(y0 + 1, y1):
        color = px[x, y]
        if max(abs(a - b) for a, b in zip(color, prev)) > tol:
            runs.append((start, y - 1, y - start, prev))
            start, prev = y, color
    runs.append((start, y1 - 1, y1 - start, prev))
    return [r for r in runs if r[2] >= 2]


def text_rows(px, x0, y0, x1, y1, th=70):
    out, start = [], None
    for y in range(y0, y1):
        lit = any(max(px[x, y]) > th for x in range(x0, x1))
        if lit and start is None:
            start = y
        elif not lit and start is not None:
            out.append((start, y - 1, y - start))
            start = None
    if start is not None:
        out.append((start, y1 - 1, y1 - start))
    return out


def text_cols(px, x0, y0, x1, y1, th=70):
    out, start = [], None
    for x in range(x0, x1):
        lit = any(max(px[x, y]) > th for y in range(y0, y1))
        if lit and start is None:
            start = x
        elif not lit and start is not None:
            out.append((start, x - 1, x - start))
            start = None
    if start is not None:
        out.append((start, x1 - 1, x1 - start))
    return out


def main():
    px = load()
    mode = sys.argv[1]
    nums = list(map(int, sys.argv[2:6]))
    th = int(sys.argv[6]) if len(sys.argv) > 6 else 70
    if mode == "hist":
        hist(px, *nums)
    elif mode == "row":
        for r in runs_row(px, nums[1], nums[0], nums[2]):
            print(f"x {r[0]:4d}..{r[1]:4d} len={r[2]:4d} {r[3]}")
    elif mode == "col":
        for r in runs_col(px, nums[0], nums[1], nums[3]):
            print(f"y {r[0]:4d}..{r[1]:4d} len={r[2]:4d} {r[3]}")
    elif mode == "trows":
        for r in text_rows(px, *nums, th):
            print(f"text y {r[0]:4d}..{r[1]:4d} h={r[2]:3d}")
    elif mode == "tcols":
        for r in text_cols(px, *nums, th):
            print(f"text x {r[0]:4d}..{r[1]:4d} w={r[2]:3d}")


if __name__ == "__main__":
    main()
