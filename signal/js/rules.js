// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL LOST — rules
//
// The classic this cabinet is a glitched take on is the maze chase: a maze
// full of things to collect, four chasers that each hunt in their own way, a
// few items that turn the chase round for a while, and a tunnel from one side
// of the screen to the other. Clear every packet and the maze is yours.
//
// What the glitch adds is Glitch Pong's: Heat, THE EYE arriving when Heat is
// full, a dash on a cooldown, and ten mazes that are Glitch Pong's arenas,
// each with the one rule that arena has.
//
// The whole game is here as numbers. Nothing touches the page or the canvas,
// so tests/signal-rules.test.mjs plays it under Node with the same bot that
// runs the attract mode behind the menu. js/game.js draws what this decides.
//
// Positions are in tiles. Time is in seconds. Speeds are tiles a second.
// ═══════════════════════════════════════════════════════════════════════════

export const W = 21, H = 21;
// right, down, left, up
export const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
export const opposite = (d) => (d + 2) % 4;
export const idx = (x, y) => y * W + x;
export const xy = (i) => ({ x: i % W, y: Math.floor(i / W) });

export const TUNE = {
  BALLS: 3, MAX_BALLS: 5,
  SPEED: 6.5,                 // the ball
  CHASER: 5.0,                // the static, in maze 1
  CHASER_STEP: 0.12,          // ...and how much faster each maze after
  CHASER_MAX: 6.1,            // never as fast as the ball
  FRIGHT_SPEED: 3.4, TUNNEL_SPEED: 3.4, HOME_SPEED: 12,
  DASH_MULT: 2, DASH_T: 0.4, DASH_COOL: 6,
  FRIGHT: 7, FRIGHT_STEP: 0.4, FRIGHT_MIN: 3,
  SCATTER: 5, CHASE: 18,
  RELEASE: [0, 3, 8, 14],     // seconds into a maze each chaser leaves the pen
  HIT: 0.62,                  // how close is touching, in tiles
  CLOSE: 1.5, CLEAR_OF: 2.6,  // a close call: this near, then this far, alive
  PACKET: 10, OVERRIDE: 50, CATCH: 150, CLOSE_CALL: 25, EYE_BONUS: 1000,
  HEAT_PACKET: 0.5, HEAT_CLOSE: 5, HEAT_CATCH: 6, HEAT_DECAY: 0.4, HEAT_LOSS: 30, HEAT_AFTER_EYE: 40,
  CRITICAL: 80,
  INTRO: 3.2, CLEAR: 2.4, RESET: 1.6,
  CHAIN_WINDOW: 1.2,
  // THE EYE: it looks down the corridor you are in, then fires along it
  EYE_SHOTS: 4, EYE_WARN: 1.15, EYE_FIRE: 0.35, EYE_GAP: 1.3, LAIR_EVERY: 5.5,
  // the arenas' rules
  LEAK_EVERY: 6, LEAK_MAX: 8, WALL_WARN: 1.5,
  DEFRAG_EVERY: 8,
  TRAIN_EVERY: 10, TRAIN_WARN: 1.6, TRAIN_FIRE: 0.8,
  ECHO_DELAY: 3.5,
  LAG_BEHIND: 3,              // seconds: where LAG thinks you are
  LOYAL_INV: 2
};

// What a maze pays into the Glitchcade's wallet: the same as a Breakpoint sector.
export const COINS = { maze: 2, lair: 10 };

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

// Heat multiplies everything, on the same steps as the other cabinets.
export function heatMultiplier(heat) { return heat >= 75 ? 3 : heat >= 50 ? 2 : heat >= 25 ? 1.5 : 1; }
export function clearBonus(n) { return 500 + 100 * n; }

// ── the ten mazes: Glitch Pong's arenas, each with the one rule that arena has ──
export const MAZES = [
  { rule: 'standard', name: 'GLITCH ARENA', line: 'NO TRICKS. TAKE EVERY PACKET. DO NOT GET CAUGHT.', seed: 11, loops: 0.34, tunnel: 9 },
  { rule: 'overflow', name: 'STACK OVERFLOW', line: 'THE TOP AND BOTTOM WRAP AS WELL AS THE SIDES.', seed: 23, loops: 0.3, tunnel: 11 },
  { rule: 'panic', name: 'KERNEL PANIC', line: 'LIGHTS OUT. YOU CAN SEE WHAT IS NEAR YOU.', seed: 37, loops: 0.32, tunnel: 9 },
  { rule: 'coolant', name: 'COOLANT LEAK', line: 'THE FLOOR IS ICE. YOU CANNOT TURN BACK.', seed: 41, loops: 0.36, tunnel: 5 },
  { rule: 'portal', name: 'QUANTUM SHIFT', line: 'TWO LINKED PORTALS. IN ONE, OUT THE OTHER.', seed: 53, loops: 0.28, tunnel: 15 },
  { rule: 'leak', name: 'MEMORY LEAK', line: 'CORRIDORS YOU HAVE EMPTIED CLOSE BEHIND YOU.', seed: 67, loops: 0.4, tunnel: 9 },
  { rule: 'echo', name: 'ECHO', line: 'YOUR ECHO FOLLOWS YOUR PATH. DO NOT MEET IT.', seed: 71, loops: 0.34, tunnel: 11 },
  { rule: 'defrag', name: 'DEFRAG', line: 'THE WALLS REARRANGE. WATCH FOR THE WARNING.', seed: 83, loops: 0.3, tunnel: 5 },
  { rule: 'train', name: 'LAST TRAIN', line: 'A TRAIN RUNS THROUGH THE TUNNEL ROW. SIGNALS FLASH FIRST.', seed: 97, loops: 0.3, tunnel: 9 },
  { rule: 'lair', name: "THE EYE'S LAIR", line: 'IT FIRES DOWN YOUR CORRIDOR. TURN A CORNER.', seed: 101, loops: 0.34, tunnel: 11 }
];
export const LAST_MAZE = MAZES.length;
export function mazeSpec(n) { return MAZES[(n - 1) % MAZES.length]; }
// after the tenth maze the ten come round again, faster
export function tierOf(n) { return Math.floor((n - 1) / MAZES.length); }
export function chaserSpeed(n) { return Math.min(TUNE.CHASER_MAX, TUNE.CHASER + TUNE.CHASER_STEP * (n - 1)); }
export function frightTime(n) { return Math.max(TUNE.FRIGHT_MIN, TUNE.FRIGHT - TUNE.FRIGHT_STEP * (n - 1)); }
// How often a chaser misjudges a junction: it hunts like a person, and gets better.
export function lapseChance(n) { return Math.max(0.05, 0.2 - 0.016 * (n - 1)); }

