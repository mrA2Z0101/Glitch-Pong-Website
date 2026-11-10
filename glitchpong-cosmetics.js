// ═══════════════════════════════════════════════════════════════════════════
// GLITCH PONG — COSMETICS v1.0
// Paddle skins and ball trails: catalog, unlock rules, equip state, renderers.
//
// Everything here is visual only. Skins never change a paddle's hitbox and
// trails never change the ball, so competitive balance is untouched.
//
// Renderers are pure canvas functions (ctx in, pixels out) so the game and the
// Store's live previews share exactly the same drawing code.
// ═══════════════════════════════════════════════════════════════════════════
const GlitchCosmetics = (function () {
  "use strict";

  const STORAGE_KEY = "glitchPong_cosmetics_v1";
  const OWNERS = ["blue", "red"];
  const SLOTS = ["paddle", "trail", "ball", "hit", "score", "dash", "teleport"];

  const RARITY = {
    common:    { label: "COMMON",    color: "#9fd4e4" },
    rare:      { label: "RARE",      color: "#71efff" },
    epic:      { label: "EPIC",      color: "#c7a6ff" },
    legendary: { label: "LEGENDARY", color: "#ffd166" }
  };

  const ARENA_NAMES = {
    classic: "CLASSIC GRID",
    matrix: "MATRIX MAINFRAME",
    construct: "THE CONSTRUCT",
    blackhole: "BLACK-HOLE NEXUS"
  };

  // unlock.type: free | level | arenaWins | boss | stat
  const item = (id, name, rarity, unlock, desc) => ({ id, name, rarity, unlock, desc });
  const FREE = { type: "free" };
  const lvl = (level) => ({ type: "level", level });
  const arena = (a, count) => ({ type: "arenaWins", arena: a, count });
  const boss = (count) => ({ type: "boss", count });
  const stat = (statName, count, label) => ({ type: "stat", stat: statName, count, label });

  const PADDLE_SKINS = [
    item("default",      "NEON CORE",     "common",    FREE,                 "Factory-issue paddle. Clean, bright, reliable."),
    item("scanline",     "SCANLINE",      "common",    lvl(3),               "CRT scanlines roll down the paddle like an old arcade monitor."),
    item("static",       "DEAD CHANNEL",  "common",    lvl(5),               "Snowy TV static with a few stuck pixels that never change."),
    item("rgbsplit",     "RGB SPLIT",     "rare",      lvl(6),               "Colour channels tear apart. The split widens as Heat climbs."),
    item("circuit",      "CIRCUIT BOARD", "rare",      lvl(9),               "Copper traces carry pulses of light and flare on every return."),
    item("matrixrain",   "MATRIX RAIN",   "rare",      arena("matrix", 1),   "Falling code streams through the paddle."),
    item("plasma",       "PLASMA",        "epic",      lvl(13),              "A slow, liquid plasma field swirling inside the frame."),
    item("wireframe",    "WIREFRAME",     "epic",      arena("construct", 3),"A bare construct mesh with a scanning pulse and vertex nodes."),
    item("holofoil",     "HOLO FOIL",     "epic",      lvl(18),              "Iridescent trading-card foil that shifts colour as it moves."),
    item("eventhorizon", "EVENT HORIZON", "legendary", arena("blackhole", 5),"A light-swallowing core circled by a glowing accretion disk."),
    item("watcher",      "THE WATCHER",   "legendary", boss(3),              "An eye taken from the Surveillance Eye. It never stops tracking the ball."),
    item("goldcore",     "GOLDEN CORE",   "legendary", lvl(25),              "Polished gold with a travelling shine. For players who stuck around.")
  ];

  const BALL_TRAILS = [
    item("default",      "GHOST ECHO",     "common",    FREE,                  "The classic soft afterglow. Takes your colour as the ball charges."),
    item("pixeldust",    "PIXEL DUST",     "common",    lvl(2),                "Square pixels shed off the ball and drift away."),
    item("sonar",        "SONAR RINGS",    "common",    lvl(3),                "Rings ping outward from the ball's path like a radar sweep."),
    item("ghostframes",  "GHOST FRAMES",   "common",    lvl(4),                "Stepped afterimages, like the ball is dropping frames."),
    item("lightning",    "LIGHTNING",      "rare",      lvl(7),                "A crackling electric arc that redraws itself every frame."),
    item("datastream",   "DATA STREAM",    "rare",      lvl(8),                "The ball leaks a stream of binary and hex."),
    item("helix",        "DOUBLE HELIX",   "rare",      lvl(10),               "Two ribbons twist around the ball's path."),
    item("comet",        "COMET",          "rare",      lvl(11),               "A smooth tapered tail that stretches with speed."),
    item("sparkler",     "SPARKLER",       "epic",      lvl(13),               "Hot sparks spit sideways off the trail."),
    item("glitchtear",   "GLITCH TEAR",    "epic",      lvl(15),               "Horizontal slices of the trail shear and tear apart."),
    item("rainbow",      "RAINBOW ROAD",   "epic",      lvl(20),               "Five bands of colour that taper behind the ball."),
    item("heattrail",    "HEAT SIGNATURE", "legendary", boss(1),               "Starts in your colour, then burns orange and white-hot as Heat rises."),
    item("gravitywake",  "GRAVITY WAKE",   "legendary", arena("blackhole", 10),"The ball drags a lensed rip in space behind it.")
  ];

  const BALL_SKINS = [
    item("default",   "NEON ORB",      "common",    FREE,      "The standard glowing ball in your colour."),
    item("pixelcube", "PIXEL CUBE",    "common",    lvl(2),    "A spinning square, straight out of the first Pong cabinet."),
    item("glitchorb", "GLITCH ORB",    "rare",      lvl(5),    "Colour channels split around the ball and glitch on impact."),
    item("wireorb",   "WIREFRAME ORB", "rare",      lvl(9),    "A rotating wireframe globe."),
    item("vinyl",     "VINYL",         "epic",      lvl(12),   "A spinning record with your colour on the label."),
    item("eightball", "8-BALL",        "epic",      lvl(16),   "Outlook not so good — for your opponent."),
    item("minieye",   "MINI EYE",      "legendary", boss(2),   "A tiny Surveillance Eye that looks where it is going.")
  ];

  const HIT_EFFECTS = [
    item("default",   "STANDARD",      "common",    FREE,      "The arena's built-in camera kick. No extra effect."),
    item("shockring", "SHOCK RING",    "common",    lvl(2),    "Twin rings blast out from the point of contact."),
    item("shards",    "SHARDS",        "rare",      lvl(4),    "The ball shatters a burst of glass shards off the paddle."),
    item("pixelpop",  "PIXEL POP",     "rare",      lvl(7),    "Chunky pixels pop off and fall with gravity."),
    item("glyphs",    "GLYPH BURST",   "epic",      stat("longestRally", 20, "LAND A 20-HIT RALLY"), "Code glyphs scatter from every return."),
    item("arcflash",  "ARC FLASH",     "legendary", lvl(14),   "Lightning forks out of the paddle with a white flash.")
  ];

  const SCORE_EFFECTS = [
    item("default",     "STANDARD",        "common",    FREE,     "The arena's built-in score shake. No extra effect."),
    item("shockwave",   "SHOCKWAVE",       "common",    lvl(3),   "A huge ring rolls out of the goal you scored in."),
    item("pixelburst",  "PIXEL EXPLOSION", "rare",      lvl(6),   "The goal mouth explodes into pixels."),
    item("binaryspill", "BINARY SPILL",    "rare",      lvl(12),  "Ones and zeros pour out of the breach."),
    item("fireworks",   "FIREWORKS",       "epic",      stat("wins", 10, "WIN 10 MATCHES"), "Rockets launch from the goal and burst overhead."),
    item("signalloss",  "SIGNAL LOSS",     "legendary", lvl(18),  "The picture tears and rolls like a dying broadcast.")
  ];

  const DASH_EFFECTS = [
    item("default",      "AFTERIMAGE",     "common",    FREE,     "The standard glowing afterimages."),
    item("smear",        "MOTION SMEAR",   "common",    lvl(3),   "A long gradient smear where the paddle just was."),
    item("speedlines",   "SPEED LINES",    "rare",      lvl(8),   "Anime speed lines streak behind the dash."),
    item("ghostclones",  "GHOST CLONES",   "rare",      stat("dashUses", 50, "DASH 50 TIMES"), "Chromatic outline clones hang in the air."),
    item("pixelscatter", "PIXEL SCATTER",  "epic",      stat("dashUses", 150, "DASH 150 TIMES"), "The old position dissolves into drifting pixels."),
    item("afterburn",    "AFTERBURN",      "legendary", lvl(16),  "Thrusters fire. The dash leaves a burning exhaust plume.")
  ];

  // The ball's glitch teleport, in the style of whoever last hit it.
  const TELEPORT_EFFECTS = [
    item("default",     "STANDARD",          "common",    FREE,    "The ball blinks out with no extra effect."),
    item("pixelate",    "PIXELATE",          "common",    lvl(4),  "The ball breaks into a grid of pixels and reassembles."),
    item("staticburst", "STATIC BURST",      "rare",      lvl(7),  "A cloud of TV static where it left and where it lands."),
    item("portal",      "PORTAL",            "rare",      lvl(10), "Spinning portals open at both ends of the jump."),
    item("beam",        "TRANSPORTER BEAM",  "epic",      lvl(14), "A column of light beams the ball across the arena."),
    item("datashred",   "DATA SHRED",        "legendary", boss(5), "The ball is shredded into packets that stream to the new spot.")
  ];

  const CATALOG = {
    paddle: PADDLE_SKINS, trail: BALL_TRAILS, ball: BALL_SKINS,
    hit: HIT_EFFECTS, score: SCORE_EFFECTS, dash: DASH_EFFECTS, teleport: TELEPORT_EFFECTS
  };
  const SLOT_INFO = {
    paddle:   { label: "PADDLE SKINS",  noun: "SKIN" },
    trail:    { label: "BALL TRAILS",   noun: "TRAIL" },
    ball:     { label: "BALL SKINS",    noun: "BALL" },
    hit:      { label: "HIT EFFECTS",   noun: "HIT EFFECT" },
    score:    { label: "SCORE EFFECTS", noun: "SCORE EFFECT" },
    dash:     { label: "DASH EFFECTS",  noun: "DASH" },
    teleport: { label: "TELEPORTS",     noun: "TELEPORT" }
  };

  const STAT_LABELS = { wins: "WINS", dashUses: "DASHES", longestRally: "HIT RALLY", matchesPlayed: "MATCHES" };

  // ─── Unlock rules ─────────────────────────────────────────────────────────
  function progressFor(item, data) {
    const u = item.unlock || { type: "free" };
    const d = data || {};
    if (u.type === "level") {
      const cur = Math.max(1, Number(d.level) || 1);
      return { unlocked: cur >= u.level, current: Math.min(cur, u.level), target: u.level,
               label: `REACH LEVEL ${u.level}` };
    }
    if (u.type === "arenaWins") {
      const wins = Number(d.arenaStats && d.arenaStats[u.arena] && d.arenaStats[u.arena].wins) || 0;
      const plural = u.count === 1 ? "MATCH" : `${u.count} MATCHES`;
      return { unlocked: wins >= u.count, current: Math.min(wins, u.count), target: u.count,
               label: `WIN ${plural} IN ${ARENA_NAMES[u.arena] || u.arena.toUpperCase()}` };
    }
    if (u.type === "boss") {
      const n = Number(d.bossSurvivals) || 0;
      return { unlocked: n >= u.count, current: Math.min(n, u.count), target: u.count,
               label: u.count === 1 ? "SURVIVE THE SURVEILLANCE EYE" : `SURVIVE THE EYE ${u.count} TIMES` };
    }
    if (u.type === "stat") {
      const n = Number(d[u.stat]) || 0;
      return { unlocked: n >= u.count, current: Math.min(n, u.count), target: u.count,
               label: u.label || `${u.count} ${STAT_LABELS[u.stat] || u.stat.toUpperCase()}` };
    }
    return { unlocked: true, current: 1, target: 1, label: "UNLOCKED BY DEFAULT" };
  }

  function find(slot, id) {
    return (CATALOG[slot] || []).find(item => item.id === id) || null;
  }

  function isUnlocked(slot, id, data) {
    const item = find(slot, id);
    return !!item && progressFor(item, data).unlocked;
  }

  // Save keys look like "paddle-scanline" (letters, digits and dashes only, so
  // they survive the save export/import filter).
  function key(slot, id) { return `${slot}-${id}`; }

  // Records every unlocked item in the progression save and returns the ones
  // that were not recorded before, so the caller can announce them.
  function syncUnlocks(data) {
    if (!data) return [];
    if (!Array.isArray(data.cosmeticsUnlocked)) data.cosmeticsUnlocked = ["default"];
    const fresh = [];
    SLOTS.forEach(slot => {
      CATALOG[slot].forEach(item => {
        const k = key(slot, item.id);
        if (progressFor(item, data).unlocked && !data.cosmeticsUnlocked.includes(k)) {
          data.cosmeticsUnlocked.push(k);
          if (item.unlock.type !== "free") fresh.push({ slot, item });
        }
      });
    });
    return fresh;
  }

  // ─── Equip state (per paddle side, saved per browser) ─────────────────────
  function defaultState() {
    return {
      equipped: {
        blue: Object.fromEntries(SLOTS.map(slot => [slot, "default"])),
        red:  Object.fromEntries(SLOTS.map(slot => [slot, "default"]))
      },
      seen: []
    };
  }

  let state = defaultState();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") { state = defaultState(); return; }
      const next = defaultState();
      OWNERS.forEach(owner => {
        SLOTS.forEach(slot => {
          const id = parsed.equipped && parsed.equipped[owner] && parsed.equipped[owner][slot];
          if (typeof id === "string" && find(slot, id)) next.equipped[owner][slot] = id;
        });
      });
      if (Array.isArray(parsed.seen)) next.seen = parsed.seen.filter(k => typeof k === "string");
      state = next;
    } catch (e) { state = defaultState(); }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // A locked item can still be in the save (e.g. after a progression reset),
  // so the default is used until it is earned again.
  function getEquipped(owner, slot, data) {
    const id = state.equipped[owner] && state.equipped[owner][slot];
    if (!id || id === "default") return "default";
    if (data && !isUnlocked(slot, id, data)) return "default";
    return find(slot, id) ? id : "default";
  }

  function equip(owner, slot, id, data) {
    if (!OWNERS.includes(owner) || !find(slot, id)) return false;
    if (data && !isUnlocked(slot, id, data)) return false;
    state.equipped[owner][slot] = id;
    save();
    return true;
  }

  function isNew(slot, id, data) {
    const item = find(slot, id);
    if (!item || item.unlock.type === "free") return false;
    return progressFor(item, data).unlocked && !state.seen.includes(key(slot, id));
  }

  function markSeen(slot, data) {
    let changed = false;
    CATALOG[slot].forEach(item => {
      const k = key(slot, item.id);
      if (progressFor(item, data).unlocked && !state.seen.includes(k)) {
        state.seen.push(k);
        changed = true;
      }
    });
    if (changed) save();
  }

  function countNew(data) {
    let n = 0;
    SLOTS.forEach(slot => CATALOG[slot].forEach(item => { if (isNew(slot, item.id, data)) n++; }));
    return n;
  }

  // ─── Colour + noise helpers ───────────────────────────────────────────────
  function rgba(rgb, a) { return `rgba(${rgb},${Math.max(0, Math.min(1, a))})`; }

  function parseRgb(rgb) { return String(rgb).split(",").map(v => Number(v) || 0); }

  function mixRgb(a, b, k) {
    const pa = parseRgb(a), pb = parseRgb(b);
    return pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(",");
  }

  // Cheap deterministic noise in [0, 1).
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // Interpolates extra samples between trail points. f = 1 at the ball, 0 at the tail.
  function densify(trail, sub) {
    const out = [];
    const n = trail.length;
    if (n === 0) return out;
    const total = Math.max(1, (n - 1) * sub);
    for (let i = 0; i < n - 1; i++) {
      const a = trail[i], b = trail[i + 1];
      for (let s = 0; s < sub; s++) {
        const k = s / sub;
        const idx = i * sub + s;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, f: 1 - idx / total });
      }
    }
    out.push({ x: trail[n - 1].x, y: trail[n - 1].y, f: 0 });
    return out;
  }

  // Evenly spaced samples along the trail (by distance), newest first.
  function resample(trail, spacing) {
    const out = [];
    if (trail.length === 0) return out;
    let total = 0;
    for (let i = 1; i < trail.length; i++) total += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
    if (total <= 0) return out;
    let walked = 0;
    let next = spacing;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      while (seg > 0 && next <= walked + seg) {
        const k = (next - walked) / seg;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, f: 1 - next / total, d: next });
        next += spacing;
      }
      walked += seg;
    }
    return out;
  }

  function strokeFrame(ctx, x, y, w, h, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // ─── Paddle skins ─────────────────────────────────────────────────────────
  // o = { rgb, hex, t (seconds), heat (0-1), pulse, quality (0-1), img, imgReady }

  function paddleDefault(ctx, x, y, w, h, o) {
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 1);
    ctx.shadowBlur = 30 + Math.max(0, (o.pulse || 0) * 0.35);
    ctx.fillStyle = o.hex;
    ctx.fillRect(x, y, w, h);
    if (o.imgReady && o.img) {
      // Preserve the paddle texture while tinting it to the selected colour.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalAlpha = 0.24;
      ctx.drawImage(o.img, x, y, w, h);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.56;
      ctx.fillStyle = o.hex;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    ctx.strokeStyle = rgba(o.rgb, 1);
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 1.75;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  function paddleScanline(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.45);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.95);
    ctx.shadowBlur = (26 + Math.max(0, (o.pulse || 0) * 0.3)) * (o.quality < 0.55 ? 0.6 : 1);
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.62), 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, rgba(o.rgb, 0.6));
    body.addColorStop(0.5, rgba(light, 1));
    body.addColorStop(1, rgba(o.rgb, 0.6));
    ctx.fillStyle = body;
    const spacing = 4;
    const offset = (o.t * 22) % spacing;
    for (let yy = y - spacing + offset; yy < y + h; yy += spacing) ctx.fillRect(x, yy, w, 2);

    // A brighter refresh band rolls down the paddle.
    const span = h + 60;
    const bandY = y - 30 + ((o.t * 0.55) % 1) * span;
    const band = ctx.createLinearGradient(0, bandY - 22, 0, bandY + 22);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(255,255,255,0.55)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(x, bandY - 22, w, 44);
    ctx.restore();

    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.95), 1.75);
    ctx.restore();
  }

  function paddleRgbSplit(ctx, x, y, w, h, o) {
    const heat = o.heat || 0;
    const tick = Math.floor(o.t * 12);
    const glitching = hash(tick) > 0.82 - heat * 0.25;
    const jitter = glitching ? (hash(tick + 3.3) - 0.5) * (6 + heat * 8) : 0;
    const off = 3.5 + heat * 5 + Math.abs(jitter) * 0.5;

    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.8);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 18;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgb(255,40,90)";
    ctx.fillRect(x - off, y + jitter * 0.4, w, h);
    ctx.fillStyle = "rgb(40,150,255)";
    ctx.fillRect(x + off, y - jitter * 0.4, w, h);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = o.hex;
    const slices = 6;
    const sh = h / slices;
    for (let i = 0; i < slices; i++) {
      const sx = glitching ? (hash(i * 7.1 + tick * 1.7) - 0.5) * off * 1.8 : 0;
      ctx.fillRect(x + sx, y + i * sh, w, sh + 0.6);
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + w / 2 - 1, y + 5, 2, h - 10);
    strokeFrame(ctx, x, y, w, h, "rgba(255,255,255,0.7)", 1.25);
    ctx.restore();
  }

  const MATRIX_GLYPHS = "01アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF";

  function paddleMatrixRain(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.35);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 22;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.86), 0.96);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const fs = Math.max(8, Math.min(11, Math.round(w * 0.46)));
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const cols = Math.max(2, Math.floor(w / (fs * 0.78)));
    const colW = w / cols;
    const rows = Math.ceil(h / fs) + 1;
    const streak = 7;
    for (let c = 0; c < cols; c++) {
      const speed = 3.2 + hash(c * 13.7) * 2.8;          // rows per second
      const cycle = rows + streak * 2;
      const head = ((o.t * speed + hash(c * 5.1) * cycle) % cycle) - streak;
      for (let k = 0; k < rows; k++) {
        const d = head - k;                               // rows behind the head
        let alpha;
        let color;
        if (d >= 0 && d < 1) { alpha = 0.95; color = "235,255,245"; }
        else if (d >= 1 && d < streak) { alpha = 0.9 * (1 - d / streak); color = light; }
        else { alpha = 0.12; color = o.rgb; }
        const glyph = MATRIX_GLYPHS[Math.floor(hash(c * 31.3 + k * 7.7 + Math.floor(o.t * 6 + c * 0.5)) * MATRIX_GLYPHS.length)];
        ctx.fillStyle = rgba(color, alpha);
        ctx.fillText(glyph, x + colW * (c + 0.5), y + k * fs - 1);
      }
    }
    ctx.restore();

    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleWireframe(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.save();
    ctx.fillStyle = rgba(o.rgb, 0.12);
    ctx.fillRect(x, y, w, h);

    ctx.shadowColor = rgba(o.rgb, 0.95);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.95), 2);
    ctx.shadowBlur = 0;

    // Triangulated mesh
    const rows = Math.max(3, Math.round(h / (w * 0.95)));
    const cellH = h / rows;
    ctx.strokeStyle = rgba(o.rgb, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    for (let r = 0; r <= rows; r++) {
      const yy = y + r * cellH;
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      if (r < rows) {
        if (r % 2 === 0) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy + cellH); }
        else { ctx.moveTo(x + w, yy); ctx.lineTo(x, yy + cellH); }
      }
    }
    ctx.stroke();

    // Scanning pulse sweeps up and down; nearby vertices light up.
    const scanY = y + (Math.sin(o.t * 2.1) * 0.5 + 0.5) * h;
    const scanGrad = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
    scanGrad.addColorStop(0, rgba(light, 0));
    scanGrad.addColorStop(0.5, rgba("255,255,255", 0.55));
    scanGrad.addColorStop(1, rgba(light, 0));
    ctx.fillStyle = scanGrad;
    ctx.fillRect(x + 1, scanY - 10, w - 2, 20);

    for (let r = 0; r <= rows; r++) {
      const yy = y + r * cellH;
      const near = Math.max(0, 1 - Math.abs(yy - scanY) / 26);
      const a = 0.45 + near * 0.55;
      const s = 2 + near * 1.6;
      ctx.fillStyle = near > 0.4 ? rgba("255,255,255", a) : rgba(light, a);
      [x, x + w / 2, x + w].forEach(vx => ctx.fillRect(vx - s / 2, yy - s / 2, s, s));
    }
    ctx.restore();
  }

  function paddleEventHorizon(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.55);
    ctx.save();
    // Glowing halo behind the dark core
    ctx.shadowColor = rgba(o.rgb, 0.95);
    ctx.shadowBlur = (o.quality < 0.55 ? 16 : 32) + Math.max(0, (o.pulse || 0) * 0.3);
    ctx.fillStyle = rgba(o.rgb, 0.95);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    const core = ctx.createLinearGradient(x, 0, x + w, 0);
    core.addColorStop(0, rgba(light, 1));
    core.addColorStop(0.2, rgba(o.rgb, 0.7));
    core.addColorStop(0.4, "rgba(0,0,0,0.98)");
    core.addColorStop(0.6, "rgba(0,0,0,0.98)");
    core.addColorStop(0.8, rgba(o.rgb, 0.7));
    core.addColorStop(1, rgba(light, 1));
    ctx.fillStyle = core;
    ctx.fillRect(x, y, w, h);

    ctx.beginPath();
    ctx.rect(x - 2, y, w + 4, h);
    ctx.clip();

    // Accretion particles orbit the core: bright in front, dim behind.
    const count = o.quality < 0.55 ? 7 : 12;
    for (let i = 0; i < count; i++) {
      const phase = o.t * (2.2 + hash(i) * 1.6) + i * 1.3;
      const travel = (o.t * (18 + hash(i + 5) * 26) + hash(i * 3.1) * h) % h;
      const px = x + w / 2 + Math.sin(phase) * w * 0.46;
      const py = y + travel;
      const front = Math.cos(phase) > 0;
      ctx.fillStyle = front ? "rgba(255,255,255,0.9)" : rgba(o.rgb, 0.35);
      const len = front ? 7 : 4;
      ctx.fillRect(px - 1.25, py - len / 2, 2.5, len);
    }

    // Faint singularity line down the middle
    const flicker = 0.25 + hash(Math.floor(o.t * 20)) * 0.25;
    ctx.fillStyle = rgba(light, flicker);
    ctx.fillRect(x + w / 2 - 0.5, y + 6, 1, h - 12);
    ctx.restore();

    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.85), 1.25);
    ctx.restore();
  }

  const PADDLE_RENDERERS = {
    default: paddleDefault,
    scanline: paddleScanline,
    rgbsplit: paddleRgbSplit,
    matrixrain: paddleMatrixRain,
    wireframe: paddleWireframe,
    eventhorizon: paddleEventHorizon
  };

  function drawPaddleSkin(ctx, skinId, x, y, w, h, o) {
    const opts = Object.assign({ rgb: "0,217,255", hex: "#00d9ff", t: 0, heat: 0, pulse: 0, quality: 1 }, o || {});
    (PADDLE_RENDERERS[skinId] || paddleDefault)(ctx, x, y, w, h, opts);
  }

  // ─── Ball trails ──────────────────────────────────────────────────────────
  // trail = [{x,y}, ...] newest first (trail[0] is at the ball).
  // o = { r, heat (0-1), rgb (owner colour, or null when neutral), charge, t, quality }

  function trailDefault(ctx, trail, o) {
    const trailScale = Math.min(3, 1 + ((o.charge || 1) - 1) * 0.45);
    ctx.save();
    for (let i = trail.length - 1; i >= 0; i--) {
      const t = trail[i];
      const progress = (trail.length - i) / (trail.length + 1);
      const size = (o.r + o.heat * 0.8) * (1 - progress * 0.25);
      const baseOpacity = (0.05 + progress * 0.15) * (1 + o.heat * 0.35) * trailScale;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      if ((o.charge || 1) >= 2 && o.rgb) {
        ctx.fillStyle   = `rgba(${o.rgb},${Math.min(0.9, baseOpacity * 1.4)})`;
        ctx.shadowColor = `rgba(${o.rgb},0.4)`;
      } else {
        ctx.fillStyle   = `rgba(255,255,255,${baseOpacity})`;
        ctx.shadowColor = `rgba(255,255,255,${0.3 * (1 - progress)})`;
      }
      ctx.shadowBlur = (14 + o.heat * 6) * (1 - progress);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function trailPixelDust(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const light = mixRgb(rgb, "255,255,255", 0.4);
    const pts = densify(trail, 2);
    ctx.save();
    for (let i = pts.length - 1; i >= 1; i--) {
      const p = pts[i];
      const age = 1 - p.f;
      for (let k = 0; k < 2; k++) {
        const seed = p.x * 0.131 + p.y * 0.717 + k * 9.13;
        const jx = (hash(seed) - 0.5) * o.r * 1.8 * (0.35 + age);
        const jy = (hash(seed + 4.2) - 0.5) * o.r * 1.8 * (0.35 + age) + age * o.r * 0.9;
        const size = Math.max(1.5, o.r * 0.55 * p.f + 1.5);
        const px = Math.round((p.x + jx) / 2) * 2;
        const py = Math.round((p.y + jy) / 2) * 2;
        ctx.fillStyle = rgba(k === 0 ? rgb : light, 0.9 * p.f + 0.05);
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
    }
    ctx.restore();
  }

  function trailGhostFrames(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    ctx.save();
    ctx.lineWidth = 1.5;
    const n = trail.length;
    for (let i = n - 1; i >= 1; i--) {
      if (i % 2 !== 0) continue;
      const p = trail[i];
      const f = 1 - i / n;
      const a = (Math.ceil(f * 4) / 4) * 0.6;           // stepped, not smooth
      const size = o.r * (0.78 + 0.22 * f);
      if (i % 4 === 0) {
        ctx.strokeStyle = rgba("255,60,100", a * 0.45);
        ctx.beginPath(); ctx.arc(p.x - 2, p.y, size, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rgba("60,220,255", a * 0.45);
        ctx.beginPath(); ctx.arc(p.x + 2, p.y, size, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(rgb, a * 0.28);
      ctx.fill();
      ctx.strokeStyle = rgba(rgb, a);
      ctx.stroke();
    }
    ctx.restore();
  }

  const DATA_GLYPHS = "0101010110ABCDEF";

  function trailDataStream(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const light = mixRgb(rgb, "255,255,255", 0.5);
    const pts = resample(trail, Math.max(7, o.r * 1.05));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      if (p.d < o.r * 1.1) continue;                    // keep clear of the ball
      const size = Math.max(7, Math.round(o.r * (0.8 + 0.6 * p.f)));
      ctx.font = `bold ${size}px monospace`;
      // Glyphs are pinned to distance-from-ball bands so they scroll, not flicker.
      const band = Math.floor(p.d / Math.max(7, o.r * 1.05));
      const glyph = DATA_GLYPHS[Math.floor(hash(band * 3.7 + Math.floor((o.t || 0) * 10) * 0.13) * DATA_GLYPHS.length)];
      ctx.fillStyle = rgba(p.f > 0.7 ? light : rgb, 0.15 + p.f * 0.8);
      ctx.fillText(glyph, p.x, p.y);
    }
    ctx.restore();
  }

  function trailComet(ctx, trail, o) {
    if (trail.length < 2) return;
    const rgb = o.rgb || "255,255,255";
    const light = mixRgb(rgb, "255,255,255", 0.6);
    const n = trail.length;
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const p = trail[i];
      const a = trail[Math.max(0, i - 1)];
      const b = trail[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const half = o.r * 0.95 * Math.pow(1 - i / (n - 1), 0.8) + 0.4;
      left.push({ x: p.x - dy * half, y: p.y + dx * half });
      right.push({ x: p.x + dy * half, y: p.y - dx * half });
    }
    const head = trail[0], tail = trail[n - 1];
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    grad.addColorStop(0, rgba(light, 0.9));
    grad.addColorStop(0.35, rgba(rgb, 0.55));
    grad.addColorStop(1, rgba(rgb, 0));

    ctx.save();
    ctx.shadowColor = rgba(rgb, 0.8);
    ctx.shadowBlur = (o.quality || 1) < 0.55 ? 0 : 16;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hot white core
    const coreGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.85)");
    coreGrad.addColorStop(0.6, "rgba(255,255,255,0)");
    ctx.strokeStyle = coreGrad;
    ctx.lineWidth = Math.max(1.5, o.r * 0.3);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    for (let i = 1; i < n; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();

    // Sparks shed from the tail
    for (let i = 2; i < n; i += 2) {
      const p = trail[i];
      const f = 1 - i / n;
      const seed = p.x * 0.23 + p.y * 0.61;
      ctx.fillStyle = rgba(light, 0.75 * f);
      ctx.fillRect(p.x + (hash(seed) - 0.5) * o.r * 2.6, p.y + (hash(seed + 1.7) - 0.5) * o.r * 2.6, 2, 2);
    }
    ctx.restore();
  }

  function trailGlitchTear(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const tick = Math.floor((o.t || 0) * 15);
    const colors = [rgb, "255,60,100", "60,230,255"];
    ctx.save();
    const n = trail.length;
    for (let i = n - 1; i >= 1; i--) {
      const p = trail[i];
      const f = 1 - i / n;
      const a = 0.15 + 0.7 * f;
      for (let k = 0; k < 3; k++) {
        const seed = i * 7.3 + k * 2.9 + tick * 1.31;
        const bw = o.r * 2 * (0.9 + hash(seed) * 1.5);
        const bh = Math.max(2, o.r * 0.42);
        const ox = (hash(seed + 5.5) - 0.5) * o.r * 3.2 * (1.4 - f);
        const oy = (k - 1) * o.r * 0.62;
        ctx.fillStyle = rgba(colors[k], k === 0 ? a : a * 0.75);
        ctx.fillRect(p.x - bw / 2 + ox, p.y + oy - bh / 2, bw, bh);
      }
      if (hash(tick * 0.77 + i) > 0.86) {
        ctx.fillStyle = rgba("255,255,255", a * 0.8);
        const tw = o.r * 6;
        ctx.fillRect(p.x - tw / 2 + (hash(tick + i * 3.3) - 0.5) * o.r * 4, p.y - 1, tw, 2);
      }
    }
    ctx.restore();
  }

  function trailHeatSignature(ctx, trail, o) {
    const heat = Math.max(0, Math.min(1, o.heat || 0));
    const base = o.rgb || "103,239,255";
    const warm = "255,140,40";
    const hot = "255,246,220";
    const core = heat < 0.5 ? mixRgb(base, warm, heat * 2) : mixRgb(warm, hot, (heat - 0.5) * 2);
    const edge = heat < 0.5 ? mixRgb(base, "255,80,30", heat * 1.4) : mixRgb("255,80,30", warm, (heat - 0.5) * 2);
    const pts = densify(trail, 2);
    const tick = (o.t || 0) * 9;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = pts.length - 1; i >= 1; i--) {
      const p = pts[i];
      const age = 1 - p.f;
      const flick = hash(i * 1.9 + Math.floor(tick)) - 0.5;
      const size = o.r * (0.55 + age * 0.9) * (0.85 + heat * 0.45) * (1 + flick * 0.2);
      const py = p.y - age * o.r * 1.4 * (0.3 + heat);
      const px = p.x + flick * o.r * 0.5 * age;
      const g = ctx.createRadialGradient(px, py, 0, px, py, size);
      g.addColorStop(0, rgba(core, 0.55 * p.f + 0.08));
      g.addColorStop(0.55, rgba(edge, 0.3 * p.f + 0.04));
      g.addColorStop(1, rgba(edge, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const TRAIL_RENDERERS = {
    default: trailDefault,
    pixeldust: trailPixelDust,
    ghostframes: trailGhostFrames,
    datastream: trailDataStream,
    comet: trailComet,
    glitchtear: trailGlitchTear,
    heattrail: trailHeatSignature
  };

  function drawBallTrail(ctx, trailId, trail, o) {
    if (!trail || trail.length === 0) return;
    const opts = Object.assign({ r: 10, heat: 0, rgb: null, charge: 1, t: 0, quality: 1 }, o || {});
    (TRAIL_RENDERERS[trailId] || trailDefault)(ctx, trail, opts);
  }

  // ═══ More paddle skins ═══════════════════════════════════════════════════
  // o also carries ballY (screen y of the ball) and hitFlash (1 → 0 after a return).

  function paddleStatic(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.6);
    const tick = Math.floor(o.t * 24);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85);
    ctx.shadowBlur = o.quality < 0.55 ? 10 : 20;
    ctx.fillStyle = "rgb(18,20,26)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    const cell = 3;
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        const n = hash(cx * 1.7 + cy * 0.37 + tick * 13.1);
        if (n < 0.35) continue;
        const g = Math.round(90 + n * 150);
        ctx.fillStyle = `rgba(${g},${g},${g},${0.25 + n * 0.55})`;
        ctx.fillRect(x + cx, y + cy, cell, cell);
      }
    }
    // a slow rolling bar, like a badly tuned set
    const bar = y + ((o.t * 0.35) % 1) * h;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, bar, w, 6);
    // stuck pixels in the paddle's colour never change
    ctx.fillStyle = rgba(light, 0.95);
    [0.17, 0.43, 0.71, 0.88].forEach((fy, i) => ctx.fillRect(x + (i % 2 ? w * 0.65 : w * 0.25), y + fy * h, 3, 3));
    ctx.globalAlpha = 0.9;
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 1), 2);
    ctx.restore();
  }

  function paddleCircuit(ctx, x, y, w, h, o) {
    const flash = o.hitFlash || 0;
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.85 + flash * 0.15);
    ctx.shadowBlur = (o.quality < 0.55 ? 12 : 22) + flash * 18;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "4,22,14", 0.82), 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // fixed traces: each lane jogs sideways once, with a pad at each end
    const lanes = [0.25, 0.5, 0.75];
    ctx.lineWidth = 1.5;
    lanes.forEach((lx, i) => {
      const jog = (hash(i * 9.1) - 0.5) * w * 0.4;
      const yA = y + h * (0.15 + hash(i * 3.3) * 0.25);
      const yB = y + h * (0.6 + hash(i * 5.7) * 0.3);
      const px = x + w * lx;
      ctx.strokeStyle = rgba(o.rgb, 0.55 + flash * 0.45);
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, yA);
      ctx.lineTo(px + jog, yA + 8);
      ctx.lineTo(px + jog, yB);
      ctx.lineTo(px, yB + 8);
      ctx.lineTo(px, y + h);
      ctx.stroke();
      ctx.fillStyle = rgba(light, 0.85);
      ctx.fillRect(px + jog - 2, yA + 6, 4, 4);
      ctx.fillRect(px + jog - 2, yB - 2, 4, 4);
      // a pulse of light travels the lane
      const py = y + ((o.t * (0.6 + i * 0.25) + hash(i)) % 1) * h;
      ctx.fillStyle = rgba("255,255,255", 0.9);
      ctx.fillRect(px - 1.5 + (py > yA && py < yB ? jog : 0), py - 3, 3, 6);
    });
    if (flash > 0) {
      ctx.fillStyle = rgba(light, flash * 0.35);
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddlePlasma(ctx, x, y, w, h, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.55);
    const alt = mixRgb(o.rgb, "255,60,200", 0.55);
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 14 : 26;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.7), 1);
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    const cell = o.quality < 0.55 ? 6 : 4;
    const t = o.t;
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        const v = Math.sin(cx * 0.35 + t * 1.7) + Math.sin(cy * 0.09 - t * 2.3) + Math.sin((cx + cy) * 0.12 + t * 1.1);
        const k = (v + 3) / 6;
        ctx.fillStyle = rgba(k > 0.55 ? mixRgb(light, alt, (k - 0.55) * 2.2) : o.rgb, 0.25 + k * 0.75);
        ctx.fillRect(x + cx, y + cy, cell, cell);
      }
    }
    strokeFrame(ctx, x, y, w, h, rgba(light, 0.9), 1.5);
    ctx.restore();
  }

  function paddleHoloFoil(ctx, x, y, w, h, o) {
    const shift = (o.t * 0.25 + (o.ballY || 0) * 0.0015) % 1;
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 24;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    for (let i = 0; i <= 6; i++) {
      const hue = ((i / 6 + shift) % 1) * 360;
      g.addColorStop(i / 6, `hsl(${hue},85%,68%)`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // the team colour washes over the foil so each side stays readable
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = rgba(o.rgb, 1);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sy = y - 40 + ((o.t * 0.6) % 1) * (h + 80);
    const shine = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.7)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(x, sy - 30, w, 60);
    ctx.restore();
    ctx.save();
    strokeFrame(ctx, x, y, w, h, "rgba(255,255,255,0.85)", 1.5);
    ctx.restore();
  }

  function paddleWatcher(ctx, x, y, w, h, o) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 24;
    ctx.fillStyle = "rgb(24,8,14)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    // vein lines toward the ends
    ctx.strokeStyle = "rgba(255,70,90,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const dir = i < 3 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + (hash(i) - 0.5) * w * 0.5, cy + dir * w * 0.5);
      ctx.lineTo(cx + (hash(i + 2) - 0.5) * w * 0.8, cy + dir * h * (0.25 + hash(i + 7) * 0.2));
      ctx.stroke();
    }
    // the eye: blinks every few seconds, iris follows the ball
    const blinkPhase = (o.t % 4.3);
    const open = blinkPhase < 0.12 ? Math.abs(blinkPhase - 0.06) / 0.06 : 1;
    const ew = w * 0.42;
    const eh = w * 0.95 * Math.max(0.08, open);
    ctx.fillStyle = "rgba(255,240,240,0.95)";
    ctx.beginPath(); ctx.ellipse(cx, cy, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    const look = Math.max(-1, Math.min(1, ((o.ballY == null ? cy : o.ballY) - cy) / (h * 1.5)));
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, ew, eh, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = rgba(o.rgb, 1);
    ctx.beginPath(); ctx.arc(cx, cy + look * eh * 0.45, ew * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(8,0,4)";
    ctx.beginPath(); ctx.arc(cx, cy + look * eh * 0.5, ew * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(cx - ew * 0.25, cy + look * eh * 0.5 - ew * 0.35, 2, 2);
    ctx.restore();
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 0.95), 1.75);
    ctx.restore();
  }

  function paddleGoldCore(ctx, x, y, w, h, o) {
    ctx.save();
    ctx.shadowColor = rgba(o.rgb, 0.9);
    ctx.shadowBlur = o.quality < 0.55 ? 12 : 26;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#7a5410");
    g.addColorStop(0.3, "#f6d77a");
    g.addColorStop(0.55, "#fff4c4");
    g.addColorStop(0.75, "#d9a632");
    g.addColorStop(1, "#6b4608");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const sy = y - 50 + ((o.t * 0.45) % 1) * (h + 100);
    ctx.translate(x + w / 2, sy);
    ctx.rotate(-0.5);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(-w, -4, w * 2, 8);
    ctx.restore();
    ctx.save();
    // team colour on the bezel so the gold still says whose paddle it is
    strokeFrame(ctx, x, y, w, h, rgba(o.rgb, 1), 2.5);
    ctx.restore();
  }

  Object.assign(PADDLE_RENDERERS, {
    static: paddleStatic,
    circuit: paddleCircuit,
    plasma: paddlePlasma,
    holofoil: paddleHoloFoil,
    watcher: paddleWatcher,
    goldcore: paddleGoldCore
  });

  // ═══ More ball trails ════════════════════════════════════════════════════

  function trailSonar(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    ctx.save();
    ctx.lineWidth = 1.5;
    const n = trail.length;
    for (let i = n - 1; i >= 1; i--) {
      if (i % 3 !== 0) continue;
      const p = trail[i];
      const age = i / n;
      ctx.strokeStyle = rgba(rgb, 0.75 * (1 - age));
      ctx.beginPath();
      ctx.arc(p.x, p.y, o.r * (0.6 + age * 2.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function trailLightning(ctx, trail, o) {
    if (trail.length < 2) return;
    const rgb = o.rgb || "160,220,255";
    const tick = Math.floor((o.t || 0) * 30);
    const pts = resample(trail, Math.max(6, o.r * 0.9));
    if (!pts.length) return;
    const path = (jitter, seed) => {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      pts.forEach((p, i) => {
        const j = (hash(i * 3.1 + seed + tick * 1.7) - 0.5) * jitter * (1 - p.f * 0.5);
        ctx.lineTo(p.x + j * 0.4, p.y + j);
      });
    };
    ctx.save();
    ctx.lineJoin = "round";
    ctx.shadowColor = rgba(rgb, 0.9);
    ctx.shadowBlur = (o.quality || 1) < 0.55 ? 0 : 14;
    ctx.strokeStyle = rgba(rgb, 0.8);
    ctx.lineWidth = 3;
    path(o.r * 1.6, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2;
    path(o.r * 1.6, 0);
    ctx.stroke();
    // a fork that branches off now and then
    if (hash(tick * 0.31) > 0.4 && pts.length > 3) {
      const at = pts[Math.floor(pts.length / 2)];
      ctx.strokeStyle = rgba(rgb, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x + (hash(tick) - 0.5) * o.r * 3, at.y + (hash(tick + 1) > 0.5 ? 1 : -1) * o.r * 2.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function trailHelix(ctx, trail, o) {
    const rgb = o.rgb || "255,255,255";
    const alt = mixRgb(rgb, "255,255,255", 0.6);
    const pts = resample(trail, 3);
    if (pts.length < 2) return;
    const phase = (o.t || 0) * 10;
    ctx.save();
    for (let strand = 0; strand < 2; strand++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const amp = o.r * 0.9 * b.f + 1;
        const wa = Math.sin(a.d * 0.18 - phase + strand * Math.PI) * amp;
        const wb = Math.sin(b.d * 0.18 - phase + strand * Math.PI) * amp;
        ctx.strokeStyle = rgba(strand ? alt : rgb, 0.15 + 0.8 * b.f);
        ctx.lineWidth = 1 + b.f * 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
        ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function trailSparkler(ctx, trail, o) {
    const rgb = o.rgb || "255,220,150";
    const tick = Math.floor((o.t || 0) * 40);
    ctx.save();
    ctx.lineCap = "round";
    const n = trail.length;
    for (let i = 1; i < n; i++) {
      const p = trail[i];
      const f = 1 - i / n;
      for (let k = 0; k < 2; k++) {
        const seed = i * 4.7 + k * 1.3 + tick * 0.77;
        const ang = hash(seed) * Math.PI * 2;
        const len = o.r * (0.5 + hash(seed + 2) * 1.6) * (0.4 + f);
        ctx.strokeStyle = k ? rgba("255,240,200", 0.9 * f) : rgba(rgb, 0.85 * f);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const RAINBOW = ["255,60,90", "255,170,40", "255,240,80", "70,235,120", "80,170,255"];

  function trailRainbow(ctx, trail, o) {
    const pts = resample(trail, 3);
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = "butt";
    RAINBOW.forEach((col, band) => {
      const off = (band - 2) * 0.42;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const wa = off * o.r * (0.35 + a.f * 0.65), wb = off * o.r * (0.35 + b.f * 0.65);
        ctx.strokeStyle = rgba(col, 0.2 + 0.75 * b.f);
        ctx.lineWidth = Math.max(1, o.r * 0.42 * (0.4 + b.f * 0.6));
        ctx.beginPath();
        ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
        ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function trailGravityWake(ctx, trail, o) {
    const rgb = o.rgb || "180,140,255";
    const n = trail.length;
    ctx.save();
    for (let i = n - 1; i >= 1; i--) {
      const p = trail[i];
      const f = 1 - i / n;
      const r = o.r * (0.5 + f * 0.7);
      // lensed rim, then the dark core on top
      ctx.strokeStyle = rgba(rgb, 0.55 * f);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.45, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(0,0,0,${0.7 * f})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    // matter spiralling into the wake
    const t = o.t || 0;
    for (let i = 2; i < n; i += 2) {
      const p = trail[i];
      const f = 1 - i / n;
      const ang = t * 6 + i;
      const d = o.r * (1.6 + (1 - f));
      ctx.fillStyle = rgba(mixRgb(rgb, "255,255,255", 0.5), 0.8 * f);
      ctx.fillRect(p.x + Math.cos(ang) * d - 1, p.y + Math.sin(ang) * d - 1, 2, 2);
    }
    ctx.restore();
  }

  Object.assign(TRAIL_RENDERERS, {
    sonar: trailSonar,
    lightning: trailLightning,
    helix: trailHelix,
    sparkler: trailSparkler,
    rainbow: trailRainbow,
    gravitywake: trailGravityWake
  });

  // ═══ Ball skins ══════════════════════════════════════════════════════════
  // The hitbox is always the plain circle of radius r; skins only change the
  // look. o = { rgb, hex, glowBlur, glowAlpha, t, vx, vy, quality }

  function glow(ctx, o) {
    ctx.shadowColor = rgba(o.rgb, o.glowAlpha == null ? 0.8 : o.glowAlpha);
    ctx.shadowBlur = (o.glowBlur == null ? 22 : o.glowBlur) * ((o.quality || 1) < 0.55 ? 0.6 : 1);
  }

  function ballDefault(ctx, x, y, r, o) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = o.hex;
    ctx.shadowColor = rgba(o.rgb, o.glowAlpha == null ? 0.8 : o.glowAlpha);
    ctx.shadowBlur = o.glowBlur == null ? 22 : o.glowBlur;
    ctx.fill();
  }

  function ballPixelCube(ctx, x, y, r, o) {
    const s = r * 1.75;
    ctx.translate(x, y);
    ctx.rotate((o.t || 0) * 3.2);
    glow(ctx, o);
    ctx.fillStyle = o.hex;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(mixRgb(o.rgb, "0,0,0", 0.45), 0.9);
    ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-s / 2, -s / 2, s * 0.22, s * 0.22);
  }

  function ballGlitchOrb(ctx, x, y, r, o) {
    const tick = Math.floor((o.t || 0) * 14);
    const jump = hash(tick) > 0.8 ? (hash(tick + 1) - 0.5) * r : 0;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,40,90,0.75)";
    ctx.beginPath(); ctx.arc(x - r * 0.32 + jump, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(40,160,255,0.75)";
    ctx.beginPath(); ctx.arc(x + r * 0.32 - jump, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    glow(ctx, o);
    ctx.fillStyle = o.hex;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(x - r, y - 1 + jump * 0.5, r * 2, 2);
  }

  function ballWireOrb(ctx, x, y, r, o) {
    const t = o.t || 0;
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    glow(ctx, o);
    ctx.fillStyle = rgba(o.rgb, 0.25);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(light, 0.95);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    [-0.5, 0, 0.5].forEach((ly) => {
      const ry = r * Math.sqrt(1 - ly * ly);
      ctx.beginPath(); ctx.ellipse(x, y + ly * r, ry, ry * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    });
    for (let i = 0; i < 3; i++) {
      const rx = Math.abs(Math.cos(t * 2.4 + i * Math.PI / 3)) * r;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), r, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function ballVinyl(ctx, x, y, r, o) {
    const t = o.t || 0;
    glow(ctx, o);
    ctx.fillStyle = "rgb(14,14,18)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.8;
    for (let k = 0.55; k < 0.98; k += 0.14) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, t * 8, t * 8 + 0.7); ctx.stroke();
    ctx.fillStyle = o.hex;
    ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(14,14,18)";
    ctx.beginPath(); ctx.arc(x, y, r * 0.09, 0, Math.PI * 2); ctx.fill();
  }

  function ballEightBall(ctx, x, y, r, o) {
    glow(ctx, o);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "rgb(90,90,100)");
    g.addColorStop(0.4, "rgb(20,20,26)");
    g.addColorStop(1, "rgb(4,4,6)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(o.rgb, 0.95);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgb(245,245,245)";
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(10,10,12)";
    ctx.font = `bold ${Math.max(6, Math.round(r * 0.72))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("8", x, y + r * 0.04);
  }

  function ballMiniEye(ctx, x, y, r, o) {
    const speed = Math.hypot(o.vx || 0, o.vy || 0) || 1;
    const lx = ((o.vx || 0) / speed) * r * 0.32;
    const ly = ((o.vy || 0) / speed) * r * 0.32;
    glow(ctx, o);
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, "rgb(255,250,250)");
    g.addColorStop(1, "rgb(255,190,200)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = o.hex;
    ctx.beginPath(); ctx.arc(x + lx, y + ly, r * 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(10,0,6)";
    ctx.beginPath(); ctx.arc(x + lx * 1.15, y + ly * 1.15, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(x + lx - r * 0.2, y + ly - r * 0.22, r * 0.1, 0, Math.PI * 2); ctx.fill();
  }

  const BALL_RENDERERS = {
    default: ballDefault, pixelcube: ballPixelCube, glitchorb: ballGlitchOrb, wireorb: ballWireOrb,
    vinyl: ballVinyl, eightball: ballEightBall, minieye: ballMiniEye
  };

  function drawBallSkin(ctx, skinId, x, y, r, o) {
    const opts = Object.assign({ rgb: "255,255,255", hex: "#ffffff", t: 0, vx: 1, vy: 0, quality: 1 }, o || {});
    ctx.save();
    (BALL_RENDERERS[skinId] || ballDefault)(ctx, x, y, r, opts);
    ctx.restore();
  }

  // ═══ Dash effects ════════════════════════════════════════════════════════
  // trail = the game's dash afterimages [{x, y, life}] (life counts down from
  // 8/12/16 frames). o = { w, h, rgb, legacyRgb, heat, t, curY, quality }

  function dashDefault(ctx, trail, o) {
    const col = o.legacyRgb || o.rgb;
    for (const tr of trail) {
      const alpha = Math.max(0, tr.life / 16) * (0.18 + o.heat * 0.14);
      ctx.fillStyle = `rgba(${col},${alpha})`;
      ctx.shadowColor = `rgba(${col},${alpha * 1.4})`;
      ctx.shadowBlur = 16;
      ctx.fillRect(tr.x, tr.y, o.w, o.h);
      ctx.shadowBlur = 0;
    }
  }

  function dashLife(trail) { return trail.reduce((m, tr) => Math.max(m, tr.life), 0) / 16; }

  function dashSmear(ctx, trail, o) {
    if (!trail.length) return;
    const k = dashLife(trail);
    const far = trail.reduce((a, tr) => (Math.abs(tr.y - o.curY) > Math.abs(a.y - o.curY) ? tr : a), trail[0]);
    const top = Math.min(far.y, o.curY);
    const bottom = Math.max(far.y, o.curY) + o.h;
    const g = ctx.createLinearGradient(0, far.y + o.h / 2, 0, o.curY + o.h / 2);
    g.addColorStop(0, rgba(o.rgb, 0.12 * k));
    g.addColorStop(1, rgba(mixRgb(o.rgb, "255,255,255", 0.3), 0.8 * k));
    ctx.fillStyle = g;
    ctx.shadowColor = rgba(o.rgb, 0.7 * k);
    ctx.shadowBlur = 14;
    ctx.fillRect(far.x + 1, top, o.w - 2, bottom - top);
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba("255,255,255", 0.5 * k);
    ctx.fillRect(far.x + o.w / 2 - 1, top, 2, bottom - top);
  }

  function dashSpeedLines(ctx, trail, o) {
    const light = mixRgb(o.rgb, "255,255,255", 0.5);
    ctx.lineWidth = 1.5;
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      for (let j = 0; j < 4; j++) {
        const lx = tr.x + o.w * (0.15 + j * 0.23) + (hash(i * 3 + j) - 0.5) * 4;
        const len = o.h * (0.5 + hash(j + i * 7) * 0.9);
        const ly = tr.y + (o.h - len) / 2;
        ctx.strokeStyle = rgba(j % 2 ? light : o.rgb, 0.7 * a);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + len); ctx.stroke();
      }
    });
  }

  function dashGhostClones(ctx, trail, o) {
    ctx.lineWidth = 1.5;
    trail.forEach((tr) => {
      const a = Math.max(0, tr.life / 16);
      ctx.strokeStyle = rgba("255,60,100", 0.6 * a);
      ctx.strokeRect(tr.x - 3, tr.y, o.w, o.h);
      ctx.strokeStyle = rgba("60,220,255", 0.6 * a);
      ctx.strokeRect(tr.x + 3, tr.y, o.w, o.h);
      ctx.strokeStyle = rgba(o.rgb, 0.9 * a);
      ctx.strokeRect(tr.x, tr.y, o.w, o.h);
      ctx.fillStyle = rgba(o.rgb, 0.12 * a);
      ctx.fillRect(tr.x, tr.y, o.w, o.h);
    });
  }

  function dashPixelScatter(ctx, trail, o) {
    const cell = 4;
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      const spread = (1 - a) * 22;
      for (let cy = 0; cy < o.h; cy += cell) {
        for (let cx = 0; cx < o.w; cx += cell) {
          const n = hash(cx * 0.7 + cy * 1.3 + i * 17.1);
          if (n > a) continue;
          const ang = n * Math.PI * 2;
          ctx.fillStyle = rgba(n > 0.5 ? o.rgb : mixRgb(o.rgb, "255,255,255", 0.5), 0.75 * a);
          ctx.fillRect(tr.x + cx + Math.cos(ang) * spread, tr.y + cy + Math.sin(ang) * spread, cell - 1, cell - 1);
        }
      }
    });
  }

  function dashAfterburn(ctx, trail, o) {
    ctx.globalCompositeOperation = "lighter";
    trail.forEach((tr, i) => {
      const a = Math.max(0, tr.life / 16);
      const cx = tr.x + o.w / 2;
      const cy = tr.y + o.h / 2;
      const flick = 0.85 + hash(i + Math.floor(o.t * 30)) * 0.3;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.h * 0.7 * flick);
      g.addColorStop(0, rgba("255,240,200", 0.55 * a));
      g.addColorStop(0.35, rgba("255,140,40", 0.45 * a));
      g.addColorStop(1, rgba(o.rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, o.w * 1.2, o.h * 0.65 * flick, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
  }

  const DASH_RENDERERS = {
    default: dashDefault, smear: dashSmear, speedlines: dashSpeedLines, ghostclones: dashGhostClones,
    pixelscatter: dashPixelScatter, afterburn: dashAfterburn
  };

  function drawDash(ctx, id, trail, o) {
    if (!trail || !trail.length) return;
    const opts = Object.assign({ w: 22, h: 140, rgb: "0,217,255", heat: 0, t: 0, curY: trail[0].y, quality: 1 }, o || {});
    ctx.save();
    (DASH_RENDERERS[id] || dashDefault)(ctx, trail, opts);
    ctx.restore();
  }

  // ═══ One-shot effects: hits, scores, teleports ═══════════════════════════
  // Each effect is drawn from its age alone (k = 0 → 1 over its life), so it
  // needs no per-frame state and plays the same in the game and the Store.
  //   hit:      x,y = contact point, o.dir = +1 moving right / −1 moving left
  //   score:    x,y = where the ball left, o.dir points back into the court
  //   teleport: x,y = where the ball vanished, o.to = where it reappeared

  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const GLYPHS = "01<>/#{}[]$%&";

  function burstDirs(e, count, spread, seedOff = 0) {
    const base = (e.o.dir || 1) > 0 ? 0 : Math.PI;
    const out = [];
    for (let j = 0; j < count; j++) {
      const s = e.seed + j * 7.13 + seedOff;
      out.push({ ang: base + (hash(s) - 0.5) * spread, spd: hash(s + 1.1), size: hash(s + 2.2), s });
    }
    return out;
  }

  const FX = {
    hit: {
      shockring: { life: 0.45, draw(ctx, e, k) {
        const rgb = e.o.rgb, r = e.o.r || 10;
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.strokeStyle = rgba(rgb, 1 - k);
        ctx.beginPath(); ctx.arc(e.x, e.y, r * (1 + ease(k) * 4.5), 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rgba("255,255,255", (1 - k) * 0.8);
        ctx.beginPath(); ctx.arc(e.x, e.y, r * (1 + ease(k) * 2.4), 0, Math.PI * 2); ctx.stroke();
      } },
      shards: { life: 0.6, draw(ctx, e, k, age) {
        burstDirs(e, 11, Math.PI * 1.2).forEach((d, j) => {
          const dist = (120 + d.spd * 260) * age;
          const px = e.x + Math.cos(d.ang) * dist;
          const py = e.y + Math.sin(d.ang) * dist + 160 * age * age;
          const sz = 4 + d.size * 6;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(age * (8 + d.spd * 10) * (j % 2 ? 1 : -1));
          ctx.fillStyle = rgba(j % 3 ? e.o.rgb : "255,255,255", 1 - k);
          ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.6, sz * 0.7); ctx.lineTo(-sz * 0.5, sz * 0.4); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
      } },
      pixelpop: { life: 0.7, draw(ctx, e, k, age) {
        burstDirs(e, 16, Math.PI * 1.4).forEach((d, j) => {
          const v = 120 + d.spd * 240;
          const px = e.x + Math.cos(d.ang) * v * age;
          const py = e.y + Math.sin(d.ang) * v * age + 420 * age * age;
          const sz = Math.round(3 + d.size * 4);
          ctx.fillStyle = rgba(j % 2 ? e.o.rgb : mixRgb(e.o.rgb, "255,255,255", 0.6), 1 - k * k);
          ctx.fillRect(Math.round(px / 2) * 2, Math.round(py / 2) * 2, sz, sz);
        });
      } },
      glyphs: { life: 0.8, draw(ctx, e, k, age) {
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        burstDirs(e, 9, Math.PI * 1.1).forEach((d) => {
          const v = 60 + d.spd * 120;
          ctx.fillStyle = rgba(d.size > 0.5 ? e.o.rgb : "255,255,255", 1 - k);
          ctx.fillText(GLYPHS[Math.floor(d.size * GLYPHS.length)], e.x + Math.cos(d.ang) * v * age, e.y + Math.sin(d.ang) * v * age - 40 * age);
        });
      } },
      arcflash: { life: 0.35, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 6);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * (1 - k)})`);
        g.addColorStop(0.3, rgba(e.o.rgb, 0.5 * (1 - k)));
        g.addColorStop(1, rgba(e.o.rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 6, 0, Math.PI * 2); ctx.fill();
        const tick = Math.floor(k * 12);
        ctx.strokeStyle = rgba("255,255,255", 1 - k);
        ctx.shadowColor = rgba(e.o.rgb, 1);
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.5;
        burstDirs(e, 5, Math.PI * 1.3).forEach((d) => {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          let px = e.x, py = e.y;
          const len = r * (3 + d.spd * 4);
          for (let s = 1; s <= 4; s++) {
            px = e.x + Math.cos(d.ang) * len * s / 4 + (hash(d.s + s + tick) - 0.5) * r * 1.6;
            py = e.y + Math.sin(d.ang) * len * s / 4 + (hash(d.s + s * 2 + tick) - 0.5) * r * 1.6;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        });
      } }
    },

    score: {
      shockwave: { life: 0.9, draw(ctx, e, k) {
        const R = (e.o.h || 600) * 0.75 * ease(k);
        ctx.lineWidth = 8 * (1 - k) + 1;
        ctx.strokeStyle = rgba(e.o.rgb, 0.9 * (1 - k));
        ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.strokeStyle = rgba("255,255,255", 0.8 * (1 - k));
        ctx.beginPath(); ctx.arc(e.x, e.y, R * 0.7, 0, Math.PI * 2); ctx.stroke();
      } },
      pixelburst: { life: 1.0, draw(ctx, e, k, age) {
        burstDirs(e, 46, Math.PI * 1.05).forEach((d, j) => {
          const v = 180 + d.spd * 520;
          const px = e.x + Math.cos(d.ang) * v * age;
          const py = e.y + Math.sin(d.ang) * v * age + 300 * age * age;
          const sz = Math.round(4 + d.size * 6);
          ctx.fillStyle = rgba(j % 3 === 0 ? "255,255,255" : e.o.rgb, 1 - k);
          ctx.fillRect(Math.round(px / 3) * 3, Math.round(py / 3) * 3, sz, sz);
        });
      } },
      binaryspill: { life: 1.4, draw(ctx, e, k, age) {
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        burstDirs(e, 30, Math.PI * 0.9).forEach((d) => {
          const v = 80 + d.spd * 260;
          const delay = d.size * 0.3;
          const a = Math.max(0, age - delay);
          if (a <= 0) return;
          const px = e.x + Math.cos(d.ang) * v * a;
          const py = e.y + Math.sin(d.ang) * v * a + 260 * a * a;
          ctx.fillStyle = rgba(d.spd > 0.5 ? e.o.rgb : "160,255,190", 1 - k);
          ctx.fillText(d.size > 0.5 ? "1" : "0", px, py);
        });
      } },
      fireworks: { life: 1.6, draw(ctx, e, k, age) {
        const dir = e.o.dir || 1;
        const cols = [e.o.rgb, "255,210,102", "255,255,255"];
        for (let rk = 0; rk < 3; rk++) {
          const s = e.seed + rk * 31.7;
          const tx = e.x + dir * (90 + hash(s) * 220);
          const ty = e.y - 80 - hash(s + 1) * 180;
          const launch = 0.45 + rk * 0.12;
          if (age < launch) {
            const q = ease(age / launch);
            const q0 = ease(Math.max(0, age - 0.06) / launch);
            ctx.strokeStyle = rgba("255,240,200", 0.95);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(e.x + (tx - e.x) * q0, e.y + (ty - e.y) * q0);
            ctx.lineTo(e.x + (tx - e.x) * q, e.y + (ty - e.y) * q);
            ctx.stroke();
            continue;
          }
          const b = age - launch;
          const life = 1.6 - launch;
          const fade = Math.max(0, 1 - b / life);
          if (b < 0.08) {
            ctx.fillStyle = rgba("255,255,255", 0.8 * (1 - b / 0.08));
            ctx.beginPath(); ctx.arc(tx, ty, 26, 0, Math.PI * 2); ctx.fill();
          }
          for (let j = 0; j < 26; j++) {
            const ang = (j / 26) * Math.PI * 2 + hash(s + j) * 0.3;
            const v = 110 + hash(s + j * 3) * 90;
            ctx.fillStyle = rgba(cols[(j + rk) % 3], fade);
            ctx.fillRect(tx + Math.cos(ang) * v * b - 2.5, ty + Math.sin(ang) * v * b + 70 * b * b - 2.5, 5, 5);
          }
        }
      } },
      signalloss: { life: 0.75, draw(ctx, e, k) {
        const W = e.o.w || 1000, H = e.o.h || 600;
        const tick = Math.floor(k * 18);
        const a = Math.sin(Math.PI * Math.min(1, k * 1.2));
        for (let i = 0; i < 14; i++) {
          const s = e.seed + i * 5.3 + tick * 0.71;
          const by = hash(s) * H;
          const bh = 4 + hash(s + 1) * 26;
          const off = (hash(s + 2) - 0.5) * W * 0.25;
          ctx.fillStyle = i % 3 === 0 ? rgba("255,255,255", 0.35 * a) : i % 3 === 1 ? rgba(e.o.rgb, 0.4 * a) : `rgba(0,0,0,${0.55 * a})`;
          ctx.fillRect(off, by, W, bh);
        }
        ctx.fillStyle = rgba("255,255,255", 0.12 * a);
        for (let y = (tick * 7) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 1);
      } }
    },

    teleport: {
      pixelate: { life: 0.5, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const cell = Math.max(3, r * 0.5);
        const to = e.o.to || e;
        for (let gy = -2; gy < 2; gy++) {
          for (let gx = -2; gx < 2; gx++) {
            const n = hash(e.seed + gx * 3.1 + gy * 7.7);
            const ang = n * Math.PI * 2;
            const out = ease(k) * r * 3;
            ctx.fillStyle = rgba(e.o.rgb, 1 - k);
            ctx.fillRect(e.x + gx * cell + Math.cos(ang) * out, e.y + gy * cell + Math.sin(ang) * out, cell - 1, cell - 1);
            const inn = (1 - ease(k)) * r * 3;
            ctx.fillStyle = rgba(e.o.rgb, Math.min(1, k * 2) * (1 - k * 0.5));
            ctx.fillRect(to.x + gx * cell + Math.cos(ang) * inn, to.y + gy * cell + Math.sin(ang) * inn, cell - 1, cell - 1);
          }
        }
      } },
      staticburst: { life: 0.45, draw(ctx, e, k) {
        const r = (e.o.r || 10) * 3.2;
        const tick = Math.floor(k * 20);
        [e, e.o.to || e].forEach((p, w) => {
          for (let j = 0; j < 40; j++) {
            const s = e.seed + j * 2.7 + tick * 13.3 + w * 99;
            if (hash(s) < k) continue;
            const ang = hash(s + 1) * Math.PI * 2;
            const d = Math.sqrt(hash(s + 2)) * r;
            const g = Math.round(150 + hash(s + 3) * 105);
            ctx.fillStyle = j % 4 === 0 ? rgba(e.o.rgb, 0.9) : `rgba(${g},${g},${g},0.85)`;
            ctx.fillRect(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, 3, 3);
          }
        });
      } },
      portal: { life: 0.7, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const open = Math.sin(Math.PI * k);
        [e, e.o.to || e].forEach((p) => {
          for (let ring = 0; ring < 3; ring++) {
            ctx.strokeStyle = rgba(ring === 1 ? "255,255,255" : e.o.rgb, 0.9 * open);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * (0.9 + ring * 0.35) * open, r * (2.1 + ring * 0.5) * open, k * 6 + ring, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      } },
      beam: { life: 0.6, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const H = e.o.h || 600;
        const a = Math.sin(Math.PI * k);
        [e, e.o.to || e].forEach((p) => {
          const g = ctx.createLinearGradient(p.x - r * 1.4, 0, p.x + r * 1.4, 0);
          g.addColorStop(0, rgba(e.o.rgb, 0));
          g.addColorStop(0.5, rgba(mixRgb(e.o.rgb, "255,255,255", 0.6), 0.65 * a));
          g.addColorStop(1, rgba(e.o.rgb, 0));
          ctx.fillStyle = g;
          ctx.fillRect(p.x - r * 1.4, 0, r * 2.8, H);
          for (let j = 0; j < 10; j++) {
            const sy = (hash(e.seed + j) * H + k * 400 * (j % 2 ? 1 : -1) + H) % H;
            ctx.fillStyle = rgba("255,255,255", 0.9 * a);
            ctx.fillRect(p.x + (hash(e.seed + j * 3) - 0.5) * r * 2, sy, 2, 2);
          }
        });
      } },
      datashred: { life: 0.6, draw(ctx, e, k) {
        const r = e.o.r || 10;
        const to = e.o.to || e;
        // shredded strips where it left
        for (let i = 0; i < 6; i++) {
          const off = (hash(e.seed + i) - 0.5) * r * 6 * k;
          ctx.fillStyle = rgba(i % 2 ? e.o.rgb : "255,255,255", 1 - k);
          ctx.fillRect(e.x - r + off, e.y - r + i * (r / 3), r * 2, Math.max(1, r / 4));
        }
        // packets streaming along the jump
        for (let j = 0; j < 9; j++) {
          const q = Math.min(1, Math.max(0, k * 1.6 - j * 0.07));
          if (q <= 0 || q >= 1) continue;
          const px = e.x + (to.x - e.x) * q;
          const py = e.y + (to.y - e.y) * q + Math.sin(q * Math.PI * 3 + j) * r * 0.6;
          ctx.fillStyle = rgba(j % 3 ? e.o.rgb : "255,255,255", 0.9);
          ctx.fillRect(px - 3, py - 2, 6, 4);
        }
      } }
    }
  };

  function createFX() {
    const list = [];
    return {
      spawn(slot, id, x, y, o) {
        const def = FX[slot] && FX[slot][id];
        if (!def) return false;
        list.push({ def, x, y, o: Object.assign({ rgb: "255,255,255", r: 10, dir: 1 }, o || {}), age: 0, seed: Math.random() * 1000 });
        if (list.length > 48) list.shift();
        return true;
      },
      draw(ctx, dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const e = list[i];
          e.age += dt;
          if (e.age >= e.def.life) { list.splice(i, 1); continue; }
          ctx.save();
          try { e.def.draw(ctx, e, e.age / e.def.life, e.age); } finally { ctx.restore(); }
        }
      },
      clear() { list.length = 0; },
      get count() { return list.length; }
    };
  }

  load();

  return {
    RARITY, ARENA_NAMES, SLOTS, SLOT_INFO, CATALOG,
    PADDLE_SKINS, BALL_TRAILS, BALL_SKINS, HIT_EFFECTS, SCORE_EFFECTS, DASH_EFFECTS, TELEPORT_EFFECTS,
    find, progressFor, isUnlocked, syncUnlocks,
    getEquipped, equip, isNew, markSeen, countNew,
    drawPaddleSkin, drawBallTrail, drawBallSkin, drawDash, createFX,
    load, save
  };
})();

if (typeof window !== "undefined") window.GlitchCosmetics = GlitchCosmetics;
