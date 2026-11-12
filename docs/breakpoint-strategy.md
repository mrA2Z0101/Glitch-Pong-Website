# Breakpoint — How to Win

Everything here comes from how the game works (`breakpoint/js/`), not guesswork. The numbers are the game's own. Where a figure was measured, it came from the game's AI playing real runs ([breakpoint-balance.md](breakpoint-balance.md)).

---

## 1. The paddle and the ball

**Where the ball lands on the paddle sets its angle.** Dead centre sends it straight up. The very end sends it out at 60 degrees. Nothing else about your paddle changes the shot, so aiming is the whole skill.

- To clear a column, hit with the middle.
- To get behind the wall, hit with an end and aim for a gap at the side.

**The ball speeds up 1.8% every time it touches the paddle**, up to roughly twice its starting speed. It is also served 1.5% faster each sector. A long rally in a deep sector is fast. Losing a life resets the speed.

**The paddle is 110 pixels wide and the field is 960.** It crosses the field in about a second and a half. If the ball is going to land far away, start moving when it turns, not when it arrives.

---

## 2. Score

A brick is worth its base value × the combo bonus × the Glitch multiplier.

| Brick | Hits | Base score |
|---|---|---|
| Data brick | 1 | 50 |
| Moving brick | 1 | 90 |
| Virus brick | 1 | 90 |
| Clone brick | 1 | 100 |
| Teleport brick | 2 | 110 |
| Orbiting brick | 1 | 110 |
| Explosive brick | 1 | 120 |
| Shield brick | 1 | 120 |
| Healing brick | 2 | 130 |
| Quantum brick | 1 | 140 |
| Heavy brick | 3 | 150 |
| Invisible brick | 1 | 160 |
| Firewall brick | 2 | 180 |
| Generator | 2 | 200 |
| Boss core | 8 | 1,000 |

Other scores: an enemy is 200, each hit on a boss is 120, a boss kill is 2,500, and clearing a sector pays 500 plus 100 for each sector number.

**Combo.** Every brick broken between two touches of the paddle adds 5% to the next one, up to +200% at a combo of 40. Touching the paddle resets it. So the best shots are the ones that keep the ball up in the bricks: get it behind the wall and it can break a dozen before it comes back.

**Glitch meter.** Each brick adds 1.1% and the meter drains about half a percent a second.

| Meter | Score |
|---|---|
| under 25% | ×1 |
| 25% | ×1.5 |
| 50% | ×2 |
| 75% | ×3 |

A full meter also means more corruption, more frequent glitch events, and 4% more power-up drops from 50%. At 100% the machine overloads: a flash, a shake and a glitch event on the spot. It then has to drain below 80% before it can overload again.

In practice the meter fills by itself if you keep the ball alive. From about sector 7 the AI finishes every sector with the meter at about 90% or more. You don't need to manage it; you need to survive it.

---

## 3. Bricks worth aiming at first

1. **Generators.** While one is alive, shield bricks can't be hurt and the boss core is locked.
2. **Clone bricks.** They copy themselves into an empty space every 10 to 16 seconds. Left alone they refill the board.
3. **Healing bricks.** They repair a damaged brick near them every 3 to 5 seconds, which undoes your work on heavy bricks.
4. **Explosive bricks.** They damage everything within 90 pixels. One in the middle of a cluster is the fastest way through it.
5. **Virus bricks** turn up to two neighbours into something worse when they break. Break them when they have few neighbours left.

**Firewall bricks can't be broken by the plain ball.** Fire Ball, the Laser Paddle, explosions and the EMP all work. If firewalls are all that is left, the game sends a Fire Ball, Laser Paddle or Explosive Ball within a few seconds, so you can't get stuck.

---

## 4. Power-ups

A broken brick has a 13% chance of dropping one (17% once the Glitch meter is over 50%, and 4% more per rank of Packet Sniffer). All twenty are equally likely. They stack.

The AI, which never goes out of its way for a capsule, catches about a third of what drops. **Going to get them is the biggest thing you can do that the AI doesn't.**

Best to worst, roughly:

- **Extra Life.** It is as likely as anything else, so over a Classic run several will drop. Catch every one.
- **Fire Ball** (10 s). Double damage, passes through what it breaks, and breaks firewalls.
- **Triple Ball / Split Shot.** More balls means more bricks, and you only lose a life when the last one falls. In multi-ball the ball with the most bricks scores 50% more.
- **Firewall Shield** (15 s). A floor under the paddle. It also blocks enemy shots.
- **EMP Blast.** One hit on every brick and it clears every enemy shot in the air.
- **Laser Paddle** (12 s). Keep pressing fire: it shoots up to three times a second. Lasers break firewalls.
- **Score ×2** (20 s). Best caught when the meter is already at ×3.
- **Magnet Paddle** (14 s). The ball sticks where it lands. Launch it from the end of the paddle to aim.
- **Slow Motion, Time Warp, Freeze Time.** Breathing room. Freeze stops bricks and enemies but not you.
- **Wide Paddle, Drone Assist, Piercing Ball, Explosive Ball, Energy Pulse, Glitch Bomb, Gravity Ball.** All help. Gravity Ball makes the ball arc downward, which is the one that can catch you out.

In MEMORY LEAK any power-up also puts your paddle back to full length.

---

## 5. Enemies

