# collab/scr/crop.py
# 按给定矩形裁剪并放大参考图，便于逐像素比对样式。
import sys
from PIL import Image

SRC = r"D:\AiCoding-Gzx\HarnessPlugin\dsh-personal-agent\collab\img\p3-ref.png"


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    print("size", src.size)
    # 用法: crop.py out.png x0 y0 x1 y1 [scale]
    out, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
    scale = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
    box = src.crop((x0, y0, x1, y1))
    if scale != 1.0:
        box = box.resize((int(box.width * scale), int(box.height * scale)), Image.LANCZOS)
    box.save(out)
    print("saved", out, box.size)


if __name__ == "__main__":
    main()
