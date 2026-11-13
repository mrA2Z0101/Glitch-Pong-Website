# BREAKPOINT

A cyber-arcade reimagining of Breakout set in the **Glitch Pong** universe — same corrupted machine, new arena. Shares Glitch Pong's design language (void-dark palette, `#71efff` cyan / `#ff58d9` pink / `#9a5dff` purple, Orbitron + VT323 + Share Tech Mono, clip-path parallelogram buttons, glitching split-shadow title) and its antagonist: **THE EYE**.

**THE EYE** (sprites in `assets/`, from Glitch Pong) claims every 10th sector and the Boss Rush finale. Its gaze tracks your ball (left/right/neutral sprites), it blinks to armor itself behind its eyelid, fires six-shot punishment volleys at your paddle, and glitch-teleports across the arena.

## Run it

No build step. Either:

- Open `index.html` directly in a browser, or
- `python -m http.server 5180` from the repo root, then visit `http://localhost:5180/`

## Controls

| Input | Action |
|---|---|
| ← → / A D / Mouse | Move paddle |
| Space / Click | Launch ball · fire laser paddle |
| X | Special ability (EMP / laser array, once unlocked) |
| P / Esc | Pause |
| R | Restart run |
| T | Hand the paddle to the AI / take it back |
| Space / Enter | Continue after a sector clear (Enter retries on game over) |
| Touch | Drag to steer · tap to launch · two-finger tap = ability |

The in-game **Codex** (main menu) has the controls and everything else.

## Systems

