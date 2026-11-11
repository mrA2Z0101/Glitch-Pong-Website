# Glitchcade trailer: plan

The plan `glitchcade-trailer.mp4` was cut from. 1920×1080, 60 fps, 1 min 22 s, about 44 MB.

## What the trailer has to do

- Sell the place first (a first-person arcade you walk into), then the two games you can play today.
- Say plainly that eight more games are coming.
- Leave the mysteries for the player. Raise the question, never answer it.
- Every line of text on screen is big, sits on a dark plate, and holds for at least 1.8 s.

## What is deliberately not shown

| Kept out | How the trailer handles it instead |
|---|---|
| What happens at max Heat in Glitch Pong | The match cuts to black on the `SYSTEM CORRUPTED` banner, before anything arrives |
| Breakpoint's bosses | Only regular sectors (1, 3, 8 and 12) are shown |
| What is behind the STAFF ONLY door | The door is shown locked, from outside |
| The events that hit the arcade floor | Only the lights going out, with no explanation and no HUD banner |
| Breakpoint's three-letter secret, the patrons, the capsule machine | Not shown or mentioned |

The antagonist is never named and never appears in play. The voice-over only says that something is awake and has been watching. Two things from the arcade's own set dressing are visible if you look for them: a distant ceiling TV during the lights-out shot, too small to read, and the last line of the info board beside the staff door.

## Structure

Cuts after the drop land on the bars of the music (116.86 BPM, one bar = 2.05 s).

| Time | Beat | Picture | On-screen text | Voice-over |
|---|---|---|---|---|
| 0:00–0:01 | Cold open | Black | `> SIGNAL ACQUIRED` | |
| 0:01–0:07 | The street | The game's own security-camera footage pushing in on the neon sign | | "There's an arcade at the end of the street." / "The lights never go out." |
| 0:07–0:12 | Walking in | First person, through the door, onto the floor | | "And the machines… are still running." |
| 0:12–0:16 | The drop | Crane shot down the hall | **GLITCHCADE** / A FIRST-PERSON ARCADE IN YOUR BROWSER | "Welcome… to the Glitchcade." |
| 0:16–0:18 | Cabinet 01 | Walking up to the Glitch Pong cabinet and pressing E | CABINET 01 / **GLITCH PONG** | |
| 0:18–0:20 | | Countdown, GO, serve (Black-Hole Nexus) | | "Glitch Pong. The longer the rally… the hotter it gets." |
| 0:20–0:24 | | The Construct: dash, juke, teleport | 4 ARENAS THAT FIGHT BACK | |
| 0:24–0:28 | | Matrix Mainframe: shield orb, glitch walls | DASH. POWER-UPS. RISING HEAT. | |
| 0:28–0:33 | | Black-Hole Nexus at critical Heat | ONLINE MULTIPLAYER / JOIN WITH A 6-DIGIT CODE | |
| 0:33–0:35 | Cabinet 02 | Walking up to the Breakpoint cabinet and pressing E | CABINET 02 / **BREAKPOINT** | |
| 0:35–0:37 | | GO, first bricks (sector 1) | | "Breakpoint. Break the bricks… before the corruption breaks you." |
| 0:37–0:41 | | Quantum Reactor: fire balls, Overclock event | 9 MODES · 12 ARENAS | |
| 0:41–0:45 | | AI Mainframe: explosive ball, Data Surge, laser paddle | 20 POWER-UPS THAT STACK | |
| 0:45–0:47 | | Broken Simulation: EMP, chain reaction | | |
| 0:47–0:51 | The floor | PRIZETRON-80 at the prize counter | WIN COINS. CLAIM PRIZES. | "Win coins. Claim prizes. Make the arcade yours." |
| 0:51–0:53 | | The Store, flipping through cosmetics | 130 COSMETICS | |
| 0:53–0:55 | | The air hockey table | AIR HOCKEY · DAILY CHALLENGES | |
| 0:55–1:01 | What's next | Dolly along the dark cabinets 07–10 | 8 MORE CABINETS, then 8 NEW GAMES / COMING SOON | "And eight more machines are waiting. Eight new games… coming soon." |
| 1:01–1:06 | Lights out | The music dies. The hall goes dark; only the neon stays lit | SOMETHING IN HERE IS AWAKE. | "But something in here… is already awake." |
| 1:06–1:11 | The door | Slow push on the locked STAFF ONLY door | IT'S BEEN WATCHING YOU PLAY. | "And it's been watching you play." |
| 1:11–1:14 | Cliffhanger | The black hole swallows the ball, the screen turns red: `SYSTEM CORRUPTED`. Cut to black | | |
| 1:15–1:22 | End card | Logo over the darkened hall | **GLITCHCADE** / PLAY FREE IN YOUR BROWSER / mra2z0101.github.io/Glitch-Pong-Website / 2 GAMES NOW · 8 MORE ON THE WAY / FIND WHAT'S HIDDEN. | "Glitchcade." / "Play free, in your browser." / "Find what's hidden." |

## Sound

- **Voice-over**: ElevenLabs, voice "David - The Movie Trailer", model `eleven_v4`. Thirteen lines, generated in three blocks.
- **Music**: the game's own soundtrack. "Neon on Wet Asphalt" (the street theme) runs quietly under the opening and returns for the end card. `in_game_music1` (a Glitch Pong match track) starts on the drop at 0:12 and stops dead when the lights go out.
- **Game sound**: every Glitch Pong sound in the footage is the real file, placed at the frame it played. Breakpoint's sounds are synthesised by the game, so they were re-created from the same recipes at the logged times.
- **Sound design**: impact, riser, glitch bursts and power-down from ElevenLabs sound effects, layered with synthesised sub hits, a drone and a heartbeat under the lights-out section.

## How the footage was made

All picture is the real build at `main` (commit `13cbae7`), rendered in headless Chromium one frame at a time on a virtual clock, so the motion is exactly 60 fps (30 fps for the arcade camera moves).

- **Arcade camera moves** reuse the title screen's footage camera with new paths. The street shot is one of the game's own.
- **First-person shots** (walking in, walking up to the cabinets) are the normal explore mode with W held and E pressed.
- **Glitch Pong** is the built-in AI vs AI mode on Hard, which draws the same as a 1P match.
- **Breakpoint** is a normal Classic run. The paddle follows the game's own aim helper through the mouse input, and the power-ups and the three glitch events were triggered at chosen moments so they would be on screen.
- **Lights out** is the floor's own Kernel Panic event, started on cue instead of waiting for it.

Nothing is drawn over the gameplay apart from the title cards and cut transitions.

## Facts quoted on screen and where they come from

| Claim | Source |
|---|---|
| 4 arenas | `ARENA_REGISTRY` in `glitchpong-site.js` |
| Online multiplayer with a six-digit code | `docs/multiplayer.md` |
| 9 modes, 12 arenas, 20 power-ups | `breakpoint/README.md` |
| 130 cosmetics | The Store header ("14/130 unlocked") |
| Air hockey, daily challenges, coins and prizes | `docs/glitchcade-floor.md` |
| 8 more cabinets | Cabinets 03–10, `COMING_SOON_GAMES` in `glitchcade.js` |
| Play free in your browser | The GitHub Pages deployment (`.github/workflows/static.yml`) |
