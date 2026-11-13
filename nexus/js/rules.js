// ═══════════════════════════════════════════════════════════════════════════
// BLACK-HOLE NEXUS — rules
//
// The whole game as numbers: the orbit, what is on the rings, scoring, Heat,
// each sector's rule, THE EYE, the save record. Nothing here touches the page
// or the canvas, so tests/nexus-rules.test.mjs plays it under Node with the
// same bot that runs the attract mode behind the menu. js/game.js draws what
// this file decides.
//
// Distances are in pixels at the game's design size, angles in radians, time
// in seconds. The ball always orbits in the direction of increasing angle.
// ═══════════════════════════════════════════════════════════════════════════

export const TAU = Math.PI * 2;

export const TUNE = {
  R_OUT: 290,          // the edge of the screen: as far out as the ball can go
  R_HOLE: 44,          // the horizon, before Heat and MEMORY LEAK widen it
  BALL_R: 7,
  BAND_MID: 210,       // inside this radius a bit is worth x2
  BAND_IN: 130,        // inside this one, x3
  // the ball: hold to climb, let go to fall
  G0: 150,             // the hole's pull at the edge of the screen (px/s²)
  G_K: 1.3,            // ...and how much stronger it is at the horizon (x 1 + G_K)
  THRUST: 520,
  DAMP: 2.3,           // radial drag: falling and climbing both settle to a steady speed
  W_EDGE: 0.55,        // orbit speed at the edge (rad/s)
  W_EXP: 1.3,          // lower orbits are faster by (R_OUT / r) ^ W_EXP
  START_R: 235,
  BALLS: 3,
  INTRO: 3.2,          // the 3-2-1-GO before a sector
  CLEAR: 2.4,          // the pause after one
  RESPAWN_INV: 2.2,    // seconds a new ball can't be hurt
  MOURN: 3.5,
  // scoring
  BIT: 10, CORE: 50, GRAZE: 25, EYE_HIT: 250, EYE_KILL: 2000,
  CHAIN_WINDOW: 4,     // seconds between bits before a rally ends
  CHAIN_MAX: 20,       // +5% a bit, up to +100%
  // Heat
  HEAT_BIT: 2.2, HEAT_IN: 0.9, HEAT_MID: 0.35, HEAT_DECAY: 0.4, HEAT_EDGE: 3, HEAT_LOSS: 30,
  HEAT_GROW: 12,       // the horizon is this much wider at full Heat
  CRITICAL: 80,
  // MEMORY LEAK
  LEAK_STEP: 4, LEAK_MAX: 48,
  // the hole breathing in
  SURGE_HEAT: 40, SURGE_WARN: 1.2, SURGE_ON: 3, SURGE_PULL: 1.35, SURGE_GAP: 15,   // the button still wins, just
  // NULL takes digits off the score display and throws them at you
  THEFT_GAP: 24, THEFT_GLYPHS: 4, TH_HUD: -Math.PI * 0.75,
  // LAG SPIKE and QUANTUM SHIFT
  LAG_EVERY: 6.5, LAG_WARN: 1, LAG_BACK: 0.6,
  SHIFT_EVERY: 8, SHIFT_WARN: 1.2,
  OVERCLOCK: 1.35,
  // power-ups
  MAGNET_T: 8, MAGNET_R: 100, FREEZE_T: 4,
  // THE EYE
  BEAM_HALF: 9,        // half the width of the gaze, in pixels
  EYE_OPEN: 5.2, EYE_WARN: 0.7, EYE_SHUT: 1.6, EYE_STUN: 1.5,
  CHARGE_LIFE: 12
};

// What a sector pays into the Glitchcade's wallet: the same as Breakpoint.
export const COINS = { sector: 2, eye: 10 };

// ── small helpers ──
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// the angle from a to b, in (-π, π]
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}
// how far round from a to b going forwards, in [0, 2π)
export function angAhead(a, b) { return (((b - a) % TAU) + TAU) % TAU; }

// ── the orbit ──
export function omega(r) { return TUNE.W_EDGE * Math.pow(TUNE.R_OUT / Math.max(30, r), TUNE.W_EXP); }
export function gravity(r) {
  const k = clamp((TUNE.R_OUT - r) / (TUNE.R_OUT - TUNE.R_HOLE), 0, 1);
  return TUNE.G0 * (1 + TUNE.G_K * k);
}

// ── scoring ──
// Heat multiplies everything, on the same steps as Breakpoint's Glitch meter.
export function heatMultiplier(heat) { return heat >= 75 ? 3 : heat >= 50 ? 2 : heat >= 25 ? 1.5 : 1; }
// 1 on the outside, 2 in the middle band, 3 next to the hole.
export function bandOf(r) { return r < TUNE.BAND_IN ? 3 : r < TUNE.BAND_MID ? 2 : 1; }
export function chainBonus(chain) { return 1 + clamp(chain, 0, TUNE.CHAIN_MAX) * 0.05; }
export function points(base, r, heat, chain) {
  return Math.round(base * bandOf(r) * heatMultiplier(heat) * chainBonus(chain));
}
export function clearBonus(sector) { return 200 + 50 * sector; }

