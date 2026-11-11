# Admin mode and the cheat menu

A private mode for the site's owner: everything unlocked, plus a cheat menu. It is
not an account. The site is static, so admin mode is a flag in one browser's
`localStorage` (`glitchPong_admin_v1`), switched on by a passphrase.

## Switching it on

1. Press **Ctrl + Shift + `** (backtick). Nothing visible happens on the site until you do.
2. Type the passphrase and press Enter.
3. From then on, **`** (backtick) opens and closes the cheat menu, on the arcade floor or
   inside a match. **Esc** also closes it. Needs a keyboard.

The flag stays until you press **DISABLE ADMIN MODE** or clear the browser's site data.
Save exports and imports never carry it.

## Setting the passphrase

Only a salted PBKDF2 hash is in the code (`VERIFIER` in `glitchpong-admin.js`). The
passphrase itself is never stored. To pick a new one:

```bash
node scripts/set-admin-passphrase.mjs            # makes a random one and prints it once
node scripts/set-admin-passphrase.mjs "my phrase" # or use your own (10+ characters)
```

Commit the changed `glitchpong-admin.js`. Changing the passphrase switches admin mode off
in every browser that had it on. With no hash set, admin mode cannot be used at all.

**This is a soft lock.** Everything runs in the visitor's browser, so anyone who reads the
source could switch the flag on by hand. It keeps players out of the menu; it does not
protect anything that matters, because nothing here ever leaves your own browser.

## The menu

| Section | Buttons |
|---|---|
| **Profile** | Set level (1–50) or jump to **MAX**. Add 100 / 1,000 / 10,000 coins. **Unlock prizes**, **achievements**, **cosmetics**. **Unlock everything**: level 50, all perks, 10,000 coins, every prize, achievement and cosmetic (bought and gilded), all arcade cabinets repaired and every toy and record collected. It reloads the page. |
| **Match** | **Heat → max**, **Spawn the Eye**, **God mode** (the left goal can't be scored on, and the Eye can't take points off the left side), score +/− for each side, **Skip round** (left scores), **Win match**, **Lose match**. |
| **System** | **Reset progress** (asks twice; wipes progression, coins, achievements, cosmetics and the arcade floor; keeps settings and admin mode). **Disable admin mode**. |

- A running match is **frozen while the menu is open**.
- Spawn the Eye and Skip round wait for the ball to be in play (not the 3-2-1 countdown).
- The **Q** key in a match does what Spawn the Eye does, for admins only.
- Unlocks work by meeting each item's real rule (levels, arena wins, stats) and buying or
  gilding it, not by skipping the check, so new cosmetics added later are covered.
  Breakpoint's own upgrades and achievements are not touched, only the sector count that
  Glitch Pong's Store reads.

## Online play

Match cheats are **off in online and peer-to-peer matches**: the buttons are disabled,
and god mode, scores and the Eye never touch a match another player is in. Nothing in
admin mode is ever sent over the network. Profile unlocks are local to your browser.
