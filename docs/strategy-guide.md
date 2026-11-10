# Glitch Pong — How to Win

Everything here comes from how the game actually works (`glitchpong-site.js`), not guesswork. Speeds and Heat work the same on every screen size, from phones to big monitors.

---

## 1. The basics that decide most points

**Your paddle's hitbox is exactly its height.** The ball counts as returned if its centre is anywhere on the paddle, so the ends of the paddle are just as safe as the middle.

**Where you hit the ball sets its angle.** Every return adds 0.04 × (how far from your paddle's centre you made contact) to the ball's vertical speed. A hit on the very tip of the paddle adds the most angle; a dead-centre hit adds none. Vertical speed is capped, so you can't make it truly vertical.

- Want a flat, fast shot? Meet it with the centre.
- Want a steep shot that bounces off a wall? Meet it with the top or bottom edge.

**Go back to the middle after every hit.** The ball can teleport, juke or bounce off a glitch wall at any moment (see §4). From the centre you can reach both ends; from a corner you can't.

**The rally gets faster with every hit.** Each return speeds the ball up a little more as Heat and your combo rise. After about a dozen hits it's much faster than the serve. Long rallies are won by whoever is still centred when the speed gets silly.

**Dash (Shift + direction) is an instant 76-pixel jump** (up to 90 at max Heat), with roughly a one-second cooldown. Save it for the last moment. Dashing early just leaves you out of position with no dash left.

---

## 2. Beating the AI

The AI plays by the same rules as you: same paddle speed, same dash. What differs is how it reads the ball:

| | Easy | Medium | Hard |
|---|---|---|---|
| How far ahead it predicts | ~10 frames | ~16 frames | ~22 frames |
| Chance of misreading a shot | 16% | ~7% (drops as you level up) | 3% |
| Dashes to save a shot | rarely (8%) | about half the time | almost always |
| Aims returns away from you | no | a little | yes |

How to exploit that:

1. **Steep angles beat its prediction.** The AI extends the ball's current path in a straight line and **doesn't account for wall bounces**. Hit off your paddle's tip so the ball bounces off a wall close to the AI's side. It commits to the wrong spot and has to scramble back. This works on every difficulty and is deadly on Easy and Medium.
2. **Make it travel.** Between shots it drifts back toward the centre. Alternating high and low corners forces long moves every time, and every long move is a chance to misread.
3. **Easy and Medium rarely dash.** Shots that are wide *and* fast are often unreachable without a dash, and they usually don't take it.
4. **Hard aims for the open side.** If you're sitting high, expect the return low. Getting back to centre (§1) is how you deal with it.
5. **The AI can't be fooled by decoys or Split Ball.** It always tracks the real ball. See §5 before you spend a Split on it.

---

## 3. Heat and the Eye (boss)

- **Each return adds about 12.5% Heat.** Heat drains a little as the ball travels and **resets to zero every time someone scores**. Because it drains by distance, not time, a slow ball builds Heat just as well as a fast one. The Eye only appears after one long rally of roughly a dozen straight returns, and **at most once per match**.
- **The boss fight is all-or-nothing.** The Eye throws six shots, three at each player. **The first player to miss one gives the opponent 2 points.** Survive all six and nobody scores.
- **It telegraphs.** Before each throw, the Eye turns to look at its target about a quarter of a second ahead. When it looks at you, get ready.
- **It aims at where your paddle is.** Each shot lands within roughly ±150 px of your paddle's centre. Don't wander off before the throw; staying put keeps the shot close.
- **Shots can juke once or twice, but only in the middle half of the court.** Don't commit early. Wait until the shot has passed the middle, then move.
- **A shield helps here too.** An active Phase Shield makes your paddle taller during the boss fight.

**Score tactics:** if you're ahead, the Eye is pure risk for you (2 points on one miss). If you're behind, it's a chance to catch up by 2. Long rallies are what summon it, so when you're leading, finishing points early is a valid way to play.

---

## 4. Ball colour, own goals and glitch bounces

The ball takes the colour of whoever hit it last. **If a ball in *your* colour goes past *you*, your opponent scores 2 points, or 3 during Critical Heat (80%+ Heat).**

The arena can't do that to you. When a glitch sends the ball back the way it came, the ball **turns white (neutral)** and is worth the normal 1 point:

- **Teleport.** Every 7–20 seconds (more often at high Heat) the ball blinks somewhere random, and 50–65% of the time it comes back the way it came.
- **Glitch walls** appear mid-court from 30% Heat (up to five at 80%+). If your shot hits the side of one, it bounces straight back at you.
- **Black-Hole Nexus micro-holes** (80%+ Heat) fling the ball off in a random direction.

**The one way an own goal still happens:** your opponent's **Phase Shield** bounces your shot back at you, still in your colour. Miss that and it's 2, or 3 at Critical Heat.

How to use this:

- After you hit, **watch your own shot until it reaches the other side.** A glitch can still send it back at you; it's only 1 point, but it's a cheap one to give away.
- **Look where you're aiming.** Avoid sending the ball straight into the side of a glitch wall. Clipping a wall's top or bottom edge only changes the ball's vertical direction.
- **Respect a shielded wall.** When your opponent's goal line is glowing, your shot is coming back in your colour. Stay centred and be ready for it, especially during Critical Heat.
- **The ball has a top speed.** Rallies get faster with every hit, up to a fixed limit: about 3.3 seconds to cross the court at serve speed and under a second at top speed, on any screen size. Once it's maxed out, the rally is decided by angles and glitches, not by pace.

---

## 5. Power-ups

An orb appears in the middle third of the court every 6–13 seconds and lasts about 15 seconds. **Only a ball that someone has hit can pick it up, and the orb goes to whoever hit it last.** Use edge hits (§1) to steer your returns through it.

- **Phase Shield (the best one).** Your whole goal line is protected until the ball gets past you once. It also blocks own goals, and makes your paddle taller during the boss. While it's up, your opponent's shots that hit it come back in **their** colour, so a miss costs them 2–3. Grab it whenever you can.
- **Power Strike.** Your next return goes 22% faster. It's best used on a steep angle the AI is already struggling with.
- **Split Ball.** Your next return splits into three balls, and only one is real.
  - **Against the AI it's wasted.** The AI always tracks the real ball.
  - **Against a human it's strong.**
  - **When it's used on you:** the fakes fly 3% slower, so **the real ball is the one in front.**

---

## 6. The ball has feelings (Sentience)

- **Spite.** If you're losing, wall bounces bend the ball slightly toward your paddle. If you're winning, expect the losing player to get easier saves.
- **Memory.** After a point, the serve goes to the player who just scored, aimed toward where they've missed before. Know your weak spot and be there.
- **Exhaustion.** After 30 returns in one rally the ball gets "drowsy" and starts to wobble up and down. Give it a little extra margin.

---

## 7. Arenas

- **Glitch Arena / Matrix Mainframe / The Construct.** Same rules, different look. The Matrix rain and Construct grid make fast balls harder to read, so stay centred.
- **Black-Hole Nexus.** The centre pulls the ball in, so shots through the middle curve. Boost and drag anomalies change the ball's speed. Above 80% Heat, micro-holes can fling the ball in a random direction (the ball turns neutral if it comes back at you).

---

## 8. Quick checklist

1. Centre after every hit.
2. Use the tip of your paddle for angles, the middle for speed.
3. Bounce shots off a wall near the AI. It doesn't predict bounces.
4. Grab Phase Shield whenever it spawns.
5. Watch your own shot. Glitches can send it back at you, and an opponent's Phase Shield sends it back in your colour for 2–3.
6. When the Eye turns to look at you, stay put until its shot passes the middle, then react.
7. When a Split Ball comes at you, follow the ball in front.
