// ============ GLITCH BREAKOUT — config & data ============
'use strict';

const CFG = {
  W: 960, H: 640,
  PADDLE_Y: 600, PADDLE_W: 110, PADDLE_H: 13, PADDLE_SPD: 620,
  BALL_R: 7, BALL_SPD: 380, BALL_MAX: 780, BALL_ACCEL: 1.018,
  BRICK_W: 66, BRICK_H: 24, BRICK_GAP: 6, BRICK_COLS: 12, BRICK_TOP: 84,
  DROP_CHANCE: 0.13,
};

// ---------- helpers ----------
const rand   = (a, b) => a + Math.random() * (b - a);
const randInt= (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const clamp  = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp   = (a, b, t) => a + (b - a) * t;
const dist2  = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

// seeded rng (daily mode)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// the player's LOCAL calendar date — toISOString() is UTC, so the "daily" seed used to
// roll over mid-afternoon or mid-evening depending on timezone
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- palette — Glitch Pong universe tokens ----------
const COL = {
  cyan: '#71efff', magenta: '#ff58d9', red: '#ff4d6d', violet: '#9a5dff',
  white: '#eef7ff', green: '#00ff96', orange: '#ff9a00', yellow: '#ffd27a',
  blue: '#4d7bff', dim: '#7a9ab8',
};

// ---------- brick types ----------
// glyphs are drawn on brick face; hp -1 = invulnerable
const BRICKS = {
  normal:    { hp: 1, score: 50,  color: COL.cyan,    glyph: ''  },
  heavy:     { hp: 3, score: 150, color: COL.blue,    glyph: '≡' },
  shield:    { hp: 1, score: 120, color: COL.violet,  glyph: '◈' },
  generator: { hp: 2, score: 200, color: COL.yellow,  glyph: '⌁' },
  virus:     { hp: 1, score: 90,  color: COL.green,   glyph: 'V' },
  healing:   { hp: 2, score: 130, color: '#ff6ad5',   glyph: '+' },
  teleport:  { hp: 2, score: 110, color: COL.orange,  glyph: '⇄' },
  clone:     { hp: 1, score: 100, color: '#7dff5a',   glyph: '∞' },
  explosive: { hp: 1, score: 120, color: COL.red,     glyph: '✶' },
  firewall:  { hp: 2, score: 180, color: '#ff5500',   glyph: 'F' },
  quantum:   { hp: 1, score: 140, color: COL.white,   glyph: '?' },
  invisible: { hp: 1, score: 160, color: '#8899aa',   glyph: '·' },
  moving:    { hp: 1, score: 90,  color: '#4dffe1',   glyph: '»' },
  rotating:  { hp: 1, score: 110, color: '#c084fc',   glyph: '↻' },
  bosscore:  { hp: 8, score: 1000,color: COL.red,     glyph: '☒' },
  barrier:   { hp: -1,score: 0,   color: '#ff5500',   glyph: '▦' }, // event firewall, temporary
};

// weighted introduction of brick types by level
function brickWeights(lv) {
  const w = { normal: 60, heavy: 8 + lv * 2 };
  if (lv >= 2) w.explosive = 6;
  // the green ones (virus, clone) used to arrive at sectors 3 and 4 and swamp
  // the board early; they now hold off until 5 and 6
  if (lv >= 4) w.teleport = 4;
  if (lv >= 5) w.virus = 5;
  if (lv >= 6) w.clone = 4;
  if (lv >= 5) { w.healing = 4; w.moving = 5; }
  if (lv >= 6) { w.quantum = 4; w.invisible = 4; }
  if (lv >= 7) { w.firewall = 4; w.rotating = 4; }
  w.normal = Math.max(18, 60 - lv * 3);
  return w;
}

// ---------- arenas ----------
const ARENAS = [
  { name: 'GLITCH ARENA',       bg: '#03040a', grid: 'rgba(113,239,255,.08)', accent: COL.cyan,    tempo: 112, root: 55.0,  hazard: null },
  { name: 'NEON GRID',          bg: '#06040e', grid: 'rgba(255,88,217,.10)',  accent: COL.magenta, tempo: 118, root: 61.74, hazard: 'movingBarrier' },
  { name: 'QUANTUM REACTOR',    bg: '#03090a', grid: 'rgba(0,255,150,.09)',   accent: COL.green,   tempo: 122, root: 49.0,  hazard: 'gravityWell' },
  { name: 'MEMORY LEAK',        bg: '#08040e', grid: 'rgba(154,93,255,.11)',  accent: COL.violet,  tempo: 108, root: 55.0,  hazard: 'corruptedZone' },
  { name: 'VIRUS HIVE',         bg: '#050a04', grid: 'rgba(125,255,90,.09)',  accent: '#7dff5a',   tempo: 126, root: 46.25, hazard: 'teleportGates' },
  { name: 'DIGITAL CATHEDRAL',  bg: '#06050d', grid: 'rgba(238,247,255,.07)', accent: COL.white,   tempo: 100, root: 41.2,  hazard: 'laserSweep' },
  { name: 'CORRUPTED BIOS',     bg: '#0a0604', grid: 'rgba(255,154,0,.09)',   accent: COL.orange,  tempo: 116, root: 55.0,  hazard: 'corruptedZone' },
  { name: 'AI MAINFRAME',       bg: '#04080d', grid: 'rgba(77,123,255,.11)',  accent: COL.blue,    tempo: 124, root: 61.74, hazard: 'movingBarrier' },
  { name: 'DATA TUNNEL',        bg: '#05050b', grid: 'rgba(113,239,255,.11)', accent: COL.cyan,    tempo: 130, root: 49.0,  hazard: 'teleportGates' },
  { name: 'BLACK HOLE NEXUS',   bg: '#020207', grid: 'rgba(154,93,255,.09)',  accent: COL.violet,  tempo: 96,  root: 36.71, hazard: 'gravityWell' },
  { name: 'INFINITE SERVER',    bg: '#030a08', grid: 'rgba(0,255,150,.10)',   accent: COL.green,   tempo: 128, root: 55.0,  hazard: 'laserSweep' },
  { name: 'BROKEN SIMULATION',  bg: '#09040a', grid: 'rgba(255,77,109,.10)',  accent: COL.red,     tempo: 134, root: 46.25, hazard: 'corruptedZone' },
];

// ---------- powerups ----------
const POWERUPS = {
  triple:  { name: 'TRIPLE BALL',   color: COL.cyan,    tag: '3X',  good: true },
  split:   { name: 'SPLIT SHOT',    color: COL.cyan,    tag: 'SP',  good: true },
  laser:   { name: 'LASER PADDLE',  color: COL.red,     tag: 'LZ',  good: true,  dur: 12 },
  emp:     { name: 'EMP BLAST',     color: COL.yellow,  tag: 'EM',  good: true },
  gravity: { name: 'GRAVITY BALL',  color: COL.violet,  tag: 'GR',  good: true,  dur: 10 },
  fire:    { name: 'FIRE BALL',     color: COL.orange,  tag: 'FB',  good: true,  dur: 10 },
  freeze:  { name: 'FREEZE TIME',   color: COL.blue,    tag: 'FZ',  good: true,  dur: 5 },
  shield:  { name: 'FIREWALL SHIELD',color: COL.green,  tag: 'SH',  good: true,  dur: 15 },
  pulse:   { name: 'ENERGY PULSE',  color: COL.white,   tag: 'EP',  good: true },
  magnet:  { name: 'MAGNET PADDLE', color: COL.violet,  tag: 'MG',  good: true,  dur: 14 },
  pierce:  { name: 'PIERCING BALL', color: COL.magenta, tag: 'PC',  good: true,  dur: 9 },
  boom:    { name: 'EXPLOSIVE BALL',color: COL.red,     tag: 'EX',  good: true,  dur: 9 },
  slow:    { name: 'SLOW MOTION',   color: COL.blue,    tag: 'SL',  good: true,  dur: 6 },
  warp:    { name: 'TIME WARP',     color: COL.white,   tag: 'TW',  good: true,  dur: 4 },
  gbomb:   { name: 'GLITCH BOMB',   color: COL.magenta, tag: 'GB',  good: true },
  drone:   { name: 'DRONE ASSIST',  color: COL.green,   tag: 'DR',  good: true,  dur: 16 },
  random:  { name: 'RANDOMIZER',    color: COL.white,   tag: '??',  good: true },
  life:    { name: 'EXTRA LIFE',    color: COL.red,     tag: '+1',  good: true },
  mult:    { name: 'SCORE x2',      color: COL.yellow,  tag: 'x2',  good: true,  dur: 20 },
  wide:    { name: 'WIDE PADDLE',   color: COL.cyan,    tag: 'W+',  good: true,  dur: 15 },
};
const POWERUP_KEYS = Object.keys(POWERUPS);

// ---------- glitch events ----------
// Sustained events run 5–15s of REAL time (see EVENT_MAX_DUR). The two one-shot
// events are deliberately sub-second: `kernelPanic` is a full-screen white flash
// (a multi-second strobe is a photosensitivity hazard) and `quantumShift` is a
// single instantaneous board shuffle, so a long timer would do nothing.
const EVENT_MAX_DUR = 15;
const EVENTS = [
  { id: 'systemError',  name: 'SYSTEM ERROR',       dur: 6.0 },
  { id: 'packetLoss',   name: 'PACKET LOSS',        dur: 5.0 },
  { id: 'timeFreeze',   name: 'TIME FREEZE',        dur: 7.0 },
  { id: 'memoryLeak',   name: 'MEMORY LEAK',        dur: 6.0 },
  { id: 'kernelPanic',  name: 'KERNEL PANIC',       dur: 0.8, instant: true },
  { id: 'dataSurge',    name: 'DATA SURGE',         dur: 8.0 },
  { id: 'firewallOn',   name: 'FIREWALL ACTIVATED', dur: 10.0 },
  { id: 'lagSpike',     name: 'LAG SPIKE',          dur: 5.0 },
  { id: 'overclock',    name: 'OVERCLOCK',          dur: 6.0 },
  { id: 'quantumShift', name: 'QUANTUM SHIFT',      dur: 0.6, instant: true },
];

// ---------- game modes ----------
const MODES = {
  classic:  { name: 'CLASSIC',        desc: '12 sectors. Purge them all. The corruption grows slowly.', levels: 12 },
  endless:  { name: 'ENDLESS',        desc: 'Infinite sectors. Survive as deep as you can.', levels: Infinity },
  corrupt:  { name: 'CORRUPTION',     desc: 'The system destabilizes fast. Maximum chaos, maximum score.', levels: Infinity },
  hardcore: { name: 'HARDCORE',       desc: 'One life. No continues. No mercy.', levels: Infinity },
  time:     { name: 'TIME ATTACK',    desc: 'Purge each sector fast — time bonus decays every second.', levels: 8 },
  puzzle:   { name: 'PUZZLE MODE',    desc: 'Limited balls, engineered layouts. Think before you launch.', levels: 8 },
  bossrush: { name: 'BOSS RUSH',      desc: 'No filler. Only the machine’s guardians, back to back.', levels: 6 },
  daily:    { name: 'DAILY GLITCH',   desc: 'Today’s corrupted seed + mutators. One score. One chance.', levels: 6 },
  ai:       { name: 'AI AUTOPLAY',    desc: 'Hand the paddle to the machine and watch it purge. Press [T] any time to take over.', levels: Infinity },
};

const DAILY_MODS = [
  { id: 'ghostBricks',  name: 'GHOST BRICKS' },
  { id: 'doubleSpeed',  name: 'DOUBLE SPEED' },
  { id: 'mirror',       name: 'MIRROR CONTROLS' },
  { id: 'randGravity',  name: 'RANDOM GRAVITY' },
  { id: 'movingWalls',  name: 'MOVING WALLS' },
  { id: 'tripleEnemy',  name: 'TRIPLE ENEMIES' },
];

// ---------- permanent upgrades ----------
const UPGRADES = [
  { id: 'pad_len',  name: 'EXTENDED PADDLE', desc: '+12% paddle length per rank.',            cost: 350, max: 3 },
  { id: 'pad_spd',  name: 'OVERDRIVE SERVOS',desc: '+14% paddle speed per rank.',             cost: 350, max: 3 },
  { id: 'life_up',  name: 'BACKUP PROCESS',  desc: '+1 starting life per rank.',              cost: 650, max: 2 },
  { id: 'luck',     name: 'PACKET SNIFFER',  desc: '+4% powerup drop chance per rank.',       cost: 450, max: 3 },
  { id: 'xp_boost', name: 'DATA MINER',      desc: '+20% XP earned per rank.',                cost: 500, max: 3 },
  { id: 'magnet',   name: 'MAGNETIC PLATING',desc: 'Start every run with a magnetic paddle.', cost: 800, max: 1 },
  { id: 'laser',    name: 'LASER ARRAY',     desc: 'Ability [X]: fire paddle lasers (cooldown).', cost: 950, max: 1 },
  { id: 'emp',      name: 'EMP CAPACITOR',   desc: 'Ability [X]: EMP — damages every brick, wipes projectiles. Long recharge.', cost: 1100, max: 1 },
  { id: 'shield0',  name: 'BOOT FIREWALL',   desc: 'Start each life with a firewall shield.', cost: 750, max: 1 },
  { id: 'damp',     name: 'STABILIZER',      desc: 'Corruption builds 20% slower per rank.',  cost: 600, max: 2 },
  { id: 'crit',     name: 'BUFFER OVERFLOW', desc: '+8% chance per rank that hits deal double damage.', cost: 650, max: 3 },
  { id: 'startmult',name: 'ROOT ACCESS',     desc: 'Glitch meter starts at 25%.',             cost: 800, max: 1 },
];

// ---------- achievements ----------
const ACHIEVEMENTS = [
  { id: 'first',    name: 'HELLO WORLD',     desc: 'Destroy your first brick.' },
  { id: 'combo15',  name: 'CHAIN REACTION',  desc: 'Reach a 15 combo.' },
  { id: 'combo30',  name: 'UNSTOPPABLE',     desc: 'Reach a 30 combo.' },
  { id: 'sector5',  name: 'DEEP DIVE',       desc: 'Reach sector 5.' },
  { id: 'sector10', name: 'KERNEL SPACE',    desc: 'Reach sector 10.' },
  { id: 'boss1',    name: 'GUARDIAN DOWN',   desc: 'Defeat a mini boss.' },
  { id: 'boss4',    name: 'EXORCIST',        desc: 'Defeat 4 different bosses.' },
  { id: 'eyeboss',  name: 'STARING CONTEST', desc: 'Defeat THE EYE.' },
  { id: 'score10k', name: 'HIGH ROLLER',     desc: 'Score 10,000 in one run.' },
  { id: 'score50k', name: 'OVERFLOW',        desc: 'Score 50,000 in one run.' },
  { id: 'glitch100',name: 'MAXIMUM GLITCH',  desc: 'Fill the glitch meter to 100%.' },
  { id: 'stack3',   name: 'STACKED DECK',    desc: 'Hold 3 timed powerups at once.' },
  { id: 'buy1',     name: 'SCRIPT KIDDIE',   desc: 'Buy a permanent upgrade.' },
  { id: 'hardcore3',name: 'NO SAFETY NET',   desc: 'Reach sector 3 in Hardcore.' },
  { id: 'daily1',   name: 'PATCH OF THE DAY',desc: 'Finish a Daily Glitch run.' },
  { id: 'clearC',   name: 'SYSTEM RESTORED', desc: 'Clear Classic mode.' },
  { id: 'secret',   name: '???',             desc: 'Find the developer room.', hidden: true },
];
