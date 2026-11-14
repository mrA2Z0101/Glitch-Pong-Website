// ═══════════════════════════════════════════════════════════════════════════
// GLITCHCADE FLOOR STATE — everything the arcade floor remembers that isn't
// the coin wallet: repaired cabinets, high scores, the daily challenge, the
// mystery capsule, jukebox records, the Eye gauntlet.
//
// Pure logic, no DOM and no three.js, so it runs under node for the tests.
// The wallet keeps its own key (glitchcade_wallet_v1): Glitch Pong and
// Breakpoint both rewrite that record and drop fields they don't know.
// ═══════════════════════════════════════════════════════════════════════════

export const FLOOR_KEY = 'glitchcade_floor_v1';

// ── Small deterministic helpers (same recipes as Breakpoint's daily seed) ──
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The player's local calendar date (toISOString() is UTC and would roll the
// daily over mid-afternoon in some timezones).
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Cabinets 04–10: what each one costs to bring back, and its ROM fragment ──
// `target` is the score that earns the full payout in the 30-second fragment.
// Cabinet 03 used to be SIGNAL LOST's and cabinet 06 ran a 30-second
// BLACK-HOLE NEXUS. That fragment is now a whole game on cabinet 03, next to
// Breakpoint, and SIGNAL LOST took the cabinet it left (see sanitizeFloor).
export const FRAGMENTS = {
  4: { id: 'firewall', title: 'FIREWALL', target: 18 },
  5: { id: 'defrag', title: 'DEFRAG', target: 22 },
  6: { id: 'signal-lost', title: 'SIGNAL LOST', target: 14 },
  7: { id: 'stack-overflow', title: 'STACK OVERFLOW', target: 18 },
  8: { id: 'packet-hop', title: 'PACKET HOP', target: 7 },
  9: { id: 'swarm-protocol', title: 'SWARM PROTOCOL', target: 24 },
  10: { id: 'missile-defense', title: 'MISSILE DEFENSE.EXE', target: 16 }
};
export const REPAIRABLE_SLOTS = Object.keys(FRAGMENTS).map(Number);
export const CHIP_PRIZE = 'overclock-chip';
export const FRAGMENT_SECONDS = 30;
export const FRAGMENT_DAILY_CAP = 6;      // coins one cabinet pays out per day
export const BASE_ONLINE = 3;             // Glitch Pong, Breakpoint and Black-Hole Nexus
export const TOTAL_CABINETS = 10;

// Each repair costs a little more than the last one.
export function repairCost(alreadyRepaired) {
  return 15 + 5 * Math.max(0, Math.min(REPAIRABLE_SLOTS.length - 1, Math.floor(alreadyRepaired)));
}

// 0–3 coins for a fragment run: a third of the target per coin.
export function fragmentPayout(score, target) {
  if (!(score > 0) || !(target > 0)) return 0;
  return Math.max(0, Math.min(3, Math.floor((score / target) * 3)));
}

// What's actually paid once the cabinet's daily cap is applied.
export function cappedPayout(want, paidToday, cap = FRAGMENT_DAILY_CAP) {
  return Math.max(0, Math.min(want, cap - Math.max(0, paidToday || 0)));
}

// ── High scores ──
export function cleanInitials(s) {
  const out = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return out.length === 3 ? out : (out + 'AAA').slice(0, 3);
}

// The machines' own entries, so there is always something to beat.
const HOUSE_NAMES = ['EYE', 'P80', 'GLT', 'NUL', 'BUG'];
export function houseScores(target) {
  return HOUSE_NAMES.map((n, i) => ({ n, s: Math.max(1, Math.round(target * (1.1 - i * 0.2))), house: true }));
}

// Insert a score into a top-`max` table. Returns the new table and the rank
// the score took (0-based), or -1 when it didn't make the table. Ties go to
// the score that was there first.
export function insertScore(list, name, score, max = 5) {
  const table = (Array.isArray(list) ? list : []).slice();
  if (!(score > 0)) return { list: table.slice(0, max), rank: -1 };
  let rank = table.findIndex((e) => score > e.s);
  if (rank < 0) rank = table.length;
  if (rank >= max) return { list: table.slice(0, max), rank: -1 };
  table.splice(rank, 0, { n: cleanInitials(name), s: Math.floor(score) });
  return { list: table.slice(0, max), rank };
}

