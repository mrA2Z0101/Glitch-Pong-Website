# Builds trailer/site: a copy of the game with two capture-only hooks patched into
# glitchpong-site.js (an eval bridge into the game closure and a sound-event logger).
# The real game files are never modified.
import os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
SITE = os.path.join(HERE, '..', 'site')
shutil.rmtree(SITE, ignore_errors=True); os.makedirs(SITE)
for name in os.listdir(REPO):
    if name in ('.git', 'trailer', 'glitchpong-site.js'): continue
    os.symlink(os.path.join(REPO, name), os.path.join(SITE, name))
s = open(os.path.join(REPO, 'glitchpong-site.js')).read()
loop = '    function loop(now = performance.now()) {'
shot = '      function playOneShot(key, { volume = 0.45, playbackRate = 1, duck = 0, duckDuration = 0 } = {}) {\n'
assert s.count(loop) == 1 and s.count(shot) == 1, 'game code changed: update the hook anchors in prepare.py'
s = s.replace(loop, '    window.__gpEval = (c) => eval(c);\n' + loop)
s = s.replace(shot, shot + '        if (window.__sfxLog) window.__sfxLog.push({ f: window.__gpFrame | 0, key, file: SOUND_FILES[key], volume, playbackRate });\n')
open(os.path.join(SITE, 'glitchpong-site.js'), 'w').write(s)
print('site ready:', os.path.abspath(SITE))
