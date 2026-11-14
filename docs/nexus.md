# Black-Hole Nexus

How Black-Hole Nexus (cabinet 03, `nexus/`) is put together: the classic underneath it, the flight, the debris, the sector rules, THE EYE, the two characters who talk, what it shares with Glitch Pong and Breakpoint, and where to change each. What was measured is at the end.

It began as the 30-second ROM fragment on cabinet 06. It is now a whole game on cabinet 03, next to Breakpoint, and the fragment is gone (see [glitchcade-floor.md](glitchcade-floor.md) for what happened to the cabinets and to old saves).

## The classic underneath

Every cabinet in the Glitchcade is a take on one arcade classic, in the Glitch Pong look. Glitch Pong is the bat-and-ball game. Breakpoint is the brick breaker. Black-Hole Nexus is the **spin-and-thrust rock shooter**:

- You turn, thrust the way you are facing, and keep drifting when you let go.
- You fire. What you hit breaks in two, and those pieces break in two again.
- Fly off one side of the screen and you come back on the other. So does the debris.

It takes the genre's mechanics and nothing else: no ship, no rocks, none of the original's art, sound or layout. What the glitch adds is a hole in the middle of the screen that pulls on everything, Heat, a rule for each sector, and THE EYE.

## The idea

Every ball that got past a paddle in Glitch Pong, and every ball that fell off the bottom in Breakpoint, went somewhere. It went here: a hole in the machine's memory. In this cabinet there is no paddle. You are the ball, and what you are shooting is what the other two cabinets threw away: Breakpoint's bricks, Glitch Pong's paddles, blocks of static.

Two characters talk, and both know they are in a game:

- **NULL** is the hole. It talks to the player, not to the ball.
- **The ball** is the same sentient ball the other two cabinets have. It talks to you too, in lower case.

**THE EYE** is the same Eye as in the other two games. It has no cabinet of its own, so every fifth sector it looks out of this one.

## Files