They appear from sector 3. A shot that hits your paddle stuns it for 2.2 seconds (it moves at a third of its speed) and resets your combo. The Firewall Shield blocks shots.

| Enemy | From | Hits from the ball | What to do |
|---|---|---|---|
| Drone | sector 3 | 1 | It shoots straight down. Don't sit under it. |
| Virus Orb | sector 6 | 1 | It turns bricks into virus bricks. Kill it early. |
| Repair Bot | sector 6 | 1 | It repairs damaged bricks. Kill it before working on heavy bricks. |
| Turret | sector 6 | 2 | It aims at your paddle. Keep moving. |

A laser does half the damage of the ball, so each takes about twice as many laser shots.

**The ball avenges you.** A shot that hits your paddle sends the ball after the shooter, and enemies take double damage from it. You don't have to aim.

---

## 6. Bosses

Every fifth sector. A boss sector has only a few bricks; the boss is the target.

| Boss | Sector | Boss Rush | How |
|---|---|---|---|
| Memory Guardian | 5 | 1st | Three shield arcs turn around it and cover about 60% of the circle. Shoot through the gaps. |
| Virus Queen | 35 | 2nd | It moves a lot and keeps turning bricks into virus bricks. Ignore the bricks. |
| Firewall Titan | 15 | 3rd | Its underside is armoured. Hit it from the side or above, where a hit counts double, or use a Fire Ball. |
| Quantum Core | 45 | 4th | It teleports every 2 to 3 seconds and can't be hurt for half a second after each jump. |
| Data Hydra | 25 | 5th | Three heads, each with its own health. All three must go. |
| THE EYE | 10, 20, 30... | 6th | It blinks to armour itself, fires volleys of six, and teleports. It has about twice the health of a mini boss and the fight takes about twice as long. |

Classic is 12 sectors, so it meets Memory Guardian at 5 and THE EYE at 10. The others turn up in Endless, Corruption and Hardcore, and in Boss Rush, which is all five in order and then THE EYE.

The EMP does 3 damage to a boss. Lasers do 1 each.

---

## 7. The arenas

Each has one rule ([breakpoint.md](breakpoint.md) has the numbers).

- **NEON GRID, light bar.** It bounces the ball both ways. Shoot past its ends.
- **QUANTUM REACTOR, pulse.** A ring closes on the core for 1.6 seconds before it fires. A ball below the core gets thrown down at you: be under it.
- **MEMORY LEAK, leaking paddle.** A ball that comes back without breaking a brick costs your paddle 3% of its length, down to four fifths. Aim every shot at something, and catch any power-up to restore it.
- **VIRUS HIVE, tunnels.** A ball into one gate comes out of the other. Watch the exit, not the entrance.
- **DIGITAL CATHEDRAL, beam.** A dashed line shows where the beam will be about a second before it fires.
- **CORRUPTED BIOS, bad sector.** The ball changes direction at random inside the marked patch. Don't commit until it leaves.
- **AI MAINFRAME, defender.** It follows a rising ball and blocks it, then reboots for 2 seconds. Angle your shots: it moves at 120 pixels a second and a wide shot outruns it. After a block, the next shot is free.
- **DATA TUNNEL, no side walls.** Up among the bricks the ball goes out one side and in the other, which is a quick way behind the wall. Beside your paddle the walls are solid, so nothing wraps at the last moment.
- **BLACK HOLE NEXUS, gravity well.** The ball curves toward the hole. A ball passing close can come back down sooner than you expect.
- **INFINITE SERVER, descending racks.** The wall drops a row every 14 seconds until it is 170 pixels above you. The lower it is, the less time you have between hits. Clear the bottom rows first.
- **BROKEN SIMULATION, drift.** The gauge at the top shows which way the ball is being pulled. Stand a little downwind of where it would otherwise land.

---

## 8. The ball's moods

The ball is on your side, mostly.

- **Rampage.** Get it behind the wall and it scores double until it drops back out. This is the best scoring in the game. The top corners of a wall are the way in.
- **Show-off.** Six bricks without touching the paddle makes it 6% faster until it does. Be ready.
- **Bored.** Five returns without a brick and it steers itself at one. On a nearly empty board, that finishes the sector for you.
- **Loyal.** On your last life, once a sector, it refuses to fall past a near miss. Not in Hardcore.
- **Protective.** See §5.
- **Mourning.** After a lost life the next ball starts 22% slower for 3.5 seconds. Use it to line up.

---

## 9. Upgrades

Credits come from score: a run pays its score divided by 55, plus 15 for each sector reached. Each branch of the tree is bought from the top down.

A good first 2,000 credits:

1. **Extended Paddle** (350). A longer paddle is the upgrade you feel most.
2. **Stabilizer** (600), then **Backup Process** (650): an extra starting life.
3. **Packet Sniffer** (450): more power-ups, which means more extra lives.

The two abilities, Laser Array and EMP Capacitor, sit at the bottom of their branches. The EMP recharges in 40 seconds and does 3 damage to a boss.

---

## 10. Quick checklist

1. Aim with the ends of the paddle. Get the ball behind the wall.
2. Go and catch power-ups. Extra lives most of all.
3. Break generators, clone bricks and healing bricks first.
4. Don't sit under drones. Keep moving for turrets.
5. Read the arena's rule during the countdown.
6. Against the defender, shoot wide, and shoot again right after a block.
