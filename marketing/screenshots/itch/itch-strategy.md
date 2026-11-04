# itch.io screenshot and cover plan — Glitch Pong — build `b0e6451`

All images are untouched captures of the real web build (`index.html` + `glitchpong-site.js`), rendered in headless Chromium at 1920×1080. Nothing is painted, composited, upscaled, or color-graded. See `asset-manifest.json` for the exact source and staging of every file.

## Confirmed game promise
- **Short description draft:** *Neon Pong where the arena fights back: rallies build Heat until a surveillance-eye boss crashes the match.*
- **Genre + core interaction:** 1v1 arcade Pong (vs AI or local 2P). Move with W/S or ↑/↓, Shift + direction to dash.
- **Hook:** a long rally builds **Heat**. At max Heat the arena corrupts and **the Eye** boss appears, orbiting six punishment shots that it fires at the paddles.
- **Verified differentiators (code evidence in `glitchpong-site.js`):**
  - Heat system and boss sequence: `HEAT_MAX`, `triggerPreBoss()`, the "SYSTEM CORRUPTED / CORRUPTION BREACH" banners.
  - Four arenas: `ARENA_REGISTRY` lists Glitch Arena, Matrix Mainframe, The Construct and Black-Hole Nexus.
  - Power-up orbs: `POWERUP_TYPES` lists shield, power and split. The HUD names them PHASE SHIELD, SPLIT BALL, etc.
  - Glitch walls the ball can shatter.
  - The Glitchcade, the 3D first-person arcade that opens the web build: `index.html` + `glitchcade.js`.
- **Page type:** embedded HTML5.
- **Page layout intention:** set the screenshots column to **Sidebar**. Embedded HTML5 pages hide the gallery by default; see `page-preflight.md`.
- **Native size:** 1920×1080, landscape, 16:9.
- **Do not show:**
  - Online multiplayer. It needs the Node/socket.io server, which an itch.io HTML5 upload doesn't have.
  - Perk and level-up screens. They weren't captured, so don't claim them visually.

## Cover — attract a click in browse listings
- **Recommended:** `cover/cover-a-glitchcade-cabinet-630x500.png`
  - It's a downscaled crop of `gallery/05-glitchcade-cabinet.png`. The neon GLITCHCADE sign, the Eye and the GLITCH PONG cabinet all read at a 160px tile.
  - All text in it is real in-game signage. No text or logo was added.
- **Alternate:** `cover/cover-b-black-hole-630x500.png`. It's a crop of the Black-Hole Nexus frame and is striking, but it shows no paddles, so it says less about *Pong*.
- **Caveat:** cover A shows the 3D arcade. Use it only if the itch upload opens in the Glitchcade, which is the current `index.html`. If you upload a build that starts straight in Glitch Pong, use cover B instead.

## Gallery — persuade after the click
| Order | Buyer question | Actual feature shown | Staging | Focal point / stakes | File |
|---|---|---|---|---|---|
| 01 | What do I play? | 1v1 Pong + the Eye boss firing punishment shots, in The Construct | Max Heat via the build's own **Q** key, 18 s into the boss phase | Eye with orbiting shots between both paddles, ball in play, glitch wall | `gallery/01-boss-eye-the-construct.png` |
| 02 | What's different? | Black-Hole Nexus at 100% Heat, SPLIT BALL orb in play | Q at 110 s of a natural rally, frame ~19 s later | The vortex swallows the centre of the court | `gallery/02-black-hole-nexus-critical-heat.png` |
| 03 | Why is it exciting? | "CORRUPTION BREACH — max heat // core entity detected" in Matrix Mainframe | Q at 6 s, frame at the breach banner | Eye + six shots under the warning, katakana rain | `gallery/03-matrix-mainframe-corruption-breach.png` |
| 04 | Is there depth? | Ball shattering a glitch wall next to the cyan paddle; PHASE SHIELD orb on court | Fully natural rally, 142 s in, no shortcut | Pixel burst at the impact point | `gallery/04-glitch-wall-shatter.png` |
| 05 | What's the world? | The Glitchcade: walk up to the Glitch Pong cabinet, the Eye watching from above | Player placed in front of the cabinet (equivalent to walking there) | Cabinet + Eye + neon sign | `gallery/05-glitchcade-cabinet.png` |

**Extras (not in the default five):**
- `extras/06-glitchcade-hall.png`: the full arcade hall with all 10 cabinets.
- `extras/07-glitchcade-street.png`: the neon street outside.

Use these in the page description, or swap one in for 04 if you want the page to lean more on the arcade.

**Honest weak spot:** in normal rallies the ball and paddles are small on a large dark court, so plain rally frames looked nearly empty at thumbnail size and were not selected. The boss Eye is also small at thumbnail size (01, 03), so its orbiting shots read as a ring of dots. The fix belongs in the game, not in the screenshots; for example, a larger Eye sprite during the boss phase. That's a design decision for you, so nothing in the game was changed.

## Motion
- **Not produced.** Capture ran about 2–15 fps in this headless environment, so the frames aren't smooth enough for an honest gameplay GIF.
- **Recommendation:** record a 4–6 s screen capture of a boss phase on a real machine, then run `screenshot_tool.py itch-gif` on the extracted frames.
- **Photosensitivity:** the boss transition flashes the screen red. Check flicker before using it as a cover or autoplaying GIF.

## Staging disclosure
- **AI vs AI:**
  - Gameplay frames were staged in the game's built-in **AI vs AI** spectator mode, at Hard, for long reproducible rallies.
  - That mode renders exactly like a 1P match. The HUD still reads "1P", and paddles, ball, arena, power-ups and boss are identical.
- **The Q shortcut:**
  - **Q** is an existing handler in the shipped build. It sets Heat to max and starts the boss sequence.
  - That's the same state a long rally reaches naturally.
  - Frame 04 needed no shortcut.
- **Your call:** if you'd rather show only fully natural boss encounters, recapture 01–03 from long natural rallies. Also decide whether Q should stay in the public build: it's a free boss button for players.
