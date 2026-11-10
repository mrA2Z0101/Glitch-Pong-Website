# Power: heat and battery on phones

What the arcade, Glitch Pong and Breakpoint do to keep a phone cool, where each setting lives, and what was measured.

## Battery saver

One switch for all three games. It is stored under `glitchPongPerformance` (the key Glitch Pong's settings button always used), so flipping it anywhere flips it everywhere:

- **Arcade:** the lightning button next to the sound button, the Battery Saver button on the title menu, or **B**.
- **Breakpoint:** Settings → Battery Saver.
- **Glitch Pong:** Settings → Battery Saver (unchanged).

It also turns on by itself, without touching the stored switch, when the browser reports an unplugged battery at 20% or lower (Chrome and Android only: Safari has no Battery API, so there it is only ever the switch). The buttons show `Auto · low battery` in that case.

## Frame rate

`glitchcade-power.js` is a plain script all three pages load. `fpsFor()` decides how many frames each moment gets, and `createPacer()` enforces it (it keeps the average right on a 90 Hz display, where a naive 60 cap would settle on 45).

| | Active | Calm / idle | Battery saver |
|---|---|---|---|
| Arcade, phone | 60 | 30 (standing still, title menu) | 30 / 20 |
| Arcade, desktop | uncapped | uncapped (menus 60) | 30 / 20 |
| Breakpoint, phone | 60 | 30 (menu, result screens), 8 paused | 30 / 20, 5 paused |
| Glitch Pong | 60 | 20 paused | 60 (30 on its menu) |

"Active" in the arcade means walking, looking, a jump in the air, anything you just used, an Eye event, the ball rolling, or a table game or photo open. It drops to calm 0.7 s after the last of those.

Glitch Pong is the exception: its physics is counted in frames (the ball moves `vx` per frame, cooldowns tick down by one), so it is built for 60 a second and battery saver does not slow it. The cap there only stops a 90, 120 or 144 Hz display from running the game faster than designed.

To change a rate, edit `fpsFor()` and the `wantFps()` function beside each loop (`glitchcade.js`, `breakpoint/js/game.js`, `loopFps()` in `glitchpong-site.js`). `tests/power.test.mjs` checks the pacer on 60, 90, 120 and 144 Hz and that saving is never busier than not saving.

## The arcade

- Sets and cabinet screens you can't see are not redrawn or re-uploaded to the GPU: out of frustum, turned away, or too far. Redraw rates are also lower on phones and lower again when saving.
- The staff room no longer has a point light. Every lit surface in the building pays for every light, so one light in a 6 m room cost about 11% per frame everywhere. It has an emissive tint and a floor glow instead.
- The 140 m ground plane draws last, so the floor and walls hide most of it before the costly shader runs.
- Anisotropic filtering is 2× on phones (8× before).
- Battery saver also hides the additive glow decals (the biggest fill-rate cost), lowers the resolution ceiling to 0.8 and halves redraw rates again.
- Audio: a muted or backgrounded page suspends the audio engine (it used to keep every oscillator running at volume zero), phones use the `balanced` latency hint and skip the always-on hiss on each dead cabinet.
- While a ROM fragment's overlay covers the screen, the 3D scene is not drawn at all.

## Breakpoint

- Brick glows are drawn once into small sprites and stamped, instead of two canvas shadows per brick per frame (200+ blurs a frame on a full wall). Only the halo is cached; at whole-pixel positions it differs from the old drawing by at most 2/255 per channel.
- Every `shadowBlur` on the game canvas is scaled: 0.7 on phones, 0.3 when saving.
- On phones: no flickering blend overlay, no animated menu grid, no backdrop blur over the live demo. Saving also stops the title's glitch animation.
- The page pauses a run and rests the audio when hidden.

## What was measured

Software rendering in headless Chromium, with the CPU time of every browser process as the proxy (the GPU's work shows up as CPU there). Absolute numbers mean nothing; the ratios are what to read. Touch emulation, 844×390.

| | Baseline | Now | Battery saver |
|---|---|---|---|
| Arcade, cost per frame: title menu | 0.308 | 0.237 (−23%) | 0.167 (−46%) |
| Arcade, cost per frame: standing | 0.326 | 0.247 (−24%) | 0.169 (−48%) |
| Arcade, cost per frame: walking | 0.345 | 0.252 (−27%) | 0.180 (−48%) |
| Breakpoint, menu | 1.60 | 0.37 (−77%) | 0.34 |
| Breakpoint, AI-played run | 1.05 | 0.62 (−41%) | 0.44 (−58%) |
| Glitch Pong, live match, 120 Hz display | 0.89 | 0.52 (−42%) | |

On a 60 Hz phone the arcade also draws half as many frames while you stand still or sit on the title menu, so its work per second there is roughly 60% lower than the per-frame figures alone suggest. That last figure is a calculation from the table and the frame budget, not a separate measurement.

Texture uploads from the arcade's canvas screens fell by roughly 40–55% in the scenes measured.

## Not tested

- A real phone: temperature, battery drain and real frame pacing. Everything above is a relative measurement in software rendering.
- A real 90 or 120 Hz display. The 120 Hz figures come from driving `requestAnimationFrame` every 8.3 ms.
- Sound: the headless browser has no audio output, so suspend and resume were checked through the audio context's state.
- Safari's behaviour with the audio context `balanced` hint and with the page going to the background.
