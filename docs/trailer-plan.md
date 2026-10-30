# Glitch Pong — Launch Trailer Plan

**Runtime:** 1:58 (under the 2:00 cap)
**Tone:** It starts as calm classic Pong, then gets corrupted into all-out chaos.
**Hook:** *"You know the rules. The arena doesn't care."*
**Tagline (end card):** *THE ARENA BREAKS. YOU FIGHT BACK.*

The trailer has three acts that follow the game's own Heat curve. Calm Pong turns into
glitch chaos, then the Surveillance Eye boss shows up, then everything ends on a
match-point cliffhanger. Each act is louder and faster than the one before it, so
the trailer feels like the Heat meter filling up.

---

## At a glance

| # | Time | Scene | What it sells |
|---|------|-------|---------------|
| 1 | 0:00–0:06 | Cold Open — "You Know the Rules" | Familiar Pong |
| 2 | 0:06–0:10 | The Glitch | Twist: the arena turns on you |
| 3 | 0:10–0:16 | Countdown & Title Slam | Logo, energy drop |
| 4 | 0:16–0:30 | Dash / Teleport / Juke | Skill moves |
| 5 | 0:30–0:40 | Power-ups | Shield, Power Strike, Split |
| 6 | 0:40–0:52 | Heat Rising | Heat meter, Glitch Walls |
| 7 | 0:52–1:02 | The Sentient Ball | Spite, Drowsy Ball, Memory |
| 8 | 1:02–1:16 | Four Arenas | Classic, Matrix, Construct, Nexus |
| 9 | 1:16–1:22 | Your Way, Your Level | Modes, online, XP & perks |
| 10 | 1:22–1:40 | THE EYE | Boss cinematic + fight |
| 11 | 1:40–1:50 | Clutch Mode | Match point, final rally |
| 12 | 1:50–1:56 | End Card | Title, features, call to action |
| 13 | 1:56–1:58 | Stinger | The Eye is still watching |

---

## ACT I — THE RULES (0:00–0:16)

### Scene 1 · Cold Open — "You Know the Rules" (0:00–0:06)
- **Visual:** Classic Grid arena with Heat at 0%. A slow, clean rally between the blue
  and red paddles. Lock the camera so it looks almost like retro Pong.
- **On-screen text:** `YOU KNOW THE RULES.` in small monospace, typed out one
  letter at a time.
- **Audio:** No music. Just `Paddle Hit Sound` → `Wall Bounce Sound` → `Paddle Hit
  Sound`, plus a faint room hum. The quiet makes the next scene hit harder.
- **Capture note:** Use **AI vs AI on Easy** to get a long, calm rally with no
  hazards.

### Scene 2 · The Glitch (0:06–0:10)
- **Visual:** The ball **freezes in mid-air**. The frame splits into RGB layers. The
  text card corrupts letter by letter into `THE ARENA DOESN'T CARE.` and then shatters into
  the in-game `⚠ SYSTEM CORRUPTED` alert.
- **Audio:** `Glitch Pulse`, then a bit-crushed rewind stutter, then dead silence for 0.5s.
- **Capture note:** Use the first frames of the pre-boss freeze (ball stopping
  mid-flight). Crop out the speech bubble here and save the full cinematic for Scene 10.

### Scene 3 · Countdown & Title Slam (0:10–0:16)
- **Visual:** The in-game countdown fills the screen: `3` → `2` → `1`
  (use `assets/3.png`, `2.png`, `1.png`), cut sharply on each number. On **GO**
  (`assets/GO.png`) the **GLITCH PONG** logo slams in with a chromatic shake, then
  explodes into gameplay.
- **Audio:** `3.mp3` / `2.mp3` / `1.mp3` → `GO.mp3` → the `GLITCH PONG.mp3`
  voice sting. **The music drops on GO** (`in_game_music` track, starting at its
  strongest section).

---

## ACT II — THE CORRUPTION (0:16–1:22)

Cut every shot here on the beat. Each feature gets **one word on screen**,
big and bold, and then the footage shows it.

### Scene 4 · Skill Moves (0:16–0:30)
| Time | Word card | Shot |
|------|-----------|------|
| 0:16–0:20 | **DASH** | The ball is about to score. The blue paddle **Shift-dashes** across half the screen with its trail and saves it at the last pixel. Slow down to 50% for the hit, then snap back to full speed. SFX: `Dash Activation` → `Paddle Hit Sound`. |
| 0:20–0:23 | **TELEPORT** | The red paddle blinks across the goal line and returns a shot that looked like a sure point. Bonus if **Mirror Ghost** leaves a decoy behind. SFX: `Teleport Sound`. |
| 0:23–0:27 | **JUKE** | A fake trajectory line goes one way. The opponent commits to it, and the real ball goes the other way. Freeze on the opponent's wrong guess for a few frames. SFX: `Juke Sound` + `Score Sound`. |
| 0:27–0:30 | *(HUD only)* | The ball clips the edge of a paddle. The `NEAR MISS DETECTED` HUD alert pops. SFX: `Near Miss Sound`, then `Dash Cooldown Ready` chime right on the downbeat. |

