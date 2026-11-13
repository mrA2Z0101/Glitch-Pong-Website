# Breakpoint — Balance Report

What was measured in Breakpoint, what it showed, what was changed because of it, and what is left as a recommendation. How the game is put together is in [breakpoint.md](breakpoint.md). How to play it well is in [breakpoint-strategy.md](breakpoint-strategy.md).

## How this was measured

- **Setup.** `scripts/breakpoint-sim.js` opens the real game in a headless browser, puts it on a made-up clock, switches the drawing off, and lets the game's own AI play whole runs. Nothing is simulated: it is the game's code. A Classic run takes a few seconds.
- **Two players.**
  - *The AI* is the one behind AI Autoplay. It aims the ball at bricks, never goes out of its way for a power-up, and almost never misses.
  - *The imprecise player* is the same AI made to act a tenth of a second late and aim with an error that wanders by about 22 pixels (a fifth of the paddle). It is a stand-in for someone who misses sometimes. It is not a person.
- **Runs.** About 1,900 in all: Classic, Hardcore and Boss Rush, by both players, on the game as it was before this work ("old") and after ("new").
- **Limits.**
  - Nobody has played the changed game by hand. The AI shows what the rules make possible and how often. It doesn't show how a sector feels.
  - Lives lost per sector is a noisy number. Two identical batches of 60 to 80 tries gave 0.33 and 0.53 for the same sector. Read differences under about 0.1 as nothing.
  - Everything was on the desktop field (960 × 640). The upright phone field, which is narrower and taller, was not measured.

## What a run looks like

The AI, Classic, 150 runs on the new game. A starred sector is a boss.

| Sector | Arena | Bricks | Seconds to clear (median) | Power-ups dropped | Caught | Glitch events | Glitch meter at the end |
|---|---|---|---|---|---|---|---|
| 1 | GLITCH ARENA | 31 | 66 | 3.9 | 1.3 | 2.5 | 5% |
| 2 | NEON GRID | 38 | 64 | 4.8 | 1.4 | 2.5 | 15% |
| 3 | QUANTUM REACTOR | 37 | 60 | 5.0 | 1.4 | 2.5 | 28% |
| 4 | MEMORY LEAK | 46 | 61 | 6.7 | 1.9 | 2.6 | 53% |
| 5 * | VIRUS HIVE | 8 | 75 | 1.3 | 0.4 | 3.7 | 36% |
| 6 | DIGITAL CATHEDRAL | 54 | 69 | 9.1 | 2.7 | 3.6 | 69% |
| 7 | CORRUPTED BIOS | 55 | 69 | 10.2 | 3.1 | 4.4 | 88% |
| 8 | AI MAINFRAME | 63 | 85 | 12.8 | 4.1 | 5.6 | 96% |
| 9 | DATA TUNNEL | 62 | 83 | 12.2 | 3.8 | 5.5 | 97% |
| 10 * | BLACK HOLE NEXUS | 8 | 157 | 1.6 | 0.5 | 7.6 | 39% |
| 11 | INFINITE SERVER | 72 | 74 | 13.7 | 4.4 | 4.5 | 85% |
| 12 | BROKEN SIMULATION | 66 | 78 | 12.6 | 4.1 | 5.2 | 96% |

- **A Classic run takes the AI 17 minutes**, and nine in ten take 20 or less.
- **A sector takes 60 to 85 seconds**, whatever its number. The wall doubles from 31 bricks to about 70, but combos and power-ups keep pace.
- **THE EYE takes twice as long as anything else**: 157 seconds against 75 for the first mini boss.
- **94 power-ups drop in a run and the AI catches 29**, because it never chases one. Each of the twenty kinds is caught about 1.5 times a run, Extra Life included.
- **The AI won all 150 runs** and lost 0.07 lives a run.

## Where runs end

The AI doesn't lose, so the imprecise player is the one to ask. Classic, 240 runs on the new game: it won 17%, lost 3.6 lives a run, and its median run lasted 13.5 minutes.

