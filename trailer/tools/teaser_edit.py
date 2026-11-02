# Assembles the teaser from the tz_* clips (see teaser.js): edit list -> frame sequence + soundtrack,
# then encodes out/glitch-pong-teaser.mp4 (1920x1080, 30 fps, -14 LUFS).
import json, os, shutil, subprocess, wave
import numpy as np
from audiolib import load, rms_profile, SR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
meta = {s: json.load(open(os.path.join(ROOT, 'fx', s, 'meta.json'))) for s in ['tz_bh', 'tz_matrix', 'tz_calm', 'tz_heat', 'tz_boss', 'tz_eye']}
BM = meta['tz_boss']['marks']
ALARM, THROW, END = BM['alarm'], BM['throw'], BM['end']
HN = meta['tz_heat']['frames']

# ── Edit list: (clip, start, end, step) ──────────────────────────────────────
edl, marks = [], {}
def add(name, a, b, step=1): edl.append((name, a, b, step))
def here(): return sum(len(range(a, b, st)) for _, a, b, st in edl)

add('tz_calm', 0, 150)                                    # A: "Just a game."
marks['B'] = here()
inserts = [(18, 'tz_bh', 2, 5), (38, 'tz_boss', ALARM + 6, ALARM + 9), (56, 'tz_matrix', 3, 5), (72, 'tz_eye', 48, 51),
           (86, 'tz_boss', THROW + 24, THROW + 26), (98, 'tz_bh', 7, 9), (108, 'tz_boss', ALARM + 40, ALARM + 42)]
cursor, marks['inserts'] = 150, []
for off, clip, a, b in inserts:                           # B: single-frame flashes cut into the dark rally
    add('tz_calm', cursor, 150 + off)
    marks['inserts'].append((here(), clip))
    add(clip, a, b)
    cursor = 150 + off + (b - a)
add('tz_calm', cursor, 270)
marks['C'] = here()
add('tz_heat', 0, HN - 20, 2)                             # C: the Heat build, double speed...
add('tz_heat', HN - 20, HN)                               # ...landing at normal speed on the freeze
marks['D'] = here()
add('tz_boss', 0, 120)                                    # D: freeze, angry bubble, glitch (half speed)
marks['E'] = here()
add('tz_eye', 0, 120)                                     # E: the Eye opens
marks['F'] = here()
add('tz_boss', ALARM, ALARM + 36)                         # F: red alarm...
add('tz_boss', THROW, THROW + 30)                         # ...orbital shots
marks['G'] = here()
add('tz_boss', END, END + 100)                            # G: logo + itch.io
TOTAL = here()

# ── Frame sequence ───────────────────────────────────────────────────────────
seq = os.path.join(ROOT, 'seq_teaser')
shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
n = 0
for clip, a, b, st in edl:
    for f in range(a, b, st):
        os.symlink(os.path.join(ROOT, 'fx', clip, f'{f:05d}.jpg'), os.path.join(seq, f'{n:05d}.jpg')); n += 1

# ── Soundtrack ───────────────────────────────────────────────────────────────
SFX = {k: f'sounds/sfx/{v}.mp3' for k, v in {
    'paddleHit': 'Paddle Hit Sound', 'wallBounce': 'Wall Bounce Sound', 'score': 'Score Sound', 'glitchPulse': 'Glitch Pulse',
    'dashActivation': 'Dash Activation', 'teleport': 'Teleport Sound', 'juke': 'Juke Sound',
    'critical': 'Critical Moment (high heat + long rally)', 'introVoice': 'GLITCH PONG', 'gameStart': 'Game Start'}.items()}
buf = np.zeros((int(TOTAL / FPS * SR) + SR, 2), np.float32)

def place(a, at, gain=1.0, rate=1.0, fade_in=0.0, fade_out=0.0):
    if rate != 1.0:
        idx = np.arange(0, len(a) - 1, rate)
        a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in (0, 1)], axis=1).astype(np.float32)
    a = a * gain
    if fade_in: k = min(len(a), int(fade_in * SR)); a[:k] *= np.linspace(0, 1, k)[:, None]
    if fade_out: k = min(len(a), int(fade_out * SR)); a[-k:] *= np.linspace(1, 0, k)[:, None]
    i = int(at * SR); e = min(len(buf), i + len(a))
    if e > i: buf[i:e] += a[:e - i]

