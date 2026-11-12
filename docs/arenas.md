# Arenas

Glitch Pong has twenty arenas. Three only change how the court looks and one (Black-Hole Nexus) bends the ball's path. The other sixteen are covered here: four that change the walls, four that change the ball or the paddles, four that put things on the court, two that change what the players can see, and two that tell a story about the game. This page says what each one does, where the numbers are, and how to add another.

## Maps that change the walls

| Arena | id | What changes | What Heat does |
|---|---|---|---|
| PENALTY BOX | `penalty` | Only the middle of each end wall is a goal. The rest is post, and a shot off the post comes back in the shooter's colour. | At Critical Heat (80%+) the two goal mouths drift up and down, out of step with each other. |
| STACK OVERFLOW | `overflow` | The top and bottom edges wrap. The ball leaves one and comes back through the other. | From 50% Heat the seam shifts: the ball comes back in offset sideways, by up to 16% of the court at full Heat. |
| MEMORY LEAK | `leak` | Every return narrows the court from both sides. It opens again when someone scores. | Nothing directly. Long rallies are what build Heat, so the corridor and high Heat arrive together. |
| DEFRAG | `defrag` | The top and bottom walls are rows of slanted blocks, so a bounce changes the ball's angle. They rearrange between points. | From 50% Heat one wall at a time moves mid-rally, every 5 seconds at first and every 2.5 at full Heat. |

## Maps that change the ball

| Arena | id | What changes | What Heat does |
|---|---|---|---|
| FREEFALL | `freefall` | The ball has gravity. It arcs, and bounces off the floor. | At Critical Heat (80%+) gravity flips, and the ceiling becomes the floor. |
| COOLANT LEAK | `coolant` | The court is frozen. Paddles are slow to start and keep sliding after the player lets go. | Heat melts the ice. Grip is 10% at no Heat and complete at 80%, by which time the ball is fast. |
| ROOFTOP | `rooftop` | Wind gusts carry the ball along the court, towards one player or the other. The rain leans the way the wind is blowing. | Gusts get stronger with Heat. At Critical Heat lightning strikes every few seconds, and each strike turns the wind round at full strength. |
| BEAT DROP | `beat` | The court pulses to a beat. A return that lands within 5 frames of a beat comes off 14% faster. | Heat raises the tempo from 104 to 160 beats a minute, so more returns land on the beat. |

## Maps that put things on the court

| Arena | id | What changes | What Heat does |
|---|---|---|---|
| BREAKPOINT CROSSOVER | `bricks` | A column of bricks runs down the centre line. A brick breaks when the ball hits it, and the ball bounces back. A broken brick can leave a power-up in the gap. | Broken bricks regrow sooner: after 10 seconds at no Heat, 3 at full Heat. |
| TILT | `tilt` | Lit pinball bumpers kick the ball away 12% faster than it arrived. | More bumpers light: 2 at the start, then the centre one at 25% Heat, two more at 45% and the last two at 65%. |
| QUANTUM SHIFT | `portal` | Two linked portals on the centre line. The ball goes into one and comes out of the other with the same speed and direction. | From 50% Heat the portals circle away from the centre line, in opposite directions. |
| LAST TRAIN | `train` | A train runs down the centre line every so often and blocks the court while it passes. Signals flash for a second and a half first. | Trains come more often (every 10 seconds at no Heat, every 4 at full). From 50% Heat they are expresses: nearly twice as fast, shorter, with a one-second warning. |

On all four, a ball that is sent back the way it came turns neutral, the same as with a glitch wall or a teleport. It is worth 1 point and can never be an own goal.

## Maps that change what you see

| Arena | id | What changes | What Heat does |
|---|---|---|---|
| ECHO | `echo` | Every return sends out a ghost ball that replays an earlier shot from the same paddle, level with the real ball. | Ghosts are 20% solid at no Heat and 92% at Critical Heat. From 50% Heat a return sends out two. |
| KERNEL PANIC | `panic` | The court is dark. The ball lights a small circle round itself, and every paddle hit lights the whole court for about a third of a second. | The ball's light shrinks from 17% of the court's height to 11%, and flickers at Critical Heat. |

## Maps that tell a story

| Arena | id | What changes | What Heat does |
|---|---|---|---|
| ARCHIVE BUILD 0.1 | `archive` | The game is drawn as an amber monochrome prototype: a square ball, two bars, a dotted net and block digits, with no glow, trail or camera shake. The ball does not teleport, juke or surge, and there are no power-ups or glitch walls. | From 15% Heat the modern game shows through in bands, and by 75% it has taken over. The glitches come back at about 35% Heat. |
| THE EYE'S LAIR | `lair` | The Eye fills the backdrop all match and its pupil follows the ball. | The Eye arrives at 70% Heat here, not 100%. The backdrop's eye narrows and reddens as Heat rises, and shuts while the real one is on the court. |