// ── sectors ──
// Every fifth sector belongs to THE EYE. The others take one rule each, in
// this order, coming round again. The names are the glitches the other two
// cabinets and the arcade floor already use.
export const SECTOR_RULES = [
  { id: 'standard', name: 'STANDARD', line: 'NO TRICKS. HOLD TO CLIMB. LET GO TO FALL.' },
  { id: 'leak', name: 'MEMORY LEAK', line: 'EVERY BIT THE HOLE EATS MAKES IT WIDER.' },
  { id: 'panic', name: 'KERNEL PANIC', line: 'LIGHTS OUT. A BIT LIGHTS THE SCREEN FOR A MOMENT.' },
  { id: 'lag', name: 'LAG SPIKE', line: 'THE BALL SNAPS BACK TO WHERE IT WAS.' },
  { id: 'shift', name: 'QUANTUM SHIFT', line: 'THE BALL JUMPS TO THE FAR SIDE OF THE HOLE.' },
  { id: 'overclock', name: 'OVERCLOCK', line: 'EVERYTHING ORBITS FASTER. BITS ARE WORTH HALF AGAIN.' }
];
export const EYE_RULE = { id: 'eye', name: 'THE EYE', line: 'THREAD THE GAP IN ITS GAZE. HIT IT WHILE IT IS OPEN.' };
export function isEyeSector(n) { return n > 0 && n % 5 === 0; }
export function sectorRule(n) {
  if (isEyeSector(n)) return EYE_RULE;
  const k = n - Math.floor(n / 5) - 1;           // which non-Eye sector this is, from 0
  return SECTOR_RULES[k % SECTOR_RULES.length];
}
// Bits to salvage before the sector is yours.
export function quota(n) { return Math.min(28, 10 + 2 * n); }
// How much junk the sector keeps in orbit.
export function debrisTarget(sector, heat, eye) {
  if (eye) return Math.min(6, 2 + Math.floor(sector / 5));
  return Math.min(13, 2 + 1.1 * sector) + heat / 25;
}
export function eyeSpec(sector) {
  const tier = Math.max(1, Math.floor(sector / 5));
  const two = tier >= 3;                         // from the third Eye it looks both ways, a little slower
  return {
    tier,
    hp: Math.min(8, 3 + tier),
    gazeW: -Math.min(0.7, 0.34 + 0.06 * tier) * (two ? 0.7 : 1),   // it turns against the ball
    gapHalf: Math.max(30, 48 - 4 * tier),
    gapSpeed: 0.4 + 0.08 * tier,
    beams: two ? 2 : 1
  };
}
// Where the gap in a beam is. A second beam's gap is level with the first
// until the fourth Eye, when the two mirror each other.
export function gapRadius(eye, beam = 0, ahead = 0) {
  const r = 165 + 68 * Math.sin(eye.gapPhase + eye.gapSpeed * ahead);
  return beam && eye.tier >= 4 ? 330 - r : r;
}

// ── a run ──
export function createRun(opts = {}) {
  const s = {
    rand: mulberry32(opts.seed === undefined ? (Math.random() * 2 ** 31) | 0 : opts.seed),
    moods: opts.moods !== false,     // the ball's moods (LOYAL changes the rules a little)
    t: 0,
    sector: 0, rule: SECTOR_RULES[0], phase: 'intro', phaseT: 0,
    score: 0, balls: TUNE.BALLS, heat: 0, critical: false,
    chain: 0, chainT: 0, bestChain: 0,
    bits: 0, quota: 0, eaten: 0, leak: 0,
    ball: { th: -Math.PI / 2, r: TUNE.START_R, vr: 0, inv: 0, mourn: 0, edgeT: 0, showoff: false },
    holeR: TUNE.R_HOLE,
    objs: [], nextId: 1,
    spawn: { bit: 0, debris: 0, power: 14 },
    shield: false, magnet: 0, freeze: 0,
    surge: { state: 'idle', t: TUNE.SURGE_GAP },
    theftT: 6,
    lag: { state: 'idle', t: TUNE.LAG_EVERY }, shift: { state: 'idle', t: TUNE.SHIFT_EVERY },
    history: [],
    eye: null,
    loyalUsed: false, edgeNoted: 0,
    stats: { bits: 0, cores: 0, grazes: 0, ballsLost: 0, ballsEaten: 0, sectors: 0, eyes: 0, coins: 0, powers: {}, cause: '', time: 0 },
    events: []
  };
  beginSector(s, opts.sector || 1);
  return s;
}

