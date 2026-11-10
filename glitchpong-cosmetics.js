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
  const SLOTS = ["paddle", "trail"];

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

  // unlock.type: free | level | arenaWins | boss
  const PADDLE_SKINS = [
    { id: "default",      name: "NEON CORE",     rarity: "common",    unlock: { type: "free" },
      desc: "Factory-issue paddle. Clean, bright, reliable." },
    { id: "scanline",     name: "SCANLINE",      rarity: "common",    unlock: { type: "level", level: 3 },
      desc: "CRT scanlines roll down the paddle like an old arcade monitor." },
    { id: "rgbsplit",     name: "RGB SPLIT",     rarity: "rare",      unlock: { type: "level", level: 6 },
      desc: "Colour channels tear apart. The split widens as Heat climbs." },
    { id: "matrixrain",   name: "MATRIX RAIN",   rarity: "rare",      unlock: { type: "arenaWins", arena: "matrix", count: 1 },
      desc: "Falling code streams through the paddle." },
    { id: "wireframe",    name: "WIREFRAME",     rarity: "epic",      unlock: { type: "arenaWins", arena: "construct", count: 3 },
      desc: "A bare construct mesh with a scanning pulse and vertex nodes." },
    { id: "eventhorizon", name: "EVENT HORIZON", rarity: "legendary", unlock: { type: "arenaWins", arena: "blackhole", count: 5 },
      desc: "A light-swallowing core circled by a glowing accretion disk." }
  ];

  const BALL_TRAILS = [
    { id: "default",     name: "GHOST ECHO",     rarity: "common",    unlock: { type: "free" },
      desc: "The classic soft afterglow. Takes your colour as the ball charges." },
    { id: "pixeldust",   name: "PIXEL DUST",     rarity: "common",    unlock: { type: "level", level: 2 },
      desc: "Square pixels shed off the ball and drift away." },
    { id: "ghostframes", name: "GHOST FRAMES",   rarity: "common",    unlock: { type: "level", level: 4 },
      desc: "Stepped afterimages, like the ball is dropping frames." },
    { id: "datastream",  name: "DATA STREAM",    rarity: "rare",      unlock: { type: "level", level: 8 },
      desc: "The ball leaks a stream of binary and hex." },
    { id: "comet",       name: "COMET",          rarity: "rare",      unlock: { type: "level", level: 11 },
      desc: "A smooth tapered tail that stretches with speed." },
    { id: "glitchtear",  name: "GLITCH TEAR",    rarity: "epic",      unlock: { type: "level", level: 15 },
      desc: "Horizontal slices of the trail shear and tear apart." },
    { id: "heattrail",   name: "HEAT SIGNATURE", rarity: "legendary", unlock: { type: "boss", count: 1 },
      desc: "Starts in your colour, then burns orange and white-hot as Heat rises." }
  ];

  const CATALOG = { paddle: PADDLE_SKINS, trail: BALL_TRAILS };

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
    return { unlocked: true, current: 1, target: 1, label: "UNLOCKED BY DEFAULT" };
  }

  function find(slot, id) {
    return (CATALOG[slot] || []).find(item => item.id === id) || null;
  }

  function isUnlocked(slot, id, data) {
    const item = find(slot, id);
    return !!item && progressFor(item, data).unlocked;
  }

  // Records every unlocked item in the progression save and returns the ones
  // that were not recorded before, so the caller can announce them.
  function syncUnlocks(data) {
    if (!data) return [];
    if (!Array.isArray(data.cosmeticsUnlocked)) data.cosmeticsUnlocked = ["default"];
    const fresh = [];
    SLOTS.forEach(slot => {
      CATALOG[slot].forEach(item => {
        const key = `${slot}:${item.id}`;
        if (progressFor(item, data).unlocked && !data.cosmeticsUnlocked.includes(key)) {
          data.cosmeticsUnlocked.push(key);
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
        blue: { paddle: "default", trail: "default" },
        red:  { paddle: "default", trail: "default" }
      },
      seen: []
    };
  }

  let state = defaultState();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return;
      const next = defaultState();
      OWNERS.forEach(owner => {
        SLOTS.forEach(slot => {
          const id = parsed.equipped && parsed.equipped[owner] && parsed.equipped[owner][slot];
          if (typeof id === "string" && find(slot, id)) next.equipped[owner][slot] = id;
        });
      });
      if (Array.isArray(parsed.seen)) next.seen = parsed.seen.filter(k => typeof k === "string");
      state = next;
    } catch (e) {}
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
    return progressFor(item, data).unlocked && !state.seen.includes(`${slot}:${id}`);
  }

  function markSeen(slot, data) {
    let changed = false;
    CATALOG[slot].forEach(item => {
      const key = `${slot}:${item.id}`;
      if (progressFor(item, data).unlocked && !state.seen.includes(key)) {
        state.seen.push(key);
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

  load();

  return {
    RARITY, ARENA_NAMES, PADDLE_SKINS, BALL_TRAILS, CATALOG,
    find, progressFor, isUnlocked, syncUnlocks,
    getEquipped, equip, isNew, markSeen, countNew,
    drawPaddleSkin, drawBallTrail,
    load, save
  };
})();

if (typeof window !== "undefined") window.GlitchCosmetics = GlitchCosmetics;
