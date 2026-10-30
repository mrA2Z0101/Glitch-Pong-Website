# Glitch Pong trailer renderer

Scripts that render the launch trailer described in `docs/trailer-plan.md` from real
gameplay. The game runs in headless Chromium on a virtual clock, so the trailer is
stepped one game frame at a time and every shot is smooth regardless of capture speed.
Every sound comes from `sounds/` and is placed on the exact frame the game played it.

Output: 1:58, 1920×1080, 30 fps, H.264 + AAC, mixed to -14 LUFS.

## Requirements

- Node 18+ with `playwright` (Chromium installed)
- Python 3 with `numpy` and `Pillow`
- `ffmpeg`

## Render

```bash
cd trailer/tools
python3 prepare.py                                   # builds trailer/site (patched copy of the game)
(cd ../site && python3 -m http.server 8765 --bind 127.0.0.1 &)
node scenes.js s1 s3 s4 s5 s6 s7 s8 s9 s10 s11 s12   # ~6 min; writes trailer/frames/
python3 postfx.py s01_cold_open s02_glitch s03_countdown s04_moves s05_powerups s06_heat \
  s07_sentient s08_arenas s09_modes s10_boss s11_clutch s12_endcard s13_stinger
python3 mix.py                                       # soundtrack -> trailer/out/trailer_mix.wav
./render.sh                                          # -> trailer/out/glitch-pong-trailer.mp4
```

Scene functions `s1` and `s12` each record two scenes (1+2 and 12+13).
`python3 sheet.py out.jpg fx/s04_moves:10,60,120` makes a contact sheet for checking shots.

## Files

| File | Role |
|------|------|
| `prepare.py` | Copies the site into `trailer/site` and patches in two capture hooks (eval bridge, sound logger). The real game files are never changed. |
| `vclock.js` | Virtual clock: replaces `requestAnimationFrame`, timers, `performance.now`, `Date.now` and `Math.random` (seeded). |
| `overlay.js` | Text cards, alerts, heat readout, logo slam, end card, Eye stinger, and the game-layer camera zoom. |
| `harness.js` | Playwright wrapper: stepping, screenshots, per-scene recorder (frames + sound log + post-fx). |
| `scenes.js` | One function per scene; stages each moment (ball positions, power-ups, boss trigger). |
| `postfx.py` | RGB split, slice tearing, shake, crop zoom and flashes. |
| `mix.py` | Music bed per section, plus game sounds at their logged frames. |
| `render.sh` | Joins the scenes and encodes the MP4 with a fixed gain and peak limiter. |

If the game code changes enough that `prepare.py` can't find its hook anchors, it
stops with an error instead of producing a broken capture.

**Note:** in Scene 11 the script forces `clutchMode` on, because the game's
`updateClutchMode()` currently needs a score of 8+ while matches end at 7.

## Vertical shorts (TikTok / Reels / Shorts)

The first batch from `docs/short-form-plan.md`, in the **follow crop** layout: the game is
captured as a normal 1920×1080 court, and a 9:16 window pans and zooms with the action (the
ball by default, or the wall, the Eye or the goal line when a shot calls for it). The text is
drawn upright on top at 1080×1920.

```bash
cd trailer/tools
node shorts.js v_tired v_grudge v_sides v_juke v_walls v_blackhole v_boss v_real   # landscape frames + camera track
python3 postfx.py v_tired v_grudge v_sides v_juke v_walls v_blackhole v_boss v_real
node compose.js v_tired v_grudge v_sides v_juke v_walls v_blackhole v_boss v_real  # 9:16 crop + overlays -> vframes/
for s in v_tired v_grudge v_sides v_juke v_walls v_blackhole v_boss v_real; do python3 mix_short.py $s && ./render_short.sh $s; done
python3 mix_short.py v_real teaser && ./render_short.sh v_real_teaser   # freeze-only version
```

Output goes to `trailer/out/shorts/`. `python3 vsheet.py out.jpg ../vframes/v_juke:60,120` makes a
portrait contact sheet. Each frame's camera hint (`f` focus, `z` zoom, `snap`) is recorded in
`shorts.js`; `compose.js` smooths it. Each short's music bed, ducking and sound accents live in
the `CFG` table in `mix_short.py`.

## YouTube thumbnail

`trailer/thumbnail/` holds two 1280×720 thumbnails (A: "PONG HAS A BOSS.", B: "THE ARENA FIGHTS
BACK.") as PNG and JPG, built from `thumbnail.html` with the game's own logo, Eye art and trailer
frames. Re-render with `node trailer/thumbnail/render.js`.
