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

The AI plays by the same rules as you: same paddle speed, same dash. It is built to play like a person, so it has a person's faults. It reacts late, misjudges, loses concentration, gets nervous and can be fooled. The three difficulties are three people of different skill. Full details are in [ai.md](ai.md).

| | Easy | Medium | Hard |
|---|---|---|---|
| Reaction time | a third of a second | a quarter | under a fifth |
| How far ahead it pictures the ball | ~14 frames | ~40 frames | the whole way, bounces included |
| Shots where its attention slips | 15% | 14% (drops as you level up) | 10% |
| Dashes to save a shot | rarely (15%) | 40% | 60% |
| Falls for a decoy ball | 45% | 28% | 12% |
| Aims returns away from you | no | a little | yes |
| Returns in an average point against itself | 4 | 8 | 14 |

How to exploit that:

1. **Change the ball late.** It needs its reaction time whenever the ball does something new: your return, a teleport, a juke, a glitch wall. A hard return from close to its side gives it the least time to catch up.
2. **Fast and steep beats flat.** It judges a fast ball worse than a slow one and a steep ball worse than a flat one, and its judgement only sharpens as the ball gets close. Tip hits (§1) at speed are where its misses come from.
3. **Make it travel.** Between shots it drifts back toward the centre. Alternating high and low corners forces long moves every time, and it re-aims only a few times a second.
4. **Long rallies wear it down.** From the sixth return of a rally its errors grow, and they grow again at Critical Heat, at match point and for a few seconds after it loses a point. Easy feels pressure most, Hard least.
5. **Easy and Medium rarely dash.** Shots that are wide *and* fast are often unreachable without a dash, and they usually don't take it. Hard dashes more, but not every time.
6. **Don't be predictable against Hard.** It leans towards where your shots have been arriving and aims its returns at your open side. Mix your targets, and get back to centre (§1).
7. **Decoys work on it.** Split Ball fakes and Heat afterimages can pull it out of position until the real ball is close. See §5.

---|---|---|---|
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
- **Bricks, bumpers and the train** on Breakpoint Crossover, Tilt and Last Train (section 7) send a shot that hits them square on straight back.

**The two ways an own goal still happens:** your opponent's **Phase Shield** bounces your shot back at you, still in your colour. So does a **goal post on Penalty Box** (section 7). Miss either and it's 2, or 3 at Critical Heat.

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
  - **Against the AI it works, more on Easy than on Hard.** It follows a fake 45% of the time on Easy, 28% on Medium and 12% on Hard, and only corrects when the real ball is close.
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
- **Penalty Box.** Only the middle half of each end wall is a goal. A shot that hits the post comes back in your colour and passes your opponent's paddle untouched, so aim for the mouth, not the corners. A wide angle that would score anywhere else is the riskiest shot here. At Critical Heat the two mouths drift up and down; an arrow by each one shows which way it is moving.
- **Stack Overflow.** The top and bottom edges wrap: the ball leaves one and comes back through the other. Paddles don't wrap, so a ball that crosses your line right at the seam is a full screen away from a paddle parked at the near edge. Hold the middle. From 50% Heat the ball comes back in offset sideways; the numbered markers on the two edges show where.
- **Memory Leak.** Every return narrows the court from both sides until it is a corridor about two paddles tall, and it opens again when someone scores. Early in a rally, angles win points. Late in one there is no room for angles, and it comes down to speed, dashes and glitches.
- **Defrag.** The top and bottom walls are slanted blocks, so a bounce can come off steeper or flatter than it went in. They rearrange between points, and from 50% Heat one wall at a time moves mid-rally (its new shape is outlined first). Read the bounce off the block, not off habit.
- **Freefall.** The ball falls. A flat shot drops on the way across, so meet it lower than it left, and expect it to come up off the floor. At Critical Heat gravity flips and everything happens against the ceiling instead; the lit edge of the court is the one the ball is falling towards.
- **Coolant Leak.** Your paddle slides. Start moving early and let go before you arrive, or tap against the slide to brake. Dash still works as an instant jump and is the one precise move you have on solid ice. Grip comes back as Heat rises and is complete at 80%.
- **Rooftop.** Wind hurries the ball towards one player and holds it up for the other. The rain leans the way it is blowing, and a readout shows the strength. Into the wind the ball arrives later and further up or down the court than you'd expect. At Critical Heat every lightning flash turns the wind round.
- **Beat Drop.** A return that lands on the beat comes off faster. You can't choose when the ball reaches you, but you can see it coming: if the ball is going to meet a paddle as the court pulses, be ready for the quicker one. The tempo rises with Heat, so more returns land on the beat late in a rally.
- **Breakpoint Crossover.** A wall of bricks stands on the centre line. Your shot breaks one brick and comes back to you neutral, so the first job is to make a hole, and the second is to hit it. A gap sometimes holds a power-up: put a ball in your colour through it. Bricks regrow faster as Heat rises, so a hole you made early may be gone when you need it.
- **Tilt.** Lit bumpers kick the ball away faster than it arrived. Hit one square on and your shot comes straight back, neutral. Clip one and the ball changes angle and keeps going. Dark bumpers do nothing, but more of them light as Heat rises, and by 65% all seven are live.
- **Quantum Shift.** Two portals on the centre line swap the ball between the top and bottom of the court, at the same speed and direction. Watch where your opponent's shot is heading: if it's going into a portal, cover the other one. From 50% Heat the portals roam, and a trip can then carry the ball closer to you as well.
- **Last Train.** A train runs down the centre line and nothing gets through while it passes. The signals flash and chevrons show its direction first. A shot that hits the train comes back neutral, so either get the ball across before it arrives or hold it on your side. From 50% Heat the trains are expresses: more often, much faster, and with a shorter warning.
- **Echo.** Every return comes with a ghost ball replaying an earlier shot, and from 50% Heat with two. Early on the ghosts are faint, so learn to pick the solid one. By Critical Heat they are nearly solid: watch the ball leave the paddle rather than trying to pick it out mid-court, and remember a ghost never bounces off a glitch wall or teleports.
- **Kernel Panic.** The lights are out. You can see the ball, a small circle round it, and the outline of your paddle. Every hit lights the court for a moment: use that moment to find glitch walls and power-ups. The ball's light shrinks as Heat rises.
- **Archive Build 0.1.** Below about 35% Heat this is plain Pong: no teleports, jukes, surges, power-ups or glitch walls. Points are won on angles alone, so use the tips of your paddle. Once the modern game starts showing through, everything else in this guide applies again.
- **The Eye's Lair.** The Eye arrives at 70% Heat here, roughly eight or nine returns into a rally. If you're ahead, end rallies early; if you're behind, a long rally brings your 2-point chance sooner. It opens when you clear the Eye Gauntlet in the arcade.

How these sixteen are built and tuned: [arenas.md](arenas.md).

---

## 8. Quick checklist

1. Centre after every hit.
2. Use the tip of your paddle for angles, the middle for speed.
3. Hit fast, steep shots at the AI and change the ball's line late. It misjudges those most.
4. Grab Phase Shield whenever it spawns.
5. Watch your own shot. Glitches can send it back at you, and an opponent's Phase Shield sends it back in your colour for 2–3.
6. When the Eye turns to look at you, stay put until its shot passes the middle, then react.
7. When a Split Ball comes at you, follow the ball in front.
