# The arcade floor

Everything in the Glitchcade that isn't one of the two finished games: repairing cabinets, the Eye's events, the daily challenge, the air hockey table, and so on. This page says what each thing does and where to change it.

| File | What's in it |
|---|---|
| `glitchcade-state.js` | The saved record and all the rules that are just numbers: repair costs, payouts, the daily challenge pool, capsule toys, record packs. No DOM and no three.js, so the tests run it under Node. |
| `glitchcade-microgames.js` | The eight ROM fragments and the overlay that plays them. |
| `glitchcade-floor.js` | Everything that's built in 3D or drawn on the HUD. `glitchcade.js` hands it a context object (`floorContext()`). |

The floor's progress is stored in the browser under `glitchcade_floor_v1` and travels with save export/import. Coins stay in the wallet (`glitchcade_wallet_v1`); both games rewrite that record and drop fields they don't know, so nothing else is kept there.

## Repairing cabinets

Cabinets 03–10 start dead. Walk up to one and press E:

- The first repair costs 15 coins and each one after costs 5 more (`repairCost`), up to 50 for the eighth.
- Owning the **Overclock Chip** prize makes one repair free. The chip stays in your collection.
- The badge in the corner, the title menu and the info board count cabinets online.

A repaired cabinet runs a **ROM fragment**: a 30-second microgame named after the game on its marquee.

| Cabinet | Fragment | The idea | Full payout at |
|---|---|---|---|
| 03 | SIGNAL LOST | Collect signal packets while static chases you | 14 |
| 04 | FIREWALL | Block red packets, let green ones through | 18 |
| 05 | DEFRAG | Steer each fragment into the bin of its colour | 22 |
| 06 | BLACK-HOLE NEXUS | Change orbit to collect stars and dodge debris | 9 |
| 07 | STACK OVERFLOW | Press when the pointer is on the glowing frame | 18 |
| 08 | PACKET HOP | Cross the lanes to the top, again and again | 7 |
| 09 | SWARM PROTOCOL | Your gun fires itself; keep it under the swarm | 24 |
| 10 | MISSILE DEFENSE.EXE | Burst threats before they reach the servers | 16 |

A run pays 0–3 coins: one coin per third of the target score. Each cabinet pays at most 6 coins a day (`FRAGMENT_DAILY_CAP`); after that it still plays, for score only. A top-five score asks for three initials.

### Adding or changing a fragment

Each fragment is an object in `glitchcade-microgames.js` with `hint`, `init(g)`, `update(s, dt, inp, g)` and `draw(s, ctx, g)`; the comment at the top of the file lists what `g` and `inp` provide. Register it in `MICROGAMES` under the id used in `FRAGMENTS` (`glitchcade-state.js`), which also holds its target score.

`tests/microgames.test.mjs` plays every fragment with a simple bot. It fails if the bot can't reach the target, or if doing nothing earns a coin, so run `node --test tests/` after changing a game or its target.

## The Eye's events

Every minute or two of walking around inside, every ceiling TV cuts to the Eye. It looks toward whichever side of the aisle you're on. One of three building-wide events runs with it:

| Event | What happens |
|---|---|
| KERNEL PANIC | The lights go out for about ten seconds. Neon and screens stay lit. |
| LAG SPIKE | Every second or so you snap back to where you were 0.6 s ago. With reduced motion on, you're slowed instead. |
| QUANTUM SHIFT | Two of cabinets 03–10 trade places. They stay swapped until you reload. |

The three come up in a shuffled order so you see each before any repeats. Timing and durations are in `EYE_EVENTS` and `updateEye()` in `glitchcade-floor.js`.

## Daily Glitch

The board on the front wall, left of the door, shows one challenge per calendar day, picked from `DAILY_POOL` by the date. Most span both games, for example "win a Glitch Pong match and earn 4 coins in Breakpoint". Finish it, then press E at the board to claim the reward (10–15 coins).

Progress is measured as the change in a few numbers since your first visit that day (`statSnapshot`): Glitch Pong wins, matches and Eye survivals, coins earned in Breakpoint, air hockey wins and fragments played. To add a challenge, add an entry to `DAILY_POOL` using those stats.

## Prizes that do something

- **Glitch Ball**: a ball appears on the floor near the collection case. Walk into it or aim at it and press E to kick it.
- **Heat Gauge**: mounts on the wall by the Glitch Pong stage and shows your current win streak.
- **Golden Paddle Trophy**: turns Glitch Pong's marquee gold.
- **Overclock Chip**: one free cabinet repair.

## The ceiling TVs

Two channels were added to the rotation:

- **High scores**: a page per cabinet. Glitch Pong's is your longest rally, Breakpoint's is your best run score, each repaired cabinet has its fragment table, and the last page is your air hockey record. The machines have entries of their own (EYE, P80, GLT...) so there is always something to beat.
- **Rally replay**: Glitch Pong records where the ball met each paddle during your longest rally (`GlitchRallyTape` in `glitchpong-site.js`, stored under `glitchPong_bestRally_v1`). The channel replays it. The paddle contacts are real; the path between them is drawn in.

## PRIZETRON-80

Talking to him now cycles through extra lines that depend on your record: your win streak, your longest rally, how many cabinets are still dark, the air hockey score between you.

- **Mystery capsule** (the machine on the counter, 8 coins, one a day): the contents are fixed by the date. Usually a toy you don't own yet, sometimes a 12–24 coin jackpot. The eight toys line up on the counter.
- **Jukebox request**: each day he asks for one track. Put it on at the jukebox and he pays 3 coins.

## Jukebox and records

The jukebox by the door now opens a track list instead of skipping to the next song. The record crate on the counter sells three packs (`TRACK_PACKS`): Matrix Mixtape, Black Hole Nebula LP and Classic Arena EP. They use the soundtrack files already in `sounds/music/`. The packs have no beat maps, so PRIZETRON dances to his own count over them.

## STAFF ONLY

The door on the right wall, past the info board, opens once you own every prize on the counter. Behind it is cabinet 11, the **Eye Gauntlet**:

1. **Round 1** launches Glitch Pong. Build heat until the Eye arrives and survive it.
2. **Round 2** launches Breakpoint straight into Boss Rush. Defeat the Eye at the end.

Finishing both pays 50 coins, and the gauntlet resets so it can be cleared again. Rounds can be done in either order and on different days.

## Glitch patrons

Up to four silhouettes stand at dead cabinets. Get within about three metres and they dissolve, then turn up at another machine once you've moved away.

## Air hockey

The table on the open floor is first to 5 against PRIZETRON's remote claw. Move with the mouse or A/D (drag on a phone); Q leaves. A win pays 4 coins, up to three paid wins a day.

## Photo mode

Press P (or the PHOTO button on a phone). Aim with the mouse, zoom with W/S, click or press E to take the shot. The photo is framed as a postcard with the date and your arcade stats, with Save and, where the browser supports it, Share.

## Performance note

Cabinets 03–10 are batched one cabinet at a time instead of into the building-wide batches, because a Quantum Shift has to move them. From the front door that is roughly 100 more draw calls than before (about 215 to 325); frame CPU time measured the same. For frame rate, battery saver and phone heat see `power.md`.
