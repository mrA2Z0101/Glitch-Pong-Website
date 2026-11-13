# BLACK-HOLE NEXUS

Cabinet 03 of the Glitchcade, next to Breakpoint. A one-button orbit game set in the **Glitch Pong** universe: the hole in the machine's memory where every ball the other two cabinets lost ended up.

There is no paddle. You are the ball. The hole is called **NULL**, it knows it is a game, and it knows you are the one holding the button.

## Run it

No build step. From the repo root:

```bash
python -m http.server 5180
```

then open `http://localhost:5180/nexus/`. It needs a server (the game is ES modules), and it needs to sit in the repo next to the other two games, because it uses their music, their Eye, and their ball skins.

## Controls

| Input | Action |
|---|---|
| Space / ↑ / W / mouse button / touch | Hold to climb. Let go to fall. |
| P / Esc | Pause |
| Enter | Play, or play again |

## What is in it

- **One button.** Lower orbits are faster and worth more (x2, then x3 next to the hole), and closer to the horizon.
- **Heat**, on the same steps as Breakpoint's Glitch meter: up to x3 score, a wider hole, more junk.
- **Six sector rules**, one a sector, named after glitches the other cabinets already use: MEMORY LEAK, KERNEL PANIC, LAG SPIKE, QUANTUM SHIFT, OVERCLOCK.
- **THE EYE** every fifth sector, looking out of the hole. Its gaze is a bar of light with a gap in it.
- **The sentient ball**, with four of Breakpoint's moods: LOYAL, SHOW-OFF, GRUDGE, MOURNING. It talks.
- **NULL**, who talks more. It reads your save, the clock, and what you did in cabinets 01 and 02.
- **Glitchcade coins**: 2 a sector, 10 for THE EYE, into the same wallet as the other two games.
- **Ball colour, skin and trail** from Glitch Pong's Store.

How it is put together, what NULL can and cannot do, and what was measured: [docs/nexus.md](../docs/nexus.md).