def sfx(key, frame, gain, rate=1.0): place(load(SFX[key]), frame / FPS, gain * 1.5, rate)

# Game sounds where they fired (not under the Eye card or the logo).
off, seen = 0, set()
for clip, a, b, st in edl:
    for e in meta[clip]['sfx']:
        if clip == 'tz_eye' or (clip == 'tz_boss' and e['out'] >= END) or not (a <= e['out'] < b) or e['key'] not in SFX: continue
        t = off + (e['out'] - a) // st
        if (e['key'], t) in seen: continue
        seen.add((e['key'], t))
        place(load(SFX[e['key']]), t / FPS, e['volume'] * 1.5, e.get('playbackRate', 1))
    off += len(range(a, b, st))

# Ambience under the dark opening: the quietest (but not silent) 9s of a nebula track.
amb = load('sounds/music/blackhole_nebula1.mp3')
r = rms_profile(amb, 0.5); w = int(marks['C'] / FPS / 0.5)
cs = np.convolve(r, np.ones(w) / w, 'valid'); cs[cs < 0.03] = 9
s0 = int(cs.argmin()) * 0.5
place(amb[int(s0 * SR): int((s0 + marks['C'] / FPS) * SR)], 0, 0.45, fade_in=1.5, fade_out=0.4)
for k, (frame, clip) in enumerate(marks['inserts']):
    sfx('glitchPulse', frame, 0.35, 1.0 if k % 2 == 0 else 0.88)
    if clip == 'tz_boss': sfx('teleport', frame, 0.18, 0.9)

# The build: the bars leading into blackhole_nebula5's drop, cut dead on the freeze.
drop = 75.5
cdur = (marks['D'] - marks['C']) / FPS
neb = load('sounds/music/blackhole_nebula5.mp3')
place(neb[int((drop - cdur) * SR): int(drop * SR)], marks['C'] / FPS, 0.62, fade_in=0.6, fade_out=0.02)
sfx('glitchPulse', marks['D'], 0.5)
sfx('glitchPulse', marks['D'] + 80, 0.35, 0.9)
sfx('teleport', marks['E'] + 2, 0.3, 0.6)                 # the Eye opening
sfx('glitchPulse', marks['E'] + 72, 0.25, 0.85)
# The drop lands on the red alarm and carries through the logo.
place(neb[int(drop * SR): int((drop + (TOTAL - marks['F']) / FPS) * SR)], marks['F'] / FPS, 0.62, fade_in=0.01, fade_out=1.0)
sfx('critical', marks['F'], 0.4)
sfx('glitchPulse', marks['G'], 0.45)
place(load(SFX['introVoice']), (marks['G'] + 6) / FPS, 1.1)
sfx('glitchPulse', marks['G'] + 94, 0.35)

out = buf[:int(TOTAL / FPS * SR)]
out = out * (0.95 / max(0.95, float(np.abs(out).max())))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
wav = os.path.join(ROOT, 'out', 'teaser_mix.wav')
with wave.open(wav, 'wb') as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())

# ── Encode ───────────────────────────────────────────────────────────────────
meas = subprocess.run(['ffmpeg', '-v', 'info', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = float([l for l in meas.splitlines() if l.strip().startswith('I:')][-1].split()[1])
mp4 = os.path.join(ROOT, 'out', 'glitch-pong-teaser.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(seq, '%05d.jpg'), '-i', wav,
                '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
                '-profile:v', 'high', '-movflags', '+faststart',
                '-af', f'volume={-14.0 - I:.2f}dB,alimiter=limit=0.89:attack=2:release=60:level=disabled',
                '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', mp4], check=True)
shutil.rmtree(seq)
print('teaser', TOTAL, 'frames', round(TOTAL / FPS, 2), 's  marks', {k: v for k, v in marks.items() if k != 'inserts'}, ' ->', mp4)
