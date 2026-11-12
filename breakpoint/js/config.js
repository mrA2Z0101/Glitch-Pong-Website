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

// What the codex says about each brick, once a ball of yours has met one.
const BRICK_INFO = {
  normal:    { name: 'DATA BRICK',     line: 'One hit.' },
  heavy:     { name: 'HEAVY BRICK',    line: 'Three hits. It cracks as it goes.' },
  shield:    { name: 'SHIELD BRICK',   line: 'Cannot be hurt while any generator brick is alive.' },
  generator: { name: 'GENERATOR',      line: 'Powers every shield brick and locks the boss core. Break these first.' },
  virus:     { name: 'VIRUS BRICK',    line: 'When it breaks it can turn up to two bricks near it into something worse.' },
  healing:   { name: 'HEALING BRICK',  line: 'Repairs a damaged brick near it every few seconds.' },
  teleport:  { name: 'TELEPORT BRICK', line: 'Moves somewhere else the first time you hit it.' },
  clone:     { name: 'CLONE BRICK',    line: 'Copies itself into an empty space beside it every 10 to 16 seconds.' },
  explosive: { name: 'EXPLOSIVE BRICK',line: 'Blows up and damages every brick near it. Aim for these.' },
  firewall:  { name: 'FIREWALL BRICK', line: 'The ball alone cannot break it. Fire, lasers, explosions and the EMP can.' },
  quantum:   { name: 'QUANTUM BRICK',  line: 'Turns into a different kind of brick every few seconds.' },
  invisible: { name: 'INVISIBLE BRICK',line: 'Fades out of sight and back. It is still there.' },
  moving:    { name: 'MOVING BRICK',   line: 'Slides from side to side.' },
  rotating:  { name: 'ORBITING BRICK', line: 'Circles a fixed point.' },
  bosscore:  { name: 'BOSS CORE',      line: 'Eight hits and worth 1,000. Locked while a generator is alive. Explodes when it goes.' },
  barrier:   { name: 'BARRIER',        line: 'Put up by FIREWALL ACTIVATED. Cannot be broken; it goes when the event ends.' },
};

