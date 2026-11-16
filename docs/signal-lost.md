# Signal Lost

How Signal Lost (cabinet 04, `signal/`) is put together: the classic underneath it, the maze, the four chasers, what it takes from Glitch Pong, the ten mazes and their rules, the two characters who talk, why it can always be beaten, and where to change each. What was measured is at the end.

It began as the 30-second ROM fragment on cabinet 03, then 06. It is now a whole game on cabinet 04, next to Black-Hole Nexus, and the fragment is gone (see [glitchcade-floor.md](glitchcade-floor.md) for what happened to the cabinets and to old saves).

## The classic underneath

Every cabinet in the Glitchcade is a take on one arcade classic, in the Glitch Pong look. Signal Lost is the **maze chase**:

- A maze full of things to collect. Take every one and the maze is cleared.
- Four chasers. Each has one way of hunting, and they take turns between hunting and backing off.
- A few items that turn the chase round for a few seconds, so the chasers run and can be caught.
- A tunnel from one side of the screen to the other.
- Turns can be asked for early: press a direction and the ball takes it at the next opening.

It takes the genre's mechanics and nothing else: its own mazes, its own chasers and their rules, none of the original's characters, art, sound or layout.

## The idea

When a cabinet loses its signal, what is left on the screen is static. Here the static is four pieces, and it hunts. You are the ball, the same sentient ball as the other cabinets', and what you are collecting is the signal: packets. Collect all of it in ten mazes and the picture comes back.

Two characters talk, and both know they are in a game:

- **The static** is the four chasers, speaking as one. It says "we". It talks to the player, not to the ball.
- **The ball** talks to you too, in lower case.

**THE EYE** is the same Eye as in the other games. It arrives when Heat is full, as it does in Glitch Pong, and the tenth maze is its lair.

## Files

