# Soundtrack for one vertical short: music bed + game SFX at their logged frames + accents.
# Usage: python3 mix_short.py <scene> [teaser]  -> out/shorts/<name>.wav and <name>.json (frame segments)
import json, os, sys, wave
import numpy as np
from audiolib import load, SR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
scene = sys.argv[1]
variant = sys.argv[2] if len(sys.argv) > 2 else None
meta = json.load(open(os.path.join(ROOT, 'fx', scene, 'meta.json')))
M = meta['marks']
N = meta['frames']

SFX = {
    'paddleHit': 'sounds/sfx/Paddle Hit Sound.mp3', 'wallBounce': 'sounds/sfx/Wall Bounce Sound.mp3',
    'score': 'sounds/sfx/Score Sound.mp3', 'gameStart': 'sounds/sfx/Game Start.mp3', 'glitchPulse': 'sounds/sfx/Glitch Pulse.mp3',
    'dashActivation': 'sounds/sfx/Dash Activation.mp3', 'dashReady': 'sounds/sfx/Dash Cooldown Ready.mp3',
    'teleport': 'sounds/sfx/Teleport Sound.mp3', 'juke': 'sounds/sfx/Juke Sound.mp3',
    'critical': 'sounds/sfx/Critical Moment (high heat + long rally).mp3', 'introVoice': 'sounds/sfx/GLITCH PONG.mp3',
    'countdown3': 'sounds/sfx/3.mp3', 'countdown2': 'sounds/sfx/2.mp3', 'countdown1': 'sounds/sfx/1.mp3', 'countdownGo': 'sounds/sfx/GO.mp3',
}

# Per-short music bed and accents. Marks are capture-frame indices recorded by shorts.js.
CFG = {
    'v_tired':     dict(music=[('sounds/music/in_game_music2.mp3', 109.5, 0, None)], duck=[('drowsy', 'punch', 0.08)]),
    'v_grudge':    dict(music=[('sounds/music/matrix_music5.mp3', 42.5, 0, None)], accents=[('teleport', 'serve', 0.3, 0.85)]),
    'v_sides':     dict(music=[('sounds/music/in_game_music4.mp3', 103.25, 0, None)]),
    'v_juke':      dict(music=[('sounds/music/in_game_music1.mp3', 93.25, 0, None)], duck=[('freeze', ('freeze', 18), 0.2)],
                        accents=[('glitchPulse', 'freeze', 0.35, 0.85)]),
    'v_walls':     dict(music=[('sounds/music/in_game_music3.mp3', 110.5, 0, None)], accents=[('critical', 'shatter', 0.25, 1.0)]),
    'v_blackhole': dict(music=[('sounds/music/blackhole_nebula4.mp3', 49.0, 0, None)]),
    'v_boss':      dict(music=[('sounds/music/matrix_music2.mp3', 156.75, 0, 'trigger'), ('sounds/music/blackhole_nebula5.mp3', 75.5, 'alarm', None)],
                        accents=[('glitchPulse', ('trigger', 80), 0.3, 0.9), ('teleport', 'stare', 0.4, 0.8), ('glitchPulse', 'alarm', 0.4, 0.8)]),
    'v_real':      dict(music=[('sounds/music/in_game_music2.mp3', 125.0, 0, None)], duck=[('freeze', 'freezeEnd', 0.25)],
                        accents=[('glitchPulse', 'freeze', 0.35, 0.9), ('glitchPulse', 'freezeEnd', 0.3, 1.0)]),
}[scene]

def mark(m):
    if isinstance(m, tuple): return M[m[0]] + m[1]
    if isinstance(m, str): return M[m]
    return m

# Output segments (capture frame ranges). The teaser ends on the freeze, then its own end card.
if scene == 'v_real' and variant == 'teaser':
    segments, end_card, name = [(0, M['freezeEnd']), (M['teaserEnd'], N)], M['freezeEnd'], 'v_real_teaser'
elif scene == 'v_real':
    segments, end_card, name = [(0, M['endEnd'])], M['end'], 'v_real'
else:
    segments, end_card, name = [(0, N)], M['end'], scene