| Sector | Arena | Runs that ended here | Lives lost per try, new | Old |
|---|---|---|---|---|
| 1 | GLITCH ARENA | 0 | 0.30 | 0.36 |
| 2 | NEON GRID | 2 | 0.38 | 0.36 |
| 3 | QUANTUM REACTOR | 4 | 0.37 | 0.40 |
| 4 | MEMORY LEAK | 12 | 0.61 | 0.39 |
| 5 * | VIRUS HIVE | 5 | 0.17 | 0.23 |
| 6 | DIGITAL CATHEDRAL | 28 | 0.38 | 0.37 |
| 7 | CORRUPTED BIOS | 15 | 0.34 | 0.45 |
| 8 | AI MAINFRAME | 38 | 0.50 | 0.56 |
| 9 | DATA TUNNEL | 33 | 0.63 | 0.46 |
| 10 * | BLACK HOLE NEXUS | 7 | 0.16 | 0.13 |
| 11 | INFINITE SERVER | 40 | 0.65 | 0.54 |
| 12 | BROKEN SIMULATION | 15 | 0.59 | 0.51 |

- **Runs end from sector 6 on**, most often at 6, 8, 9 and 11. Three starting lives and the odd Extra Life carry this player through the first five sectors.
- **Bosses are the safest sectors.** There are few bricks, so the ball comes back slowly and predictably.
- **70% of lives were lost with no glitch event running.** OVERCLOCK (6%) and DATA SURGE (4%), the two that speed the ball up, cost the most of the rest.
- **The new game is a little harder for this player than the old one**: 17% of runs won against 25%, with the same lives lost per run (3.6 against 3.5). The difference is in three of the arenas with new rules: MEMORY LEAK, DATA TUNNEL and INFINITE SERVER.

In Hardcore the same player's median run lasts two and a half minutes and ends in sector 1 to 4. The AI in Hardcore reaches sector 30 in 37 runs of 60 and dies somewhere between 7 and 27 in the rest.

## What was wrong and is now fixed

### Already in the game

**1. The DATA HYDRA could stop a run for good.** When a shot from the hydra hit the paddle, the ball went after it. It steered at the hydra's position, which is the middle of the three heads, and there is nothing there to hit. The ball circled that spot for ever, never falling, and the sector never ended.

- Every one of 12 Boss Rush runs the AI played on the old game stalled at the hydra, its fifth boss. Boss Rush is round 2 of the Eye gauntlet.
- In Endless and Hardcore the hydra is sector 25, and a run stalled there too.
- **Fix:** the ball hunts the nearest head that is still alive. On the new game 90 of 90 Boss Rush runs finish, and a 40-sector Endless run goes straight through.

**2. A full Glitch meter set off an event every two seconds.** Reaching 100% triggers an overload: a flash, a hard shake and a glitch event on the spot. In deep sectors the meter hovers just under full, so it reached 100% again and again.

| Sector | Glitch events, old | New |
|---|---|---|
| 6 | 3.5 | 3.6 |
| 7 | 13.7 | 4.4 |
| 8 | 37.4 | 5.6 |
| 9 | 40.0 | 5.5 |
| 11 | 12.0 | 4.5 |
| 12 | 29.5 | 5.2 |

Forty events in a 90-second sector, each with a full-screen flash, is also a problem for anyone sensitive to flashing.

- **Fix:** after an overload the meter has to fall below 80% before it can overload again. The ×3 score band starts at 75%, so this costs no score.

**3. A DATA SURGE could last the rest of the sector.** If another event started while a surge was running, the surge was replaced without being ended, and the ball stayed 55% faster until the sector was cleared. With events every two seconds this happened constantly.

- **Fix:** an event in progress is ended properly before the next one starts.

**4. Hardcore handed out extra lives.** The mode says "One life. No continues." Extra Life dropped there like anything else, and the AI caught four or five in a 30-sector run. With them, none of 40 AI runs ended before sector 30. Without them, 23 of 60 do.

- **Fix:** Extra Life doesn't drop in Hardcore, and the Randomizer can't turn into one.

**5. The codex's enemy health was in the wrong unit.** It said a drone takes two hits. The ball does 2 damage, so it takes one. Corrected to hits from the ball.

### In the arena rules added by this work

Each of these was found by the harness and changed before anyone played it.

**6. The DEFENDER blocked nearly every shot.** In its first version (a bar 120 wide, moving at 170 pixels a second, 160 pixels above the paddle) the AI needed between 9 minutes and 113 minutes for sector 8.

- **Now:** 110 wide, 120 pixels a second, 190 pixels above the paddle, and after each block it reboots for 2 seconds, so the next shot always gets through. The AI clears the sector in 85 seconds.

**7. NO SIDE WALLS made balls unreachable.** A low ball that left one side came back in the other, next to the paddle line, with the paddle a field's width away. The AI lost 0.43 lives a try there, against 0.06 before the rule existed.