// Player entries merged with the house entries, best first.
export function scoreBoard(playerList, target, max = 5) {
  const all = [...(playerList || []), ...houseScores(target)];
  all.sort((a, b) => b.s - a.s || (a.house ? 1 : 0) - (b.house ? 1 : 0));
  return all.slice(0, max);
}

// ── Daily challenge: one per calendar day, spanning the games ──
// Each part is "raise this number by `goal` since the day's first visit".
// The numbers come from statSnapshot() below.
export const DAILY_POOL = [
  { id: 'win-and-purge', reward: 15, parts: [
    { stat: 'gpWins', goal: 1, label: 'WIN A GLITCH PONG MATCH' },
    { stat: 'bpCoins', goal: 4, label: 'EARN 4 COINS IN BREAKPOINT' }] },
  { id: 'double-win', reward: 12, parts: [
    { stat: 'gpWins', goal: 2, label: 'WIN 2 GLITCH PONG MATCHES' }] },
  { id: 'eye-contact', reward: 15, parts: [
    { stat: 'gpBoss', goal: 1, label: 'SURVIVE THE EYE IN GLITCH PONG' }] },
  { id: 'deep-purge', reward: 12, parts: [
    { stat: 'bpCoins', goal: 10, label: 'EARN 10 COINS IN BREAKPOINT' }] },
  { id: 'double-shift', reward: 15, parts: [
    { stat: 'gpMatches', goal: 2, label: 'PLAY 2 GLITCH PONG MATCHES' },
    { stat: 'bpCoins', goal: 6, label: 'EARN 6 COINS IN BREAKPOINT' }] },
  { id: 'table-and-cabinet', reward: 12, parts: [
    { stat: 'hockeyWins', goal: 1, label: 'BEAT PRIZETRON AT AIR HOCKEY' },
    { stat: 'gpWins', goal: 1, label: 'WIN A GLITCH PONG MATCH' }] },
  { id: 'fragment-run', reward: 10, parts: [
    { stat: 'fragments', goal: 3, label: 'PLAY 3 ROM FRAGMENTS' },
    { stat: 'bpCoins', goal: 2, label: 'EARN 2 COINS IN BREAKPOINT' }] },
  { id: 'salvage', reward: 12, parts: [
    { stat: 'nxCoins', goal: 6, label: 'EARN 6 COINS IN BLACK-HOLE NEXUS' }] },
  { id: 'three-cabinets', reward: 15, parts: [
    { stat: 'gpMatches', goal: 1, label: 'PLAY A GLITCH PONG MATCH' },
    { stat: 'bpCoins', goal: 2, label: 'EARN 2 COINS IN BREAKPOINT' },
    { stat: 'nxCoins', goal: 2, label: 'EARN 2 COINS IN BLACK-HOLE NEXUS' }] }
];

export function dailyChallenge(date = todayStr()) {
  const rand = mulberry32(hashStr('gc_daily_' + date));
  return DAILY_POOL[Math.floor(rand() * DAILY_POOL.length)];
}

// The numbers a daily challenge can measure. `wallet` is the coin wallet,
// `gp` is Glitch Pong's progression record, `floor` is this module's state,
// `nexus` is Black-Hole Nexus's record (it counts the coins it has paid).
// Breakpoint's coins are whatever the wallet earned that neither a Glitch
// Pong win (10 each), the arcade floor itself nor Black-Hole Nexus paid out.
export function statSnapshot(wallet, gp, floor, nexus) {
  const w = wallet || {};
  const p = gp || {};
  const f = floor || {};
  const nx = Math.max(0, Math.floor(Number(nexus && nexus.coins) || 0));
  return {
    gpWins: Math.max(0, p.wins || 0),
    gpMatches: Math.max(0, p.matchesPlayed || 0),
    gpBoss: Math.max(0, p.bossSurvivals || 0),
    bpCoins: Math.max(0, (w.earned || 0) - 10 * (w.wins || 0) - (f.floorEarned || 0) - nx),
    nxCoins: nx,
    hockeyWins: Math.max(0, (f.hockey && f.hockey.wins) || 0),
    fragments: Math.max(0, f.fragmentsPlayed || 0)
  };
}

export function dailyProgress(challenge, base, now) {
  const parts = challenge.parts.map((p) => {
    const have = Math.max(0, Math.min(p.goal, (now[p.stat] || 0) - ((base && base[p.stat]) || 0)));
    return { label: p.label, goal: p.goal, have, done: have >= p.goal };
  });
  return { parts, done: parts.every((p) => p.done) };
}

