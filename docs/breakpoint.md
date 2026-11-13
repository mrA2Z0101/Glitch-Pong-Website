# Breakpoint

How Breakpoint (cabinet 02, `breakpoint/`) is put together: its arenas and their rules, the codex, the guided first sector, what it shares with Glitch Pong, and where to change each. How to play well is in [breakpoint-strategy.md](breakpoint-strategy.md). What was measured and what was changed because of it is in [breakpoint-balance.md](breakpoint-balance.md).

## Files

| File | What is in it |
|---|---|
| `breakpoint/index.html` | The page: HUD, menus, styles |
| `js/config.js` | Tables: bricks, arenas, music, power-ups, events, modes, upgrades, achievements, and the codex's text |
| `js/rules.js` | Decisions with no drawing: scoring, sector layouts, the boss schedule, the upgrade tree, each arena's rule, the codex, the first-sector coach, the run recap |
| `js/icons.js` | Mode icons and power-up icons |
| `js/backdrops.js` | The picture behind each arena |
| `js/audio.js` | Streamed music and synthesized sound effects |
| `js/effects.js` | Particles, shake, flashes |
| `js/wallet.js` | What is shared with Glitch Pong: coins, paddle colour, skins, prizes |
| `js/entities.js` | Paddle, ball, bricks, power-ups, enemies, bosses, five of the arena hazards |
| `js/arenas.js` | The other six arena hazards |
| `js/game.js` | The game loop, input, menus |
| `../glitchcade-breakpoint-prizes.js` | The Breakpoint-only prizes sold at the arcade's counter |

`js/rules.js` and `glitchcade-breakpoint-prizes.js` have no page code, so they run under Node:

```bash
node --test tests/*.mjs
```

`tests/breakpoint-rules.test.mjs` covers the rules, `tests/breakpoint-prizes.test.mjs` the prizes, `tests/ball-retaliation.test.mjs` the ball's homing, and `tests/breakpoint-music.test.mjs` the soundtrack.

## Arenas

The arena is set by the sector number: sector 1 is GLITCH ARENA, sector 2 NEON GRID, and so on, coming round again at sector 13. Each arena has a drawn backdrop, one rule of its own, and a soundtrack.

| Sector | Arena | Rule | What it does |
|---|---|---|---|
| 1 | GLITCH ARENA | STANDARD | The original court. No tricks. |
| 2 | NEON GRID | LIGHT BAR | A neon bar patrols the middle and bats the ball away. |
| 3 | QUANTUM REACTOR | REACTOR PULSE | Every 9 seconds, after 1.6 seconds of warning, the core throws every ball within 230 pixels straight outward. |
| 4 | MEMORY LEAK | LEAKING PADDLE | A return that breaks no brick shortens the paddle by 3%, down to 80%. Catching a power-up or losing a life restores it. |
| 5 | VIRUS HIVE | HIVE TUNNELS | Two gates. In one, out the other. |
| 6 | DIGITAL CATHEDRAL | LIGHT BEAM | A beam sweeps up and down and turns the ball back. |
| 7 | CORRUPTED BIOS | BAD SECTOR | A patch of the board that turns the ball by up to half a radian at random. |
| 8 | AI MAINFRAME | DEFENDER | A bar that slides toward a rising ball at 120 pixels a second and knocks it back down. After a block it reboots for 2 seconds, so the next shot gets through. A falling ball passes through it. |
| 9 | DATA TUNNEL | NO SIDE WALLS | Above the paddle zone the ball leaves one side and comes back in the other. The 240 pixels of each side above the paddle are solid wall. |
| 10 | BLACK HOLE NEXUS | GRAVITY WELL | A black hole drifts across the field and bends the ball toward it. |
| 11 | INFINITE SERVER | DESCENDING RACKS | The wall of bricks drops one row every 14 seconds, with 2 seconds of warning, until it is 170 pixels above the paddle. |
| 12 | BROKEN SIMULATION | DRIFT | Sideways gravity that swings back and forth over about 14 seconds. A gauge at the top shows which way it is pulling. |

Six of these rules are new (3, 4, 8, 9, 11, 12). The other five hazards were already in the game, shared between eleven arenas.

The rule is named in the HUD under the arena name and explained in one line during the countdown. Rules also apply in boss sectors, as the hazards always did.

### Adding or changing an arena

- **The entry** is in `ARENAS` in `js/config.js`: name, colours, `rule`, `hazard`, `music`.
- **The rule's name, its one line and its numbers** are in `ARENA_RULES` and `ARENA_TUNING` in `js/rules.js`. Decisions such as whether the defender blocks a shot are functions there, with tests.
- **What it looks like on the field** is a class with `update(dt, game)` and `render(ctx, game)`, registered in `HAZARDS` (`js/entities.js` or `js/arenas.js`). A rule that changes the ball itself (wrapping, drift) is applied in `Ball.update` in `js/entities.js`.
- **The backdrop** is a painter in `js/backdrops.js`, keyed by the arena's name. `still` is painted once into an off-screen canvas; `live` is the few moving details drawn each frame, skipped in battery saver and reduced screen FX. Painters work in the field's own size, because an upright phone's field is 600 wide and up to 1,300 tall.

