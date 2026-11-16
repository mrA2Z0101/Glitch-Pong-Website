# BLACK-HOLE NEXUS

Cabinet 03 of the Glitchcade, next to Breakpoint. A glitched take on the spin-and-thrust rock shooter, set in the **Glitch Pong** universe: the hole in the machine's memory where every ball the other two cabinets lost ended up.

There is no paddle. You are the ball: turn, thrust, fire. What you shoot breaks into smaller pieces. The hole in the middle of the screen pulls on everything. It is called **NULL**, it knows it is a game, and it knows who is pressing the buttons.

## Run it

No build step. From the repo root:

```bash
python -m http.server 5180
```

then open `http://localhost:5180/nexus/`. It needs a server (the game is ES modules), and it needs to sit in the repo next to the other two games, because it uses their music, their Eye, and their ball skins.

## Controls

| Input | Action |
|---|---|
| ← → / A D | Turn |
| ↑ / W | Thrust the way you are facing |
| Space | Fire (hold to keep firing) |
| P / Esc | Pause |
| Enter | Play, or play again |
| Touch | Four buttons in the corners: turn left, turn right, thrust, fire |

There is no mouse control.

## What is in it

- **The classic underneath:** turn, thrust, coast, fire. A big piece breaks into two medium ones, and those into two small ones. Fly off one side of the screen and you come back on the other.
- **The glitch on top:** a hole in the middle that pulls on the ball, the debris and the shots, and takes anything that reaches it.
- **Heat**, on the same steps as Breakpoint's Glitch meter: up to x3 score, a wider hole, more debris. A kill is also worth more the nearer you are to the hole when you make it.
- **Six sector rules**, one a sector, named after glitches the other cabinets already use: MEMORY LEAK, KERNEL PANIC, LAG SPIKE, QUANTUM SHIFT, OVERCLOCK.
- **THE EYE** every fifth sector, looking out of the hole. Its gaze is a bar of light with a gap in it; you shoot it while it is open.
- **The sentient ball**, with four of Breakpoint's moods: LOYAL, SHOW-OFF, GRUDGE, MOURNING. It talks.
- **NULL**, who talks more. It reads your save, the clock, and what you did in cabinets 01 and 02.
- **Glitchcade coins**: 2 a sector, 10 for THE EYE, into the same wallet as the other two games.
- **The look of the other two cabinets:** holographic glass, neon, a painted backdrop for each sector, and light that blooms.
- **Ball colour, skin and trail** from Glitch Pong's Store. The debris is Breakpoint's bricks and Glitch Pong's paddles.

How it is put together, what NULL can and cannot do, and what was measured: [docs/nexus.md](../docs/nexus.md).
