import subprocess, numpy as np, os
SR = 48000
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_cache = {}
def load(rel):
    if rel in _cache: return _cache[rel]
    p = os.path.join(REPO, rel)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
    _cache[rel] = a
    return a
def rms_profile(a, win=0.5):
    n = int(SR * win); m = len(a) // n
    x = a[:m * n].mean(axis=1).reshape(m, n)
    return np.sqrt((x ** 2).mean(axis=1))