// ── the four chasers: pieces of static, each with one way of hunting ──
export const CHASERS = [
  { id: 'ping', name: 'PING', color: '#ff4d6d', how: 'GOES STRAIGHT FOR YOU.' },
  { id: 'cache', name: 'CACHE', color: '#ff58d9', how: 'GOES WHERE YOU ARE ABOUT TO BE.' },
  { id: 'mirror', name: 'MIRROR', color: '#ffd27a', how: 'COMES AT YOU FROM THE OTHER SIDE.' },
  { id: 'lag', name: 'LAG', color: '#9a5dff', how: 'GOES WHERE YOU WERE A MOMENT AGO.' }
];

// ═══════════════════════════════════════════════════════════════════════════
// THE MAZE
// A 21 x 21 grid. Corridors run through the odd rows and columns, so every
// junction is on an odd tile and every wall is one tile thick. The maze is
// the same left and right. The pen is in the middle, with a ring of corridor
// round it and a door in its roof.
// ═══════════════════════════════════════════════════════════════════════════
export const WALL = 0, OPEN = 1, PEN = 2, DOOR = 3;
export const START = idx(10, 13);          // where the ball starts
export const GATE = idx(10, 7);            // the corridor outside the pen's door
export const DOOR_CELL = idx(10, 8);
const PEN_PATH = [idx(10, 10), idx(10, 9), DOOR_CELL, GATE];
const inPen = (x, y) => x >= 9 && x <= 11 && y >= 9 && y <= 11;
const isNode = (x, y) => x % 2 === 1 && y % 2 === 1 && x >= 1 && x <= W - 2 && y >= 1 && y <= H - 2 && !inPen(x, y);

// The next cell in a direction, wrapping at a tunnel mouth. -1 for a wall.
export function stepCell(m, i, d, chaser = false) {
  const x = (i % W + DIRS[d].x + W) % W, y = (Math.floor(i / W) + DIRS[d].y + H) % H;
  const j = idx(x, y), v = m.grid[j];
  if (v === OPEN) return j;
  return chaser && (v === PEN || v === DOOR) ? j : -1;
}
export function openDirs(m, i) {
  const out = [];
  for (let d = 0; d < 4; d++) if (stepCell(m, i, d) >= 0) out.push(d);
  return out;
}
// Steps from `from` to every open cell (-1 where it can't be reached).
export function distances(m, from) {
  const dist = new Int16Array(W * H).fill(-1);
  const queue = [from];
  dist[from] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (let d = 0; d < 4; d++) {
      const j = stepCell(m, i, d);
      if (j >= 0 && dist[j] < 0) { dist[j] = dist[i] + 1; queue.push(j); }
    }
  }
  return dist;
}
// Is the maze still fair? Every open cell can be reached from the start, and
// none of them is a dead end. Every wall change is checked with this first.
export function mazeIsSound(m) {
  const dist = distances(m, START);
  for (let i = 0; i < W * H; i++) {
    if (m.grid[i] !== OPEN) continue;
    if (dist[i] < 0) return false;
    if (openDirs(m, i).length < 2) return false;
  }
  return true;
}

function generate(spec, attempt) {
  const rand = mulberry32(spec.seed * 7919 + attempt * 104729);
  const grid = new Uint8Array(W * H);
  const openBoth = (x, y) => { grid[idx(x, y)] = OPEN; grid[idx(W - 1 - x, y)] = OPEN; };
  // the left half's junctions, and a spanning tree through them
  const seen = new Set();
  const stack = [[1, 1]];
  seen.add(idx(1, 1));
  openBoth(1, 1);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = [[2, 0], [0, 2], [-2, 0], [0, -2]]
      .map(([dx, dy]) => [x + dx, y + dy, x + dx / 2, y + dy / 2])
      .filter(([nx, ny]) => nx <= 9 && isNode(nx, ny) && !seen.has(idx(nx, ny)));
    if (!next.length) { stack.pop(); continue; }
    const [nx, ny, ex, ey] = next[Math.floor(rand() * next.length)];
    seen.add(idx(nx, ny));
    openBoth(nx, ny); openBoth(ex, ey);
    stack.push([nx, ny]);
  }
  // the ring of corridor round the pen, and the two crossings between the halves
  for (const [x, y] of [[8, 7], [7, 8], [7, 10], [7, 12], [8, 13], [10, 7], [10, 13]]) openBoth(x, y);
  // every edge that could be opened: between two junctions, in the left half or on the middle line
  const edges = [];
  for (let y = 1; y <= H - 2; y++) for (let x = 1; x <= 10; x++) {
    if ((x % 2) === (y % 2)) continue;                      // a junction or a post, not an edge
    const a = x % 2 ? [x, y - 1] : [x - 1, y], b = x % 2 ? [x, y + 1] : [x + 1, y];
    if (isNode(a[0], a[1]) && isNode(b[0], b[1])) edges.push([x, y]);
  }
  const m = { grid };
  // no dead ends: open a wall beside each one until there are none
  for (let pass = 0; pass < 40; pass++) {
    let fixed = false;
    for (let y = 1; y <= H - 2; y += 2) for (let x = 1; x <= 9; x += 2) {
      if (!isNode(x, y) || openDirs(m, idx(x, y)).length >= 2) continue;
      const shut = edges.filter(([ex, ey]) => grid[idx(ex, ey)] === WALL && Math.abs(ex - x) + Math.abs(ey - y) === 1);
      if (!shut.length) continue;
      const [ex, ey] = shut[Math.floor(rand() * shut.length)];
      openBoth(ex, ey);
      fixed = true;
    }
    if (!fixed) break;
  }
  // and some loops, so there is always another way round
  for (const [ex, ey] of edges) if (grid[idx(ex, ey)] === WALL && rand() < spec.loops) openBoth(ex, ey);
  // the tunnel, and for STACK OVERFLOW two more through the top and bottom
  grid[idx(0, spec.tunnel)] = OPEN; grid[idx(W - 1, spec.tunnel)] = OPEN;
  if (spec.rule === 'overflow') for (const x of [5, 15]) { grid[idx(x, 0)] = OPEN; grid[idx(x, H - 1)] = OPEN; }
  // the pen
  for (let y = 9; y <= 11; y++) for (let x = 9; x <= 11; x++) grid[idx(x, y)] = PEN;
  grid[DOOR_CELL] = DOOR;
  return m;
}

