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

THE EYE's theme takes priority over the arena theme. Other bosses use their
arena's music. Breakpoint's generic arenas are GLITCH ARENA, NEON GRID, QUANTUM
REACTOR, AI MAINFRAME, DATA TUNNEL, INFINITE SERVER, and BROKEN SIMULATION.
Songs continue across sectors using the same theme, and alternate takes when
they finish. The menu's attract game stays silent. The existing volume/mute
controls also control recorded music, while SFX and countdown voices are kept.
If both recordings for a Breakpoint theme fail to load, its procedural synth
soundtrack is used as a fallback.

The arcade crossfades its floor theme and street music at the doorway, and
reduces the floor theme near the jukebox or prize counter so the local song can
be heard. Both speakers share one stream. The jukebox starts with PRIZETRON's
two recordings, followed by the six existing Construct tracks; interacting with
it still skips songs. All arcade music pauses while either cabinet is playing
and resumes on return. Browser audio starts after a user gesture.
The opening menu also plays its current scene's music after the first click,
tap, or key press, including the street track during the exterior camera shot.

Music uses streamed media elements routed through Web Audio instead of decoding
the entire soundtrack into memory. No build step or extra dependency is needed.