# Skip the first frames where the title card is still glitching in, so frame 1 (the cover) reads cleanly.
segments[0] = (segments[0][0] + 3, segments[0][1])

def out_t(f):
    """Capture frame -> output seconds (None if the frame is cut)."""
    off = 0
    for a, b in segments:
        if a <= f < b: return (off + f - a) / FPS
        off += b - a
    return None

TOTAL = sum(b - a for a, b in segments)
buf = np.zeros((int(TOTAL / FPS * SR) + SR, 2), np.float32)

def place(a, at, gain=1.0, rate=1.0, fade_in=0.0, fade_out=0.0):
    if at is None: return
    if rate != 1.0:
        idx = np.arange(0, len(a) - 1, rate)
        a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in (0, 1)], axis=1).astype(np.float32)
    a = a * gain
    if fade_in: n = min(len(a), int(fade_in * SR)); a[:n] *= np.linspace(0, 1, n)[:, None]
    if fade_out: n = min(len(a), int(fade_out * SR)); a[-n:] *= np.linspace(1, 0, n)[:, None]
    i = int(at * SR); end = min(len(buf), i + len(a))
    if end > i: buf[i:end] += a[:end - i]

# Game SFX at their logged frames.
seen = set()
for e in meta['sfx']:
    k = (e['key'], e['out'])
    if k in seen or e['key'] not in SFX: continue
    seen.add(k)
    place(load(SFX[e['key']]), out_t(e['out']), e['volume'] * 1.5, e.get('playbackRate', 1))

# Accents: hook glitch-in, per-short cues, end-card voice.
place(load(SFX['glitchPulse']), 0.0, 0.3)
for key, m, gain, rate in CFG.get('accents', []):
    place(load(SFX[key]), out_t(mark(m)), gain * 1.5, rate)
ec = out_t(end_card) if variant != 'teaser' else (M['freezeEnd'] / FPS)
place(load(SFX['glitchPulse']), ec, 0.45)
place(load(SFX['introVoice']), ec + 0.08, 1.2)

# Music. Each bed runs in output time; the end card keeps the music at a lower level.
for rel, src, m0, m1 in CFG['music']:
    t0 = 0.0 if m0 == 0 else out_t(mark(m0))
    t1 = TOTAL / FPS if m1 is None else out_t(mark(m1))
    if t0 is None or t1 is None or t1 <= t0: continue
    a = load(rel)[int(src * SR): int((src + t1 - t0) * SR)].copy()
    env = np.ones(len(a), np.float32)
    def ramp(ta, tb, lv):
        i0, i1, r = int((ta - t0) * SR), int((tb - t0) * SR), int(0.12 * SR)
        i0, i1 = max(0, i0), max(0, min(len(env), i1))
        env[i0:i1] = np.minimum(env[i0:i1], lv)
        if i0 > 0: env[max(0, i0 - r):i0] = np.minimum(env[max(0, i0 - r):i0], np.linspace(1, lv, i0 - max(0, i0 - r)))
        if i1 < len(env): env[i1:i1 + r] = np.minimum(env[i1:i1 + r], np.linspace(lv, 1, len(env[i1:i1 + r])))
    for d0, d1, lv in CFG.get('duck', []):
        ta, tb = out_t(mark(d0)), out_t(mark(d1))
        if ta is not None and tb is not None: ramp(ta, tb, lv)
    if ec is not None and ec < t1: ramp(ec, t1 + 1, 0.5)
    a *= env[:, None]
    place(a, t0, 0.62, fade_in=0.01, fade_out=0.25 if m1 is None else 0.02)

out = buf[:int(TOTAL / FPS * SR)]
peak = float(np.abs(out).max())
out = out * (0.95 / max(0.95, peak))
os.makedirs(os.path.join(ROOT, 'out', 'shorts'), exist_ok=True)
with wave.open(os.path.join(ROOT, 'out', 'shorts', name + '.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
json.dump({'scene': scene, 'segments': segments, 'frames': TOTAL}, open(os.path.join(ROOT, 'out', 'shorts', name + '.json'), 'w'))
print(name, 'frames', TOTAL, 'seconds', round(TOTAL / FPS, 1), 'peak', round(peak, 2))
