import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLOOR_KEY, FRAGMENTS, REPAIRABLE_SLOTS, DAILY_POOL, CAPSULE_TOYS, TRACK_PACKS,
  repairCost, fragmentPayout, cappedPayout, cleanInitials, insertScore, scoreBoard,
  dailyChallenge, dailyProgress, statSnapshot, capsuleOfDay, sanitizeFloor, defaultFloor,
  rollDay, onlineCount, createFloorStore, todayStr
} from '../glitchcade-state.js';

test('cabinets 03–10 each have a ROM fragment', () => {
  assert.deepEqual(REPAIRABLE_SLOTS, [3, 4, 5, 6, 7, 8, 9, 10]);
  const idsSeen = new Set(Object.values(FRAGMENTS).map((f) => f.id));
  assert.equal(idsSeen.size, 8, 'fragment ids are unique');
  for (const f of Object.values(FRAGMENTS)) assert.match(f.id, /^[a-z0-9_-]{1,40}$/, 'ids survive the save filter');
});

test('repairs get dearer and stay bounded', () => {
  assert.equal(repairCost(0), 15);
  assert.equal(repairCost(7), 50);
  assert.equal(repairCost(99), 50);
  assert.equal(repairCost(-3), 15);
});

test('a fragment pays 0–3 coins by thirds of its target', () => {
  assert.equal(fragmentPayout(0, 12), 0);
  assert.equal(fragmentPayout(3, 12), 0);
  assert.equal(fragmentPayout(4, 12), 1);
  assert.equal(fragmentPayout(8, 12), 2);
  assert.equal(fragmentPayout(12, 12), 3);
  assert.equal(fragmentPayout(500, 12), 3);
  assert.equal(fragmentPayout(NaN, 12), 0);
});

test('the daily cap trims a payout and never goes negative', () => {
  assert.equal(cappedPayout(3, 0), 3);
  assert.equal(cappedPayout(3, 5), 1);
  assert.equal(cappedPayout(3, 6), 0);
  assert.equal(cappedPayout(3, 40), 0);
});

test('initials are always three safe characters', () => {
  assert.equal(cleanInitials('abc'), 'ABC');
  assert.equal(cleanInitials('a'), 'AAA');
  assert.equal(cleanInitials('<b>x'), 'BXA');
  assert.equal(cleanInitials(null), 'AAA');
  assert.equal(cleanInitials('toolong'), 'TOO');
});

test('scores insert in order, keep five, and ties favour the older entry', () => {
  let list = [];
  let r = insertScore(list, 'aaa', 10);
  assert.equal(r.rank, 0);
  r = insertScore(r.list, 'bbb', 30);
  assert.equal(r.rank, 0);
  r = insertScore(r.list, 'ccc', 10);
  assert.equal(r.rank, 2, 'an equal score goes below the one already there');
  assert.deepEqual(r.list.map((e) => e.n), ['BBB', 'AAA', 'CCC']);
  list = r.list;
  for (const s of [50, 40, 35]) list = insertScore(list, 'zzz', s).list;
  assert.equal(list.length, 5);
  assert.equal(insertScore(list, 'low', 1).rank, -1, 'too low for the table');
  assert.equal(insertScore(list, 'nil', 0).rank, -1);
});

test('the board mixes in house scores and stays at five rows', () => {
  const board = scoreBoard([{ n: 'YOU', s: 9999 }], 12);
  assert.equal(board.length, 5);
  assert.equal(board[0].n, 'YOU');
  assert.ok(board.slice(1).every((e) => e.house));
});

test('the daily challenge is fixed for a date and drawn from the pool', () => {
  const a = dailyChallenge('2026-11-10');
  assert.equal(dailyChallenge('2026-11-10'), a);
  assert.ok(DAILY_POOL.includes(a));
  const seen = new Set();
  for (let d = 1; d <= 28; d++) seen.add(dailyChallenge(`2026-02-${String(d).padStart(2, '0')}`).id);
  assert.ok(seen.size >= 4, 'a month covers most of the pool');
});

test('daily progress counts from the day\'s baseline and caps at the goal', () => {
  const ch = DAILY_POOL.find((c) => c.id === 'win-and-purge');
  const base = { gpWins: 5, bpCoins: 20 };
  let p = dailyProgress(ch, base, { gpWins: 5, bpCoins: 22 });
  assert.equal(p.done, false);
  assert.deepEqual(p.parts.map((x) => x.have), [0, 2]);
  p = dailyProgress(ch, base, { gpWins: 9, bpCoins: 40 });
  assert.equal(p.done, true);
  assert.deepEqual(p.parts.map((x) => x.have), [1, 4]);
});

test('Breakpoint coins are the wallet earnings nothing else explains', () => {
  const s = statSnapshot({ earned: 100, wins: 4 }, { wins: 6, matchesPlayed: 9, bossSurvivals: 2 }, { floorEarned: 25, hockey: { wins: 3 }, fragmentsPlayed: 7 });
  assert.deepEqual(s, { gpWins: 6, gpMatches: 9, gpBoss: 2, bpCoins: 35, hockeyWins: 3, fragments: 7 });
  assert.equal(statSnapshot({ earned: 5, wins: 4 }, {}, {}).bpCoins, 0, 'never negative');
});

