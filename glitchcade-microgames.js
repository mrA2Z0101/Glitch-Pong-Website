// ═══════════════════════════════════════════════════════════════════════════
// ROM FRAGMENTS — the 30-second microgames a repaired cabinet runs until its
// real game ships. Each is a scrap of the game named on the marquee: one idea,
// one screen, arrow keys and a single button.
//
// A fragment is { hint, init(g), update(s, dt, inp, g), draw(s, ctx, g) }.
//   g.W / g.H      the 320×240 screen
//   g.add(n)       change the score (never drops below zero)
//   g.blip(kind)   'good' | 'bad' | 'tick' | 'fire'
//   g.rand()       random 0–1
//   g.t            seconds played
//   inp            held: left right up down a · pressed this frame: pl pr pu pd pa
// ═══════════════════════════════════════════════════════════════════════════
import { FRAGMENT_SECONDS, cleanInitials } from './glitchcade-state.js?v=floor-2';

const W = 320, H = 240;
const COL = { cyan: '#71efff', pink: '#ff58d9', purple: '#9a5dff', amber: '#ffd27a', green: '#50fa7b', red: '#ff4d6d', text: '#eef7ff', dim: '#5a4a8a' };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function box(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ── 06 SIGNAL LOST: gather signal packets while the static closes in ──
const signalLost = {
  hint: 'MOVE: ARROWS — COLLECT THE SIGNAL, AVOID THE STATIC',
  init(g) {
    const s = { x: W / 2, y: H / 2, packets: [], blobs: [], stun: 0 };
    for (let i = 0; i < 3; i++) s.packets.push({ x: 30 + g.rand() * (W - 60), y: 40 + g.rand() * (H - 70) });
    s.blobs.push({ x: 20, y: 40 }, { x: W - 20, y: H - 20 });
    return s;
  },
  update(s, dt, inp, g) {
    s.stun = Math.max(0, s.stun - dt);
    const sp = s.stun > 0 ? 40 : 115;
    s.x = clamp(s.x + ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * sp * dt, 8, W - 8);
    s.y = clamp(s.y + ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * sp * dt, 34, H - 8);
    s.packets.forEach((p) => {
      if (Math.hypot(p.x - s.x, p.y - s.y) < 11) {
        g.add(1); g.blip('good');
        p.x = 20 + g.rand() * (W - 40); p.y = 40 + g.rand() * (H - 60);
      }
    });
    const chase = 42 + g.t * 1.6;
    s.blobs.forEach((b) => {
      const d = Math.hypot(s.x - b.x, s.y - b.y) || 1;
      b.x += ((s.x - b.x) / d) * chase * dt;
      b.y += ((s.y - b.y) / d) * chase * dt;
      if (d < 13 && s.stun <= 0) {
        g.add(-1); g.blip('bad'); s.stun = 0.8;
        b.x = g.rand() < 0.5 ? 10 : W - 10; b.y = 40 + g.rand() * (H - 60);
      }
    });
  },
  draw(s, ctx, g) {
    s.packets.forEach((p) => {
      box(ctx, p.x - 4, p.y - 4, 8, 8, COL.green);
      box(ctx, p.x - 1, p.y - 7, 2, 14, 'rgba(80,250,123,.5)');
    });
    s.blobs.forEach((b) => {
      for (let i = 0; i < 14; i++) {
        const a = g.rand() * Math.PI * 2, r = g.rand() * 12;
        box(ctx, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 3, 3, g.rand() < 0.5 ? '#ffffff' : '#8a8a9a');
      }
    });
    box(ctx, s.x - 5, s.y - 5, 10, 10, s.stun > 0 && Math.floor(g.t * 20) % 2 ? COL.red : g.accent);
  }
};

// ── 04 FIREWALL: block the red packets, let the green ones through ──
const firewall = {
  hint: 'MOVE: ◀ ▶ — BLOCK RED PACKETS, LET GREEN ONES PASS',
  init() { return { col: 2, packets: [], next: 0.4, flash: 0 }; },
  update(s, dt, inp, g) {
    const cw = W / 5;
    if (inp.pl) s.col = Math.max(0, s.col - 1);
    if (inp.pr) s.col = Math.min(4, s.col + 1);
    s.flash = Math.max(0, s.flash - dt);
    s.next -= dt;
    if (s.next <= 0) {
      s.next = Math.max(0.34, 0.6 - g.t * 0.008);
      s.packets.push({ col: Math.floor(g.rand() * 5), y: 30, bad: g.rand() < 0.6 });
    }
    const speed = 95 + g.t * 1.6;
    s.packets = s.packets.filter((p) => {
      p.y += speed * dt;
      if (p.y < H - 30) return true;
      const blocked = p.col === s.col;
      if (p.bad && blocked) { g.add(1); g.blip('good'); }
      else if (p.bad) { g.add(-1); g.blip('bad'); s.flash = 0.25; }
      else if (blocked) { g.add(-1); g.blip('bad'); s.flash = 0.25; }
      else g.blip('tick');
      return false;
    });
    s.cw = cw;
  },
  draw(s, ctx, g) {
    const cw = W / 5;
    for (let i = 1; i < 5; i++) box(ctx, i * cw, 28, 1, H - 28, 'rgba(154,93,255,.25)');
    s.packets.forEach((p) => box(ctx, p.col * cw + cw / 2 - 7, p.y - 7, 14, 14, p.bad ? COL.red : COL.green));
    box(ctx, s.col * cw + 4, H - 26, cw - 8, 8, s.flash > 0 ? COL.red : g.accent);
    box(ctx, 0, H - 12, W, 2, 'rgba(255,255,255,.2)');
  }
};

// ── 05 DEFRAG: steer each loose fragment into the bin of its own colour ──
const BIN_COLS = [COL.cyan, COL.pink, COL.amber];
const defrag = {
  hint: 'MOVE: ◀ ▶ · ▼ DROPS — SORT FRAGMENTS INTO MATCHING BINS',
  init(g) { return { piece: defragPiece(g), bins: [0, 0, 0], flash: 0 }; },
  update(s, dt, inp, g) {
    const p = s.piece;
    if (inp.pl) p.col = Math.max(0, p.col - 1);
    if (inp.pr) p.col = Math.min(2, p.col + 1);
    s.flash = Math.max(0, s.flash - dt);
    p.y += (inp.down ? 330 : 80 + g.t * 2.2) * dt;
    if (p.y >= H - 44) {
      if (p.kind === p.col) { g.add(1); g.blip('good'); s.bins[p.col]++; }
      else { g.add(-1); g.blip('bad'); s.flash = 0.25; }
      s.piece = defragPiece(g);
    }
  },
  draw(s, ctx, g) {
    const cw = W / 3;
    BIN_COLS.forEach((c, i) => {
      box(ctx, i * cw + 10, H - 40, cw - 20, 34, 'rgba(255,255,255,.06)');
      box(ctx, i * cw + 10, H - 8, cw - 20, 3, c);
      const fill = Math.min(6, s.bins[i] % 7);
      for (let k = 0; k < fill; k++) box(ctx, i * cw + 14 + k * 13, H - 22, 10, 10, c);
    });
    const p = s.piece;
    const jit = s.flash > 0 ? (g.rand() - 0.5) * 8 : 0;
    box(ctx, p.col * cw + cw / 2 - 12 + jit, p.y - 12, 24, 12, BIN_COLS[p.kind]);
    box(ctx, p.col * cw + cw / 2 - 12 + jit, p.y, 12, 6, BIN_COLS[p.kind]);
  }
};
function defragPiece(g) {
  return { col: Math.floor(g.rand() * 3), kind: Math.floor(g.rand() * 3), y: 34 };
}

// (BLACK-HOLE NEXUS was a fragment here until it became a whole game: cabinet
// 03, in nexus/. SIGNAL LOST runs on the cabinet it left, 06.)

// ── 07 STACK OVERFLOW: pop the marked frame before the stack hits the top ──
const stackOverflow = {
  hint: 'PRESS THE BUTTON WHEN THE POINTER IS ON THE GLOWING FRAME',
  init(g) { return { frames: 5, mark: Math.floor(g.rand() * 5), ptr: 0, dir: 1, flash: 0 }; },
  update(s, dt, inp, g) {
    s.flash = Math.max(0, s.flash - dt);
    s.ptr += s.dir * (5.5 + g.t * 0.14) * dt;
    if (s.ptr >= s.frames - 0.01) { s.ptr = s.frames - 0.01; s.dir = -1; }
    if (s.ptr <= 0) { s.ptr = 0; s.dir = 1; }
    if (inp.pa) {
      if (Math.floor(s.ptr) === s.mark) {
        g.add(1); g.blip('good');
        if (s.frames > 4) s.frames--;
      } else {
        g.blip('bad'); s.flash = 0.2; s.frames++;
      }
      if (s.frames > 9) { g.add(-3); s.frames = 5; s.flash = 0.6; }
      s.ptr = Math.min(s.ptr, s.frames - 0.01);
      s.mark = Math.floor(g.rand() * s.frames);
    }
  },
  draw(s, ctx, g) {
    const fh = 20, x = W / 2 - 70, base = H - 14;
    box(ctx, x - 6, base - 9 * fh - 4, 152, 2, s.frames > 7 ? COL.red : 'rgba(255,255,255,.25)');
    for (let i = 0; i < s.frames; i++) {
      const y = base - (i + 1) * fh;
      box(ctx, x, y + 2, 140, fh - 4, i === s.mark ? (Math.floor(g.t * 8) % 2 ? COL.amber : '#fff3c4') : COL.dim);
    }
    const py = base - (Math.floor(s.ptr) + 1) * fh;
    box(ctx, x - 26, py + 6, 20, 8, s.flash > 0 ? COL.red : g.accent);
    box(ctx, x + 146, py + 6, 20, 8, s.flash > 0 ? COL.red : g.accent);
  }
};

// ── 08 PACKET HOP: cross the router lanes, as many times as you can ──
const LANE_H = 26, LANES = 6;
const packetHop = {
  hint: 'HOP: ARROWS — CROSS THE LANES TO THE TOP',
  init(g) {
    const s = { col: 6, row: 0, lanes: [], dead: 0 };
    for (let i = 0; i < LANES; i++) {
      const dir = i % 2 ? 1 : -1, speed = 45 + g.rand() * 50, cars = [];
      const n = 2 + (i % 2);
      for (let k = 0; k < n; k++) cars.push({ x: (k / n) * (W + 60) + g.rand() * 30, w: 28 + g.rand() * 26 });
      s.lanes.push({ dir, speed, cars });
    }
    return s;
  },
  update(s, dt, inp, g) {
    s.dead = Math.max(0, s.dead - dt);
    s.lanes.forEach((l) => l.cars.forEach((c) => {
      c.x += l.dir * l.speed * (1 + g.t * 0.012) * dt;
      if (c.x > W + 40) c.x = -60;
      if (c.x < -60) c.x = W + 40;
    }));
    if (s.dead > 0) return;
    if (inp.pu) { s.row++; g.blip('tick'); }
    if (inp.pd) s.row = Math.max(0, s.row - 1);
    if (inp.pl) s.col = Math.max(0, s.col - 1);
    if (inp.pr) s.col = Math.min(12, s.col + 1);
    if (s.row > LANES) { g.add(1); g.blip('good'); s.row = 0; }
    if (s.row >= 1) {
      const px = s.col * 24 + 16;
      if (s.lanes[s.row - 1].cars.some((c) => px + 7 > c.x && px - 7 < c.x + c.w)) { g.blip('bad'); s.row = 0; s.dead = 0.35; }
    }
  },
  draw(s, ctx, g) {
    const base = H - 16;
    box(ctx, 0, base - LANE_H * (LANES + 1) - 2, W, LANE_H, 'rgba(80,250,123,.18)');
    s.lanes.forEach((l, i) => {
      const y = base - (i + 2) * LANE_H;
      box(ctx, 0, y + LANE_H - 1, W, 1, 'rgba(154,93,255,.3)');
      l.cars.forEach((c) => box(ctx, c.x, y + 5, c.w, LANE_H - 10, i % 2 ? COL.pink : COL.purple));
    });
    const py = base - (s.row + 1) * LANE_H;
    const blink = s.dead > 0 && Math.floor(g.t * 20) % 2;
    box(ctx, s.col * 24 + 9, py + 6, 14, 14, blink ? COL.red : g.accent);
  }
};

// ── 09 SWARM PROTOCOL: your gun fires by itself; keep it under the swarm ──
const swarm = {
  hint: 'MOVE: ◀ ▶ — THE GUN FIRES ITSELF. CLEAR THE SWARM',
  init() { return { x: W / 2, shots: [], drones: [], fire: 0, next: 0.3, hit: 0 }; },
  update(s, dt, inp, g) {
    s.x = clamp(s.x + ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 170 * dt, 10, W - 10);
    s.hit = Math.max(0, s.hit - dt);
    s.fire -= dt;
    if (s.fire <= 0) { s.fire = 0.2; s.shots.push({ x: s.x, y: H - 26 }); }
    s.next -= dt;
    if (s.next <= 0) {
      s.next = Math.max(0.3, 0.62 - g.t * 0.009);
      s.drones.push({ x0: 24 + g.rand() * (W - 48), y: 30, ph: g.rand() * 6.28, amp: 14 + g.rand() * 30 });
    }
    s.shots = s.shots.filter((b) => (b.y -= 260 * dt) > 26);
    s.drones = s.drones.filter((d) => {
      d.y += (36 + g.t * 0.9) * dt;
      d.x = d.x0 + Math.sin(d.ph + d.y * 0.06) * d.amp;
      const shot = s.shots.find((b) => Math.abs(b.x - d.x) < 9 && Math.abs(b.y - d.y) < 9);
      if (shot) { shot.y = -99; g.add(1); g.blip('good'); return false; }
      if (d.y > H - 22) { g.add(-1); g.blip('bad'); s.hit = 0.3; return false; }
      return true;
    });
  },
  draw(s, ctx, g) {
    s.shots.forEach((b) => box(ctx, b.x - 1, b.y - 4, 2, 8, COL.amber));
    s.drones.forEach((d) => {
      box(ctx, d.x - 7, d.y - 4, 14, 8, COL.pink);
      box(ctx, d.x - 3, d.y - 7, 6, 3, COL.purple);
    });
    box(ctx, s.x - 9, H - 20, 18, 7, s.hit > 0 ? COL.red : g.accent);
    box(ctx, s.x - 2, H - 26, 4, 6, g.accent);
  }
};

// ── 10 MISSILE DEFENSE.EXE: burst the threats before they reach the servers ──
const missileDefense = {
  hint: 'AIM: ARROWS · BUTTON FIRES — BURST THREATS ABOVE THE SERVERS',
  init() { return { cx: W / 2, cy: 120, threats: [], blasts: [], next: 0.5, cool: 0, hit: 0 }; },
  update(s, dt, inp, g) {
    s.cx = clamp(s.cx + ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 190 * dt, 8, W - 8);
    s.cy = clamp(s.cy + ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * 190 * dt, 36, H - 44);
    s.cool = Math.max(0, s.cool - dt);
    s.hit = Math.max(0, s.hit - dt);
    if (inp.pa && s.cool <= 0) { s.cool = 0.3; s.blasts.push({ x: s.cx, y: s.cy, t: 0 }); g.blip('fire'); }
    s.next -= dt;
    if (s.next <= 0) {
      s.next = Math.max(0.5, 1.0 - g.t * 0.015);
      const x0 = 10 + g.rand() * (W - 20), x1 = [60, 160, 260][Math.floor(g.rand() * 3)];
      s.threats.push({ x0, x1, k: 0, speed: 0.2 + g.rand() * 0.1 + g.t * 0.003 });
    }
    s.blasts = s.blasts.filter((b) => (b.t += dt) < 0.55);
    s.threats = s.threats.filter((th) => {
      th.k += th.speed * dt;
      th.x = th.x0 + (th.x1 - th.x0) * th.k;
      th.y = 30 + (H - 54) * th.k;
      if (s.blasts.some((b) => Math.hypot(b.x - th.x, b.y - th.y) < 8 + Math.sin((b.t / 0.55) * Math.PI) * 22)) { g.add(1); g.blip('good'); return false; }
      if (th.k >= 1) { g.add(-1); g.blip('bad'); s.hit = 0.3; return false; }
      return true;
    });
  },
  draw(s, ctx, g) {
    [60, 160, 260].forEach((x) => {
      box(ctx, x - 14, H - 22, 28, 14, s.hit > 0 ? COL.red : COL.dim);
      box(ctx, x - 10, H - 18, 4, 3, COL.green);
    });
    s.threats.forEach((th) => {
      ctx.strokeStyle = 'rgba(255,77,109,.45)';
      ctx.beginPath(); ctx.moveTo(th.x0, 30); ctx.lineTo(th.x, th.y); ctx.stroke();
      box(ctx, th.x - 2, th.y - 2, 5, 5, COL.red);
    });
    s.blasts.forEach((b) => {
      ctx.strokeStyle = COL.amber;
      ctx.beginPath(); ctx.arc(b.x, b.y, 8 + Math.sin((b.t / 0.55) * Math.PI) * 22, 0, Math.PI * 2); ctx.stroke();
    });
    box(ctx, s.cx - 7, s.cy, 15, 1, g.accent);
    box(ctx, s.cx, s.cy - 7, 1, 15, g.accent);
  }
};

export const MICROGAMES = {
  'signal-lost': signalLost,
  firewall,
  defrag,
  'stack-overflow': stackOverflow,
  'packet-hop': packetHop,
  'swarm-protocol': swarm,
  'missile-defense': missileDefense
};

// Run a fragment headless for `seconds` with a scripted input, for tests:
// `pilot(s, g)` returns the input object for the next step.
export function simulateFragment(id, pilot, seconds = FRAGMENT_SECONDS, seed = 1) {
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = { W, H, t: 0, score: 0, accent: COL.cyan, rand, add(n) { g.score = Math.max(0, g.score + n); }, blip() {} };
  const game = MICROGAMES[id];
  const s = game.init(g);
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    game.update(s, dt, Object.assign({ left: false, right: false, up: false, down: false, a: false, pl: false, pr: false, pu: false, pd: false, pa: false }, pilot(s, g) || {}), g);
    g.t += dt;
  }
  return { score: g.score, state: s };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PLAYER — a full-screen overlay with the cabinet's little screen in it
// ═══════════════════════════════════════════════════════════════════════════
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'a', KeyE: 'a', Enter: 'a'
};