// Enemies, bosses, glitch events and the ball's moods, as the codex describes them.
const ENEMY_INFO = {
  drone:  { name: 'DRONE',      line: 'Hovers above the wall and shoots straight down. Two hits. From sector 3.' },
  virus:  { name: 'VIRUS ORB',  line: 'Drifts about and turns the bricks it touches into virus bricks. One hit. From sector 6.' },
  repair: { name: 'REPAIR BOT', line: 'Patrols and repairs damaged bricks. Two hits. From sector 6.' },
  turret: { name: 'TURRET',     line: 'Sits at the side and aims at your paddle. Three hits. From sector 6.' },
};
const BOSS_INFO = {
  'MEMORY GUARDIAN': { line: 'Three shield arcs turn around it and deflect the ball. Shoot through the gaps.' },
  'VIRUS QUEEN':     { line: 'Turns bricks into virus bricks and sends out virus orbs.' },
  'FIREWALL TITAN':  { line: 'Armoured underneath. Hit it from the sides or above, or use a fire ball.' },
  'QUANTUM CORE':    { line: 'Teleports every few seconds and cannot be hurt for a moment after each jump.' },
  'DATA HYDRA':      { line: 'Three heads, each with its own health. All three must go.' },
  'THE EYE':         { line: 'From the Pong arena. It blinks to armour itself, fires volleys of six, and teleports. Sector 10, and the end of Boss Rush.' },
};
const EVENT_INFO = {
  systemError:  'The picture jumps about for six seconds.',
  packetLoss:   'The ball flickers in and out of sight for five seconds.',
  timeFreeze:   'Bricks and enemies stop for seven seconds.',
  memoryLeak:   'Up to three bricks are copied over six seconds.',
  kernelPanic:  'A flash and a hard shake. Nothing else.',
  dataSurge:    'The ball runs 55% faster for eight seconds.',
  firewallOn:   'Three to five unbreakable barriers appear for ten seconds.',
  lagSpike:     'Everything runs at under half speed for five seconds.',
  overclock:    'Everything runs half as fast again for six seconds.',
  quantumShift: 'Every brick swaps places with another.',
};
const MOOD_INFO = {
  bored:      { name: 'BORED',      color: '#8d97ad', line: 'Five returns without breaking a brick and it bends its own path toward the nearest one.' },
  grudge:     { name: 'GRUDGE',     color: '#ff8fb8', line: 'It remembers THE EYE from the Pong arena and leans toward it.' },
  loyal:      { name: 'LOYAL',      color: '#00ff96', line: 'On your last life it refuses to fall past a near miss, once a sector. Never in Hardcore.' },
  rampage:    { name: 'RAMPAGE',    color: '#ffd166', line: 'Behind the wall it turns gold, speeds up and scores double until it drops back out.' },
  protective: { name: 'PROTECTIVE', color: '#ff8a3d', line: 'A shot that hits your paddle sends it after the shooter. Enemies take double damage.' },
  rivalry:    { name: 'RIVALRY',    color: '#ffd166', line: 'In multi-ball the ball with the most bricks wears a crown and scores 50% more.' },
  showoff:    { name: 'SHOW-OFF',   color: '#ff58d9', line: 'Six bricks without touching the paddle: a longer trail and a little more speed.' },
  curious:    { name: 'CURIOUS',    color: '#eef7ff', line: 'Teleport, quantum and clone bricks it has not touched pull it gently toward them.' },
  mourning:   { name: 'MOURNING',   color: '#9aa7c7', line: 'After a lost life the next ball starts slow and dim for a few seconds.' },
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
// Each arena has a place (js/backdrops.js draws it), one rule of its own
// (`rule`: named and explained in js/rules.js), the thing on the field that
// carries the rule out (`hazard`: a class in js/entities.js or js/arenas.js)
// and a soundtrack (`music`: a key into MUSIC below).
const ARENAS = [
  { name: 'GLITCH ARENA',       bg: '#03040a', grid: 'rgba(113,239,255,.08)', accent: COL.cyan,    tempo: 112, root: 55.0,  rule: 'standard',  hazard: null,            music: 'sector' },
  { name: 'NEON GRID',          bg: '#06040e', grid: 'rgba(255,88,217,.10)',  accent: COL.magenta, tempo: 118, root: 61.74, rule: 'lightBar',  hazard: 'movingBarrier', music: 'grid' },
  { name: 'QUANTUM REACTOR',    bg: '#03090a', grid: 'rgba(0,255,150,.09)',   accent: COL.green,   tempo: 122, root: 49.0,  rule: 'pulse',     hazard: 'reactorPulse',  music: 'sector' },
  { name: 'MEMORY LEAK',        bg: '#08040e', grid: 'rgba(154,93,255,.11)',  accent: COL.violet,  tempo: 108, root: 55.0,  rule: 'leak',      hazard: 'leakGauge',     music: 'memory' },
  { name: 'VIRUS HIVE',         bg: '#050a04', grid: 'rgba(125,255,90,.09)',  accent: '#7dff5a',   tempo: 126, root: 46.25, rule: 'tunnels',   hazard: 'teleportGates', music: 'virus' },
  { name: 'DIGITAL CATHEDRAL',  bg: '#06050d', grid: 'rgba(238,247,255,.07)', accent: COL.white,   tempo: 100, root: 41.2,  rule: 'beam',      hazard: 'laserSweep',    music: 'memory' },
  { name: 'CORRUPTED BIOS',     bg: '#0a0604', grid: 'rgba(255,154,0,.09)',   accent: COL.orange,  tempo: 116, root: 55.0,  rule: 'badSector', hazard: 'corruptedZone', music: 'virus' },
  { name: 'AI MAINFRAME',       bg: '#04080d', grid: 'rgba(77,123,255,.11)',  accent: COL.blue,    tempo: 124, root: 61.74, rule: 'defender',  hazard: 'defender',      music: 'mainframe' },
  { name: 'DATA TUNNEL',        bg: '#05050b', grid: 'rgba(113,239,255,.11)', accent: COL.cyan,    tempo: 130, root: 49.0,  rule: 'wrap',      hazard: 'sideWrap',      music: 'sector' },
  { name: 'BLACK HOLE NEXUS',   bg: '#020207', grid: 'rgba(154,93,255,.09)',  accent: COL.violet,  tempo: 96,  root: 36.71, rule: 'well',      hazard: 'gravityWell',   music: 'nexus' },
  { name: 'INFINITE SERVER',    bg: '#030a08', grid: 'rgba(0,255,150,.10)',   accent: COL.green,   tempo: 128, root: 55.0,  rule: 'descend',   hazard: 'rackDescent',   music: 'sector' },
  { name: 'BROKEN SIMULATION',  bg: '#09040a', grid: 'rgba(255,77,109,.10)',  accent: COL.red,     tempo: 134, root: 46.25, rule: 'drift',     hazard: 'driftWind',     music: 'sector' },
];

// ---------- soundtrack ----------
// The recordings each theme plays, in order (js/audio.js streams one at a time
// and moves to the next when it ends). A bare name is a file in
// breakpoint/sounds/music; a path is used as it is, which is how the two
// arenas that share a place with Glitch Pong play that arena's music.
// To give an arena its own theme: add the files, add a line here, and set the
// arena's `music` above.
const MUSIC = {
  sector:    ['sector-zero-1', 'sector-zero-2'],
  memory:    ['ghosts-in-the-memory-1', 'ghosts-in-the-memory-2'],
  virus:     ['infection-protocol-1', 'infection-protocol-2'],
  nexus:     ['event-horizon-1', 'event-horizon-2'],
  eye:       ['do-not-blink-1', 'do-not-blink-2'],
  grid:      [1, 2, 3, 4, 5, 6].map((n) => `../sounds/music/construct_music${n}`),   // Glitch Pong's THE CONSTRUCT
  mainframe: [1, 2, 3, 4, 5, 6].map((n) => `../sounds/music/matrix_music${n}`),      // Glitch Pong's MATRIX MAINFRAME
};

// ---------- powerups ----------
// `desc` is what the pickup card and the codex say; `tag` is the old two-letter
// label, still used as a fallback where an icon can't be drawn.
const POWERUPS = {
  triple:  { name: 'TRIPLE BALL',    color: COL.cyan,    tag: '3X',  good: true,            desc: 'Every ball in play becomes three.' },
  split:   { name: 'SPLIT SHOT',     color: COL.cyan,    tag: 'SP',  good: true,            desc: 'One ball splits two more off itself.' },
  laser:   { name: 'LASER PADDLE',   color: COL.red,     tag: 'LZ',  good: true,  dur: 12,  desc: 'Fire lasers from the paddle. Lasers break firewall bricks.' },
  emp:     { name: 'EMP BLAST',      color: COL.yellow,  tag: 'EM',  good: true,            desc: 'One hit on every brick, and every enemy shot is wiped.' },
  gravity: { name: 'GRAVITY BALL',   color: COL.violet,  tag: 'GR',  good: true,  dur: 10,  desc: 'The ball is pulled downward, so it arcs.' },
  fire:    { name: 'FIRE BALL',      color: COL.orange,  tag: 'FB',  good: true,  dur: 10,  desc: 'Double damage, burns straight through, and breaks firewall bricks.' },
  freeze:  { name: 'FREEZE TIME',    color: COL.blue,    tag: 'FZ',  good: true,  dur: 5,   desc: 'Bricks and enemies stop. You and the ball do not.' },
  shield:  { name: 'FIREWALL SHIELD',color: COL.green,   tag: 'SH',  good: true,  dur: 15,  desc: 'A floor under the paddle that bounces the ball back, and blocks enemy shots.' },
  pulse:   { name: 'ENERGY PULSE',   color: COL.white,   tag: 'EP',  good: true,            desc: 'A burst of speed and a short spell of passing through bricks.' },
  magnet:  { name: 'MAGNET PADDLE',  color: COL.violet,  tag: 'MG',  good: true,  dur: 14,  desc: 'The paddle catches the ball. Launch it again from where it sits to aim.' },
  pierce:  { name: 'PIERCING BALL',  color: COL.magenta, tag: 'PC',  good: true,  dur: 9,   desc: 'The ball goes through the bricks it breaks.' },
  boom:    { name: 'EXPLOSIVE BALL', color: COL.red,     tag: 'EX',  good: true,  dur: 9,   desc: 'Every brick it touches explodes and damages the ones around it.' },
  slow:    { name: 'SLOW MOTION',    color: COL.blue,    tag: 'SL',  good: true,  dur: 6,   desc: 'Everything runs at about half speed.' },
  warp:    { name: 'TIME WARP',      color: COL.white,   tag: 'TW',  good: true,  dur: 4,   desc: 'Everything runs at a third of its speed, briefly.' },
  gbomb:   { name: 'GLITCH BOMB',    color: COL.magenta, tag: 'GB',  good: true,            desc: 'Deletes up to eight bricks at random.' },
  drone:   { name: 'DRONE ASSIST',   color: COL.green,   tag: 'DR',  good: true,  dur: 16,  desc: 'A drone hovers over the paddle and shoots bricks for you.' },
  random:  { name: 'RANDOMIZER',     color: COL.white,   tag: '??',  good: true,            desc: 'Becomes one of the other power-ups.' },
  life:    { name: 'EXTRA LIFE',     color: COL.red,     tag: '+1',  good: true,            desc: 'One more life.' },
  mult:    { name: 'SCORE x2',       color: COL.yellow,  tag: 'x2',  good: true,  dur: 20,  desc: 'Everything scores double.' },
  wide:    { name: 'WIDE PADDLE',    color: COL.cyan,    tag: 'W+',  good: true,  dur: 15,  desc: 'The paddle is nearly half as long again.' },
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
