# Glitch Pong — Balance Review

I read through `glitchpong-site.js` and ran simulated matches to measure what decides games. This report lists what's unbalanced, what's already fixed, and what I recommend changing next.

## How this was measured

- **Setup.** A test harness served an instrumented copy of the game; the repo copy was untouched. It ran full first-to-7 matches with **Hard AI vs Hard AI** across all four arenas, and logged every point with its cause.
- **Speed.** Canvas drawing was switched off to speed things up; the game logic doesn't read pixels, so that changes nothing about the rules.
- **Since then.** The Hard AI in these matches was the old one, which returned almost everything. The opponent has since been rebuilt to make human mistakes ([ai.md](ai.md)), so rally lengths and match times below no longer describe the current game.
- **Limits.** AI vs AI isn't human play: humans miss more and rallies are shorter. So treat the numbers as showing **structural** problems — what the rules make possible and how often — not how a human match will feel. All matches were on desktop.

## What decided matches (Hard AI vs Hard AI, all four arenas)

Three builds are compared:
- **Before:** the old live game, 12 matches.
- **Bug-fixed:** the current game, 24 matches.
- **+ A and B:** the bug-fixed game plus a horizontal speed cap of 24 (recommendation A) and glitch reversals that turn the ball neutral (recommendation B, option 1), 12 matches.

| | Before | Bug-fixed | + A and B |
|---|---|---|---|
| Share of all points that came from own goals | **72%** (92 of 127) | **40%** (105 of 260) | **4%** (6 of 134) |
| …own goals with no tracked glitch, mostly bug #1 | 19 of 32 | 4 of 36 | 2 of 2 |
| …own goals caused by a teleport reversing the ball | 10 of 32 | 25 of 36 | 0 (21 became 1-point neutral balls) |
| …own goals caused by a glitch wall | 3 of 32 | 7 of 36 | 0 (18 became 1-point neutral balls) |
| Points scored during Critical Heat (80%+) | 58 of 67 | 174 of 191 | 117 of 130 |
| Top ball speed per match (median / max) | 72 / 107 | **4,216 / 8,148** | 31 / 32 px per frame |
| Match length (median) | 9.0 min | 10.0 min | 16.6 min |
| Shutouts | 3 | 2 | 0 |
| Boss fights lost by the Hard AI | 0 of 12 | 0 of 24 | 0 of 12 |
| Left vs right paddle wins | 6 – 6 | 10 – 14 | 6 – 6 |

**What this shows**

- **The bug fix worked.** Saves no longer turn into own goals. The own-goal share of points dropped from 72% to 40%.
- **It also exposed recommendation A as urgent.** In the old build, the save-scored-as-own-goal bug happened to end very fast rallies. Without it, the Hard AI returns everything and horizontal speed keeps multiplying with every hit: the median match peaked above **4,000 px per frame**. That's several screen widths per frame.
  - A human can't return those balls, so in human play this shows up as the AI winning rallies no human could. About half of all points in the bug-fixed simulation were scored at more than 30 px per frame.
- **The cap and neutral reversals together fix both problems.**
  - Speed tops out around 31 px per frame at the moment of a return; the cap of 24 brings it back down on the next frame.
  - Teleports and glitch walls still decide plenty of points, but each is worth 1 instead of 2–3.
  - Matches became closer: no shutouts, a 6–6 side split, and 95% of points came from rallies.
- **Why the + A and B matches run longer.** Two Hard AIs at a capped speed rarely miss, so the matches stretch out. Humans miss far more often, so expect normal-length matches in real play. If they still feel long, raise the cap to around 28.
- **Unchanged in every build:** the Hard AI never lost a boss fight (recommendation E).

---

## Fixed in this change (bugs)

### 1. Successful returns could count as own goals (the biggest problem)
At high speed the ball can move past the goal line in a single frame. The paddle still caught it, but the goal check in the **same frame** saw the ball behind the line. Because the paddle had just touched it, the ball was the returner's colour, so this was scored as an **own goal worth 2–3 points against the player who made the save**.

In the baseline simulation this was the single most common source of points. **Fix:** a returned ball is moved back in front of the paddle face before the goal check runs.

### 2. Power Strike was stronger for the right paddle
A Power Strike return added **+40% speed for the right paddle but +22% for the left**. In single-player the AI is always the right paddle, and in local 2P it favoured Player 2. **Fix:** both sides now get +22%.

### 3. Clutch Mode could never trigger
Clutch Mode, and the **Clutch Protocol** perk, required a score of 8, but matches end at 7. The threshold looks like a leftover from a first-to-11 version. **Fix:** Clutch Mode now starts at match point (6–6, 6–5, 5–6), as intended.

**Heads-up:** matches now change feel at match point. During clutch the ball is 8% faster, Heat climbs on its own, and jukes are more likely. If that feels too intense, tone down those values rather than turning clutch back off.

---

## Applied: recommendations A and B

These are now part of standard Glitch Pong. The **+ A and B** column in the table above shows their effect.