test('the capsule is fixed for a date and never repeats an owned toy', () => {
  const day = '2026-11-10';
  assert.deepEqual(capsuleOfDay(day, []), capsuleOfDay(day, []));
  const all = CAPSULE_TOYS.map((t) => t.id);
  for (let d = 1; d <= 30; d++) {
    const date = `2026-04-${String(d).padStart(2, '0')}`;
    const full = capsuleOfDay(date, all);
    assert.equal(full.kind, 'coins', 'a full toy shelf always pays coins');
    assert.ok(full.coins >= 12 && full.coins <= 24);
    const c = capsuleOfDay(date, all.slice(0, 7));
    if (c.kind === 'toy') assert.equal(c.toy.id, all[7]);
  }
});

test('sanitizeFloor drops junk and keeps good values', () => {
  const dirty = {
    initials: 'x<y',
    repaired: [3, 3, 99, '4', 'nope'],
    chipUsed: 1,
    scores: { 'signal-lost': [{ n: 'me!', s: 12.9 }, { n: 'bad', s: -4 }, 'junk'], '<script>': [{ n: 'aaa', s: 1 }] },
    frag: { date: '2026-11-10', paid: { 'signal-lost': 4, 'bad key!': 9 } },
    daily: { date: 'yesterday', base: { gpWins: 3, '__proto__x!': 1 }, claimed: 'yes' },
    toys: ['pixel-eye', 'not-a-toy', 'pixel-eye'],
    packs: ['matrix', 'pirate'],
    gauntlet: { r1: true, clears: 2.7, bossBase: 4 },
    floorEarned: 'lots',
    extra: { deep: true }
  };
  const clean = sanitizeFloor(dirty);
  assert.equal(clean.initials, 'XYA');
  assert.deepEqual(clean.repaired, [3, 4]);
  assert.equal(clean.chipUsed, true);
  assert.deepEqual(clean.scores, { 'signal-lost': [{ n: 'MEA', s: 12 }] });
  assert.deepEqual(clean.frag, { date: '2026-11-10', paid: { 'signal-lost': 4 } });
  assert.equal(clean.daily.date, '');
  assert.deepEqual(clean.daily.base, { gpWins: 3 });
  assert.deepEqual(clean.toys, ['pixel-eye']);
  assert.deepEqual(clean.packs, ['matrix']);
  assert.deepEqual(clean.gauntlet, { r1: true, r2: false, clears: 2, bossBase: 4 });
  assert.equal(clean.floorEarned, 0);
  assert.equal('extra' in clean, false);
  assert.deepEqual(sanitizeFloor(null), defaultFloor());
  assert.deepEqual(sanitizeFloor('garbage'), defaultFloor());
});

test('a new day clears the daily parts and leaves the rest', () => {
  const f = defaultFloor();
  f.repaired = [3];
  f.frag = { date: '2026-01-01', paid: { firewall: 6 } };
  f.daily = { date: '2026-01-01', base: { gpWins: 1 }, claimed: true };
  f.capsule = { date: '2026-01-01', bought: true };
  f.hockey = { date: '2026-01-01', paid: 3, wins: 8, losses: 2 };
  rollDay(f, '2026-01-02');
  assert.deepEqual(f.frag, { date: '2026-01-02', paid: {} });
  assert.deepEqual(f.daily, { date: '2026-01-02', base: null, claimed: false });
  assert.equal(f.capsule.bought, false);
  assert.equal(f.hockey.paid, 0);
  assert.equal(f.hockey.wins, 8, 'lifetime wins survive');
  assert.deepEqual(f.repaired, [3]);
  assert.equal(onlineCount(f), 3);
});

test('the store round-trips through storage and survives a corrupt record', () => {
  const mem = {};
  const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const store = createFloorStore(storage);
  store.data.repaired.push(5);
  store.data.initials = 'ZED';
  store.save();
  const again = createFloorStore(storage);
  assert.deepEqual(again.data.repaired, [5]);
  assert.equal(again.data.initials, 'ZED');
  assert.equal(again.data.frag.date, todayStr());
  mem[FLOOR_KEY] = '{not json';
  assert.deepEqual(createFloorStore(storage).data.repaired, []);
});

test('the store notices when something else rewrites the record', () => {
  const mem = {};
  const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const store = createFloorStore(storage);
  store.data.repaired.push(4);
  store.save();
  assert.equal(store.sync(), false, 'our own write is not a change');
  mem[FLOOR_KEY] = JSON.stringify({ repaired: [7, 8], initials: 'IMP' });   // e.g. a save import
  assert.equal(store.sync(), true);
  assert.deepEqual(store.data.repaired, [7, 8]);
  assert.equal(store.data.initials, 'IMP');
  assert.equal(store.sync(), false);
});

test('record packs are priced and unique', () => {
  assert.equal(new Set(TRACK_PACKS.map((p) => p.id)).size, TRACK_PACKS.length);
  for (const p of TRACK_PACKS) assert.ok(p.cost > 0 && p.count > 0);
});
