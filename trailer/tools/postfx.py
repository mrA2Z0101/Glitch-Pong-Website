# Applies per-frame post effects recorded in frames/<scene>/meta.json -> fx/<scene>/
import json, os, sys, shutil
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def apply(im, f, seed):
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    rng = np.random.default_rng(seed)
    z = f.get('zoom', 1)
    if z != 1:
        cx, cy = f.get('cx', 0.5) * w, f.get('cy', 0.5) * h
        cw, ch = w / z, h / z
        x0 = int(min(max(0, cx - cw / 2), w - cw)); y0 = int(min(max(0, cy - ch / 2), h - ch))
        im2 = Image.fromarray(a.astype(np.uint8)).crop((x0, y0, x0 + int(cw), y0 + int(ch))).resize((w, h), Image.LANCZOS)
        a = np.asarray(im2).astype(np.int16)
    sx, sy = int(f.get('x', 0)), int(f.get('y', 0))
    if sx or sy: a = np.roll(a, (sy, sx), axis=(0, 1))
    n = int(f.get('slices', 0))
    for _ in range(n):
        y = rng.integers(0, h - 20); bh = rng.integers(6, 60); dx = int(rng.integers(-60, 60))
        a[y:y + bh] = np.roll(a[y:y + bh], dx, axis=1)
    r = int(f.get('rgb', 0))
    if r:
        a[:, :, 0] = np.roll(a[:, :, 0], r, axis=1)
        a[:, :, 2] = np.roll(a[:, :, 2], -r, axis=1)
    b = f.get('bright', 1)
    if b != 1: a = a * b
    fl = f.get('flash', 0)
    if fl: a = a * (1 - fl) + 255 * fl
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

for scene in sys.argv[1:]:
    src = os.path.join(ROOT, 'frames', scene); dst = os.path.join(ROOT, 'fx', scene)
    shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
    meta = json.load(open(os.path.join(src, 'meta.json')))
    fx = meta.get('fx', {})
    for i in range(meta['frames']):
        name = f'{i:05d}.jpg'
        f = fx.get(str(i))
        if f: apply(Image.open(os.path.join(src, name)).convert('RGB'), f, i).save(os.path.join(dst, name), quality=94)
        else: os.link(os.path.join(src, name), os.path.join(dst, name))
    shutil.copy(os.path.join(src, 'meta.json'), dst)
    print(scene, meta['frames'], 'frames,', len(fx), 'with fx')
