# collab/scr/measure.py
# 针对参考图的一次性几何测量：打印指定区域的色块矩形、圆角起点等。
from collections import Counter
from PIL import Image

SRC = r"D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent\collab\img\p3-ref.png"
px = Image.open(SRC).convert("RGB").load()


def hist(x0, y0, x1, y1, top=6):
    c = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            c[px[x, y]] += 1
    print(f"hist [{x0},{y0}]-[{x1},{y1}]: " + ", ".join(f"{k}x{v}" for k, v in c.most_common(top)))


def same_row(y, x0, x1, color, tol=6):
    """该行与 color 相近的连续区间。"""
    runs, start = [], None
    for x in range(x0, x1):
        c = px[x, y]
        if max(abs(a - b) for a, b in zip(c, color)) <= tol:
            if start is None:
                start = x
        elif start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, x1 - 1))
    return runs


def corner(card_color, x_edge, y_edge, dir_x, dir_y, max_depth=40, tol=6):
    """从边缘向内扫描，找每一行（或列）开始出现卡片色的深度，推出圆角半径。"""
    depths = []
    for d in range(max_depth):
        y = y_edge + dir_y * d
        run = same_row(y, min(x_edge, x_edge + dir_x * max_depth), max(x_edge, x_edge + dir_x * max_depth) + 1, card_color, tol)
        if run:
            first = run[0][0] if dir_x > 0 else run[-1][1]
            depths.append((d, abs(first - x_edge)))
    print("corner depths (depth, inset):", depths[:max_depth])


print("== 卡片左上角圆角（卡片色 44,44,46，卡顶 y=309，左缘 x=1077）==")
corner((44, 44, 46), 1077, 309, 1, 1)

print()
print("== 第一个选项行区域直方图 ==")
hist(1080, 405, 1400, 470)

print()
print("== 页码与按钮区域直方图（页脚）==")
hist(1600, 595, 1830, 660)