function emit(s, type, detail) { s.events.push(Object.assign({ type }, detail)); }

function beginSector(s, n) {
  s.sector = n;
  s.rule = sectorRule(n);
  s.phase = 'intro';
  s.phaseT = TUNE.INTRO;
  s.bits = 0;
  s.quota = quota(n);
  s.eaten = 0;
  s.leak = 0;
  s.objs = [];
  s.spawn.bit = 0.2;
  s.spawn.debris = 1.2;
  s.surge = { state: 'idle', t: TUNE.SURGE_GAP * 0.6 };
  s.lag = { state: 'idle', t: TUNE.LAG_EVERY };
  s.shift = { state: 'idle', t: TUNE.SHIFT_EVERY };
  s.history = [];
  s.freeze = 0;
  s.loyalUsed = false;
  s.ball.vr = 0;
  s.ball.r = Math.max(s.ball.r, 200);
  s.eye = null;
  if (s.rule.id === 'eye') {
    const spec = eyeSpec(n);
    s.eye = Object.assign(spec, {
      maxHp: spec.hp, gazeTh: s.ball.th + Math.PI, gapPhase: 0,
      lid: 'open', lidT: TUNE.EYE_OPEN, stun: 0, chargeT: 2.5
    });
  }
  emit(s, 'sector', { sector: n, rule: s.rule.id });
}

function horizon(s) {
  return TUNE.R_HOLE + TUNE.HEAT_GROW * (s.heat / 100) + s.leak + (s.eye ? 10 : 0);
}

function addObj(s, o) {
  const obj = Object.assign({ id: s.nextId++, age: 0, warm: 0.5, vr: 0, w: 0, rad: 9 }, o);
  s.objs.push(obj);
  return obj;
}

// an angle that is not on top of the ball
function awayAngle(s, min) { return s.ball.th + min + s.rand() * (TAU - 2 * min); }

function spawnBit(s) {
  const roll = s.rand();
  const r = roll < 0.3 ? 215 + s.rand() * 47 : roll < 0.75 ? 135 + s.rand() * 70 : 84 + s.rand() * 44;
  const core = r < TUNE.BAND_IN && s.rand() < 0.3;
  addObj(s, {
    kind: core ? 'core' : 'bit', r, th: awayAngle(s, 0.8),
    w: omega(r) * (0.15 + s.rand() * 0.3), vr: -(3 + s.rand() * 5), rad: core ? 11 : 9
  });
}

const DEBRIS_LOOKS = ['brick', 'brick', 'brick', 'paddle', 'static'];
function spawnDebris(s) {
  const r = 72 + s.rand() * 212;
  const retro = s.sector >= 3 && s.rand() < 0.35;
  addObj(s, {
    kind: 'debris', look: DEBRIS_LOOKS[Math.floor(s.rand() * DEBRIS_LOOKS.length)], tint: Math.floor(s.rand() * 8),
    r, th: awayAngle(s, 1.1),
    w: retro ? -omega(r) * (0.1 + s.rand() * 0.25) : omega(r) * (0.1 + s.rand() * 0.4),
    vr: -(4 + s.rand() * 10), rad: 10 + s.rand() * 5, warm: 1
  });
}

const POWERS = ['shield', 'magnet', 'freeze'];
function spawnPower(s) {
  const r = 110 + s.rand() * 130;
  addObj(s, { kind: 'power', power: POWERS[Math.floor(s.rand() * POWERS.length)], r, th: awayAngle(s, 1), w: omega(r) * 0.25, vr: -4, rad: 12 });
}

function spawnCharge(s) {
  const r = 105 + s.rand() * 125;
  addObj(s, { kind: 'charge', r, th: s.ball.th + Math.PI + (s.rand() - 0.5) * 2, w: omega(r) * 0.2, vr: -3, rad: 11, life: TUNE.CHARGE_LIFE });
}

function loseBall(s, cause) {
  const b = s.ball;
  s.balls--;
  s.stats.ballsLost++;
  if (cause === 'eaten') s.stats.ballsEaten++;
  s.stats.cause = cause;
  s.heat = Math.max(0, s.heat - TUNE.HEAT_LOSS);
  s.critical = s.heat >= TUNE.CRITICAL;
  s.chain = 0; s.chainT = 0;
  s.magnet = 0;
  emit(s, 'ballLost', { cause, th: b.th, r: b.r, balls: s.balls });
  if (s.balls <= 0) {
    s.phase = 'over';
    emit(s, 'gameOver', { cause });
    return;
  }
  b.r = TUNE.START_R; b.vr = 0; b.inv = TUNE.RESPAWN_INV; b.mourn = TUNE.MOURN; b.edgeT = 0;
  s.history = [];
}