THE EYE'S LAIR is locked until the Eye Gauntlet (arcade cabinet 11, in the STAFF ONLY room) has been cleared once. See [glitchcade-floor.md](glitchcade-floor.md).

## Where things are

| File | What's in it |
|---|---|
| `glitchpong-arenas.js` | The rules: where the walls and goal mouths are, what the ball does when it meets them, and how they change over a rally. No DOM and no canvas, so the tests run it under Node. |
| `glitchpong-site.js` | The arena menu entries (`ARENA_REGISTRY`), the calls into the rules (search for `arenaRules`), all the drawing (the `COURT MAPS`, `BALL MAPS`, `OBJECT MAPS` and `SIGHT AND STORY MAPS` sections), and the synthesised sound (`beatStep`, `beatHit`, `thunder`, `mapSfx`). |
| `tests/arenas.test.mjs` | Plays each rule on a desktop-sized and a phone-sized court. |

Every number that shapes a map is in `TUNING` at the top of `glitchpong-arenas.js`, with a comment saying what it is.

## How each one works

### PENALTY BOX

- The goal mouth is 52% of the court's height and never less than one and a half paddles.
- The paddles sit 30 pixels further in than on other arenas (20 on a phone), so there is a goal behind each one to see.
- A ball that reaches the end wall outside the mouth bounces back and keeps its colour. If it then gets past the player who hit it, that is an own goal: 2 points, or 3 at Critical Heat.
- On its way back the ball passes its own defender's paddle untouched. Only the shooter can return it.
- A ball that has gone in through the mouth can't be saved from behind, and stays between the posts until it crosses the goal line.
- A Phase Shield still covers the goal mouth. A post bounce does not use the shield up.

### STACK OVERFLOW

- The wrap happens when the centre of the ball crosses the edge. While it is crossing, the ball is drawn on both sides.
- Paddles do not wrap. A ball that crosses a paddle's line right at the seam is on the far side of the screen from a paddle parked at the near edge.
- The markers along the top and bottom edges are numbered in pairs: a ball that leaves by one comes back at its twin. When the seam shifts, the top row slides against the bottom row and a `SEAM SHIFT` readout shows by how much.
- A shifted ball never comes back closer to a paddle than 6% of the court, and a ball already past a paddle is never shifted.
- The AI knows about the wrap: a shot it expects to run off the top, it expects at the bottom.

### MEMORY LEAK

- Each return takes the same amount off the top and the bottom. After 16 returns the court is at its narrowest: 2.2 paddles tall, or 36% of the screen height if that is taller.
- The paddles are kept inside the corridor. Glitch walls and power-ups only appear inside it, and a glitch wall the corridor closes over shatters.
- The court opens fully when a point is scored, and when the Eye arrives (its shots are aimed across the full height).

### DEFRAG

- Each wall is 10 blocks with slanted faces. A face is never steeper than 0.3 (about 17°) and a block never reaches further than 15% of the court's height.
- Both walls are flush with the screen edge at the paddles, so the paddles keep their full travel.
- A bounce changes the ball's vertical speed and leaves its horizontal speed alone. A face tilted towards the ball throws it off at a sharper angle; one tilted away flattens the bounce. The ball is never sent back the way it came.
- Before a wall moves mid-rally, its new shape is outlined in dashes for 40 frames with a `MOVING CLUSTERS` warning.

### FREEFALL

- The pull is scaled to the court's height, so an arc looks the same on a phone as on a desktop.
- A bounce off the floor always rises at least 18% of the court's height, so the ball never ends up rolling along the bottom.
- Gravity takes 36 frames to turn over, and a `GRAVITY FLIP` warning shows as it starts. It turns back when Heat drops, which in practice is when a point is scored.
- The surface the ball is falling towards is lit, and dust and chevrons in the backdrop move the way gravity points.
- The usual cap on the ball's total speed is off here, because at top speed it would flatten the arc. The ball's fall has its own top speed instead.
- The AI reads the arc when it predicts where the ball will arrive.

### COOLANT LEAK

