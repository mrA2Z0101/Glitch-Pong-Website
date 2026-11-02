# Soundtrack for the "Normal Pong vs Glitch Pong" short: both courts' game sounds (the calm one
# quieter), music bed that cuts on the freeze and drops on the red alarm, end-card voice.
# Writes out/shorts/v_versus.wav + .json for render_short.sh.
import json, os, wave
import numpy as np
from audiolib import load, SR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
comp = json.load(open(os.path.join(ROOT, 'vframes', 'v_versus', 'meta.json')))
N, M = comp['frames'], comp['marks']
SFX = {k: f'sounds/sfx/{v}.mp3' for k, v in {
    'paddleHit': 'Paddle Hit Sound', 'wallBounce': 'Wall Bounce Sound', 'score': 'Score Sound', 'glitchPulse': 'Glitch Pulse',
    'dashActivation': 'Dash Activation', 'dashReady': 'Dash Cooldown Ready', 'teleport': 'Teleport Sound', 'juke': 'Juke Sound',
    'critical': 'Critical Moment (high heat + long rally)', 'introVoice': 'GLITCH PONG'}.items()}
buf = np.zeros((int(N / FPS * SR) + SR, 2), np.float32)

def place(a, at, gain=1.0, rate=1.0, fade_in=0.0, fade_out=0.0):
    if rate != 1.0:
        idx = np.arange(0, len(a) - 1, rate)
        a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in (0, 1)], axis=1).astype(np.float32)
    a = a * gain
    if fade_in: k = min(len(a), int(fade_in * SR)); a[:k] *= np.linspace(0, 1, k)[:, None]
    if fade_out: k = min(len(a), int(fade_out * SR)); a[-k:] *= np.linspace(1, 0, k)[:, None]
    i = int(at * SR); e = min(len(buf), i + len(a))
    if e > i: buf[i:e] += a[:e - i]

def blip(freq, dur):
    # Plain square-wave beep with a short decay, like an old arcade cabinet.
    t = np.arange(int(dur * SR)) / SR
    w = np.sign(np.sin(2 * np.pi * freq * t)) * np.exp(-t * 6)
    w[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return np.stack([w, w], axis=1).astype(np.float32)

# The old-school court gets simple blips instead of the game's neon sound effects.
BLIPS = {'paddleHit': blip(480, 0.07), 'wallBounce': blip(240, 0.06), 'score': blip(150, 0.32)}
seen = set()
for e in json.load(open(os.path.join(ROOT, 'fx', 'vs_top', 'meta.json')))['sfx']:
    if e['key'] in BLIPS and (e['key'], e['out']) not in seen and e['out'] < N:
        seen.add((e['key'], e['out']))
        place(BLIPS[e['key']], e['out'] / FPS, 0.16)

# Glitch Pong's court keeps its real game sounds. (Countdown/serve sounds are skipped
# because the capture jumps straight past the 3-2-1.)
for clip, gain in [('vs_bottom', 1.0)]:
    seen = set()
    for e in json.load(open(os.path.join(ROOT, 'fx', clip, 'meta.json')))['sfx']:
        if e['key'] not in SFX or (e['key'], e['out']) in seen or e['out'] >= N: continue
        seen.add((e['key'], e['out']))
        place(load(SFX[e['key']]), e['out'] / FPS, e['volume'] * 1.5 * gain, e.get('playbackRate', 1))

def sfx(key, frame, gain, rate=1.0): place(load(SFX[key]), frame / FPS, gain * 1.5, rate)

trig, cap, end = M['trigger'], M['caption'], M['end']
music = load('sounds/music/in_game_music2.mp3')
place(music[int(109.5 * SR): int((109.5 + trig / FPS) * SR)], 0, 0.6, fade_in=0.01, fade_out=0.03)   # cuts dead on the freeze
neb = load('sounds/music/blackhole_nebula5.mp3')
bed = neb[int(75.5 * SR): int((75.5 + (N - cap) / FPS) * SR)].copy()
env = np.ones(len(bed), np.float32)
i0 = int((end - cap) / FPS * SR)
env[i0:] = 0.5
env[max(0, i0 - int(0.12 * SR)):i0] = np.linspace(1, 0.5, i0 - max(0, i0 - int(0.12 * SR)))
place(bed * env[:, None], cap / FPS, 0.62, fade_in=0.01, fade_out=0.4)                               # drop on the red alarm

sfx('glitchPulse', 0, 0.3)
sfx('glitchPulse', trig, 0.5)
sfx('teleport', trig + 26, 0.3, 0.85)
sfx('glitchPulse', cap, 0.35)
sfx('glitchPulse', end, 0.45)
place(load(SFX['introVoice']), (end + 2) / FPS + 0.08, 1.2)

out = buf[:int(N / FPS * SR)]
out = out * (0.95 / max(0.95, float(np.abs(out).max())))
os.makedirs(os.path.join(ROOT, 'out', 'shorts'), exist_ok=True)
with wave.open(os.path.join(ROOT, 'out', 'shorts', 'v_versus.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
json.dump({'scene': 'v_versus', 'segments': [[0, N]], 'frames': N}, open(os.path.join(ROOT, 'out', 'shorts', 'v_versus.json'), 'w'))
print('v_versus frames', N, 'seconds', round(N / FPS, 1))
