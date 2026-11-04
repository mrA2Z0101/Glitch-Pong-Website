# itch.io page preflight — Glitch Pong (HTML5)

Re-check the official docs before uploading. Requirements can change.
- Cover and project setup: https://itch.io/docs/creators/getting-started
- Page layout and screenshot sidebar: https://itch.io/docs/creators/design
- HTML5 embed options: https://itch.io/docs/creators/html5

## Upload
- [ ] **Cover:** upload `cover/cover-a-glitchcade-cabinet-630x500.png`. It's 630×500, which is 315:250. Use cover B if the uploaded build doesn't open in the Glitchcade.
- [ ] **Screenshots:** upload `gallery/01`–`05` in order. They're native 1920×1080 PNGs; don't crop them to the cover ratio.
- [ ] **Screenshots column:** in Edit theme, set it to **Sidebar**. Embedded HTML5 pages hide screenshots by default.
- [ ] **Fallback:** if you keep the sidebar hidden, embed 01, 03 and 05 in the description instead, with captions written as text below each image.

## Embed settings to verify in the draft
- [ ] **Viewport:** 16:9 (e.g. 1280×720), with the **Fullscreen button** enabled. Glitch Pong needs landscape on phones.
- [ ] **Desktop:** the Glitchcade asks for pointer lock and audio after the first click. Confirm both work inside itch's iframe. If pointer lock is blocked, the arcade switches to drag-to-look.
- [ ] **Online:** online multiplayer won't work on itch.io (no socket.io server). Don't advertise it in the description or tags.
- [ ] **Phones:** play the draft on a phone in landscape and check that the joystick/USE buttons aren't covered by itch's own UI.

## Truthfulness
- [ ] Every screenshot is a real capture of build `b0e6451`, unedited (see `asset-manifest.json`).
- [ ] Captions and description mention only real features: Heat, the Eye boss, 4 arenas, power-ups, glitch walls, dash, the Glitchcade, and 1P vs AI / local 2P.
- [ ] No awards, review quotes, or "coming soon" features presented as playable. The 9 COMING SOON cabinets are visibly labelled as such.

## Review status
- **Done:** technical audit (`audit.json`: 5 images, 0 warnings, 0 near-duplicates), the contact sheet, and a 160px cover tile check.
- **Still yours to do:** preview the draft page on desktop and on a phone. Upload and publishing are your call.
