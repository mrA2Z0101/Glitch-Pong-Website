# Cover test plan — Glitch Pong on itch.io

itch.io has no built-in A/B testing. This is a **sequential** test, so its results are a weaker signal than a true split test. Treat it as directional only.

- **Hypothesis:** cover A (the Glitchcade cabinet, with the Eye and neon signage) gets a higher **click rate** from browse listings than cover B (Black-Hole Nexus vortex), because the arcade cabinet makes "playable arcade game" readable at tile size.
- **The one thing that changes:** the cover image. Keep the title, short description, tags, price, screenshots and page the same in both periods.
- **Primary metric:** the click rate from itch.io's analytics for each period (`clicks ÷ impressions`, or views ÷ impressions if that's what your dashboard shows).
- **Downstream metrics:** browser plays per view, and average play-session signals if available. A cover that gets clicks but not plays is misleading.
- **Schedule:**
  - Cover A for 14 days, then cover B for 14 days.
  - Avoid launch week, devlog posts, jam deadlines and featured placements, since they skew traffic.
  - Note any external promotion in the log.
- **Sample size:** wait for at least a few thousand impressions per period before reading anything. With small numbers, a difference is noise.
- **Decision rule:**
  - Keep the cover with the higher click rate *only if* its plays per view aren't worse.
  - If the results are within noise, keep A, since it also shows the game's real hub.
- **Next test (after the cover):** gallery order. Try 05 (the Glitchcade) first instead of 01 and compare views → plays. Change nothing else.

## Experiment log
| Period | Dates | Cover | Impressions | Clicks/views | Plays | Notes (promotion, events) |
|---|---|---|---|---|---|---|
| 1 | | A | | | | |
| 2 | | B | | | | |

No results are filled in. Record only real numbers from the itch.io dashboard.
