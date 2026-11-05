# Glitch Pong — Balance Review

I read through `glitchpong-site.js` and ran simulated matches to measure what decides games. This report lists what's unbalanced, what's already fixed, and what I recommend changing next.

## How this was measured

- **Setup.** A test harness served an instrumented copy of the game; the repo copy was untouched. It ran full first-to-7 matches with **Hard AI vs Hard AI** across all four arenas, and logged every point with its cause.
- **Speed.** Canvas drawing was switched off to speed things up; the game logic doesn't read pixels, so that changes nothing about the rules.
- **Limits.** AI vs AI isn't human play: humans miss more and rallies are shorter. So treat the numbers as showing **structural** problems — what the rules make possible and how often — not how a human match will feel. All matches were on desktop.

## What decided matches (12 Hard-AI matches per build, all four arenas)

| | Before (live game) |
|---|---|
| Points that came from own goals | **72%** (92 of 127) |
| …own goals that were really successful returns (bug #1) | 19 of 32 |
| …own goals caused by a teleport reversing the ball | 10 of 32 |
| …own goals caused by a glitch wall reflecting the ball | 3 of 32 |
| Points scored during Critical Heat (80%+) | 58 of 67 |
| Top ball speed per match (median / max) | 72 / 107 px per frame |
| Boss fights lost by the Hard AI | 0 of 12 |
| Left vs right paddle wins | 6 – 6 |

_Simulations of the bug-fixed build and of recommendations A and B are still running; their columns get added here when they finish._

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

## Recommended next (design decisions, not applied)

These change how the game feels, so I've left them to you. All of them can be tried today in the new **Custom Match** mode.

### A. Cap the ball's horizontal speed
- **Problem.** The existing speed cap only trims vertical speed. Horizontal speed multiplies by up to ~11.5% on every return and never stops: the simulation reached 70–100 pixels per frame, crossing the whole court in about a quarter of a second.
- **Recommendation.** Cap horizontal speed at around 24 px/frame. Long rallies still get fast and still end, but by skill rather than physics.
- **Try it:** Custom Match → Top Speed.

### B. Make glitch-caused own goals cheaper
- **The rule.** A ball in your colour going past you scores 2 for the opponent, or 3 at Critical Heat.
- **The problem.** A player can never put their own shot past themselves; only the arena can: a teleport that flips direction, the side of a glitch wall, or a Black-Hole micro-hole. Even after the bug fix, these random events decide a large share of points, at 2–3 points each in a first-to-7 match.
- **Option 1 (recommended).** When a glitch reverses the ball, it becomes neutral (1 point). The chaos stays, but one teleport can't hand over almost half a match.
- **Option 2.** Keep 2–3 points, but telegraph it: flash the ball for a few frames before a teleport, or only flip direction when the ball is in the attacker's half.
- **Try it:** Custom Match → Own-Goal Penalty off makes every point worth 1.

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
- **The asymmetry.** The AI always tracks the real ball, so your Split Ball does nothing to it, while the AI's Split Ball and Heat afterimages do fool you.
- **Recommendation.** Give the Easy and Medium AI a chance to chase a decoy for a few frames, scaled by difficulty.

### E. The boss fight is all risk, no reward
- **How it works.** Miss one of the Eye's six shots and your opponent gets 2 points. Survive all six and nobody scores.
- **The result.** The player who's ahead gains nothing from the fight. In the simulation the Hard AI never lost a boss fight, so against Hard the Eye is effectively a one-sided trap for the human.
- **Recommendation.** Give a small reward for surviving: 1 point to whoever returned more shots, or a free Phase Shield.

### F. Remove the Q debug key from the public build
Pressing **Q** in a match instantly maxes Heat and summons the Eye. It's handy for testing, but players can use it to force a 2-point gamble whenever they like. Keep it behind a debug flag.

### G. Smaller notes
- **Teleport.** It fires every 7–20 s at any Heat, from the very first rally. Consider only enabling it above some Heat (say 30%), so early rallies are clean and the chaos builds with Heat, like glitch walls do.
- **Rubber-banding is fine.** Spite (wall bounces bend toward the losing player) and serve memory (serves aim at where the receiver missed) are mild and give the ball personality. Keep them, and mention them in the How to Play page so they don't feel like bugs.
- **Mobile.** Heat is already scaled down for narrow screens. Glitch walls and teleports aren't, so phone matches get relatively more chaos per rally.

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