- Whatever moves a paddle (keys, touch or the AI) becomes a push on a sliding paddle. With 10% grip a paddle takes about half a second to get up to speed and slides roughly 70 pixels after the input stops.
- A dash is still an instant jump. It does not slide and leaves no momentum.
- A paddle that slides into the top or bottom edge bounces back with 35% of its speed.
- A `GRIP` readout shows how much control there is. Heat goes back to zero after every point, so every rally starts on solid ice.
- The Eye arrives at full Heat, so its fight is played with full grip.

### ROOFTOP

- Wind is added to the ball's movement, not to its speed, and is capped at 45% of the ball's own speed. It can hurry the ball or hold it up, but never stop it or turn it round.
- The effect on play is timing: into the wind the ball takes longer to arrive and travels further up or down on the way.
- A gust lasts 2.5 to 6 seconds. One in five is a lull. Every serve starts in a lull.
- Besides the rain, a `WIND` readout shows direction and strength in arrows.
- Lightning flashes are at most one every 2.5 seconds. They are dimmer for players whose device asks for reduced motion, and they follow the Custom Match screen-glitch setting.
- The AI allows for the wind when it judges how long the ball will take.

### BEAT DROP

- The map makes its own music: a kick, clap, hi-hat and bass line synthesised from the same clock that judges the beat, with a lead line from 50% Heat. The usual match playlist does not play here. Turning music off silences it; the court still pulses.
- The frame of the court lights up for as long as a return would count as on the beat, and `ON BEAT` shows when one does.
- The boost stacks with a Power Strike (which is 22%).
- A player cannot choose when the ball reaches them, so this is something to read rather than something to time: watch whether the ball will arrive on a pulse, and expect it back faster if it does.

### BREAKPOINT CROSSOVER

- The column has an odd number of bricks, each about 78 pixels tall: nine on a 720-pixel-tall screen, five on a phone.
- Every point starts with the wall rebuilt except the middle brick, because the serve starts inside the column.
- A ball that hits the side of a brick comes back neutral. A ball that clips the top or bottom of a brick while passing through a gap breaks it and is only turned up or down.
- A broken brick has a 40% chance of leaving a power-up in its gap (75% with Custom Match power-ups on "frequent", none with them off). Only one power-up is on the court at a time, and on this map they come from bricks only.
- A brick shows as a dashed outline for 36 frames before it is solid again, and it waits if the ball is in the gap.

### TILT

- There are seven bumper positions. A dark one is drawn as a dashed ring and the ball passes straight over it.
- Along the court the ball always leaves a bumper faster, up to a speed of 18, and never slower. Which way it leaves depends on where it hit: head on it comes straight back (and turns neutral), a glancing hit only deflects it.
- A bumper rests for 10 frames after a kick, and never lights up while the ball is on top of it.
- The layout is the same seen from either end, and bumpers light in matching pairs.

### QUANTUM SHIFT

- The ball comes out at the same spot on the second portal as it went into the first, so it carries on across that portal and out the far side.
- A ball that has just come out of a portal can't go back in until it has left it.
- While both portals are on the centre line a trip only moves the ball up or down. Once they roam, a trip can also carry the ball towards a paddle or away from one.
- The portals move in opposite directions, so the court still looks the same from both ends. They go home when a point is scored.
- Decoy balls go through portals too.

### LAST TRAIN

- The first signal comes 5 seconds into a rally. Trains then alternate between coming from the top and from the bottom.
- A departures readout counts down to the next train. Chevrons on the track show which way it will come, amber for a local and red for an express.
- A local takes about 3 seconds to pass and an express about a second and a half.
- A ball that hits the side of the train bounces back neutral. A ball that is on the track when the train arrives is thrown clear on the side it was heading for, with a push in the train's direction.
- The track is cleared when a point is scored and when the Eye arrives, and the schedule does not run between points.
- Train length and speed are scaled to the court, so a train is on screen for the same time on a phone.

### All four object maps

- Power-ups and glitch walls never appear on top of the bricks, a bumper, a portal or the track.
- Decoy balls vanish when they touch a brick, a lit bumper or the train.
- The bricks, bumpers, portals and train are not drawn during the Eye's fight, which takes place in the middle of the court.

### ECHO

- A shot is recorded from the moment a paddle hits the ball until the next paddle does. Only shots that made it across the court are kept, eight from each paddle, and they are kept for the whole match.
- A ghost crosses the court at whatever pace the real ball is going, so it stays level with it. It wears the ball's skin and has a trail. The only tell is how solid it looks.
- The first return of a match has no ghosts, because there is nothing to replay yet.
- Ghosts end when a point does.
- The AI can be fooled too. When a shot comes its way it sometimes follows a ghost (up to half the time on Easy and up to about one time in eight on Hard, more often the more solid the ghosts look) until the balls are close, then corrects.