| File | What is in it |
|---|---|
| `signal/index.html` | The page: HUD, menus, the touch button, styles (the other cabinets' design tokens and buttons) |
| `js/rules.js` | The whole game as numbers: the maze generator, movement, the chasers, scoring, Heat, each maze's rule, THE EYE, the bot, the save. No page code. |
| `js/voice.js` | Every line the static and the ball can say, and when each one is allowed. No page code. |
| `js/game.js` | Drawing, sound triggers, controls, menus, and the things the static does to the page |
| `js/audio.js` | Streamed music and synthesized sound effects |
| `js/wallet.js` | What is shared with the other cabinets: coins, the cabinet bridge, ball colour, skin and trail |
| `js/neon.js` | The drawing helpers behind the look: glass panes, neon tubes, soft lights, comet trails, sparks, the bloom pass. The same file is in both `nexus/` and `signal/`; a test keeps the two copies equal. |

`js/rules.js` and `js/voice.js` run under Node:

```bash
node --test tests/*.mjs            # tests/signal-rules.test.mjs covers this cabinet
node scripts/signal-sim.mjs        # plays 12 runs with the bot and prints what happened
```

The game is ES modules, so it has to be served (`python -m http.server` from the repo root, then `/signal/`); it does not open from a file.

## How it is drawn

The picture is built the way Glitch Pong and Breakpoint build theirs, so the cabinets look like one machine.

- **A painted backdrop.** The wall behind the maze (nebula, stars, the arcade's grid, light coming up off the floor, corner brackets) is painted once for each maze onto its own sheet. Each of the ten mazes takes its arena's colour and leaves something of that arena on the wall: the court's centre line, a stack of hex digits, frost, the train's rails.
- **The walls.** Panes of glass with scan lines across them and a tube of neon round every edge. The tube is walked corner by corner, so every turn is a curve. They are drawn once for each maze, and again when a wall moves.
- **Packets** are points of light. **Overrides** are turning panes of amber glass.
- **The static.** Each of the four is a pane of live static in its own colour, with a white visor on the side it is heading and, now and then, a slice of itself out of place. Running, they lose their colour and their edge goes to dashes.
- **Light.** The ball, its comet trail and every spark add light to what is under them. A catch goes off with a ring.
- **Bloom.** After everything is drawn, the picture is shrunk to a ninth of its size and smaller, and added back over itself, so anything bright spills light. *Screen FX: Reduced* and the battery saver both turn it off. If the page stays under about forty frames a second while asking for sixty, the bloom is dropped until the page is opened again (`watchSpeed` in `js/game.js`).

None of this is in `js/rules.js`: the look can change without the game changing.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Steer | Arrows or W A S D | Slide a thumb round the pad, or swipe anywhere on the screen. Both work at once. |
| Dash | Space | The DASH button |
| Pause | P or Esc | The II button |

**On a phone.** A direction is a turn the ball takes when it reaches an opening, so nothing has to be held and a turn can be given early.

- **The pad** is one round control, not four buttons: the way from its middle to the thumb is the way the ball goes, so a thumb can slide from one direction to the next without lifting. Leaving the direction already chosen takes a clear move toward another (`dragDir`), so a thumb resting on a diagonal does not flicker between two.
- **A swipe** works anywhere that is not a button, including outside the maze. A flick of about a thirtieth of the screen's width is enough, and one drag can make several turns.
- **Where they sit.** Held upright, a phone has height to spare, so the screen grows downward (`layout`) and the pad and DASH sit under the maze, where a thumb does not cover the game. The static's line moves to just under the maze. On its side the cabinet is drawn small with empty glass either side, so the pad and DASH are sized for a thumb rather than for the cabinet (about 40% of the screen's height) and sit out in that space.
- **What you are shown.** The pad lights the arrow for the turn the ball has been given, and a small amber chevron beside the ball shows a turn that is waiting for an opening. Where the phone can, a turn is also a short tick in the hand (off with *Screen FX: Reduced*).
- **Settings → Touch pad**: *Left* (pad under the left thumb, DASH under the right), *Right* (swapped), or *Off* (no pad; swipe only, and the screen keeps its shorter shape). The setting only shows on a touch screen.

## The maze

A 21 by 21 grid (`buildMaze`). Corridors run through the odd rows and columns, so every junction is on an odd tile and every wall is one tile thick.

- It is the same left and right.
- The **pen** is in the middle, with a ring of corridor round it and a door in its roof. The static starts there and goes back there when it is caught.
- The ball starts under the pen.
- There is a **tunnel** through the side walls on one row. The static moves at 3.4 tiles a second within three tiles of either end of it.
- There are four **overrides**, one toward each corner, and a packet on every other corridor tile: between 210 and 229 things to take in a maze.
- **There are no dead ends**, and there is always more than one way round.

Each of the ten mazes is generated from a fixed seed (`MAZES`), so maze 3 is the same maze every time you play it. To change a maze, change its seed, or `loops` (how many extra openings it has), or `tunnel` (which row).

## The ball and the static

All in `TUNE` at the top of `js/rules.js`. Speeds are in tiles a second.

| | Speed |
|---|---|
| The ball | 6.5 |
| The static, maze 1 | 5.0 |
| The static, each maze after | 0.12 more, up to 6.1 |
| The static, running from you | 3.4 |
| The static, caught, on its way back to the pen | 12 |

**The static is never as fast as the ball.** A test checks that for sixty mazes.

One piece is out at the start of a maze. The others leave the pen 3, 8 and 14 seconds in. They hunt for 18 seconds, then back off to the corners for 5 (a quarter of a second less each maze, down to 2½), and so on; when they change over they turn round, which is how you can tell.

| | How it hunts |
|---|---|
| **PING** | Goes straight for you. |
| **CACHE** | Goes for the tile four ahead of the way you are facing. |
| **MIRROR** | Goes for where you would be if the maze were flipped left to right, so it comes from the other side. Within six tiles it goes straight for you. |
| **LAG** | Goes for where you were three seconds ago. |

A piece of static does not turn back on itself, and at each junction it takes the way that gets it nearest to where it is going. Those rules are shown on the screen at the start of maze 1.

**It misjudges junctions, the way a person does.** In maze 1, one junction in five, it takes a way at random, and a `?` shows over it when it does. That falls by 1.6 in a hundred each maze, down to one in twenty (`lapseChance`). This is the same idea as Glitch Pong's computer player, which is built to make a person's mistakes ([ai.md](ai.md)).

**Overrides.** Taking one makes every piece that is out run from you: for 7 seconds in maze 1, 0.4 less each maze, 3 at least. Touch one while it is running and it is caught, and goes back to the pen. The first is worth 150, then 300, 600 and 1,200.

**Losing a ball.** Touch a piece that is not running and the ball is gone. Everything goes back to where it started, and the packets you had taken stay taken. You have three balls, and clearing every third maze gives one back, up to five.

## What it takes from Glitch Pong

- **Heat.** It builds with every packet (half a point), close call (5) and catch (6), falls by 0.4 a second, and drops 30 when a ball is lost. It multiplies everything you score: x1.5 from 25%, x2 from 50%, x3 from 75%.
- **THE EYE arrives at full Heat.** The static goes to the corners. The Eye looks down the corridor the ball is in (the whole straight run, wall to wall), shows it for 1.15 seconds, and fires along it for 0.35. Be round a corner. It does that four times, 1.3 seconds apart, then leaves: 1,000 points and Heat back to 40%. If it hits, the ball is gone and it leaves at once.
- **The dash.** Twice the speed for 0.4 seconds, then 6 seconds before it can be used again. It does not make the ball safe; it gets it somewhere else.
- **A close call scores.** A piece of static within a tile and a half of the ball, and then more than 2.6 away with the ball still alive: 25 points and Heat.
- **The arenas.** Each maze is one of Glitch Pong's arenas: its name, its one rule, its music, and its colour.
- **The same look, the same ball** with its colour, skin and trail, **the same countdown voice**, and the same coin wallet.

Leaving a line that is about to fire gets the benefit of the doubt: the ball is out of it once it is a third of the way into a tile that is not on the line (`onLine`).

## The ten mazes

| Maze | Arena | Rule |
|---|---|---|
| 1 | GLITCH ARENA | No tricks. |
| 2 | STACK OVERFLOW | The top and bottom wrap as well: two more tunnels, through the roof and the floor. |
| 3 | KERNEL PANIC | The lights are out. You see what is within about four and a half tiles of the ball. The static glows faintly, so you can see it coming, and taking an override lights the whole maze for a moment. |
| 4 | COOLANT LEAK | The floor is ice. The ball cannot turn back the way it came, and cannot stop: it slides round whatever corner is there. |
| 5 | QUANTUM SHIFT | Two linked portals. Go into one and you come out of the other. So does the static. |
| 6 | MEMORY LEAK | Corridors you have emptied close behind you: one every 6 seconds, eight at most, each after a 1½ second warning. |
| 7 | ECHO | An echo of the ball follows the path it took, 3½ seconds behind. Touch it and the ball is gone. Keep moving and never double back onto your own trail. |
| 8 | DEFRAG | The walls rearrange: every 8 seconds, after a 1½ second warning, one corridor closes and one wall opens. |
| 9 | LAST TRAIN | A train runs along the tunnel row every 10 seconds, after 1.6 seconds of flashing signals. It takes the ball if the ball is on that row, and sends any static on it back to the pen. |
| 10 | THE EYE'S LAIR | THE EYE is here from the start and fires down your corridor every 5½ seconds for the whole maze. |

KERNEL PANIC is drawing only: the rules do not know the lights are off.

**Clearing the tenth maze restores the signal.** That is the end of the game, and the run can stop there. If it goes on, the ten come round again from maze 11 with the static faster (up to its limit) and making fewer mistakes.

## Why it can always be beaten

These hold in every maze, and `tests/signal-rules.test.mjs` checks each of them:

- **Every packet can be reached, and there are no dead ends**, in all ten mazes as built (`mazeIsSound`).
- **A wall never moves in a way that breaks that.** In MEMORY LEAK and DEFRAG, a change is only made if afterwards every open tile can still be reached and none has become a dead end. The test plays both mazes with the bot and checks after every single change.
- **A corridor only closes once it is empty**, never with a packet in it, never within 2½ tiles of the ball or the static, and never on anyone. The pen and its ring are left alone.
- **Every change has a warning**, drawn on the tile that will change.
- **The static is never as fast as the ball**, in any maze, however long the run goes on.
- **The static's rules are fixed, and shown.** It does not cheat, and its mistakes are part of its rules.
- **Standing still, or holding one direction, clears nothing.**
- **The bot beats it.** The bot that plays the attract mode clears all ten mazes in most of its runs; a test fails if it cannot do so in at least half.

What the tests cannot say is how hard it is for a person. Nobody has played it by hand yet.

## The two voices

All the lines are in `js/voice.js`. A line is a string, or `{ t, if }` where `if` is asked about what the game knows at that moment (`context()` in `js/game.js`). `{name}` in a line is filled from the same place. Nothing is repeated until every line that fits has been said.

### The static

Its lines are typed out on the line under the maze, over the game and over every menu.

**What it knows**, and so what its lines can mention:

| It knows | From |
|---|---|
| How many runs you have had, how often it has caught you and you it, your best score, how many times you have restored the signal | This cabinet's save (`glitchcade_signal_v1`) |
| How many coins you have | The arcade's wallet |
| How many times you have survived THE EYE in Glitch Pong, and how many of your balls NULL has in Black-Hole Nexus | Their saves. It only reads them. |
| Whether you walked up to the cabinet or opened the page directly | `?cabinet` |
| The hour | The clock |
| That you looked at another tab, and for how long | `visibilitychange` |
| That you paused, and that you are still paused 25 seconds later | The pause screen |
| Which of the four caught you | The run |

**What it does to the page:**

- **Plays the attract mode.** The run behind the menu is the bot, and the static says it is one of them wearing the ball.
- **Tells you how it hunts.** The four rules are on the screen at the start of maze 1, and it says they will not help.
- **Shows its mistakes.** The `?` over a piece that has misjudged a junction.
- **Gets into your counter.** At Critical Heat (80%) the SIGNAL readout turns to noise for 2½ seconds. The count underneath is still right; it just cannot be read.
- **Relabels the ball counter.** When it catches the ball the BALLS label reads OURS +1 for two seconds.
- **Goes off air, but not really.** At the start of maze 3, the first time, the screen is replaced by NO SIGNAL for 3.4 seconds, and halfway through it admits that is the name of the game. After that it has a 6% chance at the start of each later maze, at most once a run.
- **Argues with the exit button.** In the cabinet, EXIT TO ARCADE reads something else for under half a second when the pointer reaches it.
- **Renames the tab** while you are looking at another one.

**What it is not allowed to do.** These are what keep it fair:

- It never moves the ball, presses a control, or moves a button you are about to press.
- The NO SIGNAL screen happens during a countdown and the clock is stopped for all of it, so nothing can be lost to it.
- The counter it gets into is only a readout. Nothing in the maze changes.
- The exit button always exits.

**Switches** (Settings): *Static: Silent* stops the terminal line, the noise in the counter, the relabelled ball counter, the NO SIGNAL screen, the exit button's trick and the renamed tab. *Screen FX: Reduced* stops the shake, the tearing, the NO SIGNAL screen and the exit button's flicker.

### The ball

Four of Breakpoint's moods, with the same names:

| Mood | What it does |
|---|---|
| **LOYAL** | On your last ball it shrugs off the first thing that would have taken it, once a maze, and cannot be hurt for two seconds. *Ball moods: Off* removes it. |
| **GRUDGE** | It remembers which piece of static caught it last. Catching that one is worth double. *Ball moods: Off* removes this too. |
| **SHOW-OFF** | Twenty packets in a rally: a longer, brighter trail. |
| **MOURNING** | After a lost ball the next one is dim for 3.5 seconds. |

Its lines appear next to it in small lower-case letters. *Ball moods: Off* silences them.

### Adding a line

Add it to the event's list in `STATIC_LINES` or `BALL_LINES`. The static's lines are upper case and at most 125 characters; the ball's are lower case and at most 44. A line that mentions something that is only sometimes true needs an `if`. The tests check all of that, and that every event `js/game.js` asks for has a line.

## In the arcade

Cabinet 04 is the third machine on the left as you walk in, after Breakpoint and Black-Hole Nexus (`buildSignalCabinet` in `glitchcade.js`). It is always online. Its marquee, side art and attract screen are drawn in `glitchcade.js` next to the others', and one of the ceiling TVs' feeds is its attract screen.

Like the other two, it runs as its own page in a full-screen frame (`signal/index.html?cabinet`). In that mode the main menu shows **Exit to arcade**, and Esc on the main menu does the same. The page posts two messages to the arcade:

- `{ type: 'glitchcade:exit' }` when you leave.
- `{ type: 'glitchcade:signal', event: 'run', score, maze, restored }` when a run ends, and when the tenth maze is cleared. The arcade puts a personal best on the high-score TV channel (`onSignalReport` in `glitchcade-floor.js`).

The **SIGNAL LOST** button on the arcade's title menu flies the camera into the cabinet.

Two of the daily challenges ask for coins earned here. The cabinet counts the coins it has paid in its own save, and the daily board subtracts them from what it would otherwise credit to Breakpoint (`statSnapshot` in `glitchcade-state.js`).

**The save** (`glitchcade_signal_v1`, shape in `defaultSave()`): best score, deepest maze, counts of runs, balls lost, times caught and catches, mazes, Eyes, signals restored and coins, time played, and the four settings. It is in Glitch Pong's save export, and the admin menu's Reset Progress clears it.

## What was measured

`node scripts/signal-sim.mjs` plays full runs with the bot that also plays the attract mode. The bot sees only what a player sees and answers with a direction and the dash. It plans a few tiles ahead by trying each route against the static's rules, and it never hesitates, so these numbers say what the rules allow, not how a first run goes. **No person has play-tested this yet.**

Thirty runs each. The second bot looks seven tiles ahead instead of nine (skill 0.2); it did as well as the first.

| | Bot at full skill | Bot at skill 0.2 |
|---|---|---|
| Cleared all ten mazes | 20 of 30 | 20 of 30 |
| Maze reached (least) | 3 | 2 |
| Time in play (median) | 11 minutes | 11 minutes |
| Coins (median) | 28 | 28 |
| Score (median) | 116,000 | 116,000 |
| Eyes survived in a run (median) | 9 | 9 |
| Static caught in a run (median) | 14 | 13 |
| Balls lost to CACHE / PING / MIRROR / LAG | 37 / 25 / 20 / 13 | 33 / 24 / 28 / 12 |
| Balls lost to THE EYE / its own echo / the train | 25 / 8 / 0 | 16 / 5 / 1 |

- **A maze takes the bot between 55 and 76 seconds.** QUANTUM SHIFT is the quickest and KERNEL PANIC and ECHO the slowest.
- **The tenth maze on its own is not the hard part.** Started there with three balls, the bot cleared it 30 times in 30. What stops a run is arriving there with one ball left.
- **THE EYE arrives about once a maze** for a player who keeps the Heat up, and is the biggest single cause of a lost ball after CACHE.
- **Doing nothing, or holding one direction,** loses all three balls without clearing a maze.
- **Coins: about 2½ a minute for the bot,** 28 for a full game. That is the same pace as Breakpoint's AI, which would earn 40 coins in a 17-minute Classic run ([breakpoint-balance.md](breakpoint-balance.md)).

Two rules were changed because of what the bot did:

- **THE EYE never arrived.** Heat fell a fraction below 100% on the very step it got there, so the check for "full" was never true. It arrives at 99% now.
- **The ball was being hit after it had left the corridor.** It counted as in a firing line until it was half a tile out of it. It is out at a third of a tile now, and not in until it is most of the way onto one.

And one thing was learned about the game from the bot's first version, which did not plan ahead: it could not clear maze 1. It kept taking a corridor with a piece of static coming from each end. Nothing in the rules was changed for that, because a corridor with two ways out is the game; the bot was given the look-ahead. But it does mean a player who only looks at the nearest packet will be caught the same way.

## Where to change things

| To change | Look at |
|---|---|
| How fast everything is | `TUNE` in `js/rules.js`: `SPEED`, `CHASER`, `CHASER_STEP`, `CHASER_MAX`, `FRIGHT_SPEED`, `TUNNEL_SPEED` |
| The dash | `TUNE`: `DASH_MULT`, `DASH_T`, `DASH_COOL` |
| Touch controls | `steer`, `dragDir` and the pad and swipe handlers in `js/game.js`; sizes in `layout`; the look in `#dpad` in `index.html` |
| How each chaser hunts | `CHASERS` (name, colour, the line shown on screen) and `targetOf` |
| How often they misjudge, how long they run | `lapseChance`, `frightTime` |
| Scoring and Heat | `TUNE`, `heatMultiplier` |
| THE EYE | `TUNE`: `EYE_SHOTS`, `EYE_WARN`, `EYE_FIRE`, `EYE_GAP`, `LAIR_EVERY`; `corridorRun`, `onLine` |
| A maze's layout | Its entry in `MAZES`: `seed`, `loops`, `tunnel` |
| A maze's rule, or a new one | `MAZES`, and its branch in `step()`; give the static a `maze_<rule>` line and the maze some music |
| What a maze pays | `COINS` |
| What the static or the ball says | `js/voice.js` |
| What the static does to the page | `onEvent`, `hud` and `startNoSignal` in `js/game.js` |
| How the maze and the static are drawn | `drawWalls`, `drawChasers` in `js/game.js` |
| The wall behind a maze | `paintBackdrop` and `ACCENT` in `js/game.js` |
| Glass, tubes, lights, the bloom | `js/neon.js` (change it in `nexus/` and copy it to `signal/`) |
| The music | `MUSIC` in `js/audio.js` |
| The cabinet in the arcade | `makeSignalMarquee`, `makeSignalSideArt`, `createSignalScreen`, `buildSignalCabinet` in `glitchcade.js` |

After changing a number in `js/rules.js`, run the tests and the sim: the tests fail if the bot can no longer beat the game in at least half its runs, or if any maze stops being sound.
