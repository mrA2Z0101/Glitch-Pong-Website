# Builds the trailer soundtrack: music bed per section + game SFX at the frames they fired.
import json, os, wave
import numpy as np
from audiolib import load, SR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
SCENES = ['s01_cold_open', 's02_glitch', 's03_countdown', 's04_moves', 's05_powerups', 's06_heat', 's07_sentient',
          's08_arenas', 's09_modes', 's10_boss', 's11_clutch', 's12_endcard', 's13_stinger']
meta = {s: json.load(open(os.path.join(ROOT, 'fx', s, 'meta.json'))) for s in SCENES}
start, t = {}, 0
for s in SCENES:
    start[s] = t
    t += meta[s]['frames']
TOTAL = t
T = lambda s, f: (start[s] + f) / FPS          # scene frame -> seconds
mixbuf = np.zeros((int(TOTAL / FPS * SR) + SR, 2), np.float32)

SFX = {
    'paddleHit': 'sounds/sfx/Paddle Hit Sound.mp3', 'wallBounce': 'sounds/sfx/Wall Bounce Sound.mp3',
    'score': 'sounds/sfx/Score Sound.mp3', 'gameStart': 'sounds/sfx/Game Start.mp3', 'glitchPulse': 'sounds/sfx/Glitch Pulse.mp3',
    'dashActivation': 'sounds/sfx/Dash Activation.mp3', 'dashReady': 'sounds/sfx/Dash Cooldown Ready.mp3',
    'teleport': 'sounds/sfx/Teleport Sound.mp3', 'juke': 'sounds/sfx/Juke Sound.mp3',
    'critical': 'sounds/sfx/Critical Moment (high heat + long rally).mp3', 'countdown3': 'sounds/sfx/3.mp3',
    'countdown2': 'sounds/sfx/2.mp3', 'countdown1': 'sounds/sfx/1.mp3', 'countdownGo': 'sounds/sfx/GO.mp3',
    'introVoice': 'sounds/sfx/GLITCH PONG.mp3', 'nearMiss': 'sounds/sfx/Near Miss Sound.mp3', 'gameOver': 'sounds/sfx/Game Over.mp3',
}

def place(a, at, gain=1.0, rate=1.0, fade_in=0.0, fade_out=0.0):
    if rate != 1.0:  # resample (pitch + speed), like HTMLAudio playbackRate without preservesPitch
        idx = np.arange(0, len(a) - 1, rate)
        a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in (0, 1)], axis=1).astype(np.float32)
    a = a * gain
    if fade_in: n = min(len(a), int(fade_in * SR)); a[:n] *= np.linspace(0, 1, n)[:, None]
    if fade_out: n = min(len(a), int(fade_out * SR)); a[-n:] *= np.linspace(1, 0, n)[:, None]
    i = int(at * SR)
    if i < 0: a = a[-i:]; i = 0
    end = min(len(mixbuf), i + len(a))
    mixbuf[i:end] += a[:end - i]

def music(rel, src_at, at, dur, gain, fade_in=0.02, fade_out=0.05, duck=None):
    a = load(rel)[int(src_at * SR): int((src_at + dur) * SR)].copy()
    if duck:  # list of (t0, t1, level) in timeline seconds
        env = np.ones(len(a), np.float32)
        for t0, t1, lv in duck:
            i0, i1 = int((t0 - at) * SR), int((t1 - at) * SR); r = int(0.12 * SR)
            env[max(0, i0):max(0, i1)] = lv
            env[max(0, i0 - r):max(0, i0)] = np.linspace(1, lv, max(0, i0) - max(0, i0 - r))
            env[max(0, i1):max(0, i1 + r)] = np.linspace(lv, 1, max(0, i1 + r) - max(0, i1))
        a *= env[:, None]
    place(a, at, gain, fade_in=fade_in, fade_out=fade_out)

# ── Game SFX at their logged frames ──────────────────────────────────────────
SFX_GAIN = 1.5
for s in SCENES:
    seen = set()
    for e in meta[s]['sfx']:
        k = (e['key'], e['out'])
        if k in seen or e['key'] not in SFX: continue
        seen.add(k)
        place(load(SFX[e['key']]), T(s, e['out']), e['volume'] * SFX_GAIN, e.get('playbackRate', 1))