- **Now:** the side walls are solid for 240 pixels above the paddle. A ball wraps only up among the bricks, and then has at least six tenths of a second to fall. The AI loses 0.01 lives a try.

**8. The LEAKING PADDLE was too harsh for sector 4.** It lost 3% on every return and stopped at 60%. The imprecise player lost 0.84 lives a try there, twice what the sectors either side cost, and 13 of its 80 runs ended there.

- **Now:** only a return that breaks nothing costs length, so accurate play keeps the paddle whole, and it stops at 80%. It still costs this player more than the old sector did (0.61 against 0.39). See recommendation F.

**9. The DESCENDING RACKS came too close.** They now stop 170 pixels above the paddle, not 150.

## Recommendations

Not changed, because each is a decision about what the game should be.

### A. Boss Rush is 26 minutes for a player who never misses

| Boss Rush sector | Boss | Seconds (median) |
|---|---|---|
| 1 | Memory Guardian | 87 |
| 2 | Virus Queen | 319 |
| 3 | Firewall Titan | 241 |
| 4 | Quantum Core | 385 |
| 5 | Data Hydra | 261 |
| 6 | THE EYE | 240 |

- **Why.** In Boss Rush a boss's health grows with its position in the run, and position there counts every sector. The fourth boss has the health a boss has at sector 20 of Endless. It also teleports every two to three seconds and can't be hurt for half a second after each jump.
- **Caveat.** The AI aims at bricks, not at bosses, so a person aiming at the boss will be quicker. But the first boss takes the AI 87 seconds and the rest take three to four times that.
- **Recommendation.** Grow boss health in Boss Rush half as fast, which would bring the run to roughly 12 to 15 minutes. It matters more than it looks, because Boss Rush is round 2 of the Eye gauntlet.

### B. The Glitch meter isn't a choice

The game describes it as risk against reward. In practice it fills by itself: each brick adds 1.1% and it drains half a percent a second, so anyone who keeps the ball in play is at 88% by sector 7 and stays there. There is no way to turn the risk down except to stop breaking bricks.

- **Recommendation.** Either let it drain faster, so staying at ×3 takes combos, or give the player a way to spend it (for example, the special ability empties the meter).

### C. Extra lives are as common as anything else

All twenty power-ups are equally likely. The AI, catching 31% of what drops, picks up 1.5 Extra Lives in a Classic run. A player who catches most drops would get four or five, on top of three starting lives.

- **Recommendation.** Make Extra Life a third as likely as the others.

### D. AI Autoplay with AI Progression on is free credits

The AI won 150 Classic runs of 150 and scored a median of 271,000, which is about 5,000 credits a run. With AI Progression switched on in Settings, leaving it running buys the whole upgrade tree (24,250 credits) in about five runs.

- **Recommendation.** Pay AI-played runs at a tenth of the rate, or cap what a day of them can earn.

### E. Nothing gets harder after sector 12

In Hardcore the AI's sectors 13 to 30 take the same 75 to 100 seconds as sectors 8 to 12 and cost the same lives. The wall stops growing at nine rows at sector 10, and no new brick or enemy arrives after sector 8. Only the ball's serve speed keeps rising, by 1.5% a sector.

- **Recommendation.** For Endless and Hardcore, keep something growing: enemy numbers, or a second arena rule from sector 13.

### F. Watch MEMORY LEAK

After the changes in fix 8 it still costs the imprecise player about 0.2 more lives a try than the same sector did before. That player catches power-ups only by accident, and catching one is how the paddle is restored, so a person may find it easier. If people report sector 4 as a wall, `least` in `ARENA_TUNING.leak` (`breakpoint/js/rules.js`) is the number to raise.

### G. Play it

Everything above was measured with the AI. Whether the six new arena rules are fun, whether the defender's reboot reads clearly, and whether the coach's lines land at the right moments all need a person at the paddle.

## Running it again

```bash
python3 -m http.server 8765
```

```bash
node scripts/breakpoint-sim.js classic 50 runs.json
```

```bash
node scripts/breakpoint-sim-report.js "Classic" runs.json
```

The harness needs Playwright, which the site itself doesn't use. Set `NOISE=22 LAG=6` for the imprecise player, and `MAXLEVEL` to stop the endless modes at a sector. The options are listed at the top of `scripts/breakpoint-sim.js`.