| File | What is in it |
|---|---|
| `nexus/index.html` | The page: HUD, menus, touch buttons, styles (Breakpoint's design tokens and buttons) |
| `js/rules.js` | The whole game as numbers: the flight, the debris, scoring, Heat, each sector's rule, THE EYE, the bot, the save. No page code. |
| `js/voice.js` | Every line NULL and the ball can say, and when each one is allowed. No page code. |
| `js/game.js` | Drawing, sound triggers, controls, menus, and the things NULL does to the page |
| `js/audio.js` | Streamed music and synthesized sound effects |
| `js/wallet.js` | What is shared with the other cabinets: coins, the cabinet bridge, ball colour, skin and trail |

`js/rules.js` and `js/voice.js` run under Node:

```bash
node --test tests/*.mjs            # tests/nexus-rules.test.mjs covers this cabinet
node scripts/nexus-sim.mjs         # plays 12 runs with the bot and prints what happened
```

The game is ES modules, so it has to be served (`python -m http.server` from the repo root, then `/nexus/`); it does not open from a file.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Turn | ← → or A D | ◀ ▶, bottom left |
| Thrust | ↑ or W | ▲, bottom right |
| Fire | Space (hold to keep firing) | ●, bottom right |
| Pause | P or Esc | The II button |

There is no mouse control. The touch buttons can be held together.

## The flight

All in `TUNE` at the top of `js/rules.js`.

- **Turning** is 4.2 radians a second (`TURN`): a half turn takes three quarters of a second.
- **Thrust** pushes the ball the way it is facing (`THRUST`). It keeps drifting afterwards and slows gradually (`DRAG`). Top speed is 320 pixels a second.
- **The hole pulls** on the ball all the time: gently at the edge of the screen (`G0`), four and a half times harder at the horizon (`G_K`). Thrust always beats it, even at the horizon while the hole is breathing in; a test checks that.
- **The edge of the screen wraps** (`R_OUT`). The field is round, so going off one side puts you on the opposite side, moving the same way.
- **The horizon** (`R_HOLE`, wider with Heat and in MEMORY LEAK) is the inner limit. Past it the ball is lost.
- You have three balls. Each one starts high up in a slow orbit, which drag wears down in a few seconds, and cannot be hurt for its first 2.2 seconds.

**Shots** leave at 520 pixels a second and last 0.62 seconds, so they reach a little more than the radius of the field. Holding fire sends one every 0.24 seconds, with four on screen at most. They stop at the edge of the screen and the hole bends them slightly.

## The debris

| Size | Radius | Worth | When shot |
|---|---|---|---|
| Big | 29 | 10 | Breaks into two medium pieces |
| Medium | 18 | 20 | Breaks into two small pieces |
| Small | 10 | 40 | Gone |

So one big piece is seven pieces all told. A sector is cleared by breaking its quota of pieces (`quota`): 35 in sector 1, seven more each sector, 91 at most.

- A big piece comes in over the edge of the screen, away from the ball, flickering for a second before it can be touched or shot. More arrive until the quota is met (`debrisTarget`). Debris gets 6% faster each sector, up to 1.9 times.
- Touch a piece and the ball is gone. Passing within 13 pixels without touching scores 25 and adds Heat.
- The hole pulls on debris a little and eats what reaches it. What it eats does not count toward the quota.
- **Power-ups** drop from small pieces 8% of the time, from sector 2, one on screen at a time, for 10 seconds. FIREWALL takes one hit. SPREAD SHOT fires three at once for 8 seconds. TIME FREEZE stops the debris and THE EYE for 4 seconds.

## Scoring

- **Depth.** A kill is worth x1 if the ball is outside radius 210 when it makes it, x2 inside that and x3 inside radius 130. The two lines are drawn on the field. It is where the ball is that counts, not the piece.
- **Rally.** Each kill within 3 seconds of the last adds 5%, up to double at 20.
- **Heat** multiplies everything, on the same steps as Breakpoint's Glitch meter: x1.5 from 25%, x2 from 50%, x3 from 75%. It rises with kills and with time spent in the lower bands, and falls by 30 when a ball is lost. It also widens the horizon by up to 12 pixels and adds debris. From 40% the hole breathes in every 15 to 21 seconds: 1.2 seconds of warning, then 3 seconds of a pull 1.9 times as strong. At 80% (Critical) NULL takes the last four digits off the score readout and throws them at the ball as small pieces, which can be shot like any other.

## Sector rules

Every fifth sector is THE EYE. The others take these in turn, coming round again (`SECTOR_RULES`). The names are glitches the other cabinets and the arcade floor already use.

| Sector | Rule | What it does |
|---|---|---|
| 1 | STANDARD | No tricks. |
| 2 | MEMORY LEAK | Every piece the hole eats widens it by 3 pixels, up to 36. Every piece you break narrows it by 1. |
| 3 | KERNEL PANIC | The field is dark. The ball lights a circle round itself, each shot carries a small light, and a hit lights the whole field for 0.4 seconds. |
| 4 | LAG SPIKE | Every 5 to 8 seconds, after a second of warning, the ball snaps back to where it was 0.6 seconds ago, with the speed it had then. The warning shows where. |
| 5 | THE EYE | See below. |
| 6 | QUANTUM SHIFT | Every 6 to 8 seconds, after 1.2 seconds of warning, every piece of debris jumps to the far side of the hole. The warning shows where each will land. A piece that would land on the ball stays where it is. |
| 7 | OVERCLOCK | The debris drifts 35% faster and a kill is worth half again. |

KERNEL PANIC is drawing only: the rules do not know the lights are off.

## THE EYE

The Eye opens in the hole. There is no quota: the sector ends when the Eye is shut for good. `eyeSpec()` has the numbers for each visit.

- **Its gaze** is a bar of light from the hole to the edge of the screen, turning round, with a gap in it. The gap moves in and out. Be at the gap's height when the bar passes. Anywhere else, it takes a ball.
- **It blinks.** After a 0.7 second warning it shuts for 1.6 seconds. While it is shut it is not looking, so the bar is off.
- **Shoot it.** A shot that reaches the hole while the Eye is open is a hit. While it is shut the shot is wasted. It takes 48 hits the first time, 12 more each visit, 96 at most.
- The gap is narrower and the bar turns faster each visit. From the third Eye (sector 15) there are two bars, opposite each other, turning a little slower.
- Debris keeps arriving, less of it than in an ordinary sector.

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
| That you have stopped firing for 9 seconds, or have just flown off the edge of the screen | The run |

**What it does to the page:**

- **Plays the attract mode.** The run behind the menu is the bot, and NULL says it is itself pretending to be you.
- **Takes your score.** At Critical Heat four digits leave the score readout, which shows the holes, and fly at the ball as small pieces of debris. A ball lost to one is recorded as "hit by a digit of your own score".
- **Relabels the ball counter.** When a ball goes past the horizon the BALLS label reads MINE +1 for two seconds.
- **Crashes, but not really.** At the start of sector 3, the first time, the screen is replaced by a fatal error for 3.6 seconds, and halfway through NULL admits it. After that it has a 6% chance at the start of each later sector, at most once a run.
- **Argues with the exit button.** In the cabinet, EXIT TO ARCADE reads something else for under half a second when the pointer reaches it.
- **Renames the tab** while you are looking at another one.

**What it is not allowed to do.** These are what keep it fair:

- It never moves the ball, presses a control, or moves a button you are about to press.
- The crash happens during a countdown and the clock is stopped for all of it, so nothing can be lost to it.
- The exit button always exits.
- The stolen digits are ordinary small debris: they take 1.2 seconds to become solid, and can be dodged or shot.

**Switches** (Settings): *NULL: Silent* stops the terminal line and everything in the second list except the attract mode and the stolen digits, which are part of the rules. *Screen FX: Reduced* stops the shake, the tearing, the crash and the exit button's flicker.

### The ball

Four of Breakpoint's moods, with the same names:

| Mood | What it does |
|---|---|
| **LOYAL** | On your last ball it refuses the horizon and throws itself back out, once a sector. *Ball moods: Off* removes it. |
| **SHOW-OFF** | Six kills in a rally: a longer, brighter trail. |
| **GRUDGE** | Against THE EYE its shots bend toward the hole five times as hard, so a shot that would have gone wide still lands. *Ball moods: Off* removes this too. |
| **MOURNING** | After a lost ball the next one is dim for 3.5 seconds while the lost ball's last path fades out. |

Its lines appear next to it in small lower-case letters. *Ball moods: Off* silences them.

### Adding a line

Add it to the event's list in `NULL_LINES` or `BALL_LINES`. NULL's lines are upper case and at most 110 characters; the ball's are lower case and at most 40. A line that mentions something that is only sometimes true needs an `if`. The tests check all of that, and that every event `js/game.js` asks for has a line.

## What it shares with the other two cabinets

| | Glitch Pong | Breakpoint | Black-Hole Nexus |
|---|---|---|---|
| The classic underneath | Bat and ball | Brick breaker | Spin-and-thrust rock shooter |
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

The debris is drawn from the other games: chunks of wall in Breakpoint's brick colours, paddles in Glitch Pong's blue and red.

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

`node scripts/nexus-sim.mjs` plays full runs with the bot that also plays the attract mode. The bot sees only what a player sees and answers with the same four controls, but it aims faster and steadier than a person and it never panics, so these numbers say what the rules allow, not how a first run goes. **No person has play-tested this yet**, and a turn-and-thrust game is much harder for a person than for a bot.

Twenty runs each. The second bot looks only a short way ahead for danger (skill 0.2); it did about as well as the first, so looking ahead is not what limits the bot.

| | Bot at full skill | Bot at skill 0.2 |
|---|---|---|
| Sector reached (median) | 11 | 12 |
| Sector reached (least to most) | 3 to 17 | 7 to 15 |
| Time in play (median) | 7½ minutes | 9 minutes |
| Coins (median) | 36 | 38 |
| Score (median) | 204,000 | 248,000 |
| Beat the first Eye | 19 of the 19 that reached it | 20 of 20 |
| Beat the second Eye | 11 of 12 | 15 of 18 |
| Beat the third Eye | 1 of 4 | 0 of 3 |
| Balls lost to debris / the gaze / the hole / its own score | 48 / 9 / 2 / 1 | 37 / 12 / 8 / 3 |

- **A sector takes the full-skill bot between 26 seconds (sector 1) and 55 seconds (sector 12).** THE EYE takes it 35 seconds the first time, 46 the second and 79 the third.
- **Doing nothing** loses all three balls in about 16 seconds of play. So does holding fire without moving, and so does spinning on the spot while firing. None of them clears a sector.
- **The third Eye** is where most long runs end. Started at sector 15 with three balls, the bot beat it in 17 runs of 20; arriving there with what was left of a run, in 1 of 7.
- **Coins: 4 to 5 a minute for the bot. That is probably too generous.** Breakpoint's AI takes 17 minutes over a 12-sector Classic run ([breakpoint-balance.md](breakpoint-balance.md)), which at the same prices is 40 coins, or about 2½ a minute. A person will be slower than the bot here, but by how much is not known. If it turns out to pay too well, raise `quota` or lower `COINS`.

Three things were changed because of what the bot did:

- **THE EYE fell in 17 seconds.** It took 18 hits. It takes 48 now.
- **The hole was eating most of the debris before it could be shot.** In one MEMORY LEAK sector it ate 83 pieces in two minutes while the bot broke 21. The hole's pull on debris was cut from 0.3 of its pull on the ball to 0.12, debris now comes in on paths that pass wider of the hole, and in MEMORY LEAK breaking a piece narrows the hole again.
- **Sectors were over in 20 seconds.** The quota went from 21 pieces in sector 1 to 35, and shots were limited to four on screen, one every 0.24 seconds.

## Where to change things

| To change | Look at |
|---|---|
| How the ball handles | `TUNE` in `js/rules.js`: `TURN`, `THRUST`, `DRAG`, `MAX_SPEED`, `G0`, `G_K` |
| The shots | `TUNE`: `SHOT_SPEED`, `SHOT_LIFE`, `SHOT_GAP`, `SHOTS` |
| What a piece is worth, and how it breaks | `TUNE.PIECE`, `TUNE.RAD`, `breakPiece` |
| Scoring, bands, Heat | `TUNE`, `heatMultiplier`, `bandOf`, `chainBonus` |
| How long a sector is, how much debris, how fast | `quota`, `debrisTarget`, `debrisSpeed` |
| A sector rule, or a new one | `SECTOR_RULES`, and its branch in `step()`; give NULL a `rule_<id>` line |
| THE EYE | `eyeSpec`, `gapRadius` |
| What a sector pays | `COINS` |
| What NULL or the ball says | `js/voice.js` |
| What NULL does to the page | `onEvent`, `hud` and `startCrash` in `js/game.js` |
| How the debris is drawn | `drawDebris` in `js/game.js` |
| The music | `MUSIC` in `js/audio.js` |
| The cabinet in the arcade | `makeNexusMarquee`, `makeNexusSideArt`, `createNexusScreen`, `buildNexusCabinet` in `glitchcade.js` |

After changing a number in `js/rules.js`, run the tests and the sim: the tests fail if the bot can no longer reach sector 4 in most runs.