def sfx(key, s, f, gain=0.5, rate=1.0): place(load(SFX[key]), T(s, f), gain * SFX_GAIN, rate)

# Events that fired just before a recorder started, plus trailer accents.
sfx('glitchPulse', 's02_glitch', 0, 0.35)
sfx('teleport', 's02_glitch', 64, 0.3, 0.8)
sfx('countdown3', 's03_countdown', 0, 0.5)
sfx('introVoice', 's03_countdown', 108, 0.85)
for s, f in [('s04_moves', 0), ('s04_moves', 120), ('s04_moves', 210), ('s05_powerups', 0), ('s05_powerups', 90), ('s05_powerups', 180),
             ('s06_heat', 0), ('s07_sentient', 0), ('s07_sentient', 96), ('s07_sentient', 210), ('s08_arenas', 0), ('s08_arenas', 105),
             ('s08_arenas', 210), ('s08_arenas', 315), ('s08_arenas', 381), ('s09_modes', 0), ('s09_modes', 30), ('s09_modes', 60),
             ('s09_modes', 90), ('s09_modes', 120), ('s09_modes', 150), ('s11_clutch', 72), ('s11_clutch', 158)]:
    sfx('glitchPulse', s, f, 0.16, 1.05)
sfx('nearMiss', 's04_moves', 378, 0.35)
sfx('glitchPulse', 's05_powerups', 236, 0.3, 0.85)       # split freeze
sfx('critical', 's06_heat', 240, 0.25)
sfx('teleport', 's10_boss', 51 + 120, 0.35, 0.9)          # glitch-to-center ends, morph begins
sfx('glitchPulse', 's10_boss', 51 + 80, 0.3, 0.9)
sfx('glitchPulse', 's10_boss', 51 + 186, 0.4, 0.8)
sfx('critical', 's11_clutch', 0, 0.3)
for f in [96, 150, 190, 216, 234, 246, 255, 262, 267, 271]: sfx('glitchPulse', 's11_clutch', f, 0.14, 1.1)
sfx('introVoice', 's12_endcard', 4, 0.8)
sfx('glitchPulse', 's12_endcard', 62, 0.25)
sfx('glitchPulse', 's12_endcard', 172, 0.3)
sfx('glitchPulse', 's13_stinger', 54, 0.35, 0.9)

# ── Music bed ────────────────────────────────────────────────────────────────
go = T('s03_countdown', 102)                                # music drops on GO
arena0 = T('s08_arenas', 0)
music('sounds/music/in_game_music2.mp3', 109.5, go, arena0 - go, 0.62, fade_in=0.01,
      duck=[(T('s07_sentient', 90), T('s07_sentient', 210), 0.07)])   # Drowsy Ball: the music cuts out
for k, (rel, at) in enumerate([('sounds/music/in_game_music3.mp3', 146.75), ('sounds/music/matrix_music1.mp3', 154.5),
                               ('sounds/music/construct_music3.mp3', 153.5), ('sounds/music/blackhole_nebula4.mp3', 49.0)]):
    music(rel, at, T('s08_arenas', k * 105), 105 / FPS + 0.03, 0.62, fade_in=0.01, fade_out=0.03)
trigger = T('s10_boss', 51)
music('sounds/music/in_game_music4.mp3', 103.25, T('s09_modes', 0), trigger - T('s09_modes', 0), 0.6, fade_in=0.01, fade_out=0.04)
alarm = T('s10_boss', 51 + 194)
black = T('s11_clutch', 293)
music('sounds/music/blackhole_nebula5.mp3', 75.5, alarm, black - alarm, 0.62, fade_in=0.01, fade_out=0.01)
music('sounds/music/Menu Music.mp3', 150.5, T('s12_endcard', 0), 6.6, 0.5, fade_in=0.4, fade_out=1.0)

# ── Write ────────────────────────────────────────────────────────────────────
out = mixbuf[:int(TOTAL / FPS * SR)]
peak = np.abs(out).max(); print('frames', TOTAL, 'seconds', TOTAL / FPS, 'peak', round(float(peak), 2))
out = out * (0.95 / max(0.95, peak))                      # clean headroom; loudnorm sets final level
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
with wave.open(os.path.join(ROOT, 'out', 'trailer_mix.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
json.dump({'scenes': SCENES, 'start': start, 'total': TOTAL}, open(os.path.join(ROOT, 'out', 'timeline.json'), 'w'))
