# The computer player

The computer opponent in Glitch Pong is meant to feel like a person on the other paddle. It uses the same paddle as you (same speed, same dash, same cooldown) and it plays through a model of a person: it reacts late, misjudges, loses concentration, gets nervous and can be tricked. The three difficulties are three people of different skill, not three paddle speeds.

The rules live in `glitchpong-ai.js`. `glitchpong-site.js` describes the court to it once a frame and moves the paddle by what it answers. The same player runs both paddles in AI vs AI and the menu's background rally.

## Why it was rewritten

The old opponent looked at the true ball every frame and moved straight to where it would arrive. Its only fault was a single dice roll per shot that either left it perfect or shifted its aim. On Hard that roll came up 3% of the time, so it returned almost everything, and what it missed it missed for no reason a player could see.

Measured in the real game, Hard against Hard on GLITCH ARENA:

| | Old | New |
|---|---|---|
| Returns in an average point | 75 | 13 |
| Longest rally | 320 returns (in one match) | 41 returns (in four matches) |
| Length of a first-to-7 match | 22 minutes | 5 to 10 minutes |
| Dashes in a match, both paddles | 1 | 12 to 35 |

The old opponent dashed once a match because of a bug: the timer that let it consider another dash only counted down on the menu screen.

## How it plays

Each frame the player goes through four steps.

1. **What it thinks the ball is doing.** While the ball does what it expects (flying straight, bouncing off the top and bottom), it sees it exactly. When the ball does anything else (the other paddle returns it, it teleports, it jukes, a glitch wall turns it), it carries on playing the ball it expected until its reaction time is up, then catches up. The reaction time varies by a fifth either way from shot to shot.
2. **Where the ball will arrive.** It projects the ball's path to its own paddle, through bounces, and on maps that change the ball it allows for the wrap, gravity and wind. Then it gets it wrong by an amount that depends on the shot:
   - a faster ball is harder to judge;
   - a steeper ball is harder to judge (the steepest about twice as hard as a flat one);
   - a ball that changed course on its way in is judged 1.6 times worse;
   - the error shrinks as the ball gets closer, slowly at first and quickly at the end, so a bad first read leaves it out of position with little time to recover.
3. **Its hands.** It re-aims the paddle a few times a second, not every frame, and lands near the spot it meant, not on it. Inside a small distance of the spot it stops fidgeting.
4. **The dash.** With the ball nearly on it and too far away to walk to, it may lunge. It doesn't always think of it, and now and then it lunges the wrong way.

On top of that:

- **Attention slips.** On some shots it isn't watching properly. It sets up a paddle or more away from where the ball is going and only notices when the ball has between 2% and 10% of the court left to travel. Against a slow ball that can be enough time to scramble back; against a fast one it isn't. A slip can also land on its reaction, which then takes 2.2 times as long.
- **Nerves.** Everything above gets worse under pressure: from the sixth return of a rally onwards (4% per return, up to 60%), at Critical Heat (20%), at match point (15%) and for six seconds after losing a point (30%, fading). It plays slightly better for five seconds after winning one. How much of this it feels depends on the difficulty.
- **Form.** At the start of each match it draws how well it is playing that day, from 8% better than usual to 12% worse.
- **Decoys.** Afterimages, Split Ball fakes and ECHO's ghosts can fool it. When a shot comes its way it may follow a fake until the real ball is close enough to tell apart.
- **Habits.** Between shots it returns towards the middle. The better players lean towards where your shots have been arriving, and take the ball slightly off-centre to send it away from you.
- **The Eye.** The Eye looks at its target before it throws, so the player needs only 40% of its usual reaction time for a throw. It can still misjudge one and lose the fight.

## The three difficulties

All times are in frames, 60 to a second.

| | Easy | Medium | Hard |
|---|---|---|---|
| Who it is | new to the game | plays regularly | very good |
| Reaction time | 20 (a third of a second) | 14 | 11 (under a fifth of a second) |
| Frames between re-aiming | 10 | 7 | 5 |
| How far ahead it pictures the ball's path | 14 frames | 40 frames | the whole way |
| First guess at the landing spot is out by (share of the court's height, typical shot) | 18% | 15% | 11% |
| Shots where its attention slips | 15% | 14% | 10% |
| Thinks to dash when it needs to | 15% | 40% | 60% |
| Dashes the wrong way | 12% | 6% | 2% |
| Follows a decoy | 45% | 28% | 12% |
| Leans towards where you usually hit | no | a little | yes |
| Places its returns away from you | no | a little | yes |
| How much pressure gets to it | 1.2 | 1.0 | 0.75 |

Medium gets a little sharper as the player levels up, as it always has: its errors and slips shrink by 0.4% per level, up to 20% at level 50.

What that comes to in the real game, each difficulty against itself on GLITCH ARENA:

| | Easy | Medium | Hard |
|---|---|---|---|
| Returns in an average point | 4 | 8 | 13 |
| Points over inside six returns | about 70% | about 35% | about 18% |
| Points that reach twelve returns | almost none | about a third | about half |
| Dashes in a match, both paddles | 2 to 4 | 11 to 16 | 12 to 35 |
| Survives the Eye's fight | about 4 in 10 | about 7 in 10 | about 4 in 5 |

The old Hard never lost the Eye's fight in 48 tries. During the fight the player comes to each throw fresh: the tiredness of the rally that brought the Eye doesn't carry over, but Critical Heat still counts.

## Where the numbers are

Everything is at the top of `glitchpong-ai.js`.

- `PROFILES` holds one block per difficulty, with a comment on each value in the Easy block. `demo` is the menu's background rally, which never misses.
- `TUNING` holds what is the same for everyone: how big a slip is, how late it wakes up, what pressure adds, the range of form, and how the error fades with distance (`focus`: lower means a misjudged ball stays misjudged for longer).

To make a difficulty easier to beat, raise `readError` and `lapse` first. They decide most points. `reaction` matters most against teleports, jukes and hard returns. `dashUse` decides how many of its mistakes it gets away with.

## Checking a change

`tests/ai.test.mjs` covers each behaviour on its own, then plays several hundred rallies and matches in a small simulator (`tests/helpers/rally-sim.mjs`) to check that every difficulty misses, that no rally runs for ever, and that Hard beats Medium beats Easy.

```bash
node --test tests/*.mjs
```

The simulator is a plain court. It is good for order and for catching a player that never misses, but it is not the game: its ball speeds up faster than the real one, so rallies there are shorter than in a match. The figures in the tables above came from the real game, played AI vs AI in a headless browser at about 28 times normal speed: eight matches on Hard and six each on Medium and Easy, plus 30 to 70 of the Eye's fights per difficulty. Those are small samples, so read the figures as rough.

## What hasn't been tested

- **Against people.** The numbers were set by playing the computer against itself. Whether Hard is the right amount of hard for someone who has played for weeks is a question only play will answer. If it turns out too easy or too hard, `readError` and `lapse` in the Hard block are the two values to change.
- **Every map.** The real-game measurements were on GLITCH ARENA. Matches were also run on STACK OVERFLOW, FREEFALL, ECHO and QUANTUM SHIFT to check for errors, not to measure difficulty there.
- **Online play.** Online matches are always two people. The computer player is not used.
