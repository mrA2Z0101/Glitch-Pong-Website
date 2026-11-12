# Achievements

The game has 27 achievements. Players see them from the **ACHIEVEMENTS** button on the Glitch Pong main menu. An unlock shows a pop-up in the game. Prize-counter unlocks also show a pop-up in the 3D arcade.

Achievements progress only in matches that also earn XP. Custom Match and AI vs AI don't count, so they can't be farmed with first-to-3 games.

They're stored in the browser (`glitchPong_achievements_v1`) and included in save export/import (Settings → Save Data).

## Adding your own

All achievements live in one list near the top of `glitchpong-site.js`: search for `const ACHIEVEMENTS = [`. Add a line like this:

```js
{ id: "rally_100", name: "INFINITE LOOP", desc: "Keep a rally going for 100 hits.", stat: "longestRally", goal: 100 },
```

| Field | Meaning |
|---|---|
| `id` | Unique and lowercase. **Never rename it after release**: saves store it, and renaming it would re-lock the achievement for everyone. |
| `name` | Shown on the pop-up and the Achievements screen. |
| `desc` | How to earn it. |
| `stat` | Which number to compare against `goal` (see below). |
| `goal` | The number the player has to reach. |
| `secret` | Optional. `true` hides the name and description until it's unlocked. |

### Stats you can use

- **From the player's profile:** `wins`, `matchesPlayed`, `bestWinStreak`, `longestRally`, `clutchWins`, `bossSurvivals`, `dashUses`, `level`
- **Arenas:** `arenasWon` (how many of the eight arenas the player has won in)
- **From the Glitchcade:** `coinsEarned`, `prizes`
- **From the Store:** `cosmeticsMastered` (items with a gold trim; see [cosmetics.md](cosmetics.md))
- **Achievement counters:** `shutoutWins`, `comebackWins`, `hardWins`, `criticalHeat`, `powerups`, `onlineWins`, `setWins`

### Tracking something new

1. Where it happens in the game, call `GlitchAchievements.count("myCounter")`. Guard it with `if (achievementsCount())` so Custom Match and AI vs AI don't count.
2. Use `stat: "myCounter"` in your achievement.

WORLD TOUR (`world_tour`) uses `goal: 8` because there are eight arenas (`ARENA_REGISTRY` in `glitchpong-site.js`). If you add or remove an arena, change that goal to match; `tests/arenas.test.mjs` fails if they differ.

The prize achievement `prizes_all` uses `goal: 12` because the prize counter has 12 prizes (`PRIZES` in `glitchcade.js`). If you add or remove prizes, change that goal to match; `tests/achievements-prizes.test.mjs` fails if they differ. Unlocks are permanent, so players who already unlocked it keep it, even if the goal later goes up.
