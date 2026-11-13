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

Two Breakpoint arenas borrow the music of the Glitch Pong arena they share a
place with, from files already in `sounds/music`:

| Breakpoint arena | Plays | Files |
| --- | --- | --- |
| NEON GRID | Glitch Pong's The Construct playlist | `sounds/music/construct_music{1..6}.mp3` |
| AI MAINFRAME | Glitch Pong's Matrix Mainframe playlist | `sounds/music/matrix_music{1..6}.mp3` |

Which theme an arena plays is its `music` entry in `breakpoint/js/config.js`,
and the files behind each theme are in `MUSIC` in the same file. To give an
arena a theme of its own, add the recordings, add a line to `MUSIC`, and set
the arena's `music`.

THE EYE's theme always takes priority. Other arenas and bosses use the active
glitch's theme while an event is happening, then return to their arena music.
The arenas still on Sector Zero are GLITCH ARENA, QUANTUM REACTOR, DATA
TUNNEL, INFINITE SERVER and BROKEN SIMULATION. Tracks for the last four have
been generated in Suno (two takes each: Quantum Reactor, Data Tunnel, Infinite
Server, Broken Simulation) but not downloaded.
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
The opening track preloads without playing. The first gesture starts music even
while the arcade art is still loading; positional emitters attach when the world
is ready without restarting playback. Initial playback selects the current tour
scene directly, while later movement retains the normal zone fades.

Music uses streamed media elements routed through Web Audio instead of decoding
the entire soundtrack into memory. No build step or extra dependency is needed.

## Glitch Pong arena tracks

Glitch Arena plays the four `in_game_music` tracks. Matrix Mainframe, The
Construct and Black-Hole Nexus have their own playlists. Eleven of the sixteen
newer arenas have a track of their own, made for the map:

| Arena | Track | File |
| --- | --- | --- |
| PENALTY BOX | Penalty Box: stadium synthwave | `sounds/music/penalty_music1.mp3` |
| MEMORY LEAK | Memory Leak: tense dark synth that keeps tightening | `sounds/music/leak_music1.mp3` |
| FREEFALL | Freefall: liquid drum and bass with falling arpeggios | `sounds/music/freefall_music1.mp3` |
| COOLANT LEAK | Coolant Leak: icy minimal techno | `sounds/music/coolant_music1.mp3` |
| ROOFTOP | Rooftop: rainy noir synthwave | `sounds/music/rooftop_music1.mp3` |
| BREAKPOINT CROSSOVER | Breakpoint Crossover: 8-bit arcade rock | `sounds/music/bricks_music1.mp3` |
| LAST TRAIN | Last Train: motorik synth with a train's rhythm | `sounds/music/train_music1.mp3` |
| ECHO | Echo: dub techno, heavy on delay | `sounds/music/echo_music1.mp3` |
| KERNEL PANIC | Kernel Panic: dark industrial ambient | `sounds/music/panic_music1.mp3` |
| ARCHIVE BUILD 0.1 | Archive Build 0.1: square-wave beeps that turn into synthwave | `sounds/music/archive_music1.mp3` |
| THE EYE'S LAIR | The Eye's Lair: slow, ominous boss theme | `sounds/music/lair_music1.mp3` |

Each is about 2 minutes 10 seconds and loops. The files are the Suno downloads
with their tags and cover art removed; the audio is untouched.

The descriptions above are the briefs the tracks were generated from. Nobody
has listened to the results yet, so check each one fits its map.

Still on the Glitch Arena playlist:

- **STACK OVERFLOW, DEFRAG, TILT, QUANTUM SHIFT.** Tracks with those titles are
  in the Suno library but not downloaded: the account had 11 download credits.
- **BEAT DROP** plays its own synthesised music in local matches, because its
  tempo follows Heat. A "Beat Drop" track is in the Suno library and could be
  used for online matches on that arena, where the beat rule does not run.

Suno made two takes of every track. The first take of each is the one used;
the second takes are in the Suno library too.

### Adding or changing an arena's music

1. Put the MP3 in `sounds/music/`.
2. Add it to `arenaTracks` in `glitchpong-site.js`, under the arena's id (the
   ids are in `ARENA_REGISTRY`), for example
   `tilt: ["sounds/music/tilt_music1.mp3"],`. Listing more than one file makes
   a playlist: a track is picked per match and not repeated twice running.
3. Run `node --test tests/*.mjs`. It fails if a listed file is missing.

Arena tracks are only fetched when a match starts on their arena, so adding
them does not slow the game's first load.