### A. Horizontal speed cap (24 px/frame)
- **Problem.** The old speed cap only trimmed vertical speed. Horizontal speed multiplied by up to ~11.5% on every return and never stopped. The old build reached 70–100 pixels per frame; with bug #1 fixed, long rallies no longer ended early and the bug-fixed simulation reached thousands of pixels per frame.
- **Change.** Horizontal speed is capped at 24 px/frame. Long rallies still get fast, but they're decided by angles and glitches rather than by a ball nobody can see.
- **Screen size.** All speeds in this report are for a 1280-pixel-wide screen. The game scales horizontal ball speed to the distance between the paddles, so a shot takes the same time to cross any screen; on a 1920-wide screen the cap works out to about 37 px/frame.
- **Custom Match.** Top Speed now offers Chill 14 / Quick 20 / **Normal 24** / Insane 28 / No Limit. The Standard preset uses Normal; the Chaos preset uses No Limit.

### B. Glitch reversals turn the ball neutral
- **The rule (unchanged).** A ball in your colour going past you scores 2 for the opponent, or 3 at Critical Heat.
- **Problem.** A player can't put their own shot past themselves; only the arena could: a teleport that flips direction, the side of a glitch wall, or a Black-Hole micro-hole. These random events decided a large share of points, at 2–3 points each in a first-to-7 match.
- **Change.** When a teleport, glitch wall or micro-hole sends the ball back the way it came, the ball turns white (neutral) and is worth 1 point. The chaos stays, but one teleport can't hand over almost half a match.
- **What still scores 2–3.** An opponent's Phase Shield bouncing your shot back at you. That's a power-up they earned, so the bonus is deserved.

## Recommended next (design decisions, not applied)

These change how the game feels, so I've left them to you.

### C. Seven of the fifteen perks do nothing
Perks the level-up screen offers that have no effect in the code:

| Perk | Says | Status |
|---|---|---|
| Ghost Packet | Teleport cooldown −15% | not implemented |
| Signal Jammer | Juke illusion lasts longer | not implemented |
| Firewall Shield | Shield power-up is permanent ×2 | not implemented |
| Corrupt Return | First return after a power-up is faster | not implemented |
| Adaptive Kernel | Reduces arena corruption effects | not implemented |
| Mirror Ghost | Teleport leaves a decoy image | not implemented |
| Clutch Protocol | Speed boost at match point | was dead (clutch never triggered); works now |

Two more perks don't help against the AI, because the AI uses the same values:
- **Overclocked Paddle** speeds up every paddle, the AI's included.
- **Dash Cache** shortens every paddle's dash cooldown.

**Recommendation:** implement these perks, or remove them from the pool until they're implemented. Picking a perk that does nothing feels bad once players notice.

### D. Split Ball and decoys only fool humans
- **Update.** Done, for every difficulty. The opponent was rebuilt to play like a person (see [ai.md](ai.md)) and now follows a decoy 45% of the time on Easy, 28% on Medium and 12% on Hard.
- **The asymmetry.** The AI always tracks the real ball, so your Split Ball does nothing to it, while the AI's Split Ball and Heat afterimages do fool you.
- **Recommendation.** Give the Easy and Medium AI a chance to chase a decoy for a few frames, scaled by difficulty.

### E. The boss fight is all risk, no reward
- **Update.** The rebuilt opponent can lose the fight. Over 30 to 70 fights each, a Hard AI survived about four in five, Medium about seven in ten and Easy about four in ten. The recommendation below still stands.
- **How it works.** Miss one of the Eye's six shots and your opponent gets 2 points. Survive all six and nobody scores.
- **The result.** The player who's ahead gains nothing from the fight. In the simulation the Hard AI never lost a boss fight, so against Hard the Eye is effectively a one-sided trap for the human.
- **Recommendation.** Give a small reward for surviving: 1 point to whoever returned more shots, or a free Phase Shield.

### F. Remove the Q debug key from the public build
Pressing **Q** in a match instantly maxes Heat and summons the Eye. It's handy for testing, but players can use it to force a 2-point gamble whenever they like. Keep it behind a debug flag.

**Done.** Q now only works in [admin mode](admin.md), where it is also a button in the cheat menu. For everyone else it does nothing.

### G. Smaller notes
- **Teleport.** It fires every 7–20 s at any Heat, from the very first rally. Consider only enabling it above some Heat (say 30%), so early rallies are clean and the chaos builds with Heat, like glitch walls do.
- **Rubber-banding is fine.** Spite (wall bounces bend toward the losing player) and serve memory (serves aim at where the receiver missed) are mild and give the ball personality. Keep them, and mention them in the How to Play page so they don't feel like bugs.
- **Screen size and Heat (fixed).** Ball crossing time is now the same on every screen, and Heat drains by distance travelled instead of by time, so a rally builds the same Heat on a phone, a laptop or a large monitor, and at any ball speed. The old narrow-screen Heat reductions were removed because they were compensating for the phone's faster crossing.

---

## Custom Match (new)

The mode menu has a new **Custom Match** button.

**Presets:** Clean, Mild, Standard and Chaos.

**Match settings:**
- Opponent: vs AI or local 2P
- Points to win: 3 / 5 / 7 / 11

**The ball:**
- Serve speed and speed-up per hit
- Top speed (the cap from recommendation A)
- Ball size
- Toggles for teleport, jukes, speed pulses, decoys, and Sentience (spite, exhaustion, serve memory)

**The glitch:**
- Heat build rate
- Power-ups: off / normal / frequent
- Screen-glitch intensity
- Toggles for glitch walls, the Eye, and the own-goal penalty

Settings are saved in the browser. Custom matches are practice: they award **no coins and no XP**, so they can't be farmed with first-to-3 games.

The Standard preset is exactly normal Glitch Pong, so Custom Match doubles as a test bench for every recommendation above.
