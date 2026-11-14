// ═══════════════════════════════════════════════════════════════════════════
// BLACK-HOLE NEXUS — rules
//
// The classic this cabinet is a glitched take on is the spin-and-thrust rock
// shooter: you turn, you thrust, you fire, and what you hit splits into
// smaller pieces. What the glitch adds: a hole in the middle of the screen
// that pulls on everything, Heat, a rule for each sector, and THE EYE.
//
// The whole game is here as numbers: the flight, the debris, scoring, Heat,
// each sector's rule, THE EYE, the bot, the save. Nothing touches the page or
// the canvas, so tests/nexus-rules.test.mjs plays it under Node with the same
// bot that runs the attract mode behind the menu. js/game.js draws what this
// file decides.
//
// Positions are in pixels at the game's design size, measured from the middle
// of the hole. Angles are in radians, time in seconds.
// ═══════════════════════════════════════════════════════════════════════════

export const TAU = Math.PI * 2;

export const TUNE = {
  R_OUT: 290,          // the edge of the screen: cross it and you come back on the far side
  R_HOLE: 44,          // the horizon, before Heat and MEMORY LEAK widen it
  BALL_R: 7,
  BAND_MID: 210,       // a kill made from inside this radius is worth x2
  BAND_IN: 130,        // ...and from inside this one, x3
  // the ball: turn, thrust, fire
  TURN: 4.2,           // radians a second
  THRUST: 300,         // px/s² along the way it is facing
  DRAG: 0.45,          // it coasts, but not for ever
  MAX_SPEED: 320,
  G0: 22,              // the hole's pull at the edge of the screen (px/s²)
  G_K: 3.5,            // ...and how much stronger it is at the horizon (x 1 + G_K)
  START_R: 215,
  BALLS: 3,
  INTRO: 3.2,          // the 3-2-1-GO before a sector
  CLEAR: 2.4,          // the pause after one
  RESPAWN_INV: 2.2,    // seconds a new ball can't be hurt
  MOURN: 3.5,
  // its shots
  SHOT_SPEED: 520, SHOT_LIFE: 0.62, SHOT_GAP: 0.24, SHOTS: 4,     // four on screen at once, as in the classic
  SHOT_PULL: 1,        // the hole bends them a little
  GRUDGE_PULL: 5,      // ...and a lot, when THE EYE is in it and the ball's moods are on
  SPREAD: 0.17, SPREAD_T: 8,
  // debris: three sizes, the big ones break into two of the next size down
  RAD: [0, 10, 18, 29],
  PIECE: [0, 40, 20, 10],     // what a piece of each size is worth
  MASS: [0, 1, 3, 7],         // how many pieces it is, all told
  DEBRIS_PULL: 0.12,          // the hole pulls on debris too, a little
  GRAZE: 25, EYE_HIT: 30, EYE_KILL: 2000,
  CHAIN_WINDOW: 3,     // seconds between kills before a rally ends
  CHAIN_MAX: 20,       // +5% a kill, up to +100%
  // Heat
  HEAT_KILL: 1.3, HEAT_IN: 0.9, HEAT_MID: 0.35, HEAT_DECAY: 0.4, HEAT_LOSS: 30,
  HEAT_GROW: 12,       // the horizon is this much wider at full Heat
  CRITICAL: 80,
  // MEMORY LEAK
  LEAK_STEP: 3, LEAK_MAX: 36, LEAK_PLUG: 1,     // wider by 3 for each piece eaten, narrower by 1 for each you break
  // the hole breathing in
  SURGE_HEAT: 40, SURGE_WARN: 1.2, SURGE_ON: 3, SURGE_PULL: 1.9, SURGE_GAP: 15,
  // NULL takes digits off the score display and throws them at you
  THEFT_GAP: 24, THEFT_GLYPHS: 4, TH_HUD: -Math.PI * 0.75,
  // LAG SPIKE and QUANTUM SHIFT
  LAG_EVERY: 6.5, LAG_WARN: 1, LAG_BACK: 0.6,
  SHIFT_EVERY: 7, SHIFT_WARN: 1.2, SHIFT_CLEAR: 80,
  OVERCLOCK: 1.35,
  // power-ups
  POWER_CHANCE: 0.08, POWER_LIFE: 10, FREEZE_T: 4,
  // THE EYE
  BEAM_HALF: 9,        // half the width of the gaze, in pixels
  EYE_OPEN: 5.2, EYE_WARN: 0.7, EYE_SHUT: 1.6,
  IDLE: 9              // seconds without firing before NULL remarks on it
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
export const dist = (o) => Math.hypot(o.x, o.y);          // how far something is from the hole

// ── the hole's pull ──
export function gravity(r) {
  const k = clamp((TUNE.R_OUT - r) / (TUNE.R_OUT - TUNE.R_HOLE), 0, 1);
  return TUNE.G0 * (1 + TUNE.G_K * k);
}

// ── scoring ──
// Heat multiplies everything, on the same steps as Breakpoint's Glitch meter.
export function heatMultiplier(heat) { return heat >= 75 ? 3 : heat >= 50 ? 2 : heat >= 25 ? 1.5 : 1; }
// 1 on the outside, 2 in the middle band, 3 next to the hole: where the ball is when it makes the kill.
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
  { id: 'standard', name: 'STANDARD', line: 'NO TRICKS. TURN, THRUST, FIRE. STAY OUT OF THE HOLE.' },
  { id: 'leak', name: 'MEMORY LEAK', line: 'EVERY PIECE IT EATS WIDENS THE HOLE. EVERY KILL NARROWS IT.' },
  { id: 'panic', name: 'KERNEL PANIC', line: 'LIGHTS OUT. A HIT LIGHTS THE SCREEN FOR A MOMENT.' },
  { id: 'lag', name: 'LAG SPIKE', line: 'THE BALL SNAPS BACK TO WHERE IT WAS.' },
  { id: 'shift', name: 'QUANTUM SHIFT', line: 'THE DEBRIS JUMPS TO THE FAR SIDE OF THE HOLE.' },
  { id: 'overclock', name: 'OVERCLOCK', line: 'EVERYTHING DRIFTS FASTER. A HIT IS WORTH HALF AGAIN.' }
];
export const EYE_RULE = { id: 'eye', name: 'THE EYE', line: 'THREAD THE GAP IN ITS GAZE. SHOOT IT WHILE IT IS OPEN.' };
export function isEyeSector(n) { return n > 0 && n % 5 === 0; }
export function sectorRule(n) {
  if (isEyeSector(n)) return EYE_RULE;
  const k = n - Math.floor(n / 5) - 1;           // which non-Eye sector this is, from 0
  return SECTOR_RULES[k % SECTOR_RULES.length];
}
// Pieces to break before the sector is yours. A big one is seven, all told,
// so sector 1 is five of them and each sector after is one more.
export function quota(n) { return Math.min(91, 28 + 7 * n); }
// How much debris the sector keeps on screen, counted in small pieces.
export function debrisTarget(sector, heat, eye) {
  if (eye) return Math.min(21, 7 + sector / 2);
  return Math.min(44, 16 + 3.5 * sector) + heat / 12;
}
export function debrisSpeed(size, sector) {
  return [0, 66, 48, 32][size] * Math.min(1.9, 1 + 0.06 * sector);
}
export function eyeSpec(sector) {
  const tier = Math.max(1, Math.floor(sector / 5));
  const two = tier >= 3;                         // from the third Eye it looks both ways, a little slower
  return {
    tier,
    hp: Math.min(96, 36 + 12 * tier),            // shots it takes
    gazeW: Math.min(0.95, 0.55 + 0.08 * tier) * (two ? 0.75 : 1),
    gapHalf: Math.max(34, 52 - 4 * tier),
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
    moods: opts.moods !== false,     // the ball's moods (LOYAL and GRUDGE change the rules a little)
    t: 0,
    sector: 0, rule: SECTOR_RULES[0], phase: 'intro', phaseT: 0,
    score: 0, balls: TUNE.BALLS, heat: 0, critical: false,
    chain: 0, chainT: 0, bestChain: 0,
    bits: 0, quota: 0, eaten: 0, leak: 0,          // bits: pieces broken this sector
    ball: { x: 0, y: -TUNE.START_R, vx: 0, vy: 0, a: 0, cool: 0, inv: 0, mourn: 0, showoff: false },
    holeR: TUNE.R_HOLE,
    objs: [], shots: [], nextId: 1,
    spawnT: 0,
    shield: false, spread: 0, freeze: 0,
    surge: { state: 'idle', t: TUNE.SURGE_GAP },
    theftT: 6, idleT: 0, idleNoted: -99, wrapNoted: -99,
    lag: { state: 'idle', t: TUNE.LAG_EVERY }, shift: { state: 'idle', t: TUNE.SHIFT_EVERY },
    history: [],
    eye: null,
    loyalUsed: false,
    stats: { broken: 0, shots: 0, grazes: 0, ballsLost: 0, ballsEaten: 0, sectors: 0, eyes: 0, coins: 0, powers: {}, cause: '', time: 0 },
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
  s.shots = [];
  s.spawnT = 0;
  s.surge = { state: 'idle', t: TUNE.SURGE_GAP * 0.6 };
  s.lag = { state: 'idle', t: TUNE.LAG_EVERY };
  s.shift = { state: 'idle', t: TUNE.SHIFT_EVERY };
  s.history = [];
  s.freeze = 0;
  s.idleT = 0;
  s.loyalUsed = false;
  // the ball starts each sector in a slow orbit above the hole, facing the way it is going
  const b = s.ball;
  const th = Math.atan2(b.y, b.x) || -Math.PI / 2;
  placeInOrbit(b, th);
  b.a = th + Math.PI / 2; b.cool = 0;
  s.eye = null;
  if (s.rule.id === 'eye') {
    const spec = eyeSpec(n);
    s.eye = Object.assign(spec, { maxHp: spec.hp, gazeTh: th + Math.PI, gapPhase: 0, lid: 'open', lidT: TUNE.EYE_OPEN });
    b.a = th + Math.PI;            // it starts facing the Eye
  }
  emit(s, 'sector', { sector: n, rule: s.rule.id });
}

// High up, moving just fast enough to circle the hole. Drag wears the orbit
// down in a few seconds, so it is a head start, not somewhere to stay.
function placeInOrbit(b, th) {
  const v = Math.sqrt(gravity(TUNE.START_R) * TUNE.START_R);
  b.x = Math.cos(th) * TUNE.START_R; b.y = Math.sin(th) * TUNE.START_R;
  b.vx = -Math.sin(th) * v; b.vy = Math.cos(th) * v;
}

function horizon(s) {
  return TUNE.R_HOLE + TUNE.HEAT_GROW * (s.heat / 100) + s.leak + (s.eye ? 10 : 0);
}

function addObj(s, o) {
  const obj = Object.assign({ id: s.nextId++, age: 0, warm: 0.5, vx: 0, vy: 0, rad: 10 }, o);
  s.objs.push(obj);
  return obj;
}
function addDebris(s, size, o) {
  return addObj(s, Object.assign({ kind: 'debris', size, rad: TUNE.RAD[size], spin: (s.rand() - 0.5) * 2.4, rot: s.rand() * TAU }, o));
}

const DEBRIS_LOOKS = ['brick', 'brick', 'brick', 'paddle', 'static'];
// A big piece comes in over the edge of the screen, away from the ball, on a
// path that crosses the field but misses the hole.
function spawnLarge(s) {
  const b = s.ball;
  const th = Math.atan2(b.y, b.x) + 0.9 + s.rand() * (TAU - 1.8);
  const x = Math.cos(th) * (TUNE.R_OUT - 4), y = Math.sin(th) * (TUNE.R_OUT - 4);
  const aim = s.rand() * TAU, ar = 125 + s.rand() * 100;
  const dx = Math.cos(aim) * ar - x, dy = Math.sin(aim) * ar - y, d = Math.hypot(dx, dy) || 1;
  const v = debrisSpeed(3, s.sector) * (0.8 + s.rand() * 0.4);
  addDebris(s, 3, {
    look: DEBRIS_LOOKS[Math.floor(s.rand() * DEBRIS_LOOKS.length)], tint: Math.floor(s.rand() * 8),
    x, y, vx: (dx / d) * v, vy: (dy / d) * v, warm: 1
  });
}

const POWERS = ['shield', 'spread', 'freeze'];

function loseBall(s, cause) {
  const b = s.ball;
  s.balls--;
  s.stats.ballsLost++;
  if (cause === 'eaten') s.stats.ballsEaten++;
  s.stats.cause = cause;
  s.heat = Math.max(0, s.heat - TUNE.HEAT_LOSS);
  s.critical = s.heat >= TUNE.CRITICAL;
  s.chain = 0; s.chainT = 0;
  s.spread = 0;
  emit(s, 'ballLost', { cause, x: b.x, y: b.y, balls: s.balls });
  if (s.balls <= 0) {
    s.phase = 'over';
    emit(s, 'gameOver', { cause });
    return;
  }
  // the next one starts high up, on the side of the hole it was lost on
  placeInOrbit(b, Math.atan2(b.y, b.x));
  b.inv = TUNE.RESPAWN_INV; b.mourn = TUNE.MOURN; b.showoff = false;
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
  s.objs = [];
  s.shots = [];
  emit(s, 'sectorClear', { sector: s.sector, eye: !!eye, coins, bonus });
}

// A piece of debris has been shot. Big ones break in two; the small ones are gone.
function breakPiece(s, o, shot) {
  const b = s.ball, r = dist(b);
  s.objs.splice(s.objs.indexOf(o), 1);
  s.chain++;
  s.chainT = TUNE.CHAIN_WINDOW;
  s.bestChain = Math.max(s.bestChain, s.chain);
  b.showoff = s.chain >= 6;
  const base = TUNE.PIECE[o.size] * (s.rule.id === 'overclock' ? 1.5 : 1);
  const pts = addScore(s, points(base, r, s.heat, s.chain));
  s.heat = Math.min(100, s.heat + TUNE.HEAT_KILL * bandOf(r));
  s.bits++;
  s.stats.broken++;
  s.leak = Math.max(0, s.leak - TUNE.LEAK_PLUG);     // MEMORY LEAK: breaking things plugs it
  if (o.size > 1) {
    // the two halves fly apart, across the line of the shot
    const sv = Math.hypot(shot.vx, shot.vy) || 1;
    const nx = -shot.vy / sv, ny = shot.vx / sv;
    const v = debrisSpeed(o.size - 1, s.sector);
    for (const side of [-1, 1]) {
      const kick = v * (0.55 + s.rand() * 0.4);
      addDebris(s, o.size - 1, {
        look: o.look === 'glyph' ? 'static' : o.look, tint: o.tint,
        x: o.x + nx * side * o.rad * 0.4, y: o.y + ny * side * o.rad * 0.4,
        vx: o.vx * 0.6 + nx * side * kick + (shot.vx / sv) * 14, vy: o.vy * 0.6 + ny * side * kick + (shot.vy / sv) * 14,
        warm: 0.12
      });
    }
  } else if (s.sector >= 2 && s.rand() < TUNE.POWER_CHANCE && !s.objs.some((p) => p.kind === 'power')) {
    addObj(s, { kind: 'power', power: POWERS[Math.floor(s.rand() * POWERS.length)], x: o.x, y: o.y, vx: o.vx * 0.3, vy: o.vy * 0.3, rad: 12, warm: 0.2, life: TUNE.POWER_LIFE });
  }
  emit(s, 'break', { size: o.size, pts, x: o.x, y: o.y, band: bandOf(r), chain: s.chain, glyph: o.look === 'glyph' });
  if (!s.eye && s.bits >= s.quota) clearSector(s, false);
}

function fire(s) {
  const b = s.ball;
  const angles = s.spread > 0 ? [-TUNE.SPREAD, 0, TUNE.SPREAD] : [0];
  for (const da of angles) {
    const a = b.a + da;
    s.shots.push({
      x: b.x + Math.cos(b.a) * (TUNE.BALL_R + 2), y: b.y + Math.sin(b.a) * (TUNE.BALL_R + 2),
      vx: b.vx * 0.5 + Math.cos(a) * TUNE.SHOT_SPEED, vy: b.vy * 0.5 + Math.sin(a) * TUNE.SHOT_SPEED,
      life: TUNE.SHOT_LIFE
    });
  }
  b.cool = TUNE.SHOT_GAP;
  s.idleT = 0;
  s.stats.shots++;
  emit(s, 'shot');
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

// Advance the run by dt seconds. `input` is { left, right, thrust, fire }.
export function step(s, input, dt) {
  if (s.phase === 'over') return s;
  const b = s.ball, inp = input || {};
  s.t += dt;

  if (s.phase === 'intro' || s.phase === 'clear') {
    // the ball can turn while the countdown runs, and nothing else
    if (inp.left) b.a -= TUNE.TURN * dt;
    if (inp.right) b.a += TUNE.TURN * dt;
    b.inv = Math.max(0, b.inv - dt);
    b.mourn = Math.max(0, b.mourn - dt);
    for (const o of s.objs) o.age += dt;
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
  s.spread = Math.max(0, s.spread - dt);
  b.inv = Math.max(0, b.inv - dt);
  b.mourn = Math.max(0, b.mourn - dt);
  b.cool = Math.max(0, b.cool - dt);

  // ── the hole breathing in ──
  const sg = s.surge;
  sg.t -= dt;
  if (sg.state === 'idle' && sg.t <= 0 && s.heat >= TUNE.SURGE_HEAT) { sg.state = 'warn'; sg.t = TUNE.SURGE_WARN; emit(s, 'surgeWarn'); }
  else if (sg.state === 'warn' && sg.t <= 0) { sg.state = 'on'; sg.t = TUNE.SURGE_ON; emit(s, 'surge'); }
  else if (sg.state === 'on' && sg.t <= 0) { sg.state = 'idle'; sg.t = TUNE.SURGE_GAP + s.rand() * 6; emit(s, 'surgeEnd'); }
  const breath = sg.state === 'on' ? TUNE.SURGE_PULL : 1;

  // ── the ball: turn, thrust, coast, fall ──
  if (inp.left) b.a -= TUNE.TURN * dt;
  if (inp.right) b.a += TUNE.TURN * dt;
  let r = dist(b) || 1;
  const pull = gravity(r) * breath;
  b.vx += ((inp.thrust ? Math.cos(b.a) * TUNE.THRUST : 0) - (b.x / r) * pull) * dt;
  b.vy += ((inp.thrust ? Math.sin(b.a) * TUNE.THRUST : 0) - (b.y / r) * pull) * dt;
  const drag = Math.exp(-TUNE.DRAG * dt);
  b.vx *= drag; b.vy *= drag;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > TUNE.MAX_SPEED) { b.vx *= TUNE.MAX_SPEED / sp; b.vy *= TUNE.MAX_SPEED / sp; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  r = dist(b);
  if (r > TUNE.R_OUT) {
    // off one side of the screen, back on the other
    const k = (TUNE.R_OUT - 2) / r;
    b.x = -b.x * k; b.y = -b.y * k;
    s.history = [];
    if (s.t - s.wrapNoted > 30) { s.wrapNoted = s.t; emit(s, 'wrap', { first: true }); } else emit(s, 'wrap', { first: false });
    r = dist(b);
  }
  if (inp.fire && b.cool <= 0 && s.shots.length < TUNE.SHOTS * (s.spread > 0 ? 3 : 1)) fire(s);
  s.idleT += dt;
  if (s.idleT > TUNE.IDLE && s.t - s.idleNoted > 25) { s.idleNoted = s.t; emit(s, 'idle'); }

  // ── Heat ──
  const band = bandOf(r);
  s.heat = clamp(s.heat + ((band === 3 ? TUNE.HEAT_IN : band === 2 ? TUNE.HEAT_MID : 0) - TUNE.HEAT_DECAY) * dt, 0, 100);
  if (!s.critical && s.heat >= TUNE.CRITICAL) { s.critical = true; emit(s, 'heatCritical'); }
  else if (s.critical && s.heat < TUNE.CRITICAL - 20) { s.critical = false; emit(s, 'heatCool'); }
  s.holeR = horizon(s);

  // ── the horizon ──
  if (r <= s.holeR + TUNE.BALL_R) {
    if (s.moods && s.balls === 1 && !s.loyalUsed) {
      // LOYAL: on your last ball it refuses the horizon, once a sector
      s.loyalUsed = true;
      const k = (s.holeR + TUNE.BALL_R + 3) / (r || 1);
      b.x *= k; b.y *= k;
      b.vx = (b.x / dist(b)) * 260; b.vy = (b.y / dist(b)) * 260;
      b.inv = Math.max(b.inv, 1.2);
      emit(s, 'loyal', { x: b.x, y: b.y });
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
  s.history.push({ t: s.t, x: b.x, y: b.y, vx: b.vx, vy: b.vy });
  while (s.history.length && s.t - s.history[0].t > TUNE.LAG_BACK + 0.4) s.history.shift();
  if (rule === 'lag') {
    const l = s.lag;
    l.t -= dt;
    if (l.state === 'idle' && l.t <= 0) { l.state = 'warn'; l.t = TUNE.LAG_WARN; emit(s, 'lagWarn'); }
    else if (l.state === 'warn' && l.t <= 0) {
      const past = lagTarget(s);
      if (past && Math.hypot(past.x, past.y) > s.holeR + 24) {
        b.x = past.x; b.y = past.y; b.vx = past.vx; b.vy = past.vy;
        b.inv = Math.max(b.inv, 0.4);
      }
      l.state = 'idle'; l.t = TUNE.LAG_EVERY * (0.8 + s.rand() * 0.4);
      emit(s, 'lagSnap');
    }
  }
  // ── QUANTUM SHIFT: the debris changes sides ──
  if (rule === 'shift') {
    const q = s.shift;
    q.t -= dt;
    if (q.state === 'idle' && q.t <= 0) { q.state = 'warn'; q.t = TUNE.SHIFT_WARN; emit(s, 'shiftWarn'); }
    else if (q.state === 'warn' && q.t <= 0) {
      for (const o of s.objs) if (shiftLands(s, o)) { o.x = -o.x; o.y = -o.y; }
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
      const th = TUNE.TH_HUD + (i - 1.5) * 0.12, rr = TUNE.R_OUT - 6;
      const x = Math.cos(th) * rr, y = Math.sin(th) * rr;
      const d = Math.hypot(b.x - x, b.y - y) || 1;
      addDebris(s, 1, { look: 'glyph', ch: digits[i], tint: 0, x, y, vx: ((b.x - x) / d) * 58, vy: ((b.y - y) / d) * 58, warm: 1.2, spin: 0, rot: 0 });
    }
    emit(s, 'hudTheft', { digits });
  }

  // ── THE EYE ──
  const e = s.eye;
  if (e) {
    if (s.freeze <= 0) {
      e.gazeTh += e.gazeW * dt;
      e.gapPhase += e.gapSpeed * dt;
      e.lidT -= dt;
      if (e.lid === 'open' && e.lidT <= 0) { e.lid = 'warn'; e.lidT = TUNE.EYE_WARN; emit(s, 'eyeBlinkWarn'); }
      else if (e.lid === 'warn' && e.lidT <= 0) { e.lid = 'shut'; e.lidT = TUNE.EYE_SHUT; emit(s, 'eyeShut'); }
      else if (e.lid === 'shut' && e.lidT <= 0) { e.lid = 'open'; e.lidT = TUNE.EYE_OPEN * (0.8 + s.rand() * 0.4); emit(s, 'eyeOpen'); }
    }
    // its gaze: a bar of light with a gap. Shut, it isn't looking.
    if (e.lid !== 'shut') {
      const bth = Math.atan2(b.y, b.x);
      for (let i = 0; i < e.beams; i++) {
        const across = Math.abs(angDiff(e.gazeTh + i * Math.PI, bth)) * r;
        if (across < TUNE.BEAM_HALF + TUNE.BALL_R * 0.6 && Math.abs(r - gapRadius(e, i)) > e.gapHalf - TUNE.BALL_R * 0.5) {
          if (strike(s, 'gaze') && s.phase === 'over') return s;
          break;
        }
      }
    }
  }

  // ── shots ──
  const shotPull = e && s.moods ? TUNE.GRUDGE_PULL : TUNE.SHOT_PULL;      // GRUDGE: they bend toward THE EYE
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i];
    const sr = Math.hypot(sh.x, sh.y) || 1, g = gravity(sr) * shotPull;
    sh.vx -= (sh.x / sr) * g * dt; sh.vy -= (sh.y / sr) * g * dt;
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    sh.life -= dt;
    const now = Math.hypot(sh.x, sh.y);
    if (sh.life <= 0 || now > TUNE.R_OUT) { s.shots.splice(i, 1); continue; }
    if (now <= s.holeR + 3) {
      // into the hole. If THE EYE is in it, that is a hit, unless it has shut.
      s.shots.splice(i, 1);
      if (e) {
        if (e.lid === 'shut') emit(s, 'eyeDeflect', { x: sh.x, y: sh.y });
        else {
          e.hp--;
          addScore(s, TUNE.EYE_HIT * heatMultiplier(s.heat));
          emit(s, 'eyeHit', { hp: e.hp, x: sh.x, y: sh.y });
          if (e.hp <= 0) {
            addScore(s, TUNE.EYE_KILL);
            emit(s, 'eyeDefeated', { sector: s.sector });
            clearSector(s, true);
            return s;
          }
        }
      }
      continue;
    }
    for (const o of s.objs) {
      if (o.kind !== 'debris' || o.age < o.warm) continue;
      if (Math.hypot(o.x - sh.x, o.y - sh.y) < o.rad + 3) {
        s.shots.splice(i, 1);
        breakPiece(s, o, sh);
        if (s.phase !== 'play') return s;
        break;
      }
    }
  }

  // ── everything else on the screen ──
  for (let i = s.objs.length - 1; i >= 0; i--) {
    const o = s.objs[i];
    o.age += dt;
    const debris = o.kind === 'debris';
    const or = Math.hypot(o.x, o.y) || 1;
    if (dtObj > 0) {
      const g = gravity(or) * TUNE.DEBRIS_PULL * breath;
      o.vx -= (o.x / or) * g * dtObj; o.vy -= (o.y / or) * g * dtObj;
      o.x += o.vx * dtObj; o.y += o.vy * dtObj;
      if (debris) o.rot += o.spin * dtObj;
    }
    if (o.life !== undefined) {
      o.life -= dt;
      if (o.life <= 0) { s.objs.splice(i, 1); continue; }
    }
    const nr = Math.hypot(o.x, o.y);
    if (nr > TUNE.R_OUT && o.x * o.vx + o.y * o.vy > 0) {
      const k = TUNE.R_OUT / nr;                 // debris wraps the same way the ball does
      o.x = -o.x * k; o.y = -o.y * k;
    }
    if (nr <= s.holeR) {
      // the hole takes it
      s.objs.splice(i, 1);
      if (debris) {
        s.eaten++;
        if (rule === 'leak') s.leak = Math.min(TUNE.LEAK_MAX, s.leak + TUNE.LEAK_STEP);
        emit(s, 'debrisEaten', { x: o.x, y: o.y, eaten: s.eaten });
      }
      continue;
    }
    if (o.age < o.warm) continue;                // still materialising: can't be touched yet
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (!debris) {
      if (d < o.rad + TUNE.BALL_R + 2) {
        s.objs.splice(i, 1);
        s.stats.powers[o.power] = (s.stats.powers[o.power] || 0) + 1;
        if (o.power === 'shield') s.shield = true;
        if (o.power === 'spread') s.spread = TUNE.SPREAD_T;
        if (o.power === 'freeze') s.freeze = TUNE.FREEZE_T;
        emit(s, 'power', { power: o.power, x: o.x, y: o.y });
      }
      continue;
    }
    if (d < o.rad * 0.88 + TUNE.BALL_R) {
      const hadShield = s.shield;
      const dead = strike(s, o.look === 'glyph' ? 'score' : 'debris');
      if (dead || (hadShield && !s.shield)) { const at = s.objs.indexOf(o); if (at >= 0) s.objs.splice(at, 1); }
      if (s.phase === 'over') return s;
      if (dead) break;
    } else if (!o.grazed && b.inv <= 0 && d < o.rad + TUNE.BALL_R + 13) {
      // SHOW-OFF: close enough to count
      o.grazed = true;
      s.stats.grazes++;
      const pts = addScore(s, Math.round(TUNE.GRAZE * heatMultiplier(s.heat)));
      s.heat = Math.min(100, s.heat + 2);
      emit(s, 'graze', { pts, x: o.x, y: o.y });
    }
  }

  // ── new arrivals: keep the screen stocked until the sector is cleared ──
  s.spawnT -= dt;
  if (s.spawnT <= 0) {
    let mass = 0;
    for (const o of s.objs) if (o.kind === 'debris') mass += TUNE.MASS[o.size];
    if (mass + TUNE.MASS[3] <= debrisTarget(s.sector, s.heat, !!e) || mass === 0) { spawnLarge(s); s.spawnT = 2; }
    else s.spawnT = 0.4;
  }
  return s;
}

// where a LAG SPIKE will put the ball: the oldest sample at least LAG_BACK old
export function lagTarget(s) {
  let past = null;
  for (const h of s.history) { if (s.t - h.t >= TUNE.LAG_BACK) past = h; else break; }
  return past || s.history[0] || null;
}
// QUANTUM SHIFT: a piece only jumps if it would not land on the ball
export function shiftLands(s, o) {
  return o.kind === 'debris' && Math.hypot(-o.x - s.ball.x, -o.y - s.ball.y) > o.rad + TUNE.SHIFT_CLEAR;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BOT — plays the attract mode behind the menu, and the tests.
// It only gets what a player can see, and it answers with the same four
// controls. `skill` (0–1) is how far ahead it looks.
// ═══════════════════════════════════════════════════════════════════════════
const BOT_MOVES = [
  { turn: 0, thrust: false }, { turn: -1, thrust: false }, { turn: 1, thrust: false },
  { turn: 0, thrust: true }, { turn: -1, thrust: true }, { turn: 1, thrust: true }
];

export function botInput(s, skill = 1) {
  if (s.phase !== 'play') return { left: false, right: false, thrust: false, fire: false };
  const b = s.ball, e = s.eye;
  const r = dist(b) || 1, th = Math.atan2(b.y, b.x);
  const ux = b.x / r, uy = b.y / r;                       // straight out from the hole
  const range = TUNE.SHOT_SPEED * TUNE.SHOT_LIFE;

  // ── what to shoot: the nearest piece, led by how long a shot takes to get there ──
  let aim = null, aimD = Infinity;
  for (const o of s.objs) {
    if (o.kind !== 'debris' || o.age < o.warm - 0.3) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d < aimD) { aimD = d; aim = o; }
  }
  let aimA = null, aimTol = 0;
  if (e) {
    aimA = th + Math.PI; aimTol = Math.atan2(s.holeR * 0.8, r);      // THE EYE is the target
  } else if (aim) {
    const t = aimD / TUNE.SHOT_SPEED;
    const tx = aim.x + aim.vx * t - b.x, ty = aim.y + aim.vy * t - b.y;
    aimA = Math.atan2(ty, tx); aimTol = Math.atan2(aim.rad * 0.8, Math.hypot(tx, ty));
  }

  // ── where to be: a comfortable height, not moving fast ──
  let lo = Math.max(125, s.holeR + 60), hi = 240;
  if (e && e.lid !== 'shut') {
    // the gaze is coming round: be at the gap when it gets here
    for (let i = 0; i < e.beams; i++) {
      let gap = angDiff(e.gazeTh + i * Math.PI, th);
      if (gap < 0) gap += TAU;                             // how far it has to turn to reach the ball
      const t = gap / e.gazeW;
      if (t < 2.6) { const g = gapRadius(e, i, t); lo = Math.max(s.holeR + 34, g - 14); hi = g + 14; break; }
    }
  }
  const vr = b.vx * ux + b.vy * uy;                        // speed away from the hole
  const ahead = r + vr * 0.6;
  let wantA = aimA, wantThrust = false;
  const speed = Math.hypot(b.vx, b.vy);
  // Once it starts climbing it keeps going until it is well clear, so that it
  // spends its time aiming and not hovering on the line. (The one thing the
  // bot remembers from one decision to the next.)
  if (ahead < lo) s.botClimb = true;
  else if (ahead > lo + 55) s.botClimb = false;
  if (s.botClimb) { wantA = th; wantThrust = true; }                       // climb
  else if (ahead > hi) { wantA = th + Math.PI; wantThrust = true; }        // come back in
  else if (speed > 170) { wantA = Math.atan2(-b.vy, -b.vx); wantThrust = true; }   // brake
  const steer = (a) => {
    const d = a === null ? 0 : angDiff(b.a, a);
    return { turn: Math.abs(d) < 0.06 ? 0 : d > 0 ? 1 : -1, off: Math.abs(d) };
  };
  const want = steer(wantA);
  const desired = { turn: want.turn, thrust: wantThrust && want.off < 0.6 };

  // ── will that get it hit? If so, try the other things it could do. ──
  const horizonT = 0.5 + 0.9 * skill;
  let move = desired;
  if (botRollout(s, desired, horizonT) < horizonT) {
    let best = -1;
    for (const m of BOT_MOVES) {
      const t = botRollout(s, m, horizonT);
      const score = Math.min(t, horizonT) + (m.turn === desired.turn ? 0.02 : 0) + (m.thrust === desired.thrust ? 0.01 : 0);
      if (score > best) { best = score; move = m; }
    }
  }

  // ── fire when something is in front of it ──
  let shoot = false;
  if (e) shoot = e.lid === 'open' && Math.abs(angDiff(b.a, th + Math.PI)) < aimTol;
  else {
    for (const o of s.objs) {
      if (o.kind !== 'debris' || o.age < o.warm - 0.15) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d > range) continue;
      const t = d / TUNE.SHOT_SPEED;
      const a = Math.atan2(o.y + o.vy * t - b.y, o.x + o.vx * t - b.x);
      if (Math.abs(angDiff(b.a, a)) < Math.atan2(o.rad * 0.9, d)) { shoot = true; break; }
    }
  }
  return { left: move.turn < 0, right: move.turn > 0, thrust: move.thrust, fire: shoot };
}

// Fly the ball with one move held for T seconds against where everything will
// be. Returns when it would be hit, or Infinity.
function botRollout(s, move, T) {
  const b = s.ball, e = s.eye, dt = 1 / 20;
  const fast = s.rule.id === 'overclock' ? TUNE.OVERCLOCK : 1;
  const breath = s.surge.state === 'on' ? TUNE.SURGE_PULL : 1;
  const junk = [];
  for (const o of s.objs) if (o.kind === 'debris') junk.push({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, hit: o.rad * 0.88 + TUNE.BALL_R + 7, wait: Math.max(0, o.warm - o.age) });
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, a = b.a, inv = b.inv, freeze = s.freeze;
  let gazeTh = e ? e.gazeTh : 0, ahead = 0;
  for (let t = 0; t < T; t += dt) {
    // the move for the first part, then let go and see where that leaves it
    const on = t < 0.45;
    if (on) a += move.turn * TUNE.TURN * dt;
    let r = Math.hypot(x, y) || 1;
    const pull = gravity(r) * breath;
    vx += ((on && move.thrust ? Math.cos(a) * TUNE.THRUST : 0) - (x / r) * pull) * dt;
    vy += ((on && move.thrust ? Math.sin(a) * TUNE.THRUST : 0) - (y / r) * pull) * dt;
    const drag = Math.exp(-TUNE.DRAG * dt);
    vx *= drag; vy *= drag;
    x += vx * dt; y += vy * dt;
    r = Math.hypot(x, y);
    if (r > TUNE.R_OUT) { x = -x; y = -y; }
    inv -= dt;
    if (r <= s.holeR + TUNE.BALL_R + 8) return t;
    const dtObj = freeze > 0 ? 0 : dt * fast;
    freeze -= dt;
    for (const o of junk) {
      o.x += o.vx * dtObj; o.y += o.vy * dtObj;
      if (o.x * o.x + o.y * o.y > TUNE.R_OUT * TUNE.R_OUT && o.x * o.vx + o.y * o.vy > 0) { o.x = -o.x; o.y = -o.y; }
      if (o.wait > 0) { o.wait -= dt; continue; }
      if (inv <= 0 && Math.hypot(o.x - x, o.y - y) < o.hit) return t;
    }
    if (e && e.lid !== 'shut' && dtObj > 0) {
      gazeTh += e.gazeW * dt; ahead += dt;
      const bth = Math.atan2(y, x);
      for (let i = 0; i < e.beams; i++) {
        const across = Math.abs(angDiff(gazeTh + i * Math.PI, bth)) * r;
        if (inv <= 0 && across < TUNE.BEAM_HALF + TUNE.BALL_R + 4 && Math.abs(r - gapRadius(e, i, ahead)) > e.gapHalf - TUNE.BALL_R - 4) return t;
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
    broken: s.stats.broken,
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
