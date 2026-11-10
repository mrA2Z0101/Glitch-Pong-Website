# Breakpoint and Glitchcade soundtrack

All 16 supplied recordings are included unchanged, with short filenames for
reliable URLs. A `-1` file is the original take; `-2` is the take labelled `2`.

| Song (both takes) | Where it plays | Files |
| --- | --- | --- |
| Sector Zero | Breakpoint's general gameplay arenas | `breakpoint/sounds/music/sector-zero-{1,2}.mp3` |
| Ghosts in the Memory | MEMORY LEAK and DIGITAL CATHEDRAL | `breakpoint/sounds/music/ghosts-in-the-memory-{1,2}.mp3` |
| Infection Protocol | VIRUS HIVE and CORRUPTED BIOS | `breakpoint/sounds/music/infection-protocol-{1,2}.mp3` |
| Event Horizon | BLACK HOLE NEXUS | `breakpoint/sounds/music/event-horizon-{1,2}.mp3` |
| DO NOT BLINK | Every THE EYE battle, including Boss Rush | `breakpoint/sounds/music/do-not-blink-{1,2}.mp3` |
| Insert Coin After Midnight | Inside the 3D arcade | `sounds/music/arcade-main-{1,2}.mp3` |
| Neon on Wet Asphalt | Outside on the arcade street | `sounds/music/neon-on-wet-asphalt-{1,2}.mp3` |
| PRIZETRON's Groove | Positional speakers at the jukebox and prize counter | `sounds/music/prizetrons-groove-{1,2}.mp3` |

THE EYE's theme always takes priority. Other arenas and bosses use the active
glitch's theme while an event is happening, then return to their arena music.
Breakpoint's generic arenas are GLITCH ARENA, NEON GRID, QUANTUM
REACTOR, AI MAINFRAME, DATA TUNNEL, INFINITE SERVER, and BROKEN SIMULATION.
Songs continue across sectors using the same theme, and alternate takes when
they finish. The menu's attract game stays silent. The existing volume/mute
controls also control recorded music, while SFX and countdown voices are kept.
If both recordings for a Breakpoint theme fail to load, its procedural synth
soundtrack is used as a fallback.

## Breakpoint glitch reactions

| Active event | Temporary song | Audible reaction |
| --- | --- | --- |
| SYSTEM ERROR | Infection Protocol | Chopped, filtered sound with stereo jitter |
| PACKET LOSS | Ghosts in the Memory | Short audio dropouts |
| TIME FREEZE | Event Horizon | Slowed and muffled, with an echo |
| MEMORY LEAK | Ghosts in the Memory | Slower, ghostly echoes and stereo drift |
| KERNEL PANIC | Infection Protocol | Fast dropouts and a warped, heavily filtered sound |
| DATA SURGE | Sector Zero | Faster playback |
| FIREWALL ACTIVATED | Infection Protocol | A filtered, enclosed sound |
| LAG SPIKE | Event Horizon | Slow playback with periodic dropouts |
| OVERCLOCK | Sector Zero | Faster playback and pitch |
| QUANTUM SHIFT | Event Horizon | Rapid stereo movement and an echo |

THE EYE keeps DO NOT BLINK during events, with the same glitch processing.
The corruption/glitch meter also adds filtering, pitch instability and small
dropouts to the recorded music as it rises. These effects apply to the synth
fallback too; sound effects and countdown voices stay clear. Theme changes use
one streaming player, fading out before swapping recordings. When an event ends,
the arena song resumes from its saved playback position. Clearing a sector or
starting a new sector resets event processing; ending a run cancels pending
switches and music-effect timers.

## Arcade transitions

The arcade selects one music zone: street, arcade floor, or local speakers.
The outgoing song fades to silence over 0.65 seconds, followed by a 50 ms gap,
then the incoming song fades up over 1.1 seconds. PRIZETRON’s music is fully silent outside the local
speaker zone, and the floor theme is fully silent inside that zone. Separate
enter/leave thresholds at the door and around the speakers prevent repeated
switching near their edges. Turning around during a fade reverses smoothly and
cancels the old scheduled fade-in. Both speakers share one stream. The jukebox
starts with PRIZETRON's two recordings, followed by the six existing Construct tracks; interacting with
it still skips songs. All arcade music pauses while either cabinet is playing
and resumes on return. Browser audio starts after a user gesture.
The opening menu also plays its current scene's music after the first click,
tap, or key press, including the street track during the exterior camera shot.
The opening track preloads without playing. A separate audio entry point loads
before the 3D scripts, so the first press starts playback even while Three.js or
the arcade art is still loading. Initial playback sets the menu volume immediately,
without the usual 0.4-second master fade. Touch release retries activation for
browsers that require it. Positional emitters attach when the world is ready
without restarting playback. Initial playback selects the current tour scene
directly, while later movement retains the normal zone fades.

Music uses streamed media elements routed through Web Audio instead of decoding
the entire soundtrack into memory. No build step or extra dependency is needed.