- **15 brick types** (the green virus and clone bricks hold off until sectors 5 and 6, and spread slowly) — normal, heavy (cracks), shield + generators, virus (corrupts neighbors), healing, teleport, clone, explosive, firewall (needs fire/laser/explosives), quantum, invisible, moving, rotating, boss core (locked behind generators), event barriers
- **10 glitch events** — System Error, Packet Loss, Time Freeze, Memory Leak, Kernel Panic, Data Surge, Firewall Activated, Lag Spike, Overclock, Quantum Shift
- **20 powerups** (they stack) · **4 enemy types** · **5 mini bosses** rotate through every 5th sector, with **THE EYE** claiming every 10th
- **12 arenas**, each with a drawn backdrop, one rule of its own and a soundtrack: a light bar, a reactor that throws the ball, a paddle that leaks, hive tunnels, a light beam, a bad sector, a defender, no side walls, a gravity well, descending racks, and sideways drift. The rule is named in the HUD and explained during the countdown.
- **Glitch Meter** — risk vs. reward: up to x3 score, but more corruption, events and enemies
- **Procedural corruption** — bricks mutate, duplicate, dissolve; visuals and audio degrade. Recorded music switches themes for active glitches and reacts with slowdown, dropouts, echoes, filtering, and pitch changes, then returns to the arena song.
- **9 modes** — Classic, Endless, Corruption, Hardcore, Time Attack, Puzzle, Boss Rush, Daily Glitch (date-seeded mutators, local best), AI Autoplay
- **Screen FX: Reduced** setting (defaults on with OS reduce-motion) — softer shake, capped flashes, no tearing
- **Meta progression** — XP, credits, an upgrade tree of 12 in three branches, 16 achievements, saved to `localStorage`
- **Codex** — 77 entries (bricks, power-ups, enemies, bosses, arenas, glitches, the ball's moods), each unlocking with a note the first time you meet the thing
- **Guided first sector** — a new player's first run comes with a coach; skip it from the pause menu, replay it from Settings
- **Run recap** — the game-over screen says your best combo, favourite power-up and what ended the run
- **Sentient ball** — like Glitch Pong's, but with its own moods: **Bored** (five returns without breaking a brick and it bends toward the nearest one), **Grudge** (it leans toward THE EYE), **Loyal** (on your last life it refuses to fall past a near miss, once per sector, never in Hardcore), **Rampage** (behind the wall it turns gold, speeds up a little and scores double until it drops back out), **Protective** (a shot that hits your paddle or shield triggers immediate homing on the shooter: an orange missile trail, targeting line, and lock reticle make the chase visible; it keeps trying through blocked approaches until a hit, target loss, or sector end; regular enemies take double damage and bosses retain normal damage), **Sibling rivalry** (in multi-ball the ball with the most bricks wears a crown for +50% brick score; the last ball standing gets a bonus), **Show-off** (6+ bricks without touching the paddle: a longer, brighter trail and 6% faster until it's back at the paddle), **Curious** (teleport, quantum and clone bricks it hasn't touched pull it gently toward them, with a ? over the ball), **Mourning** (after a lost life the next ball launches 22% slower and dim for 3.5s while the lost ball's last path fades out). Toggle in Settings.
- **3-2-1-GO countdown** at the start of every sector, with Glitch Pong's art and voice; the paddle can line up, and the ball launches on GO
- **Paddle colour, paddle skin, ball skin and ball trail** shared with Glitch Pong (you're its blue player); change them in Settings and they change in both games
- **Breakpoint-only prizes** — three brick styles and three break effects, sold by PRIZETRON-80 at the prize counter and worn from Settings
- **Glitchcade coins** — every sector you clear pays 2 coins (a boss sector pays 10) into the same wallet Glitch Pong uses; spend them at PRIZETRON-80's prize counter. Sectors the AI played don't pay.

There is also a secret. Old-school arcade rules: it's three letters and typed on the main menu.

## On phones

The playfield takes the screen's shape. Held upright, a phone gets a tall, narrow field (8 brick columns) sized to fill the screen, with the paddle raised over a thumb strip: drag anywhere to steer, tap to launch, and use the round button for your [X] ability. Turned sideways, phones and tablets get a wider field with extra columns. Desktop keeps the original 960×640. Pinch/double-tap zoom is off, the notch is respected, and the page can be added to the home screen to run full-screen.

## In the Glitchcade

The recorded music and arcade scene placements are listed in
[the soundtrack guide](../docs/soundtrack.md).

Break Point is **cabinet 02** in Glitch Pong's 3D arcade. The arcade opens `index.html?cabinet` in a full-screen frame; in that mode the main menu shows **Exit to arcade** (or press Esc on the main menu) to walk away from the machine.

Coins are shared through `localStorage` (key `glitchcade_wallet_v1`), which browsers only share within one site. Break Point and Glitch Pong must be served from the same origin, for example both on your `github.io` domain, for the balance to carry over.

## Code layout

```
index.html        shell, HUD, menus, styles
js/config.js      data: bricks, arenas, music, powerups, events, modes, upgrades, achievements, codex text
js/rules.js       decisions with no drawing: scoring, layouts, boss schedule, upgrade tree, arena rules, codex, coach, recap
js/icons.js       mode icons and power-up icons
js/backdrops.js   the picture behind each arena
js/audio.js       streamed scene playlists, WebAudio SFX + synth fallback
js/effects.js     particles, floating text, screen shake, RGB split, slice tearing
js/wallet.js      shared with Glitch Pong: coin wallet, paddle colour, skins, prizes, cabinet exit bridge
js/entities.js    paddle, ball, bricks, enemies, bosses, five arena hazards
js/arenas.js      the other six arena hazards
js/game.js        state machine, collisions, events, progression, UI
```

`js/rules.js` has no page code and is covered by `tests/breakpoint-rules.test.mjs` (run `node --test tests/*.mjs` from the repository root). The page also loads `../glitchpong-cosmetics.js`, `../glitchcade-breakpoint-prizes.js` and `../glitchcade-power.js` from the folder above; copied out on its own it still runs, without skins, prizes or battery saver.

More: [how it is put together](../docs/breakpoint.md), [how to win](../docs/breakpoint-strategy.md), [what was measured](../docs/breakpoint-balance.md).