### KERNEL PANIC

- The dark is 94% black. Paddles keep a faint outline, so players can always find their own.
- Power-ups and glitch walls are only visible in the ball's light or during a flash. Decoy balls carry a light too, or they would give themselves away.
- The lights come back for the Eye's fight and for the end of the match.
- **Reduced motion.** If the player's device asks for reduced motion there is no whole-court flash. The dark is shallower (76%), the ball's light is about a third bigger, and a hit swells that light instead.
- The Custom Match screen-glitch setting scales the flash as well.
- It shares its name and its idea with the arcade's KERNEL PANIC blackout event.

### ARCHIVE BUILD 0.1

- The prototype is drawn over the finished modern frame. The screen is cut into 30 bands, each with its own Heat threshold. Below it the band shows the prototype; above it, the modern game underneath.
- Glitch walls, power-ups and decoys are drawn in amber inside prototype bands, so anything that affects play can always be seen.
- Heat goes back to zero after every point, so every rally starts in the prototype.
- The modern layer is the ordinary Glitch Arena. The HUD bar is not part of the court and stays as it is.

### THE EYE'S LAIR

- The Eye still comes at most once a match, and its fight is the usual one.
- Because it comes at 70% Heat, it usually arrives before Critical Heat (80%) is ever reached in that rally.
- The lock is read from the arcade's save (`glitchcade_floor_v1`, `gauntlet.clears`). Admin mode opens it as well, for testing. A locked card in the arena menu is greyed out and says how to open it.
- Winning there counts towards WORLD TOUR like any other arena, so that achievement now needs the gauntlet.

## Things that hold on every arena

- **Custom Match** rules apply as usual.
- **Online matches don't use these rules.** The online referee (`server/authoritative-pong.js`, or the host's browser in a peer-to-peer game) runs plain Pong for everyone, so one of these sixteen maps selected before an online match shows its backdrop only: no posts, seam or moving walls, no gravity, ice, wind or beat boost, no bricks, bumpers, portals or train, no ghosts, no blackout, no prototype layer, and the Eye at its usual 100% Heat. See [multiplayer.md](multiplayer.md).
- **The Eye.** The boss fight is the same on every arena.
- **Music.** An arena can have its own playlist; eleven of these sixteen do so far. See [soundtrack.md](soundtrack.md).
- **Arena wins** are recorded per arena in the player's stats, under the arena's `id`. The WORLD TOUR achievement asks for a win in all twenty; `tests/arenas.test.mjs` fails if its goal and the number of arenas differ.

## Adding an arena

1. Add an entry to `ARENA_REGISTRY` in `glitchpong-site.js`. Never rename an `id` after release: saves store arena wins under it.
2. If it only changes the look, give it `init`, `cleanup` and a backdrop, the way The Construct does.
3. If it changes the rules, add its id to `IDS` in `glitchpong-arenas.js`, put its state in `createState()`, and teach the functions the game already calls (`update`, `walls`, `topAt`, `bottomAt`, `band`, `paddleBand`, `roundReset`) what to do for it. Set `courtRules: true` on the registry entry. A rule that needs a new hook (the way `fall`, `drift`, `slide` and `returnBoost` do) also needs one call from the game loop in `glitchpong-site.js`. Something solid on the court goes through `objects`, with `obstacles` and `blocked` saying where it is.
4. Draw it: a backdrop in `drawCourtMapBackdrop`, and anything that shows the rule in `drawCourtMapRules` (drawn with the court) or `drawCourtMapEdges` (drawn with the paddles; use this for anything on the screen edge, because the camera zooms in as Heat rises). Something that has to go over the ball, like ROOFTOP's rain, goes in `drawArenaOverlay`.
5. Raise the WORLD TOUR goal, and run `node --test tests/*.mjs`.

## Not tested

- Play by people. An AI-against-AI match was run on each map in a headless browser to check that it plays and draws without errors, but nobody has yet judged whether the numbers feel right: mouth size, leak rate, block depth, the strength of gravity and wind, how slippery the ice is, the size of the beat window, how often bricks regrow and trains run, how hard bumpers kick, how solid ghosts look, how dark the blackout is. `TUNING` is where to change them.
- Sound. The headless browser has no audio output, so BEAT DROP's music, ROOFTOP's thunder and the object maps' effects (brick, bumper, portal, the train and its bell) have not been heard, only run without errors.
- A real phone. Phone-sized screens were checked in the same headless browser with touch emulation.
