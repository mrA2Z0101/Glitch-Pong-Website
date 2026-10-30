import sys, os
from PIL import Image, ImageDraw
# usage: sheet.py out.jpg dir:idx,idx,... [dir:idx...]
out = sys.argv[1]; items = []
for arg in sys.argv[2:]:
    d, idx = arg.split(':')
    for i in idx.split(','): items.append((d, int(i)))
cols = 3; w, h = 640, 360
W = Image.new('RGB', (cols * w, ((len(items) + cols - 1) // cols) * h))
for k, (d, i) in enumerate(items):
    p = os.path.join(d, f'{i:05d}.jpg')
    im = Image.open(p).resize((w, h))
    ImageDraw.Draw(im).text((6, 4), f'{os.path.basename(d)} #{i}', fill=(255, 255, 0))
    W.paste(im, ((k % cols) * w, (k // cols) * h))
W.save(out, quality=82)
