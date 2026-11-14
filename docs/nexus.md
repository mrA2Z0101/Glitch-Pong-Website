# Black-Hole Nexus

How Black-Hole Nexus (cabinet 03, `nexus/`) is put together: the orbit, the sector rules, THE EYE, the two characters who talk, what it shares with Glitch Pong and Breakpoint, and where to change each. What was measured is at the end.

It began as the 30-second ROM fragment on cabinet 06. It is now a whole game on cabinet 03, next to Breakpoint, and the fragment is gone (see [glitchcade-floor.md](glitchcade-floor.md) for what happened to the cabinets and to old saves).

## The idea

Every ball that got past a paddle in Glitch Pong, and every ball that fell off the bottom in Breakpoint, went somewhere. It went here: a hole in the machine's memory. In this cabinet there is no paddle. You are the ball, in orbit round the hole, and there is one control: hold to climb, let go to fall.

Two characters talk, and both know they are in a game:

- **NULL** is the hole. It talks to the player, not to the ball.
- **The ball** is the same sentient ball the other two cabinets have. It talks to you too, in lower case.

**THE EYE** is the same Eye as in the other two games. It has no cabinet of its own, so every fifth sector it looks out of this one.

## Files

| File | What is in it |
|---|---|
| `nexus/index.html` | The page: HUD, menus, styles (Breakpoint's design tokens and buttons) |
| `js/rules.js` | The whole game as numbers: the orbit, what is on the rings, scoring, Heat, each sector's rule, THE EYE, the bot, the save. No page code. |
| `js/voice.js` | Every line NULL and the ball can say, and when each one is allowed. No page code. |
| `js/game.js` | Drawing, sound triggers, menus, and the things NULL does to the page |
| `js/audio.js` | Streamed music and synthesized sound effects |
| `js/wallet.js` | What is shared with the other cabinets: coins, the cabinet bridge, ball colour, skin and trail |

`js/rules.js` and `js/voice.js` run under Node:

```bash
node --test tests/*.mjs            # tests/nexus-rules.test.mjs covers this cabinet
node scripts/nexus-sim.mjs         # plays 12 runs with the bot and prints what happened
```

The game is ES modules, so it has to be served (`python -m http.server` from the repo root, then `/nexus/`); it does not open from a file.

## The orbit

All in `TUNE` at the top of `js/rules.js`.

- The ball orbits the hole. Lower orbits are faster (`W_EDGE`, `W_EXP`).
- Holding the button pushes it outward (`THRUST`). Letting go lets the hole pull it in (`G0`, stronger near the hole by `G_K`). The button always beats the pull, even at the horizon while the hole is breathing in; a test checks that.
- The outer limit is the edge of the screen (`R_OUT`). The ball can sit against it safely, but nothing can be collected from there and Heat drains.
- The inner limit is the horizon (`R_HOLE`, wider with Heat and in MEMORY LEAK). Past it the ball is lost.
- You have three balls. A new one starts in a high orbit and cannot be hurt for 2.2 seconds.

What is in orbit with you:

| Thing | What it does |
|---|---|
| **Bit** (white square) | Collect to fill the sector's quota (12 in sector 1, two more each sector, 28 at most). Worth 10, times the band. |
| **Core** (gold diamond) | Only near the hole. Worth 50 and counts as two bits. |
| **Debris** | Bricks from Breakpoint, broken paddles from Glitch Pong, blocks of static. Touch one and the ball is gone. Passing within 13 pixels without touching scores 25 and adds Heat. |
| **Power-up** (hexagon) | FIREWALL takes one hit. MAGNET pulls bits within 100 pixels for 8 seconds. TIME FREEZE stops everything but the ball for 4 seconds. From sector 2. |

Everything spirals slowly inward and the hole eats it. New things flicker for half a second to a second before they can be touched.

**Bands.** A bit is worth x1 outside radius 210, x2 inside it and x3 inside radius 130. The two lines are drawn on the field.

**Rally.** Each bit within 4 seconds of the last adds 5%, up to double at 20.

**Heat** multiplies everything, on the same steps as Breakpoint's Glitch meter: x1.5 from 25%, x2 from 50%, x3 from 75%. It rises with bits and with time spent in the lower bands, and falls at the edge of the screen and by 30 when a ball is lost. It also widens the horizon by up to 12 pixels and adds debris. From 40% the hole breathes in every 15 to 21 seconds: 1.2 seconds of warning, then 3 seconds of a 35% stronger pull. At 80% (Critical) NULL takes the last four digits off the score readout and throws them in as debris.

## Sector rules

Every fifth sector is THE EYE. The others take these in turn, coming round again (`SECTOR_RULES`). The names are glitches the other cabinets and the arcade floor already use.

| Sector | Rule | What it does |
|---|---|---|
| 1 | STANDARD | No tricks. |
| 2 | MEMORY LEAK | Every bit the hole eats widens it by 4 pixels, up to 48. |
| 3 | KERNEL PANIC | The field is dark. The ball lights a circle round itself, and collecting a bit lights the whole field for 0.4 seconds. |
| 4 | LAG SPIKE | Every 5 to 8 seconds, after a second of warning, the ball snaps back to where it was 0.6 seconds ago. The warning shows where. |
| 5 | THE EYE | See below. |
| 6 | QUANTUM SHIFT | Every 6 to 10 seconds, after 1.2 seconds of warning, the ball jumps to the far side of the hole at the same height. The warning shows where. |
| 7 | OVERCLOCK | Everything orbits 35% faster and a bit is worth half again. |

KERNEL PANIC is drawing only: the rules do not know the lights are off.

## THE EYE

The Eye opens in the hole and there are no bits. `eyeSpec()` has the numbers for each visit.

- **Its gaze** is a bar of light from the hole to the edge of the screen, turning against the ball, with a gap in it. The gap moves in and out. Be at the gap's height when the bar passes. Anywhere else, it takes a ball.
- **It blinks.** After a 0.7 second warning it shuts for 1.6 seconds. While it is shut it is not looking, so the bar is off.
- **Charges** (pink rings) appear one at a time. Collect one while the Eye is open and the ball fires it back: one hit, and the Eye is stunned for 1.5 seconds. Collect one while it is shut and it is wasted.
- It has 4 hits the first time, one more each visit, 8 at most. The gap is narrower each visit, and the second Eye's bar turns faster than the first's. From the third Eye (sector 15) there are two bars, opposite each other, turning a little slower.

Beating it pays 10 coins and 2,000 points.

## The two voices

All the lines are in `js/voice.js`. A line is a string, or `{ t, if }` where `if` is asked about what the game knows at that moment (`context()` in `js/game.js`). `{name}` in a line is filled from the same place. Nothing is repeated until every line that fits has been said.

### NULL

NULL's lines are typed out on the line under the field, over the game and over every menu.

**What it knows**, and so what its lines can mention:

| It knows | From |
|---|---|
| How many runs you have had, how many balls you have lost and how many went past the horizon, your best score | This cabinet's save (`glitchcade_nexus_v1`) |
| How many coins you have | The arcade's wallet |
| Your longest rally in Glitch Pong and how many sectors you have purged in Breakpoint | Their saves. It only reads them. |
| Whether you walked up to the cabinet or opened the page directly | `?cabinet` |
| Whether you are on a keyboard, a mouse or a touch screen | The last input |
| The hour | The clock |
| That you looked at another tab, and for how long | `visibilitychange` |
| That you paused, and that you are still paused 25 seconds later | The pause screen |

**What it does to the page:**

- **Plays the attract mode.** The run behind the menu is the bot, and NULL says it is itself pretending to be you.
- **Takes your score.** At Critical Heat four digits leave the score readout, which shows the holes, and arrive on the field as debris. A ball lost to one is recorded as "hit by a digit of your own score".
- **Relabels the ball counter.** When a ball goes past the horizon the BALLS label reads MINE +1 for two seconds.
- **Crashes, but not really.** At the start of sector 3, the first time, the screen is replaced by a fatal error for 3.6 seconds, and halfway through NULL admits it. After that it has a 6% chance at the start of each later sector, at most once a run.
- **Argues with the exit button.** In the cabinet, EXIT TO ARCADE reads something else for under half a second when the pointer reaches it.
- **Renames the tab** while you are looking at another one.

**What it is not allowed to do.** These are what keep it fair:

- It never moves the ball, holds the button, or moves a button you are about to press.
- The crash happens during a countdown and the clock is stopped for all of it, so nothing can be lost to it.
- The exit button always exits.
- The stolen digits are ordinary debris: they take 1.2 seconds to become solid and can be dodged.

**Switches** (Settings): *NULL: Silent* stops the terminal line and everything in the second list except the attract mode and the stolen digits, which are part of the rules. *Screen FX: Reduced* stops the shake, the tearing, the crash and the exit button's flicker.

### The ball

Four of Breakpoint's moods, with the same names:

| Mood | What it does |
|---|---|
| **LOYAL** | On your last ball it refuses the horizon and throws itself back out, once a sector. This one changes the rules; *Ball moods: Off* removes it. |
| **SHOW-OFF** | Six bits in a rally: a longer, brighter trail. |
| **GRUDGE** | Against THE EYE: a charge it picks up is fired straight back. |
| **MOURNING** | After a lost ball the next one is dim for 3.5 seconds while the lost ball's last path fades out. |

Its lines appear next to it in small lower-case letters. *Ball moods: Off* silences them.

### Adding a line

Add it to the event's list in `NULL_LINES` or `BALL_LINES`. NULL's lines are upper case and at most 110 characters; the ball's are lower case and at most 40. A line that mentions something that is only sometimes true needs an `if`. The tests check all of that, and that every event `js/game.js` asks for has a line.

## What it shares with the other two cabinets

| | Glitch Pong | Breakpoint | Black-Hole Nexus |
|---|---|---|---|
| The risk meter | Heat | Glitch meter | Heat, on the Glitch meter's steps |
| The sentient ball | Jukes, grudges | Nine moods | Four of those moods, and it speaks |
| THE EYE | Arrives at full Heat | Every tenth sector | Every fifth sector, in the hole |
| Glitches by name | Arenas: MEMORY LEAK, KERNEL PANIC, QUANTUM SHIFT, STACK OVERFLOW... | Events: MEMORY LEAK, KERNEL PANIC, LAG SPIKE, QUANTUM SHIFT, OVERCLOCK... | Sector rules: the same five |
| Where it is | Black-Hole Nexus is one of its arenas | BLACK HOLE NEXUS is one of its arenas | The place itself |
| 3-2-1-GO | Art and voice | Glitch Pong's art and voice | Glitch Pong's voice |
| Music | Black-Hole Nexus playlist | Event Horizon, DO NOT BLINK | Both playlists, and DO NOT BLINK for THE EYE |
| Coins | 10 a win | 2 a sector, 10 a boss | 2 a sector, 10 for THE EYE |
| Ball colour, skin, trail | Chosen in the Store | Worn | Worn |
| The look | | The same tokens, fonts and buttons | The same again |

The debris is drawn from the other games: bricks in Breakpoint's colours, paddles in Glitch Pong's blue and red.

Everything shared goes through `localStorage`, so the three games must be served from the same site.

## In the arcade

Cabinet 03 is the second machine on the left as you walk in, next to Breakpoint (`buildNexusCabinet` in `glitchcade.js`). It is always online: it never needed a repair. Its marquee, side art and attract screen are drawn in `glitchcade.js` next to Breakpoint's, and one of the ceiling TVs' feeds is its attract screen.

Like Breakpoint, it runs as its own page in a full-screen frame (`nexus/index.html?cabinet`). In that mode the main menu shows **Exit to arcade**, and Esc on the main menu does the same. The page posts two messages to the arcade:

- `{ type: 'glitchcade:exit' }` when you leave.
- `{ type: 'glitchcade:nexus', event: 'run', score, sector }` when a run ends. The arcade puts a personal best on the high-score TV channel (`onNexusReport` in `glitchcade-floor.js`).

The **NEXUS** button on the arcade's title menu flies the camera into the cabinet.

Two of the daily challenges ask for coins earned here. The cabinet counts the coins it has paid in its own save, and the daily board subtracts them from what it would otherwise credit to Breakpoint (`statSnapshot` in `glitchcade-state.js`).

**The save** (`glitchcade_nexus_v1`, shape in `defaultSave()`): best score, deepest sector, best rally, counts of runs, balls lost, balls past the horizon, sectors, Eyes and coins, time played, and the four settings. It is in Glitch Pong's save export, and the admin menu's Reset Progress clears it.

## What was measured

`node scripts/nexus-sim.mjs` plays full runs with the bot that also plays the attract mode. The bot sees only what a player sees and answers with the one button, but it is steadier than a person and it never panics, so these numbers say what the rules allow, not how a first run goes. No person has play-tested the difficulty yet.

Twenty runs each:

| | Bot at full skill | Bot that looks a short way ahead (skill 0.2) |
|---|---|---|
| Sector reached (median) | 15 | 10 |
| Sector reached (least to most) | 10 to 15 | 5 to 15 |
| Time in play (median) | 14 minutes | 6½ minutes |
| Coins (median) | 44 | 26 |
| Score (median) | 72,000 | 43,000 |
| Beat the first Eye | 20 of 20 | 19 of 20 |
| Beat the second Eye | 17 of 20 | 9 of 20 |
| Balls lost to debris / the gaze / its own score | 18 / 41 / 1 | 32 / 19 / 9 |

- **A sector takes the full-skill bot between 27 seconds (sector 1) and 81 seconds (sector 10, THE EYE).**
- **Letting go of the button** loses all three balls in about 8 seconds of play and earns nothing.
- **Holding it down forever** collects nothing in 90 seconds: no bit can be reached from the edge of the screen.
- **Coins.** About 3 to 4 coins a minute for the bot. A person will be slower.
- **The third Eye is a wall for the bot.** None of the 15 full-skill runs that reached sector 15 got past it. Started at sector 15 with three balls, the bot beat it in 3 runs of 20. Two bars leave it little time to fetch a charge between passes. Whether that is too hard for a person is not known.

Two things were changed because of what the bot did:

- **The hole's breath was too strong.** At 1.7 times the normal pull, a ball inside radius 93 could not climb out even with the button held. It is 1.35 times now, and a test checks the button always wins.
- **The second Eye had two bars.** The bot lost to it nearly every time. One bar until the third Eye; and the first two Eyes turn a little slower with a wider gap than first written.

## Where to change things

| To change | Look at |
|---|---|
| How the ball handles | `TUNE` in `js/rules.js`: `THRUST`, `G0`, `G_K`, `DAMP`, `W_EDGE`, `W_EXP` |
| Scoring, bands, Heat | `TUNE`, `heatMultiplier`, `bandOf`, `chainBonus` |
| How long a sector is, how much debris | `quota`, `debrisTarget` |
| A sector rule, or a new one | `SECTOR_RULES`, and its branch in `step()`; give NULL a `rule_<id>` line |
| THE EYE | `eyeSpec`, `gapRadius` |
| What a sector pays | `COINS` |
| What NULL or the ball says | `js/voice.js` |
| What NULL does to the page | `onEvent`, `hud` and `startCrash` in `js/game.js` |
| The music | `MUSIC` in `js/audio.js` |
| The cabinet in the arcade | `makeNexusMarquee`, `makeNexusSideArt`, `createNexusScreen`, `buildNexusCabinet` in `glitchcade.js` |

After changing a number in `js/rules.js`, run the tests and the sim: the tests fail if the bot can no longer reach THE EYE in most runs.
