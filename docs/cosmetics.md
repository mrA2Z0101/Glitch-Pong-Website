# Cosmetics

Everything in the Glitch Pong **STORE** is in `glitchpong-cosmetics.js`: the catalog, the unlock rules, what each side has equipped, and the drawing code. The game and the Store's live previews call the same renderers.

Cosmetics never change gameplay. A paddle skin keeps the paddle's hitbox and a ball skin keeps the plain round ball.

## Slots

| Slot | What it changes | Per side or shared |
|---|---|---|
| `paddle`, `ball`, `trail` | The paddle, the ball and the ball's trail | Per side (the ball follows whoever hit it last) |
| `hit`, `score`, `dash`, `teleport` | One-shot effects | Per side |
| `net` | The centre line, in place of the arena's own | Shared |
| `board` | Big score digits behind the play | Per side |
| `countdown` | The 3-2-1-GO before each serve | Shared |
| `victory` | An effect over the match-winning point | Per side |
| `sound` | The paddle-hit and score sounds, synthesised with Web Audio | Per side |
| `title`, `plate` | The match intro card and the online lobby | Per side |

Equipping an item in a shared slot sets it for both sides.

## How items unlock

Each item has one `unlock` rule:

| Helper | Unlocks when |
|---|---|
| `lvl(n)` | The player reaches level `n` |
| `arena(id, n)` | `n` wins in that arena |
| `boss(n)` | `n` Eye survivals |
| `stat(name, n, label)` | A number reaches `n`. `name` is a key of the progression save, or one of the extra stats below |
| `coins(cost)` | Bought with Glitchcade coins, in the Store or at the rack on PRIZETRON's counter |
| `ach(id, label)` | The achievement with that id is unlocked |

Extra stats come from `GlitchCosmetics.setContext()` in `glitchpong-site.js`: every achievement counter (`onlineWins`, `setWins`, ...), `coinsEarned`, and `breakpointSectors`. Breakpoint counts sectors cleared by hand under `glitchcade_breakpoint_v1`.

An item marked `SECRET` shows as `? ? ?` in the Store until it is earned.

## Mastery, sets and shuffle

- **Mastery**: each win with an item equipped counts toward it. At 25 wins the item gets a gold trim, which the player can switch off on its Store card. Against the AI only your side counts. In local two-player the winner's side counts. Sound packs, countdowns, titles and nameplates have no trim.
- **Sets** (`SETS`): equipping every piece of a set on one side draws that set's bonus effect on that side. Sets never include a shared slot.
- **Shuffle**: a per-side switch. At the start of each match that side gets a random unlocked item in every slot except title and nameplate. The saved loadout is untouched and comes back when shuffle is turned off.

## Adding an item

1. Add a line to the slot's list, for example in `PADDLE_SKINS`:

   ```js
   item("myskin", "MY SKIN", "rare", lvl(12), "One sentence for the Store card."),
   ```

   Ids are lowercase letters and digits. Never rename one after release: saves store it.
2. Write its renderer and register it in the slot's table (`PADDLE_RENDERERS`, `TRAIL_RENDERERS`, `BALL_RENDERERS`, `DASH_RENDERERS`, `NET_RENDERERS`, `BOARD_RENDERERS`, `COUNTDOWN_RENDERERS`, `PLATE_RENDERERS`, or `FX.hit` / `FX.score` / `FX.teleport` / `FX.victory`). Sound packs go in `SOUND_SYNTHS`.
3. Run `node --test tests/`. The cosmetics test draws every catalog item, so a missing renderer for an effect fails there.

The gold trim needs no extra code: it is drawn over whatever the item drew.

## Online

A player's title and nameplate travel to the other player as two catalog ids (`card: { title, plate }`). The server and the peer-to-peer validators keep only short ids, and each client looks them up in its own catalog, so no text from the other player is shown. The card always comes from the Player 1 locker. Paddle skins and effects are not sent: each player sees their own loadouts on both paddles.

## Storage

`glitchPong_cosmetics_v1` holds the equipped items, the NEW badges already seen, coin purchases, mastery wins, switched-off trims and the shuffle switches. It travels with save export/import and is cleaned by `GlitchCosmetics.sanitize()`.