// ── Mystery capsule: one per day, contents fixed by the date ──
export const CAPSULE_COST = 8;
export const CAPSULE_TOYS = [
  { id: 'tiny-prizetron', name: 'TINY PRIZETRON', color: '#5fe8ff' },
  { id: 'pocket-cabinet', name: 'POCKET CABINET', color: '#9a5dff' },
  { id: 'pixel-eye', name: 'PIXEL EYE', color: '#ff58d9' },
  { id: 'neon-coin', name: 'NEON COIN', color: '#ffd27a' },
  { id: 'dead-pixel', name: 'DEAD PIXEL', color: '#50fa7b' },
  { id: 'loose-wire', name: 'LOOSE WIRE', color: '#ff7a3d' },
  { id: 'crt-snow-globe', name: 'CRT SNOW GLOBE', color: '#eef7ff' },
  { id: 'patron-shadow', name: 'PATRON SHADOW', color: '#4d7cff' }
];

// What today's capsule holds for this player: a toy they don't own yet most
// days, a coin jackpot otherwise. `owned` is the list of toy ids.
export function capsuleOfDay(date, owned = []) {
  const rand = mulberry32(hashStr('gc_capsule_' + date));
  const roll = rand();
  const missing = CAPSULE_TOYS.filter((t) => !owned.includes(t.id));
  if (missing.length && roll < 0.7) {
    return { kind: 'toy', toy: missing[Math.floor(rand() * missing.length)] };
  }
  return { kind: 'coins', coins: 12 + Math.floor(rand() * 4) * 4 };   // 12, 16, 20 or 24
}

// ── Jukebox records sold at the counter ──
export const TRACK_PACKS = [
  { id: 'matrix', name: 'MATRIX MIXTAPE', cost: 15, count: 6 },
  { id: 'nebula', name: 'BLACK HOLE NEBULA LP', cost: 15, count: 5 },
  { id: 'arena', name: 'CLASSIC ARENA EP', cost: 10, count: 4 }
];

// ── Air hockey ──
export const HOCKEY_WIN_COINS = 4;
export const HOCKEY_PAID_WINS_PER_DAY = 3;
export const HOCKEY_TARGET = 5;

// ── The Eye gauntlet (cabinet 11) ──
export const GAUNTLET_REWARD = 50;

// ── The record itself ──
export function defaultFloor() {
  return {
    v: 2,                         // 2: cabinet 03 became Black-Hole Nexus, SIGNAL LOST moved to 06
    initials: '',
    repaired: [],                 // slot numbers 4–10
    chipUsed: false,              // the Overclock Chip's one free repair
    scores: {},                   // cabinet id → [{ n, s }] best first
    fragmentsPlayed: 0,
    frag: { date: '', paid: {} }, // coins each cabinet has paid today
    daily: { date: '', base: null, claimed: false },
    hockey: { date: '', paid: 0, wins: 0, losses: 0 },
    capsule: { date: '', bought: false },
    toys: [],
    packs: [],                    // owned jukebox record ids
    request: { date: '', title: '', done: false },
    gauntlet: { r1: false, r2: false, clears: 0, bossBase: -1 },
    floorEarned: 0,               // coins the floor itself has paid out
    photos: 0
  };
}

const ID_RE = /^[a-z0-9_-]{1,40}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, lo = 0, hi = 1e9) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : lo;
};
const date = (v) => (typeof v === 'string' && DATE_RE.test(v) ? v : '');
const ids = (v, max = 60) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && ID_RE.test(x)))].slice(0, max) : []);