// Build maze n. The same number always gives the same maze.
export function buildMaze(n) {
  const spec = mazeSpec(n);
  let m = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    m = generate(spec, attempt);
    if (mazeIsSound(m)) break;
  }
  m.rule = spec.rule;
  m.name = spec.name;
  m.tunnel = spec.tunnel;
  // packets everywhere but the start, the gate and the mouths of the tunnels
  m.packets = new Set();
  for (let i = 0; i < W * H; i++) {
    if (m.grid[i] !== OPEN || i === START || i === GATE) continue;
    const { x, y } = xy(i);
    if (x === 0 || x === W - 1 || y === 0 || y === H - 1) continue;
    m.packets.add(i);
  }
  // four overrides, one toward each corner
  m.overrides = new Set([idx(1, 3), idx(W - 2, 3), idx(1, H - 4), idx(W - 2, H - 4)]);
  for (const o of m.overrides) m.packets.delete(o);
  m.portals = spec.rule === 'portal' ? [idx(3, 5), idx(W - 4, H - 6)] : null;
  if (m.portals) for (const p of m.portals) m.packets.delete(p);
  m.total = m.packets.size + m.overrides.size;
  m.closed = [];                               // corridors MEMORY LEAK or DEFRAG has shut
  m.home = distances(m, GATE);                 // the way back to the pen, for a chaser that has been caught
  return m;
}
// the cells where a wall can come or go: between two junctions, away from the pen's ring
function edgeCells(m, want) {
  const out = [];
  for (let y = 1; y <= H - 2; y++) for (let x = 1; x <= W - 2; x++) {
    if ((x % 2) === (y % 2)) continue;
    const i = idx(x, y);
    if (m.grid[i] !== want) continue;
    if (x >= 6 && x <= 14 && y >= 6 && y <= 14) continue;       // leave the pen and its ring alone
    const a = x % 2 ? [x, y - 1] : [x - 1, y], b = x % 2 ? [x, y + 1] : [x + 1, y];
    if (isNode(a[0], a[1]) && isNode(b[0], b[1])) out.push(i);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// A RUN
// ═══════════════════════════════════════════════════════════════════════════
export function createRun(opts = {}) {
  const s = {
    rand: mulberry32(opts.seed === undefined ? (Math.random() * 2 ** 31) | 0 : opts.seed),
    moods: opts.moods !== false,
    t: 0, mazeT: 0, lastPacket: 0,
    n: 0, maze: null, phase: 'intro', phaseT: 0,
    score: 0, balls: TUNE.BALLS, heat: 0, critical: false,
    chain: 0, chainT: 0, bestChain: 0, caught: 0,
    ball: null, chasers: [], echo: null,
    mode: 'scatter', modeT: TUNE.SCATTER,
    dash: 0, dashCool: 0,
    line: null,                // a row or column about to be fired along: THE EYE's gaze, or the train
    eye: null, wall: null, trainT: 0, wallT: 0,
    history: [],
    loyalUsed: false, grudge: null,
    stats: { packets: 0, catches: 0, closeCalls: 0, ballsLost: 0, caughtBy: 0, mazes: 0, eyes: 0, coins: 0, dashes: 0, cause: '', by: '', time: 0, restored: false },
    events: []
  };
  beginMaze(s, opts.maze || 1);
  return s;
}

function emit(s, type, detail) { s.events.push(Object.assign({ type }, detail)); }
const mover = (cell) => ({ cell, next: cell, dir: -1, t: 0 });
// where something is, in tiles (it may be past the edge on its way through a tunnel)
export function pos(e) {
  const c = xy(e.cell);
  if (e.dir < 0) return c;
  return { x: c.x + DIRS[e.dir].x * e.t, y: c.y + DIRS[e.dir].y * e.t };
}
// the cell something is nearest to
export const cellOf = (e) => (e.dir >= 0 && e.t >= 0.5 ? e.next : e.cell);
function apart(a, b) {
  const p = pos(a), q = pos(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

function placeAll(s) {
  s.ball = Object.assign(mover(START), { want: -1, inv: 1, mourn: s.ball ? s.ball.mourn : 0, showoff: false, ported: false });
  s.chasers = CHASERS.map((c, k) => Object.assign(mover(k === 0 ? GATE : idx(9 + (k - 1), 10)), {
    id: c.id, k, state: k === 0 ? 'out' : 'pen', fright: 0, close: false, lapse: 0, ported: false, wait: TUNE.RELEASE[k]
  }));
  s.chasers[0].dir = s.rand() < 0.5 ? 0 : 2;
  s.chasers[0].next = stepCell(s.maze, GATE, s.chasers[0].dir);
  s.mode = 'scatter'; s.modeT = TUNE.SCATTER;
  s.mazeT = 0;
  s.line = null;
  s.caught = 0;
  s.dash = 0;
  s.history = [];
  s.echo = null;
  if (s.eye && !s.eye.lair) s.eye = null;
  if (s.eye) s.eye.t = TUNE.LAIR_EVERY;
}

function beginMaze(s, n) {
  s.n = n;
  s.maze = buildMaze(n);
  s.phase = 'intro';
  s.phaseT = TUNE.INTRO;
  s.loyalUsed = false;
  s.wall = null; s.wallT = TUNE.LEAK_EVERY; s.trainT = TUNE.TRAIN_EVERY * 0.6;
  s.eye = s.maze.rule === 'lair' ? { lair: true, shots: Infinity, t: TUNE.LAIR_EVERY } : null;
  placeAll(s);
  emit(s, 'maze', { n, rule: s.maze.rule });
}
// After the tenth maze the run has been won. This carries on into the eleventh.
export function continueRun(s) {
  if (s.phase !== 'won') return s;
  beginMaze(s, s.n + 1);
  return s;
}

function addScore(s, n) { s.score += n; return n; }

function loseBall(s, cause, by) {
  const p = pos(s.ball);
  s.balls--;
  s.stats.ballsLost++;
  s.stats.cause = cause; s.stats.by = by || '';
  if (cause === 'static') s.stats.caughtBy++;
  s.heat = Math.max(0, s.heat - TUNE.HEAT_LOSS);
  s.critical = s.heat >= TUNE.CRITICAL;
  s.chain = 0;
  s.grudge = by || null;
  if (s.eye && !s.eye.lair) s.eye = null;
  s.line = null;
  emit(s, 'ballLost', { cause, by: by || '', x: p.x, y: p.y, balls: s.balls });
  if (s.balls <= 0) { s.phase = 'over'; emit(s, 'gameOver', { cause }); return; }
  s.phase = 'reset';
  s.phaseT = TUNE.RESET;
  s.ball.mourn = 3.5;
}

// Something hit the ball. LOYAL: on the last ball it shrugs the first one off, once a maze.
function strike(s, cause, by) {
  if (s.ball.inv > 0) return;
  if (s.moods && s.balls === 1 && !s.loyalUsed) {
    s.loyalUsed = true;
    s.ball.inv = TUNE.LOYAL_INV;
    const p = pos(s.ball);
    emit(s, 'loyal', { x: p.x, y: p.y });
    return;
  }
  loseBall(s, cause, by);
}

function clearMaze(s) {
  const lair = s.maze.rule === 'lair';
  s.phase = 'clear';
  s.phaseT = TUNE.CLEAR;
  s.stats.mazes++;
  const coins = lair ? COINS.lair : COINS.maze;
  s.stats.coins += coins;
  const bonus = addScore(s, clearBonus(s.n) * heatMultiplier(s.heat));
  let extra = false;
  if (s.n % 3 === 0 && s.balls < TUNE.MAX_BALLS) { s.balls++; extra = true; }
  s.line = null;
  if (s.eye && !s.eye.lair) s.eye = null;
  emit(s, 'mazeClear', { n: s.n, lair, coins, bonus, extra });
}

// ── walking the corridors ──
// Move something `dist` tiles along its way, stopping at each tile centre to decide.
function advance(e, dist, atCentre) {
  let guard = 0;
  while (dist > 1e-9 && guard++ < 12) {
    if (e.dir < 0) { atCentre(e, false); if (e.dir < 0) return; }
    const left = 1 - e.t;
    if (dist < left) { e.t += dist; return; }
    dist -= left;
    e.cell = e.next; e.t = 0;
    atCentre(e, true);
  }
}
function head(m, e, d, chaser) {
  const j = d < 0 ? -1 : stepCell(m, e.cell, d, chaser);
  if (j < 0) { e.dir = -1; e.next = e.cell; return false; }
  e.dir = d; e.next = j;
  return true;
}
function usePortal(m, e) {
  if (!m.portals) return;
  const at = m.portals.indexOf(e.cell);
  if (at < 0) { e.ported = false; return; }
  if (e.ported) return;
  e.cell = m.portals[1 - at];
  e.ported = true;
}

function ballAtCentre(s, arrived) {
  const b = s.ball, m = s.maze;
  if (arrived) {
    usePortal(m, b);
    if (m.packets.delete(b.cell)) {
      s.chain++; s.chainT = TUNE.CHAIN_WINDOW; s.lastPacket = s.t;
      s.bestChain = Math.max(s.bestChain, s.chain);
      b.showoff = s.chain >= 20;
      s.stats.packets++;
      const pts = addScore(s, TUNE.PACKET * heatMultiplier(s.heat));
      s.heat = Math.min(100, s.heat + TUNE.HEAT_PACKET);
      emit(s, 'packet', { pts, cell: b.cell, chain: s.chain, left: m.packets.size + m.overrides.size });
    } else if (m.overrides.delete(b.cell)) {
      addScore(s, TUNE.OVERRIDE * heatMultiplier(s.heat));
      s.caught = 0;
      const t = frightTime(s.n);
      for (const c of s.chasers) if (c.state === 'out') { c.fright = t; c.turn = true; }
      emit(s, 'override', { cell: b.cell, time: t, left: m.packets.size + m.overrides.size });
    }
    if (m.packets.size + m.overrides.size === 0) { clearMaze(s); b.dir = -1; b.next = b.cell; return; }
  }
  const back = b.dir >= 0 ? opposite(b.dir) : -1;
  const ice = m.rule === 'coolant';
  // the turn that was asked for, if it is open; otherwise straight on
  if (b.want >= 0 && !(ice && b.want === back) && stepCell(m, b.cell, b.want) >= 0) { head(m, b, b.want); return; }
  if (b.dir >= 0 && stepCell(m, b.cell, b.dir) >= 0) { head(m, b, b.dir); return; }
  if (ice && b.dir >= 0) {
    // on ice it cannot stop: it slides round whichever corner is there
    const ways = openDirs(m, b.cell).filter((d) => d !== back);
    if (ways.length) { head(m, b, ways[0]); return; }
  }
  b.dir = -1; b.next = b.cell;
}

// where a chaser is trying to get to, in tiles
function targetOf(s, c) {
  const b = pos(s.ball);
  const scatter = [[W - 2, 1], [1, 1], [W - 2, H - 2], [1, H - 2]][c.k];
  if (s.mode === 'scatter' || (s.eye && !s.eye.lair)) return { x: scatter[0], y: scatter[1] };
  if (c.id === 'cache') {
    const d = s.ball.dir >= 0 ? DIRS[s.ball.dir] : { x: 0, y: 0 };
    return { x: b.x + d.x * 4, y: b.y + d.y * 4 };
  }
  if (c.id === 'mirror') {
    const me = pos(c);
    if (Math.hypot(me.x - b.x, me.y - b.y) < 6) return b;         // close enough: it turns on you
    return { x: W - 1 - b.x, y: b.y };
  }
  if (c.id === 'lag') {
    let past = null;
    for (const h of s.history) { if (s.t - h.t >= TUNE.LAG_BEHIND) past = h; else break; }
    return past || b;
  }
  return b;
}

function chaserAtCentre(s, c, arrived) {
  const m = s.maze;
  if (c.state === 'leaving') {
    const at = PEN_PATH.indexOf(c.cell);
    if (c.cell === GATE) {
      c.state = 'out';
      head(m, c, s.rand() < 0.5 ? 0 : 2);
      return;
    }
    const to = PEN_PATH[at + 1];
    for (let d = 0; d < 4; d++) if (stepCell(m, c.cell, d, true) === to) { c.dir = d; c.next = to; return; }
    return;
  }
  if (c.state === 'home') {
    if (c.cell === GATE || m.grid[c.cell] === DOOR || m.grid[c.cell] === PEN) {
      // down through the door, wait a moment, come out again
      const at = PEN_PATH.indexOf(c.cell);
      if (at <= 0) { c.state = 'pen'; c.wait = 1.5; c.dir = -1; c.next = c.cell; c.fright = 0; return; }
      const to = PEN_PATH[at - 1];
      for (let d = 0; d < 4; d++) if (stepCell(m, c.cell, d, true) === to) { c.dir = d; c.next = to; return; }
      return;
    }
    let best = -1, bd = Infinity;
    for (let d = 0; d < 4; d++) { const j = stepCell(m, c.cell, d); if (j >= 0 && m.home[j] >= 0 && m.home[j] < bd) { bd = m.home[j]; best = d; } }
    head(m, c, best);
    return;
  }
  if (c.state !== 'out') return;
  if (arrived) usePortal(m, c);
  const back = c.dir >= 0 ? opposite(c.dir) : -1;
  let ways = openDirs(m, c.cell);
  // it does not turn back on itself, except the moment the chase turns round
  if (c.turn && back >= 0 && ways.includes(back)) { c.turn = false; head(m, c, back); return; }
  c.turn = false;
  if (ways.length > 1) ways = ways.filter((d) => d !== back);
  let pick = ways[0];
  if (ways.length > 1) {
    if (c.fright > 0) pick = ways[Math.floor(s.rand() * ways.length)];        // it runs anywhere
    else if (s.rand() < lapseChance(s.n)) {
      // it misjudges the junction, the way a person does
      pick = ways[Math.floor(s.rand() * ways.length)];
      c.lapse = 0.8;
    } else {
      const t = targetOf(s, c);
      let bd = Infinity;
      for (const d of ways) {
        const j = xy(stepCell(m, c.cell, d));
        const dd = (j.x - t.x) ** 2 + (j.y - t.y) ** 2;
        if (dd < bd) { bd = dd; pick = d; }
      }
    }
  }
  head(m, c, pick);
}

// the straight run of corridor through a cell, along a row (axis 0) or a column (axis 1)
export function corridorRun(m, cell, axis) {
  const run = new Set([cell]);
  for (const d of axis === 0 ? [0, 2] : [1, 3]) {
    let i = cell;
    for (let k = 0; k < W; k++) { i = stepCell(m, i, d); if (i < 0 || run.has(i)) break; run.add(i); }
  }
  return run;
}
// Is something standing in a line that is firing? It is out once it is a third
// of the way into a tile that is not on the line, and not in until it is most
// of the way onto one: the benefit of the doubt goes to whoever is leaving.
export function onLine(line, e) {
  const here = line.cells.has(e.cell), ahead = e.dir >= 0 && line.cells.has(e.next);
  if (e.dir < 0) return here;
  if (here && ahead) return true;
  if (here) return e.t < 0.33;
  return ahead && e.t > 0.72;
}
function startLine(s, cells, warn, fire, cause) {
  s.line = { cells, state: 'warn', t: warn, fire, cause };
  emit(s, 'lineWarn', { cause });
}

// A wall coming or going. Nothing changes unless the maze is still sound afterwards.
function planWall(s) {
  const m = s.maze, defrag = m.rule === 'defrag';
  if (m.rule === 'leak' && m.closed.length >= TUNE.LEAK_MAX) return;
  const near = (i) => [s.ball, ...s.chasers].some((e) => { const p = pos(e), c = xy(i); return Math.hypot(p.x - c.x, p.y - c.y) < 2.5; });
  const shuttable = edgeCells(m, OPEN).filter((i) => !m.packets.has(i) && !m.overrides.has(i) && !near(i));
  let shut = -1;
  for (let tries = 0; tries < 12 && shuttable.length; tries++) {
    const i = shuttable.splice(Math.floor(s.rand() * shuttable.length), 1)[0];
    m.grid[i] = WALL;
    const ok = mazeIsSound(m);
    m.grid[i] = OPEN;
    if (ok) { shut = i; break; }
  }
  let open = -1;
  if (defrag) {
    const walls = edgeCells(m, WALL);
    if (walls.length) open = walls[Math.floor(s.rand() * walls.length)];
  }
  if (shut < 0 && open < 0) return;
  s.wall = { shut, open, t: TUNE.WALL_WARN };
  emit(s, 'wallWarn', { shut, open });
}
function applyWall(s) {
  const m = s.maze, w = s.wall;
  s.wall = null;
  if (w.open >= 0) m.grid[w.open] = OPEN;
  if (w.shut >= 0) {
    const on = [s.ball, ...s.chasers].some((e) => e.cell === w.shut || e.next === w.shut);
    m.grid[w.shut] = WALL;
    if (on || !mazeIsSound(m)) m.grid[w.shut] = OPEN;        // someone is in the way, or it would trap: leave it
    else m.closed.push(w.shut);
  }
  m.home = distances(m, GATE);
  emit(s, 'wallMove', { shut: m.grid[w.shut] === WALL ? w.shut : -1, open: w.open });
}

// Advance the run by dt seconds. `input` is { dir: 0–3 or -1, dash }.
export function step(s, input, dt) {
  if (s.phase === 'over' || s.phase === 'won') return s;
  const b = s.ball, m = s.maze, inp = input || {};
  s.t += dt;
  if (inp.dir >= 0 && inp.dir <= 3) b.want = inp.dir;

  if (s.phase !== 'play') {
    b.mourn = Math.max(0, b.mourn - dt);
    s.phaseT -= dt;
    if (s.phaseT > 0) return s;
    if (s.phase === 'intro') { s.phase = 'play'; emit(s, 'go', { n: s.n }); }
    else if (s.phase === 'reset') { placeAll(s); s.phase = 'play'; emit(s, 'respawn'); }
    else if (s.phase === 'clear') {
      if (s.n === LAST_MAZE) { s.phase = 'won'; s.stats.restored = true; emit(s, 'restored', { score: Math.floor(s.score) }); }
      else beginMaze(s, s.n + 1);
    }
    return s;
  }

  s.stats.time += dt;
  s.mazeT += dt;
  b.inv = Math.max(0, b.inv - dt);
  b.mourn = Math.max(0, b.mourn - dt);
  s.dash = Math.max(0, s.dash - dt);
  s.dashCool = Math.max(0, s.dashCool - dt);

  // ── the dash: Glitch Pong's burst, on a cooldown ──
  if (inp.dash && s.dashCool <= 0 && b.dir >= 0) {
    s.dash = TUNE.DASH_T; s.dashCool = TUNE.DASH_COOL;
    s.stats.dashes++;
    emit(s, 'dash');
  }

  // ── the ball ──
  if (b.want >= 0 && b.dir >= 0 && b.want === opposite(b.dir) && b.t > 0 && m.rule !== 'coolant') {
    // it can turn back anywhere along a corridor
    const from = b.cell;
    b.cell = b.next; b.next = from; b.t = 1 - b.t; b.dir = b.want;
  }
  advance(b, TUNE.SPEED * (s.dash > 0 ? TUNE.DASH_MULT : 1) * dt, (e, arrived) => ballAtCentre(s, arrived));
  if (s.phase !== 'play') return s;
  const bp = pos(b);
  s.history.push({ t: s.t, x: bp.x, y: bp.y, cell: cellOf(b) });
  while (s.history.length && s.t - s.history[0].t > TUNE.ECHO_DELAY + 0.5) s.history.shift();

  // ── rally ──
  if (s.chain > 0) { s.chainT -= dt; if (s.chainT <= 0) { s.chain = 0; b.showoff = false; } }

  // ── Heat ──
  s.heat = clamp(s.heat - TUNE.HEAT_DECAY * dt, 0, 100);
  if (!s.critical && s.heat >= TUNE.CRITICAL) { s.critical = true; emit(s, 'heatCritical'); }
  else if (s.critical && s.heat < TUNE.CRITICAL - 20) { s.critical = false; }
  // at full Heat THE EYE arrives, as it does in Glitch Pong
  if (s.heat >= 99 && !s.eye) {
    s.eye = { lair: false, shots: TUNE.EYE_SHOTS, t: 1.2 };
    for (const c of s.chasers) c.turn = true;
    emit(s, 'eyeArrive');
  }

  // ── hunt, then back off, then hunt ──
  s.modeT -= dt;
  if (s.modeT <= 0) {
    s.mode = s.mode === 'scatter' ? 'chase' : 'scatter';
    s.modeT = s.mode === 'scatter' ? Math.max(2.5, TUNE.SCATTER - 0.25 * (s.n - 1)) : TUNE.CHASE;
    for (const c of s.chasers) c.turn = true;
    emit(s, 'mode', { mode: s.mode });
  }

  // ── the static ──
  const fast = chaserSpeed(s.n);
  for (const c of s.chasers) {
    c.lapse = Math.max(0, c.lapse - dt);
    if (c.state === 'pen') {
      c.wait -= dt;
      if (c.wait <= 0) { c.state = 'leaving'; c.cell = PEN_PATH[0]; c.next = c.cell; c.dir = -1; c.t = 0; emit(s, 'release', { id: c.id }); }
      continue;
    }
    if (c.fright > 0 && c.state === 'out') c.fright = Math.max(0, c.fright - dt);
    const cx = c.cell % W, inTunnel = Math.floor(c.cell / W) === m.tunnel && (cx <= 2 || cx >= W - 3);
    const speed = c.state === 'home' ? TUNE.HOME_SPEED : c.state === 'leaving' ? fast * 0.7 : c.fright > 0 ? TUNE.FRIGHT_SPEED : inTunnel ? TUNE.TUNNEL_SPEED : fast;
    advance(c, speed * dt, (e, arrived) => chaserAtCentre(s, c, arrived));
    if (c.state !== 'out') continue;
    const d = apart(b, c);
    if (c.fright > 0) {
      if (d < TUNE.HIT) {
        // the chase has turned round: the ball takes it
        const grudge = s.moods && s.grudge === c.id;
        const pts = addScore(s, TUNE.CATCH * 2 ** Math.min(3, s.caught) * heatMultiplier(s.heat) * (grudge ? 2 : 1));
        s.caught++;
        s.stats.catches++;
        if (grudge) s.grudge = null;
        s.heat = Math.min(100, s.heat + TUNE.HEAT_CATCH);
        c.state = 'home'; c.fright = 0; c.close = false;
        const p = pos(c);
        emit(s, 'catch', { id: c.id, pts, grudge, x: p.x, y: p.y });
      }
      continue;
    }
    if (d < TUNE.HIT) {
      strike(s, 'static', c.id);
      if (s.phase !== 'play') return s;
    } else if (d < TUNE.CLOSE) c.close = true;
    else if (c.close && d > TUNE.CLEAR_OF) {
      // it was right on you, and now it isn't
      c.close = false;
      s.stats.closeCalls++;
      const pts = addScore(s, Math.round(TUNE.CLOSE_CALL * heatMultiplier(s.heat)));
      s.heat = Math.min(100, s.heat + TUNE.HEAT_CLOSE);
      emit(s, 'closeCall', { id: c.id, pts, x: bp.x, y: bp.y });
    }
  }

  // ── ECHO: the ball's own path, a few seconds late ──
  if (m.rule === 'echo' && s.mazeT > TUNE.ECHO_DELAY + 0.3) {
    let at = null;
    for (const h of s.history) { if (s.t - h.t >= TUNE.ECHO_DELAY) at = h; else break; }
    if (at) {
      s.echo = { x: at.x, y: at.y };
      if (Math.hypot(at.x - bp.x, at.y - bp.y) < TUNE.HIT) { strike(s, 'echo'); if (s.phase !== 'play') return s; }
    }
  }

  // ── THE EYE: it looks down the corridor you are in, then fires along it ──
  const e = s.eye;
  if (e && !s.line) {
    e.t -= dt;
    if (e.t <= 0) {
      if (e.shots <= 0) {
        s.eye = null;
        s.stats.eyes++;
        const pts = addScore(s, TUNE.EYE_BONUS * heatMultiplier(s.heat));
        s.heat = TUNE.HEAT_AFTER_EYE;
        emit(s, 'eyeSurvived', { pts });
      } else {
        const axis = b.dir >= 0 ? b.dir % 2 : (corridorRun(m, cellOf(b), 0).size >= corridorRun(m, cellOf(b), 1).size ? 0 : 1);
        startLine(s, corridorRun(m, cellOf(b), axis), TUNE.EYE_WARN, TUNE.EYE_FIRE, 'gaze');
        e.shots--;
        e.t = e.lair ? TUNE.LAIR_EVERY : TUNE.EYE_GAP;
      }
    }
  }
  // ── LAST TRAIN: along the tunnel row, on a schedule ──
  if (m.rule === 'train' && !s.line) {
    s.trainT -= dt;
    if (s.trainT <= 0) {
      s.trainT = TUNE.TRAIN_EVERY;
      const row = new Set();
      for (let x = 0; x < W; x++) if (m.grid[idx(x, m.tunnel)] === OPEN) row.add(idx(x, m.tunnel));
      startLine(s, row, TUNE.TRAIN_WARN, TUNE.TRAIN_FIRE, 'train');
    }
  }
  if (s.line) {
    const l = s.line;
    l.t -= dt;
    if (l.state === 'warn' && l.t <= 0) { l.state = 'fire'; l.t = l.fire; emit(s, 'lineFire', { cause: l.cause }); }
    else if (l.state === 'fire' && l.t <= 0) s.line = null;
    if (l.state === 'fire' && s.line) {
      if (onLine(l, b)) { strike(s, l.cause); if (s.phase !== 'play') return s; }
      // the train takes the static with it
      if (l.cause === 'train') for (const c of s.chasers) if (c.state === 'out' && onLine(l, c)) { c.state = 'home'; c.fright = 0; }
    }
  }

  // ── MEMORY LEAK and DEFRAG: the walls move ──
  if (m.rule === 'leak' || m.rule === 'defrag') {
    if (s.wall) { s.wall.t -= dt; if (s.wall.t <= 0) applyWall(s); }
    else {
      s.wallT -= dt;
      if (s.wallT <= 0) { s.wallT = m.rule === 'leak' ? TUNE.LEAK_EVERY : TUNE.DEFRAG_EVERY; planWall(s); }
    }
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BOT — plays the attract mode behind the menu, and the tests.
// It only gets what a player can see, and it answers with a direction and
// the dash. `skill` (0–1) is how much room it leaves the static.
// ═══════════════════════════════════════════════════════════════════════════
export function botInput(s, skill = 1) {
  if (s.phase !== 'play') return { dir: -1, dash: false };
  const m = s.maze, b = s.ball, ice = m.rule === 'coolant';
  const port = (j) => (m.portals && m.portals.includes(j) ? m.portals[1 - m.portals.indexOf(j)] : j);
  const moving = b.dir >= 0;
  const reach = Math.round(6 + 3 * skill);                 // how many tiles ahead it thinks
  const horizon = reach / TUNE.SPEED;

  // how far every cell is from the nearest thing worth having
  const toPacket = new Int16Array(W * H).fill(-1);
  const queue = [];
  for (const i of m.packets) { toPacket[i] = 0; queue.push(i); }
  for (const i of m.overrides) { toPacket[i] = 0; queue.push(i); }
  for (const c of s.chasers) if (c.state === 'out' && c.fright > 2) { const at = cellOf(c); if (toPacket[at] !== 0) { toPacket[at] = 0; queue.push(at); } }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (let d = 0; d < 4; d++) { const j = stepCell(m, i, d); if (j >= 0 && toPacket[j] < 0) { toPacket[j] = toPacket[i] + 1; queue.push(j); } }
  }

  // Nothing near, nothing about to fire: just go for the nearest packet.
  let nearest = Infinity;
  for (const c of s.chasers) if (c.state === 'out' && c.fright <= 0.6) nearest = Math.min(nearest, apart(b, c));
  if (nearest > 7 && !s.line && m.rule !== 'echo') {
    const from = moving ? port(b.next) : b.cell;
    let dir = moving ? b.dir : -1, bd = toPacket[from] < 0 ? Infinity : toPacket[from];
    if (moving && !ice && toPacket[b.cell] >= 0 && toPacket[b.cell] + 2 * b.t < bd + 2 * (1 - b.t) - 1) return { dir: opposite(b.dir), dash: false };
    for (let d = 0; d < 4; d++) {
      if (moving && d === opposite(b.dir)) continue;
      const j = stepCell(m, from, d);
      if (j >= 0 && toPacket[port(j)] >= 0 && toPacket[port(j)] < bd) { bd = toPacket[port(j)]; dir = d; }
    }
    return { dir, dash: false };
  }

  // every way it could go for the next few tiles: a list of the turns to take
  const routes = [];
  const walk = (cell, came, left, turns, begin) => {
    if (left === 0 || routes.length > 160) { routes.push({ begin, turns }); return; }
    let ways = [];
    for (let d = 0; d < 4; d++) if (stepCell(m, cell, d) >= 0 && (came < 0 || d !== opposite(came))) ways.push(d);
    if (!ways.length && came >= 0) ways = [opposite(came)];
    for (const d of ways) walk(port(stepCell(m, cell, d)), d, left - 1, turns.concat(d), begin);
  };
  if (!moving) walk(b.cell, -1, reach, [], 'stopped');
  else {
    walk(port(b.next), b.dir, reach - 1, [], 'on');
    if (!ice && b.t > 0) walk(b.cell, opposite(b.dir), reach - 1, [], 'back');
  }

  // fly each one against what the static will do, and keep the best
  const threats = s.chasers.filter((c) => c.state !== 'pen' || c.wait < horizon);
  let best = null, bestScore = -Infinity;
  const lineFires = s.line ? (s.line.state === 'warn' ? s.line.t : 0) : Infinity;
  const lineEnds = s.line ? lineFires + (s.line.state === 'warn' ? s.line.fire : s.line.t) : -1;
  for (const route of routes) {
    const ball = { cell: b.cell, next: b.next, dir: b.dir, t: b.t, ported: b.ported };
    if (route.begin === 'back') { ball.cell = b.next; ball.next = b.cell; ball.t = 1 - b.t; ball.dir = opposite(b.dir); }
    const sim = {
      maze: m, n: s.n, mode: s.mode, eye: s.eye, history: s.history, t: s.t, ball,
      rand: () => 0.999,                                    // the static at its best: no misjudged junctions
      chasers: threats.map((c) => Object.assign({}, c))
    };
    let k = 0, got = 0, dead = -1, override = false;
    const seen = new Set();
    const turn = (e, arrived) => {
      if (arrived) {
        usePortal(m, e);
        if (!seen.has(e.cell)) { seen.add(e.cell); if (m.packets.has(e.cell)) got++; else if (m.overrides.has(e.cell)) override = true; }
      }
      head(m, e, k < route.turns.length ? route.turns[k++] : -1);
    };
    const dt = 1 / 16, fast = chaserSpeed(s.n);
    for (let t = 0; t < horizon && dead < 0; t += dt) {
      advance(ball, TUNE.SPEED * dt, turn);
      const at = cellOf(ball);
      if (s.line && t > lineFires - 0.2 && t < lineEnds + 0.1 && (onLine(s.line, ball) || s.line.cells.has(at))) { dead = t; break; }
      if (m.rule === 'echo') {
        // its own echo: where it was ECHO_DELAY ago, counted from then
        const p = pos(ball);
        let h = null;
        for (const past of s.history) { if (s.t + t - past.t >= TUNE.ECHO_DELAY) h = past; else break; }
        if (h && s.mazeT + t > TUNE.ECHO_DELAY + 0.3 && Math.hypot(h.x - p.x, h.y - p.y) < TUNE.HIT + 0.25) { dead = t; break; }
      }
      for (const c of sim.chasers) {
        if (c.state === 'pen') { c.wait -= dt; if (c.wait <= 0) { c.state = 'leaving'; c.cell = PEN_PATH[0]; c.next = c.cell; c.dir = -1; c.t = 0; } continue; }
        if (c.fright > 0) c.fright -= dt;
        const speed = c.state === 'home' ? TUNE.HOME_SPEED : c.state === 'leaving' ? fast * 0.7 : c.fright > 0 ? TUNE.FRIGHT_SPEED : fast;
        advance(c, speed * dt, (e, arrived) => chaserAtCentre(sim, c, arrived));
        if (c.state === 'out' && c.fright <= 0 && !override && apart(ball, c) < TUNE.HIT + 0.25) { dead = t; break; }
      }
    }
    let score;
    if (dead >= 0) score = -100 + dead * 10;
    else {
      // alive at the end: what it picked up, how near the next packet is, and how much room it has
      let room = Infinity;
      for (const c of sim.chasers) if (c.state === 'out' && c.fright <= 0) room = Math.min(room, apart(ball, c));
      const next = toPacket[cellOf(ball)];
      score = got + (override ? (nearest < 5 ? 6 : 0.5) : 0) - (next < 0 ? 0 : next * 0.25) + Math.min(room, 6) * 0.35;
    }
    if (score > bestScore) { bestScore = score; best = route; }
  }

  let dir = -1;
  if (best) dir = best.begin === 'back' ? opposite(b.dir) : best.turns.length ? best.turns[0] : b.dir;
  const cornered = bestScore < -50 || nearest < 2.2 || (s.line && s.line.cells.has(cellOf(b)) && s.line.t < 0.5);
  return { dir, dash: !!cornered && s.dashCool <= 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// AFTER A RUN
// ═══════════════════════════════════════════════════════════════════════════
export const CAUSES = {
  static: 'CAUGHT BY',
  echo: 'RAN INTO ITS OWN ECHO',
  gaze: 'THE EYE LOOKED DOWN THE CORRIDOR',
  train: 'STOOD ON THE TRACKS'
};
export function runRecap(s) {
  const who = CHASERS.find((c) => c.id === s.stats.by);
  return {
    score: Math.floor(s.score),
    maze: s.n,
    mazes: s.stats.mazes,
    packets: s.stats.packets,
    catches: s.stats.catches,
    closeCalls: s.stats.closeCalls,
    bestChain: s.bestChain,
    coins: s.stats.coins,
    eyes: s.stats.eyes,
    restored: s.stats.restored,
    time: Math.round(s.stats.time),
    cause: s.stats.cause ? CAUSES[s.stats.cause] + (s.stats.cause === 'static' && who ? ' ' + who.name : '') : ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SAVE — what the static keeps. Stored in the browser under SAVE_KEY and
// carried by Glitch Pong's save export.
// ═══════════════════════════════════════════════════════════════════════════
export const SAVE_KEY = 'glitchcade_signal_v1';
export const PAD_SIDES = ['left', 'right', 'off'];
export function defaultSave() {
  return {
    v: 1,
    best: 0, bestMaze: 0,
    runs: 0,
    ballsLost: 0,
    caughtBy: 0,          // times the static has caught the ball
    catches: 0,           // times the ball has caught the static
    mazes: 0, eyes: 0,
    restored: 0,          // times the tenth maze has been cleared
    coins: 0,             // coins this cabinet has paid (the arcade's daily board subtracts them)
    seconds: 0,
    noSignalSeen: false,  // the NO SIGNAL screen has been played once
    vol: 70, fx: true, moods: true, talk: true,
    pad: 'left'           // touch screens: which side the steering pad is on, or 'off' for swipes only
  };
}
const int = (v, lo = 0, hi = 1e9) => { const n = Number(v); return Number.isFinite(n) ? clamp(Math.floor(n), lo, hi) : lo; };
export function sanitizeSave(v) {
  const out = defaultSave();
  if (!v || typeof v !== 'object') return out;
  for (const k of ['best', 'bestMaze', 'runs', 'ballsLost', 'caughtBy', 'catches', 'mazes', 'eyes', 'restored', 'coins', 'seconds']) out[k] = int(v[k]);
  out.vol = v.vol === undefined ? 70 : int(v.vol, 0, 100);
  out.noSignalSeen = !!v.noSignalSeen;
  for (const k of ['fx', 'moods', 'talk']) out[k] = v[k] === undefined ? true : !!v[k];
  out.pad = PAD_SIDES.includes(v.pad) ? v.pad : 'left';
  return out;
}
// Fold a finished run into the record. Returns what was new.
export function recordRun(save, s) {
  const r = runRecap(s);
  const fresh = { best: r.score > save.best, maze: r.maze > save.bestMaze };
  save.best = Math.max(save.best, r.score);
  save.bestMaze = Math.max(save.bestMaze, r.maze);
  save.ballsLost += s.stats.ballsLost;
  save.caughtBy += s.stats.caughtBy;
  save.catches += s.stats.catches;
  save.mazes += s.stats.mazes;
  save.eyes += s.stats.eyes;
  save.seconds += r.time;
  return fresh;
}
