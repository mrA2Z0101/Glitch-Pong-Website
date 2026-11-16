# SIGNAL LOST

Cabinet 04 of the Glitchcade, next to Black-Hole Nexus. A glitched take on the maze chase, set in the **Glitch Pong** universe.

You are the ball, in a maze full of packets. Four pieces of **static** hunt you, each in its own way. They talk, as one, and they know they are four small rules and a timer.

## Run it

No build step. From the repo root:

```bash
python -m http.server 5180
```

then open `http://localhost:5180/signal/`. It needs a server (the game is ES modules), and it needs to sit in the repo next to the other games, because it uses their music, their Eye, and their ball skins.

## Controls

| Input | Action |
|---|---|
| Arrows / W A S D | Steer. A direction pressed early is taken at the next opening. |
| Space | Dash: a short burst of speed, then a 6 second wait |
| P / Esc | Pause |
| Enter | Play, play again, or keep going after the tenth maze |
| Touch | Swipe to steer; the DASH button |

## What is in it

- **The classic underneath:** take every packet to clear the maze. Four chasers, each with one way of hunting. Four overrides that turn the chase round for a few seconds. A tunnel from one side of the screen to the other.
- **From Glitch Pong:** Heat, which multiplies your score up to x3; THE EYE arriving when Heat is full; the dash; and ten mazes that are Glitch Pong's arenas, each with that arena's one rule and its music.
- **An ending.** Clear the tenth maze, THE EYE'S LAIR, and the signal is restored. After that the ten come round again, faster, for as long as you last.
- **It can be beaten, and the tests check it.** Every packet can always be reached, there are no dead ends, the static is never as fast as you, and a wall never moves without a warning or in a way that would trap you.
- **The sentient ball**, with LOYAL, GRUDGE, SHOW-OFF and MOURNING. It talks.
- **The static**, which talks more. It reads your save, the clock, and what you did in the other cabinets.
- **Glitchcade coins**: 2 a maze, 10 for the tenth, into the same wallet as the other games.

How it is put together, what the static can and cannot do, and what was measured: [docs/signal-lost.md](../docs/signal-lost.md).