function addScore(s, n) { s.score += n; return n; }

function clearSector(s, eye) {
  s.phase = 'clear';
  s.phaseT = TUNE.CLEAR;
  s.stats.sectors++;
  if (eye) s.stats.eyes++;
  const coins = eye ? COINS.eye : COINS.sector;
  s.stats.coins += coins;
  const bonus = addScore(s, clearBonus(s.sector) * heatMultiplier(s.heat));
  s.objs = s.objs.filter((o) => o.kind !== 'debris' && o.kind !== 'charge');
  emit(s, 'sectorClear', { sector: s.sector, eye: !!eye, coins, bonus });
}

function collect(s, o) {
  const b = s.ball;
  if (o.kind === 'bit' || o.kind === 'core') {
    s.chain++;
    s.chainT = TUNE.CHAIN_WINDOW;
    s.bestChain = Math.max(s.bestChain, s.chain);
    const base = (o.kind === 'core' ? TUNE.CORE : TUNE.BIT) * (s.rule.id === 'overclock' ? 1.5 : 1);
    const pts = addScore(s, points(base, o.r, s.heat, s.chain));
    s.heat = Math.min(100, s.heat + TUNE.HEAT_BIT * bandOf(o.r));
    s.bits += o.kind === 'core' ? 2 : 1;
    if (o.kind === 'core') s.stats.cores++; else s.stats.bits++;
    b.showoff = s.chain >= 6;
    emit(s, 'bit', { pts, band: bandOf(o.r), core: o.kind === 'core', th: o.th, r: o.r, chain: s.chain });
    if (!s.eye && s.bits >= s.quota) clearSector(s, false);
    return;
  }
  if (o.kind === 'power') {
    s.stats.powers[o.power] = (s.stats.powers[o.power] || 0) + 1;
    if (o.power === 'shield') s.shield = true;
    if (o.power === 'magnet') s.magnet = TUNE.MAGNET_T;
    if (o.power === 'freeze') s.freeze = TUNE.FREEZE_T;
    emit(s, 'power', { power: o.power, th: o.th, r: o.r });
    return;
  }
  if (o.kind === 'charge' && s.eye) {
    const e = s.eye;
    if (e.lid === 'shut') { emit(s, 'eyeDeflect', { th: o.th, r: o.r }); return; }
    e.hp--;
    addScore(s, TUNE.EYE_HIT * heatMultiplier(s.heat));
    e.stun = TUNE.EYE_STUN;
    e.gazeW *= 1.08;
    e.chargeT = 2;
    emit(s, 'eyeHit', { hp: e.hp, th: o.th, r: o.r });
    if (e.hp <= 0) {
      addScore(s, TUNE.EYE_KILL);
      emit(s, 'eyeDefeated', { sector: s.sector });
      clearSector(s, true);
    }
  }
}

// Something hit the ball. A shield takes it; otherwise the ball is gone.
function strike(s, cause) {
  if (s.ball.inv > 0) return false;
  if (s.shield) {
    s.shield = false;
    s.ball.inv = 1;
    emit(s, 'shieldBreak', { cause });
    return false;
  }
  loseBall(s, cause);
  return true;
}

