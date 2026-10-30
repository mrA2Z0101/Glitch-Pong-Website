# Portrait contact sheet: vsheet.py out.jpg dir:idx,idx,... (6 per row)
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]; items = []
for arg in sys.argv[2:]:
    d, idx = arg.split(':')
    for i in idx.split(','): items.append((d, int(i)))
cols, w, h = 6, 300, 533
W = Image.new('RGB', (cols * w, ((len(items) + cols - 1) // cols) * h))
for k, (d, i) in enumerate(items):
    im = Image.open(os.path.join(d, f'{i:05d}.jpg')).resize((w, h))
    ImageDraw.Draw(im).text((6, 4), f'{os.path.basename(d)} #{i}', fill=(255, 255, 0))
    W.paste(im, ((k % cols) * w, (k // cols) * h))
W.save(out, quality=80)
