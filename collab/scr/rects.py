# collab/scr/rects.py
# 找出与目标色相近的像素包围盒/分块（用于量 20×20 指示块、按钮、胶囊等）。
from PIL import Image

SRC = r"D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent\collab\img\p3-ref.png"
px = Image.open(SRC).convert("RGB").load()


def near(a, b, tol):
    return max(abs(x - y) for x, y in zip(a, b)) <= tol


def blobs(color, box, tol=8, min_pixels=20):
    x0, y0, x1, y1 = box
    seen = [[False] * (x1 - x0) for _ in range(y1 - y0)]
    out = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if seen[y - y0][x - x0] or not near(px[x, y], color, tol):
                continue
            stack = [(x, y)]
            seen[y - y0][x - x0] = True
            min_x = max_x = x
            min_y = max_y = y
            count = 0
            while stack:
                cx, cy = stack.pop()
                count += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if x0 <= nx < x1 and y0 <= ny < y1 and not seen[ny - y0][nx - x0] and near(px[nx, ny], color, tol):
                        seen[ny - y0][nx - x0] = True
                        stack.append((nx, ny))
            if count >= min_pixels:
                out.append((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1, count))
    out.sort(key=lambda r: (r[1], r[0]))
    return out


def show(title, color, box, tol=8, min_pixels=20):
    print(f"{title}: color={color} box={box}")
    for r in blobs(color, box, tol, min_pixels):
        print(f"   x={r[0]:4d} y={r[1]:4d} w={r[2]:3d} h={r[3]:3d} px={r[4]}")


print("== 数字指示块（bg-overlay 97,102,107）==")
show("badge", (97, 102, 107), (1080, 400, 1200, 560), 10, 30)

print()
print("== 页脚按钮区（找按钮底色）==")
show("btn-fill", (81, 81, 83), (1600, 595, 1830, 660), 10, 40)

print()
print("== 胶囊背景（44,44,46）==")
show("pill", (44, 44, 46), (1070, 150, 1310, 200), 6, 200)

print()
print("== 搜索框底色（35,35,35 / 36,36,36）==")
show("search", (35, 35, 35), (1550, 150, 1790, 200), 6, 200)