Keep backdrops faint. The bricks, ball and paddle have to read over them.

### Music

Which theme an arena plays is its `music` entry; the recordings behind each theme are in `MUSIC` in `js/config.js`. See [soundtrack.md](soundtrack.md).

## The codex

The codex replaces the old manual. It has a tab for controls and one each for bricks, power-ups, enemies, bosses, arenas, glitch events and the ball's moods: 77 entries. An entry shows a picture, a name and one line on what it does. The pictures are drawn by the game's own drawing code, so they can't drift from what is on the field.

An entry unlocks the first time you meet the thing in a run, and a note appears saying what it is. That note is how the game explains itself: the first heavy brick you hit tells you it takes three hits.

- The text is in `js/config.js`: `BRICK_INFO`, each power-up's `desc`, `ENEMY_INFO`, `BOSS_INFO`, `EVENT_INFO`, `MOOD_INFO`. Arena entries use the rule's line.
- What is unlocked is saved in `seen` in the `gb_save` record, as keys such as `brick:heavy`.
- The game unlocks an entry by calling `game.meet(kind, id)`. The menu demo and AI runs that earn no progress unlock nothing.
- `tests/breakpoint-rules.test.mjs` checks that every brick type, power-up, enemy, boss, arena and event the game has is in the codex.

## The guided first sector

A new player's first run in Classic, Endless, Corruption, Hardcore or Time Attack starts with a guided sector:

- The wall is fixed: three plain rows with two heavy bricks, and the top corners left open.
- No glitch events happen.
- The fourth brick broken always drops a WIDE PADDLE.
- A coach shows one line at a time and moves on when you have done what it describes, or have had time to read it: moving, aiming with the paddle, combos, catching a power-up, the Glitch meter, the ball's moods.

It ends when the sector is cleared or the run ends, and does not come back. It can be skipped from the pause menu and replayed from Settings. The steps are `TUTOR_STEPS` in `js/rules.js`.

## Power-ups

Capsules carry an icon instead of two letters, and the HUD's timers use the same icon. Catching one shows its name and what it does for 2.4 seconds. Icons are canvas paths in `js/icons.js` (`POWER_ICONS`), one per power-up.

## What is shared with Glitch Pong

Everything shared goes through `localStorage`, so both games must be served from the same site.

| What | How |
|---|---|
| Coins | The wallet record. A cleared sector pays 2, a boss sector 10. Sectors the AI played pay nothing. |
| Paddle colour | Glitch Pong's blue player's colour. |
| Paddle skin, ball skin, ball trail | What the blue player wears in Glitch Pong's Store. Breakpoint loads `glitchpong-cosmetics.js` and draws with the same code. Its Settings screen steps through the ones you own; a change shows up in Glitch Pong too. |
| Sectors cleared | Counted for Glitch Pong's Breakpoint cosmetics. |

Glitch Pong's paddles stand upright, so a paddle skin is drawn upright and turned a quarter turn. Its court-facing side ends up on top.

## Breakpoint's own prizes

PRIZETRON-80's rack on the prize counter sells six things only the Breakpoint cabinet can wear:

| Prize | Kind | Coins |
|---|---|---|
| CONFETTI | Break effect | 20 |
| 8-BIT BRICKS | Brick style | 25 |
| GLASS SHARDS | Break effect | 35 |
| GLASS BRICKS | Brick style | 45 |
| COIN SHOWER | Break effect | 60 |
| GOLD BULLION | Brick style | 80 |

They are worn from Breakpoint's Settings screen. Every brick style keeps each brick type's colour, because the colour is how you tell bricks apart.

To add one: add it to `CATALOG` in `glitchcade-breakpoint-prizes.js`, then draw it. Brick styles are in `Brick.render` (`js/entities.js`); break effects are in `game.burst` (`js/game.js`). A test fails if a prize in the catalog has no drawing code.

These six are separate from the twelve collectables on the counter's shelves, so the SOLD OUT achievement is unchanged.

## The upgrade tree

Twelve upgrades in three branches of four. A node can be bought once the node above it has at least one rank. Anything already owned can still be ranked up, so a save from before the tree loses nothing.

| PADDLE | SURVIVAL | SCORE |
|---|---|---|
| Extended Paddle | Stabilizer | Packet Sniffer |
| Overdrive Servos | Backup Process | Data Miner |
| Magnetic Plating | Boot Firewall | Buffer Overflow |
| Laser Array | EMP Capacitor | Root Access |

The branches are `UPGRADE_TREE` in `js/rules.js`.

## The run recap

The game-over screen says:

- your best combo and the sector it was in;
- the power-up you caught most;
- what ended the run: a stun and whose shot it was, a glitch event, a near miss and by how many pixels, a ball near top speed, or the arena's rule;
- the sector that cost the most lives, if one cost two or more;
- how many codex entries were new.

The sentences are built by `runRecap` and `deathCause` in `js/rules.js`.
