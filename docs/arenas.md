# Arenas

Glitch Pong has eight arenas. Three only change how the court looks, one (Black-Hole Nexus) bends the ball's path, and four change the walls. This page covers the four that change the walls: what each one does, where the numbers are, and how to add another.

| Arena | id | What changes | What Heat does |
|---|---|---|---|
| PENALTY BOX | `penalty` | Only the middle of each end wall is a goal. The rest is post, and a shot off the post comes back in the shooter's colour. | At Critical Heat (80%+) the two goal mouths drift up and down, out of step with each other. |
| STACK OVERFLOW | `overflow` | The top and bottom edges wrap. The ball leaves one and comes back through the other. | From 50% Heat the seam shifts: the ball comes back in offset sideways, by up to 16% of the court at full Heat. |
| MEMORY LEAK | `leak` | Every return narrows the court from both sides. It opens again when someone scores. | Nothing directly. Long rallies are what build Heat, so the corridor and high Heat arrive together. |
| DEFRAG | `defrag` | The top and bottom walls are rows of slanted blocks, so a bounce changes the ball's angle. They rearrange between points. | From 50% Heat one wall at a time moves mid-rally, every 5 seconds at first and every 2.5 at full Heat. |

## Where things are

| File | What's in it |
|---|---|
| `glitchpong-arenas.js` | The rules: where the walls and goal mouths are, what the ball does when it meets them, and how they change over a rally. No DOM and no canvas, so the tests run it under Node. |
| `glitchpong-site.js` | The arena menu entries (`ARENA_REGISTRY`), the calls into the rules (search for `arenaRules`), and all the drawing (the `COURT MAPS` section). |
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

## Things that hold on every arena

- **Custom Match** rules apply as usual.
- **Online matches don't use these rules.** The online referee (`server/authoritative-pong.js`, or the host's browser in a peer-to-peer game) runs plain Pong for everyone, so a court map selected before an online match shows its backdrop only, with no posts, seam or moving walls. See [multiplayer.md](multiplayer.md).
- **The Eye.** The boss fight is the same on every arena.
- **Arena wins** are recorded per arena in the player's stats, under the arena's `id`. The WORLD TOUR achievement asks for a win in all eight; `tests/arenas.test.mjs` fails if its goal and the number of arenas differ.

## Adding an arena

1. Add an entry to `ARENA_REGISTRY` in `glitchpong-site.js`. Never rename an `id` after release: saves store arena wins under it.
2. If it only changes the look, give it `init`, `cleanup` and a backdrop, the way The Construct does.
3. If it changes the court, add its id to `IDS` in `glitchpong-arenas.js`, put its state in `createState()`, and teach the functions the game already calls (`update`, `walls`, `topAt`, `bottomAt`, `band`, `paddleBand`, `roundReset`) what to do for it. Set `courtRules: true` on the registry entry.
4. Draw it in the `COURT MAPS` section: a backdrop in `drawCourtMapBackdrop`, and its walls in `drawCourtMapRules` (drawn with the court) or `drawCourtMapEdges` (drawn with the paddles; use this for anything on the screen edge, because the camera zooms in as Heat rises).
5. Raise the WORLD TOUR goal, and run `node --test tests/*.mjs`.

## Not tested

- Play by people. An AI-against-AI match was run on each map in a headless browser to check that it plays and draws without errors, but nobody has yet judged whether the mouth size, the leak rate or the block depth feel right. `TUNING` is where to change them.
- A real phone. Phone-sized screens were checked in the same headless browser with touch emulation.