// Advance the run by dt seconds. `input.thrust` is the one button.
export function step(s, input, dt) {
  if (s.phase === 'over') return s;
  const b = s.ball;
  s.t += dt;

  if (s.phase === 'intro' || s.phase === 'clear') {
    // the ball holds its orbit while the countdown runs; the button does nothing yet
    b.th += omega(b.r) * dt;
    b.inv = Math.max(0, b.inv - dt);
    b.mourn = Math.max(0, b.mourn - dt);
    for (const o of s.objs) { o.age += dt; o.th += o.w * dt; }
    s.phaseT -= dt;
    if (s.phaseT <= 0) {
      if (s.phase === 'clear') beginSector(s, s.sector + 1);
      else { s.phase = 'play'; emit(s, 'go', { sector: s.sector }); }
    }
    return s;
  }

  s.stats.time += dt;
  const rule = s.rule.id;
  const fast = rule === 'overclock' ? TUNE.OVERCLOCK : 1;
  const dtObj = s.freeze > 0 ? 0 : dt * fast;
  s.freeze = Math.max(0, s.freeze - dt);
  s.magnet = Math.max(0, s.magnet - dt);
  b.inv = Math.max(0, b.inv - dt);
  b.mourn = Math.max(0, b.mourn - dt);

  // ── the hole breathing in ──
  const sg = s.surge;
  sg.t -= dt;
  if (sg.state === 'idle' && sg.t <= 0 && s.heat >= TUNE.SURGE_HEAT) { sg.state = 'warn'; sg.t = TUNE.SURGE_WARN; emit(s, 'surgeWarn'); }
  else if (sg.state === 'warn' && sg.t <= 0) { sg.state = 'on'; sg.t = TUNE.SURGE_ON; emit(s, 'surge'); }
  else if (sg.state === 'on' && sg.t <= 0) { sg.state = 'idle'; sg.t = TUNE.SURGE_GAP + s.rand() * 6; emit(s, 'surgeEnd'); }

  // ── the ball ──
  const pull = gravity(b.r) * (sg.state === 'on' ? TUNE.SURGE_PULL : 1);
  b.vr += ((input && input.thrust ? TUNE.THRUST : 0) - pull) * dt;
  b.vr *= Math.exp(-TUNE.DAMP * dt);
  b.r += b.vr * dt;
  b.th += omega(b.r) * dt * (rule === 'overclock' ? 1.15 : 1);
  if (b.r >= TUNE.R_OUT) {
    // scraping along the glass: safe from the hole, and worth nothing
    b.r = TUNE.R_OUT; b.vr = Math.min(0, b.vr);
    b.edgeT += dt;
    s.heat = Math.max(0, s.heat - TUNE.HEAT_EDGE * dt);
    if (b.edgeT > 4 && s.t - s.edgeNoted > 20) { s.edgeNoted = s.t; emit(s, 'edgeHide'); }
  } else b.edgeT = Math.max(0, b.edgeT - dt * 2);

  // ── Heat ──
  const band = bandOf(b.r);
  s.heat = clamp(s.heat + ((band === 3 ? TUNE.HEAT_IN : band === 2 ? TUNE.HEAT_MID : 0) - TUNE.HEAT_DECAY) * dt, 0, 100);
  if (!s.critical && s.heat >= TUNE.CRITICAL) { s.critical = true; emit(s, 'heatCritical'); }
  else if (s.critical && s.heat < TUNE.CRITICAL - 20) { s.critical = false; emit(s, 'heatCool'); }
  s.holeR = horizon(s);

  // ── the horizon ──
  if (b.r <= s.holeR + TUNE.BALL_R) {
    if (s.moods && s.balls === 1 && !s.loyalUsed) {
      // LOYAL: on your last ball it refuses the horizon, once a sector
      s.loyalUsed = true;
      b.r = s.holeR + TUNE.BALL_R + 3; b.vr = 320; b.inv = Math.max(b.inv, 1.2);
      emit(s, 'loyal', { th: b.th, r: b.r });
    } else {
      loseBall(s, 'eaten');
      if (s.phase === 'over') return s;
    }
  }

  // ── rally timer ──
  if (s.chain > 0) {
    s.chainT -= dt;
    if (s.chainT <= 0) { emit(s, 'chainBreak', { chain: s.chain }); s.chain = 0; b.showoff = false; }
  }

  // ── LAG SPIKE: back to where you were ──
  s.history.push({ t: s.t, th: b.th, r: b.r });
  while (s.history.length && s.t - s.history[0].t > TUNE.LAG_BACK + 0.4) s.history.shift();
  if (rule === 'lag') {
    const l = s.lag;
    l.t -= dt;
    if (l.state === 'idle' && l.t <= 0) { l.state = 'warn'; l.t = TUNE.LAG_WARN; emit(s, 'lagWarn'); }
    else if (l.state === 'warn' && l.t <= 0) {
      const past = lagTarget(s);
      if (past) { b.th = past.th; b.r = Math.max(past.r, s.holeR + 24); b.vr = 0; b.inv = Math.max(b.inv, 0.4); }
      l.state = 'idle'; l.t = TUNE.LAG_EVERY * (0.8 + s.rand() * 0.4);
      emit(s, 'lagSnap');
    }
  }
  // ── QUANTUM SHIFT: the far side of the hole ──
  if (rule === 'shift') {
    const q = s.shift;
    q.t -= dt;
    if (q.state === 'idle' && q.t <= 0) { q.state = 'warn'; q.t = TUNE.SHIFT_WARN; emit(s, 'shiftWarn'); }
    else if (q.state === 'warn' && q.t <= 0) {
      b.th += Math.PI; b.inv = Math.max(b.inv, 0.5);
      s.history = [];
      q.state = 'idle'; q.t = TUNE.SHIFT_EVERY * (0.8 + s.rand() * 0.4);
      emit(s, 'shiftJump');
    }
  }

  // ── NULL takes digits off the score and throws them in ──
  s.theftT -= dt;
  if (s.critical && s.theftT <= 0 && !s.eye) {
    s.theftT = TUNE.THEFT_GAP;
    const digits = String(Math.floor(s.score)).padStart(6, '0').slice(-TUNE.THEFT_GLYPHS);
    for (let i = 0; i < digits.length; i++) {
      addObj(s, {
        kind: 'debris', look: 'glyph', ch: digits[i], tint: 0,
        r: TUNE.R_OUT - 4 - i * 9, th: TUNE.TH_HUD + (i - 1.5) * 0.11,
        w: -0.12 - s.rand() * 0.1, vr: -(34 + s.rand() * 10), rad: 11, warm: 1.2
      });
    }
    emit(s, 'hudTheft', { digits });
  }

  // ── THE EYE ──
  const e = s.eye;
  if (e) {
    e.stun = Math.max(0, e.stun - dt);
    if (e.stun <= 0 && s.freeze <= 0) {
      e.gazeTh += e.gazeW * dt;
      e.gapPhase += e.gapSpeed * dt;
      e.lidT -= dt;
      if (e.lid === 'open' && e.lidT <= 0) { e.lid = 'warn'; e.lidT = TUNE.EYE_WARN; emit(s, 'eyeBlinkWarn'); }
      else if (e.lid === 'warn' && e.lidT <= 0) { e.lid = 'shut'; e.lidT = TUNE.EYE_SHUT; emit(s, 'eyeShut'); }
      else if (e.lid === 'shut' && e.lidT <= 0) { e.lid = 'open'; e.lidT = TUNE.EYE_OPEN * (0.8 + s.rand() * 0.4); emit(s, 'eyeOpen'); }
    }
    // its gaze: a bar of light with a gap. Shut or stunned, it isn't looking.
    if (e.lid !== 'shut' && e.stun <= 0) {
      for (let i = 0; i < e.beams; i++) {
        const across = Math.abs(angDiff(e.gazeTh + i * Math.PI, b.th)) * b.r;
        if (across < TUNE.BEAM_HALF + TUNE.BALL_R * 0.6 && Math.abs(b.r - gapRadius(e, i)) > e.gapHalf - TUNE.BALL_R * 0.5) {
          if (strike(s, 'gaze') && s.phase === 'over') return s;
          break;
        }
      }
    }
    e.chargeT -= dt;
    if (e.chargeT <= 0 && !s.objs.some((o) => o.kind === 'charge')) { spawnCharge(s); e.chargeT = 1.5; }
  }

  // ── everything else in orbit ──
  const bx = Math.cos(b.th) * b.r, by = Math.sin(b.th) * b.r;
  for (let i = s.objs.length - 1; i >= 0; i--) {
    const o = s.objs[i];
    o.age += dt;
    o.th += o.w * dtObj;
    o.r += o.vr * dtObj;
    if (o.life !== undefined) {
      o.life -= dt;
      if (o.life <= 0) { s.objs.splice(i, 1); if (e) e.chargeT = 1.5; continue; }
    }
    const good = o.kind !== 'debris';
    if (good && s.magnet > 0 && o.age >= o.warm) {
      const d = Math.hypot(Math.cos(o.th) * o.r - bx, Math.sin(o.th) * o.r - by);
      if (d < TUNE.MAGNET_R) {
        o.r += clamp(b.r - o.r, -150 * dt, 150 * dt);
        o.th += angDiff(o.th, b.th) * Math.min(1, 4 * dt);
      }
    }
    if (o.r <= s.holeR) {
      // the hole takes it
      s.objs.splice(i, 1);
      if (o.kind === 'bit' || o.kind === 'core') {
        s.eaten++;
        if (rule === 'leak') s.leak = Math.min(TUNE.LEAK_MAX, s.leak + TUNE.LEAK_STEP);
        emit(s, 'bitEaten', { th: o.th, eaten: s.eaten });
      }
      continue;
    }
    if (o.age < o.warm) continue;                // still materialising: can't be touched yet
    const d = Math.hypot(Math.cos(o.th) * o.r - bx, Math.sin(o.th) * o.r - by);
    if (good) {
      if (d < o.rad + TUNE.BALL_R + 2) {
        s.objs.splice(i, 1);
        collect(s, o);
        if (s.phase !== 'play') return s;
      }
      continue;
    }
    if (d < o.rad * 0.85 + TUNE.BALL_R) {
      const hadShield = s.shield;
      const dead = strike(s, o.look === 'glyph' ? 'score' : 'debris');
      if (dead || (hadShield && !s.shield)) s.objs.splice(i, 1);
      if (s.phase === 'over') return s;
      if (dead) break;
    } else if (!o.grazed && b.inv <= 0 && d < o.rad + TUNE.BALL_R + 13) {
      // SHOW-OFF: close enough to count
      o.grazed = true;
      s.stats.grazes++;
      const pts = addScore(s, Math.round(TUNE.GRAZE * heatMultiplier(s.heat)));
      s.heat = Math.min(100, s.heat + 2);
      emit(s, 'graze', { pts, th: o.th, r: o.r });
    }
  }

  // ── new arrivals ──
  s.spawn.bit -= dt;
  s.spawn.debris -= dt;
  s.spawn.power -= dt;
  if (!e) {
    const bitsOut = s.objs.filter((o) => o.kind === 'bit' || o.kind === 'core').length;
    if (s.spawn.bit <= 0 && bitsOut < 5 + Math.min(3, Math.floor(s.sector / 2))) { spawnBit(s); s.spawn.bit = 0.9; }
  }
  const junk = s.objs.filter((o) => o.kind === 'debris').length;
  if (s.spawn.debris <= 0 && junk < debrisTarget(s.sector, s.heat, !!e)) { spawnDebris(s); s.spawn.debris = 1.1; }
  if (s.spawn.power <= 0) {
    s.spawn.power = 16 + s.rand() * 8;
    if (s.sector >= 2 && !s.objs.some((o) => o.kind === 'power')) spawnPower(s);
  }
  return s;
}