- **Text add-on (corner, small):** `THE AI USES THEM TOO.` over the Teleport shot.

### Scene 5 · Power-ups (0:30–0:40)
| Time | Word card | Shot |
|------|-----------|------|
| 0:30–0:33 | **SHIELD** | A shield lights up the **entire wall** behind the paddle and a shot that should have scored bounces off it. |
| 0:33–0:36 | **POWER STRIKE** | The ball leaves the paddle at full speed. Add screen shake and a short time-ramp so the impact feels huge. |
| 0:36–0:40 | **SPLIT** | One ball becomes **three**. Freeze the frame and put a glitchy `?` over each ball. Card: `WHICH ONE IS REAL?` Unfreeze, and the paddle guesses wrong. |

### Scene 6 · Heat Rising (0:40–0:52)
- **Visual:** Keep the **Heat meter** in frame (use a corner zoom if needed). It climbs
  `20% → 41% → 63%` in jumps that land on the beat. Each jump causes:
  1. A **Glitch Wall** flickering in with its warning, then solidifying.
  2. The ball **shattering** a wall. Slow down to show the pixel debris.
  3. Walls multiplying (2 → 3 → 5) as the arena colours start corrupting.
- **On-screen text:** `EVERY RALLY FEEDS THE HEAT.` → HUD ticker `ARENA CORRUPTION AT 63%`
- **Audio:** The music adds layers. Use a riser that builds into Scene 7.
- **Capture note:** Use **Hard AI vs AI** to get long rallies that push Heat up
  quickly.

### Scene 7 · The Sentient Ball (0:52–1:02)
This is the comedy beat. It lets the audience catch their breath before the arenas and the boss.
| Time | Card | Shot |
|------|------|------|
| 0:52–0:55 | `IT PICKS SIDES.` | The scoreboard shows one player well ahead (e.g. 5–1). The ball visibly curves toward the leader's weak spot. HUD: `⚠ BALL SPITE ACTIVE`. |
| 0:55–0:59 | `IT GETS TIRED.` | **The music cuts out.** A 30-hit rally ends with the ball wobbling and **Z's floating up** 💤. Hold for about two seconds of near silence. |
| 0:59–1:02 | `IT REMEMBERS.` | The next serve goes straight to the gap where the player missed last time. Drop the music back in at full volume on the score. |