// Rebuilds a record from anything (an old save, an imported file, garbage),
// keeping only well-formed values.
export function sanitizeFloor(v) {
  const out = defaultFloor();
  if (!v || typeof v !== 'object') return out;
  if (typeof v.initials === 'string' && v.initials) out.initials = cleanInitials(v.initials);
  if (Array.isArray(v.repaired)) {
    // A record from before cabinet 03 became a whole game: the cabinet that
    // was repaired there ran SIGNAL LOST, and SIGNAL LOST now lives at 06.
    const moved = int(v.v) < 2 ? v.repaired.map((n) => (int(n) === 3 ? 6 : n)) : v.repaired;
    out.repaired = [...new Set(moved.map((n) => int(n)).filter((n) => REPAIRABLE_SLOTS.includes(n)))];
  }
  out.chipUsed = !!v.chipUsed;
  if (v.scores && typeof v.scores === 'object') {
    Object.keys(v.scores).slice(0, 40).forEach((k) => {
      if (!ID_RE.test(k) || !Array.isArray(v.scores[k])) return;
      out.scores[k] = v.scores[k]
        .filter((e) => e && typeof e === 'object' && Number(e.s) > 0)
        .map((e) => ({ n: cleanInitials(e.n), s: int(e.s) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 5);
    });
  }
  out.fragmentsPlayed = int(v.fragmentsPlayed);
  if (v.frag && typeof v.frag === 'object') {
    out.frag.date = date(v.frag.date);
    if (v.frag.paid && typeof v.frag.paid === 'object') {
      Object.keys(v.frag.paid).slice(0, 20).forEach((k) => { if (ID_RE.test(k)) out.frag.paid[k] = int(v.frag.paid[k], 0, 99); });
    }
  }
  if (v.daily && typeof v.daily === 'object') {
    out.daily.date = date(v.daily.date);
    out.daily.claimed = !!v.daily.claimed;
    if (v.daily.base && typeof v.daily.base === 'object') {
      out.daily.base = {};
      Object.keys(v.daily.base).slice(0, 20).forEach((k) => { if (ID_RE.test(k)) out.daily.base[k] = int(v.daily.base[k]); });
    }
  }
  if (v.hockey && typeof v.hockey === 'object') {
    out.hockey = { date: date(v.hockey.date), paid: int(v.hockey.paid, 0, 99), wins: int(v.hockey.wins), losses: int(v.hockey.losses) };
  }
  if (v.capsule && typeof v.capsule === 'object') out.capsule = { date: date(v.capsule.date), bought: !!v.capsule.bought };
  const toyIds = CAPSULE_TOYS.map((t) => t.id);
  out.toys = ids(v.toys).filter((id) => toyIds.includes(id));
  const packIds = TRACK_PACKS.map((p) => p.id);
  out.packs = ids(v.packs).filter((id) => packIds.includes(id));
  if (v.request && typeof v.request === 'object') {
    out.request = {
      date: date(v.request.date),
      title: typeof v.request.title === 'string' ? v.request.title.slice(0, 60) : '',
      done: !!v.request.done
    };
  }
  if (v.gauntlet && typeof v.gauntlet === 'object') {
    out.gauntlet = { r1: !!v.gauntlet.r1, r2: !!v.gauntlet.r2, clears: int(v.gauntlet.clears), bossBase: int(v.gauntlet.bossBase, -1) };
  }
  out.floorEarned = int(v.floorEarned);
  out.photos = int(v.photos);
  return out;
}

// Reset the per-day parts of the record when the date has moved on.
export function rollDay(floor, today = todayStr()) {
  if (floor.frag.date !== today) floor.frag = { date: today, paid: {} };
  if (floor.hockey.date !== today) { floor.hockey.date = today; floor.hockey.paid = 0; }
  if (floor.capsule.date !== today) floor.capsule = { date: today, bought: false };
  if (floor.request.date !== today) floor.request = { date: today, title: '', done: false };
  if (floor.daily.date !== today) floor.daily = { date: today, base: null, claimed: false };
  return floor;
}

export function onlineCount(floor) {
  return BASE_ONLINE + floor.repaired.length;
}

// Storage wrapper. `storage` defaults to the browser's localStorage.
export function createFloorStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  let data = defaultFloor();
  let lastRaw = null;          // what storage held when we last read or wrote it
  const readRaw = () => { try { return storage.getItem(FLOOR_KEY); } catch (e) { return null; } };
  function load() {
    lastRaw = readRaw();
    try { data = sanitizeFloor(JSON.parse(lastRaw || 'null')); } catch (e) { data = defaultFloor(); }
    rollDay(data);
    return data;
  }
  function save() {
    lastRaw = JSON.stringify(data);
    try { storage.setItem(FLOOR_KEY, lastRaw); } catch (e) {}
    return data;
  }
  load();
  return {
    get data() { return data; },
    load, save,
    // Something else rewrote the record (a save import, another tab): pick it
    // up. Returns true when the record was reloaded.
    sync() {
      if (readRaw() === lastRaw) return false;
      load();
      return true;
    },
    // Roll the day over if needed, then return the record.
    today() { rollDay(data); return data; }
  };
}