export function createFragmentPlayer({ audio, isTouch, reducedMotion }) {
  const el = document.createElement('div');
  el.id = 'gcFragment';
  el.innerHTML = `
    <div class="gf-frame">
      <div class="gf-head"><b id="gfTitle"></b><span id="gfSub">ROM FRAGMENT</span></div>
      <canvas id="gfCanvas" width="${W}" height="${H}" aria-label="ROM fragment"></canvas>
      <div class="gf-pad" aria-hidden="true">
        <div class="gf-dpad">
          <button type="button" data-k="up">▲</button>
          <button type="button" data-k="left">◀</button>
          <button type="button" data-k="right">▶</button>
          <button type="button" data-k="down">▼</button>
        </div>
        <button type="button" class="gf-a" data-k="a">A</button>
      </div>
      <div class="gf-foot"><span id="gfHint"></span><button type="button" id="gfQuit">QUIT</button></div>
    </div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('#gfCanvas');
  const ctx = cv.getContext('2d');
  const held = { left: false, right: false, up: false, down: false, a: false };
  const pressed = { left: false, right: false, up: false, down: false, a: false };
  let run = null;       // { def, game, s, g, phase, t, opts, result, initials, slot }
  let raf = 0;
  let last = 0;

  function setKey(k, down) {
    if (!run) return;
    if (down && !held[k]) pressed[k] = true;
    held[k] = down;
  }
  el.querySelectorAll('[data-k]').forEach((btn) => {
    const k = btn.dataset.k;
    const on = (e) => { e.preventDefault(); setKey(k, true); };
    const off = (e) => { e.preventDefault(); setKey(k, false); };
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off, { passive: false });
    btn.addEventListener('touchcancel', off, { passive: false });
    btn.addEventListener('mousedown', on);
    btn.addEventListener('mouseup', off);
    btn.addEventListener('mouseleave', off);
  });
  el.querySelector('#gfQuit').addEventListener('click', () => quit());

  function blip(kind) {
    if (!audio || !audio.ready) return;
    if (kind === 'good') audio.tone({ type: 'square', from: 660, to: 990, dur: 0.07, volume: 0.05 });
    else if (kind === 'bad') audio.tone({ type: 'sawtooth', from: 180, to: 70, dur: 0.16, volume: 0.07 });
    else if (kind === 'fire') audio.tone({ type: 'square', from: 520, to: 160, dur: 0.09, volume: 0.04 });
    else audio.tone({ type: 'square', from: 440, to: 440, dur: 0.03, volume: 0.025 });
  }

  function text(str, x, y, size, col, align = 'center') {
    ctx.font = `${size}px VT323, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(str, x, y);
  }

  function chrome() {
    const r = run;
    box(ctx, 0, 0, W, 26, 'rgba(0,0,0,.55)');
    text(`SCORE ${r.g.score}`, 6, 13, 18, COL.text, 'left');
    const left = Math.max(0, FRAGMENT_SECONDS - r.g.t);
    text(`${Math.ceil(left)}`, W - 6, 13, 18, left < 6 ? COL.red : COL.amber, 'right');
    box(ctx, 80, 10, 160, 6, 'rgba(255,255,255,.12)');
    box(ctx, 80, 10, 160 * (left / FRAGMENT_SECONDS), 6, left < 6 ? COL.red : r.def.accent);
  }

  function corrupt(amount) {
    if (reducedMotion) return;
    for (let i = 0; i < amount; i++) {
      const y = Math.floor(Math.random() * H), h = 2 + Math.floor(Math.random() * 10);
      ctx.drawImage(cv, 0, y, W, h, (Math.random() - 0.5) * 30, y, W, h);
    }
  }

  function scan() {
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  function draw() {
    const r = run;
    box(ctx, 0, 0, W, H, '#05040c');
    if (r.phase === 'intro') {
      text(`CABINET ${String(r.def.slot).padStart(2, '0')}`, W / 2, 62, 20, COL.amber);
      text(r.def.title, W / 2, 92, r.def.title.length > 14 ? 28 : 36, r.def.accent);
      text('ROM FRAGMENT RECOVERED', W / 2, 122, 18, COL.text);
      text(`${FRAGMENT_SECONDS} SECONDS · BEST ${r.opts.best || 0}`, W / 2, 148, 18, COL.dim);
      if (Math.floor(r.t * 2.5) % 2) text(isTouch ? 'TAP A TO START' : 'PRESS E TO START', W / 2, 196, 22, COL.green);
      if (Math.random() < 0.15) corrupt(2);
    } else if (r.phase === 'play') {
      r.game.draw(r.s, ctx, r.g);
      chrome();
      if (r.glitch > 0) corrupt(3);
    } else if (r.phase === 'initials') {
      text('NEW HIGH SCORE', W / 2, 50, 30, COL.amber);
      text(`${r.g.score}`, W / 2, 84, 34, COL.text);
      text('ENTER YOUR INITIALS', W / 2, 118, 18, COL.dim);
      for (let i = 0; i < 3; i++) {
        const x = W / 2 - 44 + i * 44;
        text(r.initials[i], x, 156, 44, i === r.slot ? r.def.accent : COL.text);
        if (i === r.slot && Math.floor(r.t * 3) % 2) box(ctx, x - 12, 178, 24, 3, r.def.accent);
      }
      text(isTouch ? '▲▼ LETTER · ◀▶ MOVE · A OK' : 'TYPE, OR ARROWS · ENTER TO CONFIRM', W / 2, 212, 16, COL.dim);
    } else {
      const res = r.result;
      text('FRAGMENT ENDS', W / 2, 30, 24, COL.pink);
      text(`SCORE ${r.g.score}`, W / 2, 56, 26, COL.text);
      const pay = res.coins > 0 ? `+${res.coins} COIN${res.coins > 1 ? 'S' : ''}` : res.capped ? 'DAILY PAYOUT REACHED' : 'NO PAYOUT';
      text(pay, W / 2, 80, 20, res.coins > 0 ? COL.amber : COL.dim);
      res.board.forEach((e, i) => {
        const mine = i === res.rank;
        text(`${i + 1}. ${e.n}`, W / 2 - 60, 110 + i * 18, 18, mine ? r.def.accent : e.house ? COL.dim : COL.text, 'left');
        text(`${e.s}`, W / 2 + 60, 110 + i * 18, 18, mine ? r.def.accent : e.house ? COL.dim : COL.text, 'right');
      });
      if (r.t > 0.6 && Math.floor(r.t * 2.5) % 2) text(isTouch ? 'TAP A TO LEAVE' : 'PRESS E TO LEAVE', W / 2, 220, 20, COL.green);
    }
    scan();
  }

  function finishPlay() {
    const r = run;
    r.result = r.opts.onScore(r.g.score);
    r.t = 0;
    if (r.result.rank >= 0) {
      r.phase = 'initials';
      r.initials = cleanInitials(r.opts.initials || 'AAA').split('');
      r.slot = 0;
    } else {
      r.phase = 'over';
    }
    if (audio && audio.ready) audio.tone({ type: 'square', from: 880, to: 220, dur: 0.4, volume: 0.05 });
  }

  function confirmInitials() {
    const r = run;
    const name = r.initials.join('');
    r.result = r.opts.onInitials(name, r.result);
    r.phase = 'over';
    r.t = 0;
    blip('good');
  }

  function step(dt) {
    const r = run;
    r.t += dt;
    const inp = {
      left: held.left, right: held.right, up: held.up, down: held.down, a: held.a,
      pl: pressed.left, pr: pressed.right, pu: pressed.up, pd: pressed.down, pa: pressed.a
    };
    Object.keys(pressed).forEach((k) => { pressed[k] = false; });
    if (r.phase === 'intro') {
      if (inp.pa || r.t > 6) { r.phase = 'play'; r.t = 0; blip('good'); }
    } else if (r.phase === 'play') {
      const before = r.g.score;
      r.game.update(r.s, dt, inp, r.g);
      r.g.t += dt;
      r.glitch = Math.max(0, (r.glitch || 0) - dt);
      if (r.g.score < before) r.glitch = 0.18;
      if (r.g.t >= FRAGMENT_SECONDS) finishPlay();
    } else if (r.phase === 'initials') {
      const A = 65;
      const bump = (d) => {
        const c = r.initials[r.slot].charCodeAt(0);
        const idx = c >= A ? c - A : 26 + (c - 48);          // A–Z then 0–9
        const n = (idx + d + 36) % 36;
        r.initials[r.slot] = n < 26 ? String.fromCharCode(A + n) : String.fromCharCode(48 + n - 26);
        blip('tick');
      };
      if (inp.pu) bump(1);
      if (inp.pd) bump(-1);
      if (inp.pl) r.slot = Math.max(0, r.slot - 1);
      if (inp.pr) r.slot = Math.min(2, r.slot + 1);
      if (inp.pa) confirmInitials();
    } else if (inp.pa && r.t > 0.6) {
      quit();
    }
  }

  function loop(now) {
    if (!run) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    if (run) draw();
  }

  function quit() {
    if (!run) return;
    const r = run;
    // leaving mid-game still banks the score so far
    if (r.phase === 'play' && r.g.score > 0) r.result = r.opts.onScore(r.g.score);
    if (r.phase === 'initials') r.opts.onInitials(r.initials.join(''), r.result);
    run = null;
    cancelAnimationFrame(raf);
    el.classList.remove('on');
    Object.keys(held).forEach((k) => { held[k] = false; pressed[k] = false; });
    r.opts.onClose();
  }

  return {
    get active() { return !!run; },
    // def: { id, title, slot, accent }, opts: { best, initials, onScore, onInitials, onClose }
    open(def, opts) {
      const game = MICROGAMES[def.id];
      if (!game) { opts.onClose(); return; }
      const g = { W, H, t: 0, score: 0, accent: def.accent, rand: Math.random, add(n) { g.score = Math.max(0, g.score + n); }, blip };
      run = { def, game, g, s: game.init(g), phase: 'intro', t: 0, opts, result: null };
      el.querySelector('#gfTitle').textContent = `CABINET ${String(def.slot).padStart(2, '0')} // ${def.title}`;
      el.querySelector('#gfHint').textContent = game.hint;
      el.classList.add('on');
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    quit,
    // Keyboard, routed here by the arcade while a fragment is open.
    key(e, down) {
      if (!run) return;
      if (down && e.code === 'Escape') { e.preventDefault(); quit(); return; }
      if (down && run.phase === 'initials' && /^Key[A-Z]$|^Digit[0-9]$/.test(e.code) && !e.repeat) {
        // typing goes straight into the current slot (A–D/W/S/E included)
        run.initials[run.slot] = e.code.slice(-1);
        if (run.slot < 2) run.slot++;
        blip('tick');
        e.preventDefault();
        return;
      }
      if (down && run.phase === 'initials' && e.code === 'Backspace') { run.slot = Math.max(0, run.slot - 1); e.preventDefault(); return; }
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      if (run.phase === 'initials' && e.code.startsWith('Key')) return;
      if (down && e.repeat) return;
      setKey(k, down);
    },
    // test hooks
    get phase() { return run ? run.phase : null; },
    get score() { return run ? run.g.score : 0; },
    debugFinish(score) { if (run && run.phase !== 'over') { run.g.score = score; run.phase = 'play'; finishPlay(); } }
  };
}