### Scene 8 · Four Arenas (1:02–1:16)
Four hard cuts of about 3.5s each. **The music changes with each arena** (use 1–2 bars
from that arena's playlist), like a broken radio changing stations. Glitch-smear
between cuts.
| Time | Arena | Hero shot | Music |
|------|-------|-----------|-------|
| 1:02–1:05 | **CLASSIC GRID** | Fast rally with neon trails at high Heat | `in_game_music` |
| 1:05–1:09 | **MATRIX MAINFRAME** | Katakana rain falling behind a rally, then a long-shot slam | `matrix_music` |
| 1:09–1:12 | **THE CONSTRUCT** | Slow push in on the luminous aperture and mirrored monoliths, then a smash | `construct_music` |
| 1:12–1:16 | **BLACK-HOLE NEXUS** | Gravitational lensing, with a micro black hole **bending the ball's path** into a score | `blackhole_nebula` |
- **On-screen text:** The arena name in the corner, then `4 ARENAS` at the end.

### Scene 9 · Your Way, Your Level (1:16–1:22)
Six quick 1-second shots:
1. Menu: **1P vs AI**, cycling `EASY / MEDIUM / HARD`
2. **Local 2P**: two pairs of hands on one keyboard (live action, or an over-the-shoulder shot)
3. **Online**: a 6-digit join code being typed, then both players in the lobby showing `READY`
4. The **Level-Up cinematic** firing
5. The perk selection screen, with a card picked: `PERK UNLOCKED: OVERCLOCKED PADDLE`
6. A paddle colour swap: Ion Cyan → Hot Magenta → Solar Gold
- **On-screen text:** `SOLO. LOCAL. ONLINE.` → `50 LEVELS. 15 PERKS.`

---

## ACT III — THE EYE (1:22–1:50)

### Scene 10 · The Surveillance Eye (1:22–1:40)
This is the payoff, so give it the most screen time.
| Time | Beat |
|------|------|
| 1:22–1:24 | Heat meter hits **100%**. HUD: `⚡ HEAT 100%`. **Hard cut to total silence.** |
| 1:24–1:27 | The ball **freezes mid-flight**. The **angry speech bubble** pops over it. Hold. |
| 1:27–1:30 | The ball **glitches violently to the center** with RGB tearing, then **morphs into the Eye**. |
| 1:30–1:32 | Close-up of the Eye. Its pupil glances **left** (`boss_eye_left`), then **right** (`boss_eye_right`), then **straight into the camera** (`boss_eye_neutral`). Card: `IT'S BEEN WATCHING YOU.` |
| 1:32–1:34 | The **red alarm** goes off. If it's the Matrix arena, show the rain **turning red**. HUD: `BOSS ACTIVE` / `THREAT LOCK`. The music comes back as the heaviest track (a `blackhole_nebula` or `matrix_music` drop). |
| 1:34–1:40 | **Six orbital projectiles** launch. Montage of the player dashing and teleporting between them, deflecting one, getting through by inches. End on the boss reaching its **resolution phase**, then a white flash. |

- **Capture note:** If you have it, equip the **Boss Trace** perk so the projectiles
  glow brighter and read clearly on video.

### Scene 11 · Clutch Mode (1:40–1:50)
- **Visual:** Scoreboard: **6–6. MATCH POINT.** `CLUTCH MODE ENGAGED`. The screen
  starts to **fracture**, the ball speeds up, and the cuts get faster
  (1s → 0.5s → 0.25s) as the rally keeps going.
- **On-screen text:** `ONE POINT.` → `DON'T CHOKE.`
- **Audio:** `Critical Moment (high heat + long rally)` over the music, which gets more and more
  distorted (the in-game Clutch music break).
- **Final shot:** The last return comes **straight at the camera**. **SMASH CUT TO BLACK**
  before we see who scores. Leave the audience wanting to find out.

---

## END (1:50–1:58)

### Scene 12 · End Card (1:50–1:56)
- **Visual:** On black, the **GLITCH PONG** logo flickers on.
  - Tagline: **THE ARENA BREAKS. YOU FIGHT BACK.**
  - Feature strip (small, monospace, separated by `///` like the site ticker):
    `1P VS AI /// LOCAL 2P /// ONLINE /// 4 ARENAS /// BOSS FIGHTS /// 50 LEVELS /// 15 PERKS`
  - Call to action: **PLAY NOW — GLITCHPONG.COM**
- **Audio:** The music ends on one hard hit, followed by a short `Clapping Crowd` swell that cuts off sharply.

### Scene 13 · Stinger (1:56–1:58)
- **Visual:** The end card glitches out. In the darkness, **the Eye opens**,
  looks at the URL, then looks at the viewer. *Blink.* Cut.
- **Audio:** One `Glitch Pulse`, then silence.

---

## Music & sound plan

| Section | Track | Notes |
|---------|-------|-------|
| 0:00–0:10 | None | SFX only. The silence is the setup. |
| 0:10–1:02 | `in_game_music` (pick the hardest track) | Drops on **GO**. Cut out for 0:55–0:59 (Drowsy Ball). |
| 1:02–1:16 | Arena-specific snippets | One per arena, glitch-transitioned. |
| 1:16–1:22 | Back to main track | Riser into the boss. |
| 1:22–1:32 | **Silence** → alarm | The longest quiet stretch, so the boss feels important. |
| 1:32–1:50 | Heaviest boss track | Distorted for Clutch Mode, ends on the black cut. |
| 1:50–1:58 | Final hit, crowd, glitch | — |

**SFX already in `sounds/sfx/` to use:** `Paddle Hit Sound`, `Wall Bounce Sound`, `Glitch
Pulse`, `3`/`2`/`1`/`GO`, `GLITCH PONG`, `Dash Activation`, `Dash Cooldown Ready`,
`Teleport Sound`, `Juke Sound`, `Near Miss Sound`, `Score Sound`, `Critical Moment`,
`Clapping Crowd`, `Game Over`.

---

## Editing rules
1. **Cut on the beat.** Every hard cut, word card and Heat jump lands on a downbeat.
2. **Gameplay first.** At least 80% of the runtime is real in-game footage. Text cards are
   overlays on top of it, never full-screen breaks (except the countdown and end card).
3. **One word per feature.** Never more than 5 words on screen at once.
4. **Use silence.** There are three planned dead-air moments: the cold open, the Drowsy
   Ball and the Boss freeze. That contrast makes the loud parts feel louder.
5. **Use the game's own UI.** HUD alerts (`NEAR MISS DETECTED`, `CLUTCH MODE ENGAGED`,
   etc.) work as captions, so you won't need many separate graphics.
6. **Leave them hanging.** Never show who wins the final point.

## Capture checklist
- [ ] Record at **60 fps**, 1080p minimum (4K if possible for the Nexus and Construct close-ups).
- [ ] Hide the mouse cursor. Use landscape and full-screen the browser.
- [ ] **AI vs AI** (Easy for calm rallies, Hard for chaos) for clean, repeatable footage.
- [ ] One clean playthrough per arena that reaches 100% Heat, so you have boss footage in each.
- [ ] Split power-up with three balls on screen (several takes, so one has a clean wrong guess).
- [ ] A 30+ hit rally to trigger Drowsy Ball.
- [ ] A spite moment (big score lead).
- [ ] A 6–6 match point with Clutch Mode on and a long final rally.
- [ ] A Level-Up cinematic and a perk selection screen (use a fresh browser profile to level
      up quickly).
- [ ] An online lobby with two players and a visible join code.
- [ ] Separate recordings of the music and SFX files, so audio can be mixed cleanly in the edit.

## Bonus cutdowns (from the same footage)
- **30s social cut:** Scenes 2 → 3 → 4 (DASH only) → 5 (SPLIT only) → 10 (freeze, morph,
  Eye stare) → 12.
- **15s teaser:** Scene 1 (3s) → Scene 2 → Eye morph and stare → `GLITCH PONG` → URL.
