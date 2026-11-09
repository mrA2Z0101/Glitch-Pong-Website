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

## Systems

- **15 brick types** (the green virus and clone bricks hold off until sectors 5 and 6, and spread slowly) — normal, heavy (cracks), shield + generators, virus (corrupts neighbors), healing, teleport, clone, explosive, firewall (needs fire/laser/explosives), quantum, invisible, moving, rotating, boss core (locked behind generators), event barriers
- **10 glitch events** — System Error, Packet Loss, Time Freeze, Memory Leak, Kernel Panic, Data Surge, Firewall Activated, Lag Spike, Overclock, Quantum Shift
- **20 powerups** (they stack) · **4 enemy types** · **5 mini bosses** rotate through every 5th sector, with **THE EYE** claiming every 10th
- **12 arenas** with unique palettes, procedural synthwave soundtracks, and hazards (gravity wells, laser sweeps, teleport gates, moving barriers, corrupted zones)
- **Glitch Meter** — risk vs. reward: up to x3 score, but more corruption, events and enemies
- **Procedural corruption** — bricks mutate, duplicate, dissolve; visuals and audio degrade
- **9 modes** — Classic, Endless, Corruption, Hardcore, Time Attack, Puzzle, Boss Rush, Daily Glitch (date-seeded mutators, local best), AI Autoplay
- **Screen FX: Reduced** setting (defaults on with OS reduce-motion) — softer shake, capped flashes, no tearing
- **Meta progression** — XP, credits, 12 permanent upgrades, 16 achievements, saved to `localStorage`
- **Sentient ball** — like Glitch Pong's, but with its own moods: **Bored** (five returns without breaking a brick and it bends toward the nearest one), **Grudge** (it leans toward THE EYE), **Loyal** (on your last life it refuses to fall past a near miss, once per sector, never in Hardcore), **Rampage** (behind the wall it turns gold, speeds up a little and scores double until it drops back out), **Protective** (if an enemy stuns your paddle, it chases that enemy down for double damage), **Sibling rivalry** (in multi-ball the ball with the most bricks wears a crown for +50% brick score; the last ball standing gets a bonus). Toggle in Settings.
- **3-2-1-GO countdown** at the start of every sector, with Glitch Pong's art and voice; the paddle can line up, and the ball launches on GO
- **Paddle colour** shared with Glitch Pong (you're its blue player); change it in Settings and it changes in both games
- **Glitchcade coins** — every sector you clear pays 2 coins (a boss sector pays 10) into the same wallet Glitch Pong uses; spend them at PRIZETRON-80's prize counter. Sectors the AI played don't pay.

There is also a secret. Old-school arcade rules: it's three letters and typed on the main menu.

## In the Glitchcade

Break Point is **cabinet 02** in Glitch Pong's 3D arcade. The arcade opens `index.html?cabinet` in a full-screen frame; in that mode the main menu shows **Exit to arcade** (or press Esc on the main menu) to walk away from the machine.

Coins are shared through `localStorage` (key `glitchcade_wallet_v1`), which browsers only share within one site. Break Point and Glitch Pong must be served from the same origin, for example both on your `github.io` domain, for the balance to carry over.

## Code layout

```
index.html      shell, HUD, menus, CRT overlay CSS
js/config.js    data: bricks, arenas, powerups, events, modes, upgrades, achievements
js/audio.js     WebAudio: per-arena synthwave scheduler + all SFX
js/wallet.js    shared with Glitch Pong: coin wallet, paddle colour, cabinet exit bridge
js/effects.js   particles, floating text, screen shake, RGB split, slice tearing
js/entities.js  paddle, ball, bricks, enemies, bosses, hazards
js/game.js      state machine, level generation, collisions, events, progression, UI
```