// where a LAG SPIKE will put the ball: the oldest sample at least LAG_BACK old
export function lagTarget(s) {
  let past = null;
  for (const h of s.history) { if (s.t - h.t >= TUNE.LAG_BACK) past = h; else break; }
  return past || s.history[0] || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BOT — plays the attract mode behind the menu, and the tests.
// It only gets what a player can see, and it answers with the one button.
// `skill` (0–1) is how far ahead it looks.
// ═══════════════════════════════════════════════════════════════════════════
export function botInput(s, skill = 1) {
  const b = s.ball;
  if (s.phase !== 'play') return { thrust: false };
  // it keeps well clear of the hole while it breathes in, unless the gap in the gaze is down there
  const lo = s.holeR + 26 + (s.surge.state !== 'idle' && !s.eye ? 50 : 0), hi = TUNE.R_OUT - 10;
  const wBall = omega(b.r);
  // seconds until the ball and something at angle th (turning at w) are level
  const meet = (th, w) => {
    const rel = wBall - w;
    if (Math.abs(rel) < 0.02) return Infinity;
    return (rel > 0 ? angAhead(b.th, th) : angAhead(th, b.th)) / Math.abs(rel);
  };

  // what to go for: the nearest thing worth having, in time and in height
  let want = 185, bestCost = Infinity;
  for (const o of s.objs) {
    if (o.kind === 'debris' || o.age < o.warm - 0.4) continue;
    if (o.kind === 'charge' && s.eye && s.eye.lid !== 'open') continue;
    const t = meet(o.th, o.w);
    const r = o.r + o.vr * Math.min(t, 4);
    if (r < lo || t > 7) continue;
    const cost = t + Math.abs(r - b.r) / 120;
    if (cost < bestCost) { bestCost = cost; want = r; }
  }
  // the gaze is coming round: be at the gap when it arrives
  if (s.eye && s.eye.lid !== 'shut' && s.eye.stun <= 0.3) {
    let soon = Infinity;
    for (let i = 0; i < s.eye.beams; i++) {
      const t = meet(s.eye.gazeTh + i * Math.PI, s.eye.gazeW);
      if (t < 2 && t < soon) { soon = t; want = gapRadius(s.eye, i, t); }
    }
  }

  // Try a ladder of heights: fly each one forward and see what it runs into.
  const horizonT = 0.6 + 1.1 * skill;
  let best = b.r, bestScore = -Infinity;
  for (let i = 0; i <= 9; i++) {
    const target = lo + ((hi - lo) * i) / 9;
    const hitT = botRollout(s, target, horizonT);
    const score = (hitT === Infinity ? 1000 : hitT * 100) - Math.abs(target - want);
    if (score > bestScore) { bestScore = score; best = target; }
  }
  return { thrust: botSteer(b.r, b.vr, best) };
}

// hold the button when the ball is under where it wants to be, allowing for its speed
function botSteer(r, vr, target) { return r + vr * 0.22 < target; }

// Fly the ball at `target` for T seconds against where everything will be.
// Returns when it would be hit, or Infinity.
function botRollout(s, target, T) {
  const b = s.ball, dt = 1 / 20;
  const fast = s.rule.id === 'overclock' ? TUNE.OVERCLOCK : 1;
  const junk = [];
  for (const o of s.objs) if (o.kind === 'debris') junk.push({ th: o.th, r: o.r, w: o.w, vr: o.vr, hit: o.rad * 0.85 + TUNE.BALL_R + 6, wait: Math.max(0, o.warm - o.age) });
  const e = s.eye;
  let r = b.r, vr = b.vr, th = b.th, inv = b.inv, freeze = s.freeze;
  let gazeTh = e ? e.gazeTh : 0, ahead = 0;
  for (let t = 0; t < T; t += dt) {
    const pull = gravity(r) * (s.surge.state === 'on' ? TUNE.SURGE_PULL : 1);
    vr += ((botSteer(r, vr, target) ? TUNE.THRUST : 0) - pull) * dt;
    vr *= Math.exp(-TUNE.DAMP * dt);
    r = Math.min(TUNE.R_OUT, r + vr * dt);
    th += omega(r) * dt * (fast > 1 ? 1.15 : 1);
    inv -= dt;
    if (r <= s.holeR + TUNE.BALL_R + 4) return t;
    const dtObj = freeze > 0 ? 0 : dt * fast;
    freeze -= dt;
    const x = Math.cos(th) * r, y = Math.sin(th) * r;
    for (const o of junk) {
      o.th += o.w * dtObj; o.r += o.vr * dtObj;
      if (o.wait > 0) { o.wait -= dt; continue; }
      if (inv <= 0 && Math.hypot(Math.cos(o.th) * o.r - x, Math.sin(o.th) * o.r - y) < o.hit) return t;
    }
    if (e && e.lid !== 'shut' && e.stun <= t && dtObj > 0) {
      gazeTh += e.gazeW * dt; ahead += dt;
      for (let i = 0; i < e.beams; i++) {
        const across = Math.abs(angDiff(gazeTh + i * Math.PI, th)) * r;
        if (inv <= 0 && across < TUNE.BEAM_HALF + TUNE.BALL_R + 3 && Math.abs(r - gapRadius(e, i, ahead)) > e.gapHalf - TUNE.BALL_R - 3) return t;
      }
    }
  }
  return Infinity;
}

// ═══════════════════════════════════════════════════════════════════════════
// AFTER A RUN
// ═══════════════════════════════════════════════════════════════════════════
export const CAUSES = {
  eaten: 'FELL PAST THE HORIZON',
  debris: 'HIT SOMETHING THE OTHER CABINETS THREW AWAY',
  score: 'HIT BY A DIGIT OF YOUR OWN SCORE',
  gaze: 'THE EYE LOOKED STRAIGHT AT IT'
};
export function runRecap(s) {
  const fav = Object.entries(s.stats.powers).sort((a, b) => b[1] - a[1])[0];
  return {
    score: Math.floor(s.score),
    sector: s.sector,
    sectors: s.stats.sectors,
    bestChain: s.bestChain,
    grazes: s.stats.grazes,
    coins: s.stats.coins,
    eyes: s.stats.eyes,
    time: Math.round(s.stats.time),
    favourite: fav ? fav[0] : null,
    cause: CAUSES[s.stats.cause] || ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SAVE — what NULL keeps. Stored in the browser under SAVE_KEY and carried
// by Glitch Pong's save export.
// ═══════════════════════════════════════════════════════════════════════════
export const SAVE_KEY = 'glitchcade_nexus_v1';
export function defaultSave() {
  return {
    v: 1,
    best: 0, bestSector: 0, bestChain: 0,
    runs: 0,             // runs started
    ballsLost: 0,        // every ball, any cause
    ballsEaten: 0,       // the ones that went past the horizon
    sectors: 0, eyes: 0,
    coins: 0,            // coins this cabinet has paid (the arcade's daily board subtracts them)
    seconds: 0,
    crashSeen: false,    // the crash that isn't one has been played once
    vol: 70, fx: true, moods: true, talk: true
  };
}
const int = (v, lo = 0, hi = 1e9) => { const n = Number(v); return Number.isFinite(n) ? clamp(Math.floor(n), lo, hi) : lo; };
export function sanitizeSave(v) {
  const out = defaultSave();
  if (!v || typeof v !== 'object') return out;
  for (const k of ['best', 'bestSector', 'bestChain', 'runs', 'ballsLost', 'ballsEaten', 'sectors', 'eyes', 'coins', 'seconds']) out[k] = int(v[k]);
  out.vol = v.vol === undefined ? 70 : int(v.vol, 0, 100);
  out.crashSeen = !!v.crashSeen;
  for (const k of ['fx', 'moods', 'talk']) out[k] = v[k] === undefined ? true : !!v[k];
  return out;
}
// Fold a finished run into the record. Returns what was new.
export function recordRun(save, s) {
  const r = runRecap(s);
  const fresh = { best: r.score > save.best, sector: r.sector > save.bestSector };
  save.best = Math.max(save.best, r.score);
  save.bestSector = Math.max(save.bestSector, r.sector);
  save.bestChain = Math.max(save.bestChain, r.bestChain);
  save.ballsLost += s.stats.ballsLost;
  save.ballsEaten += s.stats.ballsEaten;
  save.sectors += s.stats.sectors;
  save.eyes += s.stats.eyes;
  save.seconds += r.time;
  return fresh;
}
