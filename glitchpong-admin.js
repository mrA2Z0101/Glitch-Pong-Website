// ═══════════════════════════════════════════════════════════════════════════
// GLITCH ADMIN — a private admin mode and cheat menu.
//
//   Switch on   Ctrl+Shift+` (backtick), then type the passphrase.
//   Cheat menu  ` (backtick) opens and closes it once admin mode is on.
//
// Admin mode is a flag in this browser's localStorage. Nothing here is a real
// account: the site is static, so the passphrase check only keeps casual
// players out. Set the passphrase with scripts/set-admin-passphrase.mjs. Only a
// salted hash lives in this file. With no hash set, admin mode cannot be used.
//
// The menu works anywhere (the arcade floor or a Glitch Pong match). The match
// cheats (Heat, the Eye, scores, god mode) hook into a running local match
// through attachGame(); they are switched off in online and peer-to-peer matches
// so they can never touch another player. Nothing here is sent over the network.
//
// Loaded after glitchpong-site.js and glitchpong-cosmetics.js. It reads their
// globals (GlitchProgression, GlitchcadeWallet, GlitchAchievements,
// GlitchCosmetics) only when an action runs.
// ═══════════════════════════════════════════════════════════════════════════
const GlitchAdmin = (function () {
  "use strict";

  const FLAG_KEY = "glitchPong_admin_v1";

  // ADMIN-VERIFIER-START (rewritten by scripts/set-admin-passphrase.mjs)
  const VERIFIER = { salt: "6b2bc0c32b1c037d5a1e1d5d5acc8d8e", iterations: 150000, hash: "097454f5e08c6a0faa7c7171d5003b136bf052edeb48613ee927324cfa2da496" };
  // ADMIN-VERIFIER-END

  const KEYS = {
    wallet: "glitchcade_wallet_v1",
    achievements: "glitchPong_achievements_v1",
    cosmetics: "glitchPong_cosmetics_v1",
    rally: "glitchPong_bestRally_v1",
    breakpoint: "glitchcade_breakpoint_v1",
    nexus: "glitchcade_nexus_v1",
    floor: "glitchcade_floor_v1"
  };
  const MAX_LEVEL = 50;
  const BIG_COINS = 10000;
  const FLOOR_STATE_URL = "./glitchcade-state.js?v=floor-2";

  // ─── Small helpers ────────────────────────────────────────────────────────
  const hasWindow = typeof window !== "undefined";
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
  };
  function emit(name, detail) {
    try { if (hasWindow) window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
  }
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

  // The other modules, looked up when an action runs so load order doesn't matter.
  function lib(name) {
    let found = null;
    if (name === "progression" && typeof GlitchProgression !== "undefined") found = GlitchProgression;
    else if (name === "wallet" && typeof GlitchcadeWallet !== "undefined") found = GlitchcadeWallet;
    else if (name === "achievements" && typeof GlitchAchievements !== "undefined") found = GlitchAchievements;
    else if (name === "cosmetics" && typeof GlitchCosmetics !== "undefined") found = GlitchCosmetics;
    if (!found) throw new Error(`${name} isn't loaded yet`);
    return found;
  }
  function prizeIds() {
    return hasWindow && Array.isArray(window.GlitchcadePrizeIds) ? window.GlitchcadePrizeIds.filter((id) => typeof id === "string") : [];
  }
  function readSectors() { const d = store.get(KEYS.breakpoint); return int(d && d.sectors, 0, 1e9); }
  function reloadSoon() {
    setTimeout(() => { try { location.reload(); } catch (e) {} }, 900);
  }

  // ─── The passphrase and the flag ──────────────────────────────────────────
  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  async function derive(passphrase, salt, iterations) {
    const subtle = typeof crypto !== "undefined" && crypto.subtle;
    if (!subtle) throw new Error("This page can't check a passphrase (it needs https or localhost).");
    const enc = new TextEncoder();
    const key = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
    const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
    return hex(new Uint8Array(bits));
  }

  const configured = () => !!(VERIFIER.hash && VERIFIER.salt);
  const flagToken = () => VERIFIER.hash.slice(0, 16);

  async function verify(passphrase) {
    if (!configured() || typeof passphrase !== "string" || !passphrase.trim()) return false;
    return (await derive(passphrase.trim(), VERIFIER.salt, VERIFIER.iterations)) === VERIFIER.hash;
  }

  function readFlag() {
    if (!configured()) return false;
    const f = store.get(FLAG_KEY);
    return !!(f && f.v === 1 && f.k === flagToken());
  }

  let enabled = readFlag();
  let failures = 0;
  let lockedUntil = 0;

  // Checks the passphrase and, if it is right, switches admin mode on.
  async function enable(passphrase) {
    const wait = lockedUntil - Date.now();
    if (wait > 0) return { ok: false, error: `TOO MANY TRIES. WAIT ${Math.ceil(wait / 1000)}S.` };
    let good = false;
    try { good = await verify(passphrase); }
    catch (e) { return { ok: false, error: String((e && e.message) || e).toUpperCase() }; }
    if (!good) {
      failures += 1;
      lockedUntil = Date.now() + Math.min(30000, 500 * Math.pow(2, failures));
      return { ok: false, error: configured() ? "ACCESS DENIED." : "ADMIN MODE IS NOT SET UP." };
    }
    failures = 0;
    lockedUntil = 0;
    store.set(FLAG_KEY, { v: 1, k: flagToken() });
    enabled = true;
    emit("glitchpong:admin", { enabled: true });
    return { ok: true };
  }

  function disable() {
    store.remove(FLAG_KEY);
    enabled = false;
    god = false;
    closeMenu();
    emit("glitchpong:admin", { enabled: false });
  }

  // Another tab turned admin mode on or off.
  if (hasWindow && window.addEventListener) {
    window.addEventListener("storage", (e) => {
      if (e.key !== FLAG_KEY) return;
      enabled = readFlag();
      if (!enabled) { god = false; closeMenu(); }
    });
  }

  // ─── Unlocking ────────────────────────────────────────────────────────────
  // Every grant works on one context object and commit() writes it all out, so
  // the modules that own each record see the result.
  function makeCtx() {
    return {
      P: lib("progression").data,
      ach: lib("achievements").sanitize(store.get(KEYS.achievements)),
      wallet: lib("wallet").get(),
      sectors: readSectors()
    };
  }

  // Lifts one measurable stat to at least `n`, wherever that stat is kept.
  function raise(ctx, stat, n) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (stat === "level") {
      const next = Math.min(MAX_LEVEL, n);
      if (next > ctx.P.level) { ctx.P.level = next; ctx.P.xp = 0; }
    } else if (typeof ctx.P[stat] === "number") ctx.P[stat] = Math.max(ctx.P[stat], n);
    else if (stat === "coinsEarned") ctx.wallet.earned = Math.max(ctx.wallet.earned, n);
    else if (stat === "breakpointSectors") ctx.sectors = Math.max(ctx.sectors, n);
    else if (stat === "prizes" || stat === "arenasWon" || stat === "cosmeticsMastered") { /* worked out from the wallet, arena wins and mastery */ }
    else ctx.ach.counters[stat] = Math.max(ctx.ach.counters[stat] || 0, n);
  }

  function raiseArena(ctx, arenaId, wins) {
    if (!ctx.P.arenaStats) ctx.P.arenaStats = {};
    const a = Object.assign({ matches: 0, wins: 0, losses: 0 }, ctx.P.arenaStats[arenaId]);
    a.wins = Math.max(a.wins, wins);
    a.matches = Math.max(a.matches, a.wins + a.losses);
    ctx.P.arenaStats[arenaId] = a;
  }

  function grantLevel(ctx, level) {
    const P = lib("progression");
    level = int(level, 1, MAX_LEVEL);
    ctx.P.level = level;
    ctx.P.xp = 0;
    let total = 0;
    for (let l = 1; l < level; l++) total += P.xpForLevel(l);
    ctx.P.totalXP = Math.max(Number(ctx.P.totalXP) || 0, total);
  }

  function grantPerks(ctx) {
    const ids = lib("progression").ALL_PERKS.map((p) => p.id);
    ctx.P.unlockedPerks = ids.slice();
    ctx.P.equippedPerks = ids.slice();
  }

  function grantPrizes(ctx) {
    const ids = prizeIds();
    if (!ids.length) return false;
    ids.forEach((id) => { if (!ctx.wallet.prizes.includes(id)) ctx.wallet.prizes.push(id); });
    return true;
  }

  function grantAchievements(ctx) {
    const now = Date.now();
    lib("achievements").ACHIEVEMENTS.forEach((a) => {
      raise(ctx, a.stat, a.goal);
      if (!ctx.ach.unlocked[a.id]) ctx.ach.unlocked[a.id] = now;
    });
  }

  // Meets every cosmetic's unlock rule, buys every coin item and gilds everything.
  function grantCosmetics(ctx) {
    const C = lib("cosmetics");
    C.SLOTS.forEach((slot) => C.CATALOG[slot].forEach((item) => {
      const u = item.unlock || {};
      if (u.type === "level") raise(ctx, "level", u.level);
      else if (u.type === "arenaWins") raiseArena(ctx, u.arena, u.count);
      else if (u.type === "boss") raise(ctx, "bossSurvivals", u.count);
      else if (u.type === "stat") raise(ctx, u.stat, u.count);
      else if (u.type === "achievement") { if (!ctx.ach.unlocked[u.id]) ctx.ach.unlocked[u.id] = Date.now(); }
    }));
    return C.grantAll();
  }

  function commit(ctx) {
    const P = lib("progression");
    P.save();
    store.set(KEYS.achievements, ctx.ach);
    lib("achievements").reload();
    store.set(KEYS.wallet, { coins: ctx.wallet.coins, earned: ctx.wallet.earned, wins: ctx.wallet.wins, prizes: ctx.wallet.prizes });
    if (ctx.sectors !== readSectors()) store.set(KEYS.breakpoint, { sectors: ctx.sectors });
    try {
      const C = lib("cosmetics");
      C.refreshContext();
      if (C.syncUnlocks) C.syncUnlocks(ctx.P);
      P.save();
    } catch (e) {}
    emit("glitchcade:wallet", ctx.wallet);   // the floor and the Store redraw from this
  }

  // Repairs every cabinet and collects every toy and record on the arcade floor.
  // Returns false when the floor's state module can't be loaded.
  async function grantFloor() {
    let S;
    try { S = await import(FLOOR_STATE_URL); } catch (e) { return false; }
    const floor = S.sanitizeFloor(store.get(S.FLOOR_KEY));
    floor.repaired = S.REPAIRABLE_SLOTS.slice();
    floor.toys = S.CAPSULE_TOYS.map((t) => t.id);
    floor.packs = S.TRACK_PACKS.map((p) => p.id);
    return store.set(S.FLOOR_KEY, S.sanitizeFloor(floor));
  }

  const actions = {
    setLevel(n) {
      const ctx = makeCtx();
      grantLevel(ctx, n);
      commit(ctx);
      try { lib("achievements").check(); } catch (e) {}
      return { ok: true, msg: `LEVEL ${ctx.P.level}` };
    },
    addCoins(n) {
      const w = lib("wallet").award(int(n, 0, 1e9));
      return { ok: true, msg: `COINS: ${w.coins}` };
    },
    unlockPrizes() {
      const ctx = makeCtx();
      if (!grantPrizes(ctx)) return { ok: false, msg: "THE PRIZE LIST LOADS WITH THE ARCADE. TRY AGAIN IN A MOMENT." };
      commit(ctx);
      return { ok: true, msg: `ALL ${prizeIds().length} PRIZES UNLOCKED` };
    },
    unlockAchievements() {
      const ctx = makeCtx();
      grantAchievements(ctx);
      commit(ctx);
      return { ok: true, msg: `ALL ${lib("achievements").ACHIEVEMENTS.length} ACHIEVEMENTS UNLOCKED` };
    },
    unlockCosmetics() {
      const ctx = makeCtx();
      const got = grantCosmetics(ctx);
      commit(ctx);
      return { ok: true, msg: `ALL COSMETICS UNLOCKED (${got.owned} BOUGHT, ${got.gilded} GILDED)` };
    },
    // Everything at once: level 50, every perk, coins, prizes, achievements,
    // cosmetics and the arcade floor. Returns what could not be done.
    async unlockEverything() {
      const ctx = makeCtx();
      grantLevel(ctx, MAX_LEVEL);
      grantPerks(ctx);
      ctx.wallet.coins = Math.max(ctx.wallet.coins, BIG_COINS);
      ctx.wallet.earned = Math.max(ctx.wallet.earned, BIG_COINS);
      const prizesDone = grantPrizes(ctx);
      grantAchievements(ctx);
      grantCosmetics(ctx);
      commit(ctx);
      const floorDone = await grantFloor();
      const skipped = [];
      if (!prizesDone) skipped.push("prizes");
      if (!floorDone) skipped.push("arcade floor");
      emit("glitchcade:wallet", lib("wallet").get());
      return { ok: true, skipped, msg: skipped.length ? `UNLOCKED. SKIPPED: ${skipped.join(", ").toUpperCase()}` : "EVERYTHING UNLOCKED" };
    },
    // Wipes progression, coins, achievements, cosmetics and the arcade floor.
    // Settings, key bindings and admin mode itself are kept.
    resetProgress() {
      lib("progression").reset();
      [KEYS.wallet, KEYS.achievements, KEYS.cosmetics, KEYS.rally, KEYS.breakpoint, KEYS.nexus, KEYS.floor].forEach((k) => store.remove(k));
      try { lib("achievements").reload(); } catch (e) {}
      try { lib("cosmetics").load(); } catch (e) {}
      emit("glitchcade:wallet", { coins: 0, earned: 0, wins: 0, prizes: [] });
      return { ok: true, msg: "PROGRESS RESET" };
    }
  };

  // ─── The running match ────────────────────────────────────────────────────
  // glitchpong-site.js registers a small API for the match it is running:
  //   online(), inMatch(), snapshot(), maxHeat(), spawnEye(), setScore(side, n), skipRound()
  let game = null;
  let god = false;

  function attachGame(api) { game = api; god = false; }
  function detachGame(api) {
    if (game === api) { game = null; god = false; closeMenu(); }
  }
  const gameOnline = () => !!(game && game.online());
  // Match cheats are allowed for the admin in any match except an online one.
  const cheatsAllowed = () => enabled && !gameOnline();
  // God mode: the left paddle's goal can't be scored on.
  const godActive = () => enabled && god && !!game && !gameOnline();
  function setGod(on) {
    if (!cheatsAllowed() || !game) return false;
    god = !!on;
    return true;
  }

  // ─── The cheat menu ───────────────────────────────────────────────────────
  let panel = null, promptEl = null, statusEl = null, refreshTimer = null;
  let panelOpen = false, promptOpen = false;
  const ui = {};

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function injectStyle() {
    if (document.getElementById("gpadm-style")) return;
    const style = el("style", { id: "gpadm-style" });
    style.textContent = `
      #gpadm-panel, #gpadm-prompt { position: fixed; z-index: 2147483647; box-sizing: border-box; pointer-events: auto;
        font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #dffcff; letter-spacing: .03em;
        background: rgba(5, 10, 22, .96); border: 1px solid rgba(113, 239, 255, .45); border-radius: 10px;
        box-shadow: 0 0 28px rgba(113, 239, 255, .18), inset 0 0 0 1px rgba(255, 88, 217, .18); }
      #gpadm-panel *, #gpadm-prompt * { box-sizing: border-box; }
      #gpadm-panel { top: 12px; right: 12px; width: min(380px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto; padding: 12px; }
      #gpadm-prompt { top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(340px, calc(100vw - 24px)); padding: 16px; }
      .gpadm-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
      .gpadm-title { font-weight: 700; font-size: 14px; color: #71efff; letter-spacing: .12em; }
      .gpadm-hint { color: #7fa6b4; margin-bottom: 8px; }
      .gpadm-sec { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(113, 239, 255, .2); }
      .gpadm-sec > b { display: block; color: #ff58d9; letter-spacing: .14em; margin-bottom: 6px; font-size: 11px; }
      .gpadm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 6px; }
      .gpadm-row > span { color: #9fc8d6; }
      .gpadm-btn { font: inherit; color: #dffcff; background: rgba(113, 239, 255, .08); border: 1px solid rgba(113, 239, 255, .4);
        border-radius: 6px; padding: 5px 9px; cursor: pointer; letter-spacing: .04em; }
      .gpadm-btn:hover:not(:disabled) { background: rgba(113, 239, 255, .2); }
      .gpadm-btn:disabled { opacity: .38; cursor: not-allowed; }
      .gpadm-btn.on { background: rgba(255, 88, 217, .28); border-color: #ff58d9; color: #fff; }
      .gpadm-btn.warn { border-color: rgba(255, 106, 106, .7); color: #ffb3b3; }
      .gpadm-btn.warn.arm { background: rgba(255, 106, 106, .3); color: #fff; }
      .gpadm-x { padding: 2px 9px; }
      .gpadm-in { font: inherit; color: #dffcff; background: rgba(0, 0, 0, .45); border: 1px solid rgba(113, 239, 255, .4);
        border-radius: 6px; padding: 5px 8px; width: 64px; }
      #gpadm-prompt .gpadm-in { width: 100%; margin: 8px 0; }
      .gpadm-score { min-width: 22px; text-align: center; font-weight: 700; color: #fff; }
      .gpadm-note { color: #9fc8d6; margin: 0 0 6px; }
      .gpadm-status { margin-top: 10px; min-height: 16px; color: #8cffb0; }
      .gpadm-status.bad { color: #ff8f8f; }
    `;
    document.head.appendChild(style);
  }

  function say(msg, bad) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "gpadm-status" + (bad ? " bad" : "");
  }

  function button(label, run, cls) {
    const b = el("button", { type: "button", class: "gpadm-btn" + (cls ? " " + cls : ""), text: label });
    b.addEventListener("click", async () => {
      try {
        const r = await run();
        if (r && r.msg) say(r.msg, r.ok === false);
      } catch (e) { say(String((e && e.message) || e).toUpperCase(), true); }
      refresh();
    });
    return b;
  }

  // A button that has to be clicked twice, so a slip can't wipe a save.
  function confirmButton(label, run) {
    let armed = null;
    const b = button(label, async () => {
      if (!armed) {
        b.textContent = "CLICK AGAIN TO CONFIRM";
        b.classList.add("arm");
        armed = setTimeout(() => { armed = null; b.textContent = label; b.classList.remove("arm"); }, 4000);
        return null;
      }
      clearTimeout(armed);
      armed = null;
      b.textContent = label;
      b.classList.remove("arm");
      return run();
    }, "warn");
    return b;
  }

  function section(title, nodes) {
    return el("div", { class: "gpadm-sec" }, [el("b", { text: title })].concat(nodes));
  }
  const row = (nodes) => el("div", { class: "gpadm-row" }, nodes);

  function build() {
    injectStyle();
    const close = button("✕", () => { closeMenu(); return null; }, "gpadm-x");
    close.setAttribute("aria-label", "Close admin menu");

    ui.level = el("input", { type: "number", min: "1", max: String(MAX_LEVEL), value: "1", class: "gpadm-in" });
    ui.matchNote = el("p", { class: "gpadm-note" });
    ui.god = button("GOD MODE: OFF", () => {
      if (!setGod(!god)) return { ok: false, msg: "NO LOCAL MATCH RUNNING" };
      return { ok: true, msg: god ? "GOD MODE ON: THE LEFT GOAL IS SAFE" : "GOD MODE OFF" };
    });
    ui.leftScore = el("span", { class: "gpadm-score", text: "0" });
    ui.rightScore = el("span", { class: "gpadm-score", text: "0" });
    const gameCall = (name, ...args) => () => {
      if (!game || !cheatsAllowed()) return { ok: false, msg: "NO LOCAL MATCH RUNNING" };
      return game[name](...args);
    };
    const nudge = (side, by) => () => {
      if (!game || !cheatsAllowed()) return { ok: false, msg: "NO LOCAL MATCH RUNNING" };
      const now = game.snapshot();
      return game.setScore(side, (side === "left" ? now.left : now.right) + by);
    };
    ui.matchBtns = [
      button("HEAT → MAX", gameCall("maxHeat")),
      button("SPAWN THE EYE", gameCall("spawnEye")),
      ui.god,
      button("−", nudge("left", -1)), button("+", nudge("left", 1)),
      button("−", nudge("right", -1)), button("+", nudge("right", 1)),
      button("SKIP ROUND (LEFT SCORES)", gameCall("skipRound")),
      button("WIN MATCH", gameCall("winMatch")),
      button("LOSE MATCH", gameCall("loseMatch"))
    ];
    const [heat, eye, godBtn, lMinus, lPlus, rMinus, rPlus, skip, win, lose] = ui.matchBtns;

    statusEl = el("div", { class: "gpadm-status", role: "status" });

    panel = el("div", { id: "gpadm-panel", role: "dialog", "aria-label": "Glitch admin menu" }, [
      el("div", { class: "gpadm-head" }, [el("span", { class: "gpadm-title", text: "GLITCH ADMIN" }), close]),
      el("div", { class: "gpadm-hint", text: "` or Esc closes this menu. A running match is frozen while it is open." }),
      section("PROFILE", [
        row([el("span", { text: "LEVEL" }), ui.level,
          button("SET", () => actions.setLevel(ui.level.value)),
          button("MAX", () => { ui.level.value = String(MAX_LEVEL); return actions.setLevel(MAX_LEVEL); })]),
        row([el("span", { text: "COINS" }),
          button("+100", () => actions.addCoins(100)),
          button("+1,000", () => actions.addCoins(1000)),
          button("+10,000", () => actions.addCoins(10000))]),
        row([button("UNLOCK PRIZES", () => actions.unlockPrizes()),
          button("UNLOCK ACHIEVEMENTS", () => actions.unlockAchievements())]),
        row([button("UNLOCK COSMETICS", () => actions.unlockCosmetics())]),
        row([button("UNLOCK EVERYTHING", async () => {
          const r = await actions.unlockEverything();
          reloadSoon();
          return { ok: r.ok, msg: r.msg + " — RELOADING…" };
        }, "on")])
      ]),
      section("MATCH", [
        ui.matchNote,
        row([heat, eye]),
        row([godBtn]),
        row([el("span", { text: "LEFT" }), lMinus, ui.leftScore, lPlus,
          el("span", { text: "RIGHT" }), rMinus, ui.rightScore, rPlus]),
        row([skip]),
        row([win, lose])
      ]),
      section("SYSTEM", [
        row([confirmButton("RESET PROGRESS", () => { const r = actions.resetProgress(); reloadSoon(); return { ok: r.ok, msg: r.msg + " — RELOADING…" }; }),
          button("DISABLE ADMIN MODE", () => { disable(); return null; })])
      ]),
      statusEl
    ]);
    // Keys typed in the menu are the menu's, not the game's or the arcade's. Key-ups
    // still get through, so a paddle key held when the menu opened can't stick.
    ["keydown", "keypress"].forEach((t) => panel.addEventListener(t, (e) => e.stopPropagation()));
  }

  // The menu lives inside the game's own overlay while a game runs: that overlay
  // swallows clicks everywhere else.
  function host() { return document.getElementById("__glitchcade_overlay") || document.body; }

  function refresh() {
    if (!panelOpen || !panel) return;
    const h = host();
    if (panel.parentNode !== h) h.appendChild(panel);

    let note = "", live = false;
    if (!game) note = "NO MATCH RUNNING. START A LOCAL MATCH TO USE THESE.";
    else if (game.online()) note = "OFF IN ONLINE MATCHES.";
    else if (!game.inMatch()) note = "WAITING FOR A MATCH TO BE IN PLAY.";
    else { live = true; note = "MATCH LIVE."; }
    ui.matchNote.textContent = note;
    ui.matchBtns.forEach((b) => { b.disabled = !live; });
    ui.god.textContent = "GOD MODE: " + (god ? "ON" : "OFF");
    ui.god.classList.toggle("on", god);
    if (live) {
      const s = game.snapshot();
      ui.leftScore.textContent = String(s.left);
      ui.rightScore.textContent = String(s.right);
    }
  }

  function openMenu() {
    if (!enabled || typeof document === "undefined" || !document.body) return false;
    closePrompt();
    if (!panel) build();
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    panelOpen = true;
    host().appendChild(panel);
    try { ui.level.value = String(lib("progression").level); } catch (e) {}
    say("");
    refresh();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, 250);
    return true;
  }

  function closeMenu() {
    panelOpen = false;
    clearInterval(refreshTimer);
    refreshTimer = null;
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
  }

  function openPrompt() {
    if (typeof document === "undefined" || !document.body) return;
    closeMenu();
    closePrompt();
    injectStyle();
    const input = el("input", { type: "password", class: "gpadm-in", autocomplete: "off", spellcheck: "false", "aria-label": "Admin passphrase" });
    const msg = el("div", { class: "gpadm-status bad" });
    const form = el("form", {}, [
      el("div", { class: "gpadm-title", text: "ADMIN ACCESS" }),
      input, msg,
      el("div", { class: "gpadm-row" }, [
        el("button", { type: "submit", class: "gpadm-btn on", text: "ENTER" }),
        el("button", { type: "button", class: "gpadm-btn", text: "CANCEL" })
      ])
    ]);
    form.lastChild.lastChild.addEventListener("click", closePrompt);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const r = await enable(input.value);
      input.value = "";
      if (r.ok) { closePrompt(); openMenu(); }
      else { msg.textContent = r.error; input.focus(); }
    });
    promptEl = el("div", { id: "gpadm-prompt", role: "dialog", "aria-label": "Admin access" }, [form]);
    ["keydown", "keypress"].forEach((t) => promptEl.addEventListener(t, (ev) => ev.stopPropagation()));
    host().appendChild(promptEl);
    promptOpen = true;
    input.focus();
  }

  function closePrompt() {
    promptOpen = false;
    if (promptEl && promptEl.parentNode) promptEl.parentNode.removeChild(promptEl);
    promptEl = null;
  }

  function toggleMenu() { return panelOpen ? (closeMenu(), false) : openMenu(); }

  function onKeyDown(e) {
    if (e.repeat) return;
    const tick = e.code === "Backquote" || e.key === "`";
    if (promptOpen) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePrompt(); }
      return;
    }
    if (!enabled) {
      // The secret way in.
      if (tick && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && configured()) {
        e.preventDefault();
        e.stopPropagation();
        openPrompt();
      }
      return;
    }
    if (panelOpen && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
    if (!tick || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(panel && panel.contains(t));
    if (typing) return;
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  }
  if (hasWindow && window.addEventListener) window.addEventListener("keydown", onKeyDown, true);

  return {
    get enabled() { return enabled; },
    get configured() { return configured(); },
    get menuOpen() { return panelOpen || promptOpen; },
    get god() { return god; },
    enable, disable, verify,
    openMenu, closeMenu, toggleMenu,
    attachGame, detachGame, cheatsAllowed, godActive, setGod,
    actions
  };
})();

if (typeof window !== "undefined") window.GlitchAdmin = GlitchAdmin;
