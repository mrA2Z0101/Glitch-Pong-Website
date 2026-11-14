import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as R from '../nexus/js/rules.js';
import { NULL_LINES, BALL_LINES, EXIT_FLICKER, pick, fill } from '../nexus/js/voice.js';

// Black-Hole Nexus (cabinet 03): the rules in nexus/js/rules.js and the two
// voices in nexus/js/voice.js. The run is played here by the same bot that
// plays the attract mode behind the menu. The drawing and the menus
// (nexus/js/game.js) are not covered, apart from what they ask of these files.
const { TUNE } = R;
const DT = 1 / 60;
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// advance a run, collecting its events
function advance(s, seconds, input = { thrust: false }, events = []) {
  for (let i = 0; i < Math.round(seconds / DT) && s.phase !== 'over'; i++) {
    R.step(s, typeof input === 'function' ? input(s) : input, DT);
    events.push(...s.events);
    s.events.length = 0;
  }
  return events;
}
// a run that is past its countdown, with nothing in orbit and nothing arriving
function playing(opts = {}) {
  const s = R.createRun(Object.assign({ seed: 11 }, opts));
  advance(s, TUNE.INTRO + 0.1, { thrust: true });
  assert.equal(s.phase, 'play');
  s.objs = [];
  s.spawn.bit = s.spawn.debris = s.spawn.power = 1e9;
  s.ball.r = 200; s.ball.vr = 0; s.ball.inv = 0;
  return s;
}
// hold the ball level, whatever the hole is doing
const hover = (r) => (s) => ({ thrust: s.ball.r + s.ball.vr * 0.2 < r });
let nextId = 9000;
const put = (s, o) => { const obj = Object.assign({ id: nextId++, age: 2, warm: 0.5, w: 0, vr: 0, rad: 10 }, o); s.objs.push(obj); return obj; };
// the bot, deciding a few times a second like the page's attract mode
function botRun(seed, maxSeconds, skill = 1) {
  const s = R.createRun({ seed });
  let hold = { thrust: false }, n = 0;
  const events = advance(s, maxSeconds, (st) => { if (n++ % 3 === 0) hold = R.botInput(st, skill); return hold; });
  return { s, events };
}

test('every fifth sector is THE EYE and the others take the six rules in turn', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => R.sectorRule(n).id),
    ['standard', 'leak', 'panic', 'lag', 'eye', 'shift', 'overclock', 'standard', 'leak', 'eye', 'panic']);
  assert.equal(R.isEyeSector(5), true);
  assert.equal(R.isEyeSector(0), false);
  for (const rule of [...R.SECTOR_RULES, R.EYE_RULE]) {
    assert.match(rule.name, /^[A-Z ]+$/);
    assert.ok(rule.line.length <= 60, `${rule.id}: the line fits the banner`);
  }
  let last = 0;
  for (let n = 1; n <= 40; n++) { const q = R.quota(n); assert.ok(q >= last && q <= 28); last = q; }
  assert.equal(R.quota(1), 12);
});

test('Heat multiplies on Breakpoint\'s steps; depth and rally add to it', () => {
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(R.heatMultiplier), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
  assert.deepEqual([280, 211, 209, 131, 129, 60].map(R.bandOf), [1, 1, 2, 2, 3, 3]);
  assert.equal(R.chainBonus(0), 1);
  assert.equal(R.chainBonus(20), 2);
  assert.equal(R.chainBonus(500), 2, 'the rally bonus stops at double');
  assert.equal(R.points(10, 250, 0, 0), 10);
  assert.equal(R.points(10, 100, 80, 20), 180, 'x3 for depth, x3 for Heat, x2 for the rally');
  assert.ok(R.clearBonus(8) > R.clearBonus(2));
});

test('lower orbits are faster, the hole pulls harder near it, and the button always wins', () => {
  assert.ok(R.omega(80) > R.omega(160) && R.omega(160) > R.omega(280));
  assert.ok(R.gravity(60) > R.gravity(200));
  assert.ok(TUNE.THRUST > R.gravity(TUNE.R_HOLE) * TUNE.SURGE_PULL, 'you can climb from the horizon even while it breathes in');
  // from the horizon's edge, holding the button gets the ball out
  const s = playing();
  s.ball.r = s.holeR + TUNE.BALL_R + 6;
  advance(s, 1.5, { thrust: true });
  assert.ok(s.ball.r > 150, `climbed to ${s.ball.r}`);
  assert.equal(s.balls, TUNE.BALLS);
});

test('letting go loses every ball and earns nothing', () => {
  const s = R.createRun({ seed: 4 });
  const events = advance(s, 60);
  assert.equal(s.phase, 'over');
  assert.equal(s.stats.sectors, 0);
  assert.equal(s.stats.coins, 0);
  assert.equal(s.stats.ballsEaten, TUNE.BALLS, 'all three went past the horizon');
  assert.ok(events.some((e) => e.type === 'gameOver' && e.cause === 'eaten'));
});

test('hiding at the edge of the screen collects nothing', () => {
  for (const seed of [1, 2, 3]) {
    const s = R.createRun({ seed });
    const events = advance(s, 90, { thrust: true });
    assert.equal(s.stats.bits + s.stats.cores, 0, 'no bit can be reached from the glass');
    assert.equal(s.stats.sectors, 0);
    assert.equal(s.heat, 0);
    assert.ok(events.some((e) => e.type === 'edgeHide'), 'and NULL gets to say so');
  }
});

test('a competent player clears the first sectors and can beat the first Eye', () => {
  const runs = [1, 2, 3, 4, 5, 6].map((seed) => botRun(seed, 420));
  const reached = runs.map((r) => r.s.sector);
  if (process.env.SHOW_SCORES) console.log('sectors reached', reached, 'scores', runs.map((r) => Math.floor(r.s.score)));
  assert.ok(reached.filter((n) => n >= 5).length >= 5, `most runs reach THE EYE: ${reached}`);
  assert.ok(reached.filter((n) => n >= 6).length >= 3, `and half of them beat it: ${reached}`);
  for (const { s, events } of runs) {
    const clears = events.filter((e) => e.type === 'sectorClear');
    assert.equal(clears.reduce((sum, e) => sum + e.coins, 0), s.stats.coins, 'coins are what the sectors paid');
    assert.ok(clears.every((e) => e.coins === (e.eye ? R.COINS.eye : R.COINS.sector)));
    assert.ok(Number.isFinite(s.score) && s.score >= 0);
    // a sector takes somewhere between a breath and two minutes
    const first = events.find((e) => e.type === 'sectorClear');
    assert.ok(first, 'sector 1 was cleared');
  }
});

test('a sector pays the same coins as Breakpoint', () => {
  assert.deepEqual(R.COINS, { sector: 2, eye: 10 });
  const wallet = src('breakpoint/js/wallet.js');
  assert.match(wallet, /const COINS = \{ sector: 2, boss: 10 \}/);
});

test('bits score by depth, build a rally and fill the quota', () => {
  const s = playing();
  s.ball.r = 100;
  put(s, { kind: 'bit', th: s.ball.th + 0.02, r: 100 });
  const events = advance(s, 0.2, hover(100));
  const bit = events.find((e) => e.type === 'bit');
  assert.ok(bit, 'collected');
  assert.equal(bit.band, 3);
  assert.equal(bit.pts, R.points(TUNE.BIT, 100, 0, 1));
  assert.equal(s.chain, 1);
  assert.equal(s.bits, 1);
  assert.ok(s.heat > 0);
  // the rally ends if nothing else is collected in time
  const later = advance(s, TUNE.CHAIN_WINDOW + 0.3, hover(250));
  assert.ok(later.some((e) => e.type === 'chainBreak'));
  assert.equal(s.chain, 0);
  // the last bit of the quota clears the sector and pays
  s.bits = s.quota - 1;
  put(s, { kind: 'bit', th: s.ball.th + 0.02, r: s.ball.r });
  const done = advance(s, 0.3, hover(250));
  const clear = done.find((e) => e.type === 'sectorClear');
  assert.ok(clear);
  assert.equal(clear.coins, 2);
  assert.equal(s.phase, 'clear');
  advance(s, TUNE.CLEAR + 0.1, hover(250));
  assert.equal(s.sector, 2);
  assert.equal(s.rule.id, 'leak');
});

test('something still materialising can\'t be touched', () => {
  const s = playing();
  const o = put(s, { kind: 'debris', look: 'brick', th: s.ball.th, r: s.ball.r, age: 0, warm: 1, w: R.omega(200) });
  advance(s, 0.5, hover(200));
  assert.equal(s.balls, TUNE.BALLS, 'passed through it while it formed');
  o.th = s.ball.th; o.r = s.ball.r;
  const events = advance(s, 0.8, hover(200));
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'debris'), 'solid now');
});

test('debris takes a ball; a near miss scores instead', () => {
  const s = playing();
  put(s, { kind: 'debris', look: 'brick', th: s.ball.th + 0.03, r: s.ball.r });
  let events = advance(s, 0.3, hover(200));
  const lost = events.find((e) => e.type === 'ballLost');
  assert.equal(lost.cause, 'debris');
  assert.equal(s.balls, TUNE.BALLS - 1);
  assert.ok(s.ball.inv > 0, 'the new ball can\'t be hurt for a moment');
  assert.ok(s.ball.r > 200, 'and it starts again from a high orbit');
  // a graze: close enough to count, not close enough to hit
  const g = playing();
  put(g, { kind: 'debris', look: 'brick', th: g.ball.th + 0.03, r: g.ball.r + 10 * 0.85 + TUNE.BALL_R + 6 });
  events = advance(g, 0.4, hover(200));
  assert.ok(events.some((e) => e.type === 'graze'));
  assert.equal(g.balls, TUNE.BALLS);
  assert.equal(g.stats.grazes, 1);
  assert.ok(g.score > 0 && g.heat > 0);
});

test('LOYAL: the last ball refuses the horizon once a sector, if its moods are on', () => {
  const s = playing();
  s.balls = 1;
  s.ball.r = s.holeR + TUNE.BALL_R + 1; s.ball.vr = -50;
  let events = advance(s, 0.1);
  assert.ok(events.some((e) => e.type === 'loyal'));
  assert.equal(s.balls, 1);
  assert.ok(s.ball.vr > 0, 'thrown back out');
  events = advance(s, 12);
  assert.ok(events.some((e) => e.type === 'gameOver'), 'the second time it goes in');
  // moods off: no refusal
  const off = playing({ moods: false });
  off.balls = 1;
  off.ball.r = off.holeR + TUNE.BALL_R + 1; off.ball.vr = -50;
  events = advance(off, 0.1);
  assert.ok(!events.some((e) => e.type === 'loyal'));
  assert.equal(off.phase, 'over');
});

test('power-ups: a firewall takes one hit, a magnet pulls bits in, a freeze stops the junk', () => {
  const s = playing();
  put(s, { kind: 'power', power: 'shield', th: s.ball.th + 0.02, r: s.ball.r });
  advance(s, 0.2, hover(200));
  assert.equal(s.shield, true);
  put(s, { kind: 'debris', look: 'brick', th: s.ball.th + 0.03, r: s.ball.r });
  const events = advance(s, 0.3, hover(200));
  assert.ok(events.some((e) => e.type === 'shieldBreak'));
  assert.equal(s.shield, false);
  assert.equal(s.balls, TUNE.BALLS);
  assert.equal(s.objs.length, 0, 'the firewall destroyed what it hit');

  const m = playing();
  m.magnet = TUNE.MAGNET_T;
  const bit = put(m, { kind: 'bit', th: m.ball.th + 0.2, r: m.ball.r + 40, w: R.omega(200) });
  advance(m, 1.2, hover(200));
  assert.equal(m.stats.bits, 1, 'a bit out of reach came to the ball');
  assert.ok(!m.objs.includes(bit));

  const f = playing();
  f.freeze = TUNE.FREEZE_T;
  const junk = put(f, { kind: 'debris', look: 'static', th: f.ball.th + 2, r: 150, w: 1, vr: -10 });
  advance(f, 1, hover(200));
  assert.equal(junk.r, 150);
  advance(f, TUNE.FREEZE_T, hover(200));
  assert.ok(junk.r < 150, 'and it moves again afterwards');
});

test('MEMORY LEAK: every bit the hole eats widens it, up to a limit', () => {
  const s = playing({ sector: 2 });
  assert.equal(s.rule.id, 'leak');
  const before = s.holeR;
  for (let i = 0; i < 30; i++) put(s, { kind: 'bit', th: i, r: s.holeR + 1 + i * 0.01, vr: -40 });
  const events = advance(s, 1, hover(240));
  assert.ok(events.filter((e) => e.type === 'bitEaten').length >= 12);
  assert.equal(s.leak, TUNE.LEAK_MAX);
  assert.ok(Math.abs(s.holeR - before - TUNE.LEAK_MAX) < 2);
  // a standard sector's hole does not grow from eaten bits
  const plain = playing();
  put(plain, { kind: 'bit', th: 1, r: plain.holeR + 1, vr: -40 });
  advance(plain, 0.5, hover(240));
  assert.equal(plain.leak, 0);
});

test('LAG SPIKE puts the ball back where it was; QUANTUM SHIFT puts it on the far side', () => {
  const s = playing({ sector: 4 });
  assert.equal(s.rule.id, 'lag');
  s.lag = { state: 'idle', t: 2 };
  const events = [];
  advance(s, 2 + TUNE.LAG_WARN - 0.05, hover(200), events);
  assert.ok(events.some((e) => e.type === 'lagWarn'), 'warned first');
  assert.ok(!events.some((e) => e.type === 'lagSnap'));
  const target = R.lagTarget(s);
  const thBefore = s.ball.th;
  advance(s, 0.1, hover(200), events);
  assert.ok(events.some((e) => e.type === 'lagSnap'));
  assert.ok(s.ball.th < thBefore, 'it went backwards');
  assert.ok(Math.abs(R.angDiff(target.th, s.ball.th)) < 0.25, 'to about where the warning showed');

  const q = playing({ sector: 6 });
  assert.equal(q.rule.id, 'shift');
  q.shift = { state: 'warn', t: 0.05 };
  const th = q.ball.th;
  const ev = advance(q, 0.1, hover(200));
  assert.ok(ev.some((e) => e.type === 'shiftJump'));
  assert.ok(Math.abs(Math.abs(R.angDiff(th, q.ball.th)) - Math.PI) < 0.2);
  assert.ok(q.ball.inv > 0, 'and it can\'t be hurt as it lands');
});

test('OVERCLOCK runs the junk faster and pays half again for a bit', () => {
  const s = playing({ sector: 7 });
  assert.equal(s.rule.id, 'overclock');
  const junk = put(s, { kind: 'debris', look: 'brick', th: s.ball.th + 3, r: 120, w: 1 });
  const th = junk.th;
  advance(s, 1, hover(240));
  assert.ok(Math.abs(junk.th - th - TUNE.OVERCLOCK) < 0.05);
  s.heat = 0;
  put(s, { kind: 'bit', th: s.ball.th + 0.02, r: s.ball.r });
  const ev = advance(s, 0.2, hover(240));
  assert.equal(ev.find((e) => e.type === 'bit').pts, R.points(TUNE.BIT * 1.5, 240, 0, 1));
});

test('at Critical Heat the hole breathes in and NULL throws your score at you', () => {
  const s = playing();
  s.score = 123456;
  s.heat = 95; s.theftT = 0.1; s.surge = { state: 'idle', t: 0.1 };
  const events = advance(s, 0.3, hover(120));
  assert.ok(events.some((e) => e.type === 'heatCritical'));
  const theft = events.find((e) => e.type === 'hudTheft');
  assert.equal(theft.digits, '3456', 'the last four digits of the score');
  const glyphs = s.objs.filter((o) => o.look === 'glyph');
  assert.deepEqual(glyphs.map((o) => o.ch), ['3', '4', '5', '6']);
  assert.ok(glyphs.every((o) => o.warm >= 1), 'they take a moment to become solid');
  assert.ok(events.some((e) => e.type === 'surgeWarn'));
  advance(s, TUNE.SURGE_WARN + 0.1, hover(120), events);
  assert.equal(s.surge.state, 'on');
  // one of your own digits is a cause of death with its own name
  const g = glyphs[0];
  g.age = 5; g.th = s.ball.th + 0.01; g.r = s.ball.r; g.vr = 0; g.w = R.omega(s.ball.r);
  s.ball.inv = 0;
  advance(s, 0.2, hover(120), events);
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'score'));
  assert.ok(R.CAUSES.score);
  assert.ok(s.heat < 95 - 20, 'losing a ball cools things down');
});

test('THE EYE gets harder each time it comes back', () => {
  const a = R.eyeSpec(5), b = R.eyeSpec(10), c = R.eyeSpec(15), z = R.eyeSpec(200);
  assert.ok(b.hp > a.hp && Math.abs(b.gazeW) > Math.abs(a.gazeW) && b.gapHalf < a.gapHalf);
  assert.equal(a.beams, 1);
  assert.equal(b.beams, 1);
  assert.equal(c.beams, 2, 'from the third Eye it looks both ways');
  assert.ok(z.hp <= 8 && z.gapHalf >= 30 && Math.abs(z.gazeW) <= 0.7, 'and it stops getting worse');
  assert.ok(a.gazeW < 0, 'its gaze turns against the ball');
  assert.ok(a.gapHalf * 2 > TUNE.BALL_R * 6, 'the gap is a good deal wider than the ball');
});

test('THE EYE: its gaze takes a ball anywhere but the gap, and not while it is shut', () => {
  const eye = () => {
    const s = playing({ sector: 5 });
    assert.equal(s.rule.id, 'eye');
    s.eye.chargeT = 1e9; s.eye.lidT = 1e9; s.eye.gazeW = 0; s.eye.gapSpeed = 0;
    return s;
  };
  // in the gap: safe
  let s = eye();
  s.ball.r = R.gapRadius(s.eye);
  s.eye.gazeTh = s.ball.th + 0.2;
  let events = advance(s, 1, hover(R.gapRadius(s.eye)));
  assert.equal(s.balls, TUNE.BALLS, 'threaded the gap');
  // outside it: gone
  s = eye();
  s.ball.r = R.gapRadius(s.eye) + s.eye.gapHalf + 30;
  s.eye.gazeTh = s.ball.th + 0.2;
  events = advance(s, 1, hover(s.ball.r));
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'gaze'));
  // shut: it isn't looking
  s = eye();
  s.eye.lid = 'shut';
  s.ball.r = R.gapRadius(s.eye) + s.eye.gapHalf + 30;
  s.eye.gazeTh = s.ball.th + 0.2;
  advance(s, 1, hover(s.ball.r));
  assert.equal(s.balls, TUNE.BALLS);
});

test('THE EYE: charges hurt it while it is open, bounce off while it is shut, and it pays 10', () => {
  const s = playing({ sector: 5 });
  s.eye.lidT = 1e9; s.eye.gazeW = 0; s.eye.gazeTh = s.ball.th + Math.PI; s.eye.chargeT = 1e9;
  const hp = s.eye.hp;
  s.eye.lid = 'shut';
  put(s, { kind: 'charge', th: s.ball.th + 0.02, r: s.ball.r, life: 9 });
  let events = advance(s, 0.2, hover(200));
  assert.ok(events.some((e) => e.type === 'eyeDeflect'));
  assert.equal(s.eye.hp, hp, 'wasted');
  s.eye.lid = 'open';
  for (let i = hp; i > 0; i--) {
    put(s, { kind: 'charge', th: s.ball.th + 0.02, r: s.ball.r, life: 9 });
    events = advance(s, 0.2, hover(200));
    assert.ok(events.some((e) => e.type === 'eyeHit'));
    if (i > 1) assert.ok(s.eye.stun > 0, 'stunned: its gaze is off');
  }
  const clear = events.find((e) => e.type === 'sectorClear');
  assert.ok(events.some((e) => e.type === 'eyeDefeated'));
  assert.equal(clear.eye, true);
  assert.equal(clear.coins, 10);
  assert.equal(s.stats.eyes, 1);
  // a charge left alone fizzles and another arrives
  const w = playing({ sector: 5 });
  w.eye.lidT = 1e9; w.eye.gazeW = 0; w.eye.gazeTh = w.ball.th + Math.PI; w.eye.chargeT = 0.1;
  advance(w, 0.3, hover(280));
  assert.equal(w.objs.filter((o) => o.kind === 'charge').length, 1);
  const first = w.objs.find((o) => o.kind === 'charge');
  advance(w, TUNE.CHARGE_LIFE + 2, (st) => { st.eye.gazeTh = st.ball.th + Math.PI; return hover(286)(st); });
  const now = w.objs.find((o) => o.kind === 'charge');
  assert.ok(now && now !== first, 'a fresh one');
});

test('the run recap names what ended it', () => {
  const s = R.createRun({ seed: 9 });
  advance(s, 60);
  const r = R.runRecap(s);
  assert.equal(r.cause, R.CAUSES.eaten);
  assert.equal(r.sector, 1);
  assert.equal(r.coins, 0);
  for (const c of ['eaten', 'debris', 'score', 'gaze']) assert.match(R.CAUSES[c], /^[A-Z ]+$/);
});

test('the save: junk is dropped, runs are folded in, bests only go up', () => {
  assert.deepEqual(R.sanitizeSave(null), R.defaultSave());
  assert.deepEqual(R.sanitizeSave('garbage'), R.defaultSave());
  const clean = R.sanitizeSave({ best: 4200.9, runs: -3, ballsEaten: 'many', vol: 400, fx: 0, talk: false, crashSeen: 1, evil: { x: 1 } });
  assert.equal(clean.best, 4200);
  assert.equal(clean.runs, 0);
  assert.equal(clean.ballsEaten, 0);
  assert.equal(clean.vol, 100);
  assert.equal(clean.fx, false);
  assert.equal(clean.talk, false);
  assert.equal(clean.moods, true, 'a switch that was never saved is on');
  assert.equal(clean.crashSeen, true);
  assert.equal('evil' in clean, false);
  assert.match(R.SAVE_KEY, /^[a-z0-9_-]{1,40}$/i, 'the key survives the save export\'s filter');

  const save = R.defaultSave();
  save.best = 50;
  const s = R.createRun({ seed: 9 });
  advance(s, 60);
  s.score = 900;
  let fresh = R.recordRun(save, s);
  assert.deepEqual(fresh, { best: true, sector: true });
  assert.equal(save.best, 900);
  assert.equal(save.ballsLost, TUNE.BALLS);
  assert.equal(save.ballsEaten, TUNE.BALLS);
  s.score = 10;
  fresh = R.recordRun(save, s);
  assert.equal(fresh.best, false);
  assert.equal(save.best, 900);
  assert.equal(save.ballsLost, TUNE.BALLS * 2);
});

// ── the two voices ──
const FULL = {
  runs: 7, next: 8, ballsLost: 21, ballsEaten: 9, best: 5000, coins: 44, hour: 2, input: 'touch', cabinet: true,
  pongRally: 41, pongWins: 3, pongLosses: 5, bpSectors: 12, sector: 4, quota: 16, score: 1234, balls: 2, chain: 10, away: 12
};

test('NULL talks in capitals, the ball in lower case, and no line is left with a hole in it', () => {
  for (const [event, lines] of Object.entries(NULL_LINES)) {
    assert.ok(lines.length > 0, event);
    for (const l of lines) {
      const text = fill(typeof l === 'string' ? l : l.t, FULL);
      assert.ok(!/[{}]/.test(text), `${event}: every {name} is something the game knows: ${text}`);
      assert.equal(text, text.toUpperCase(), `${event}: ${text}`);
      assert.ok(text.length <= 110, `${event}: fits the terminal line: ${text}`);
    }
  }
  for (const [event, lines] of Object.entries(BALL_LINES)) {
    for (const l of lines) {
      assert.equal(l, l.toLowerCase(), `${event}: ${l}`);
      assert.ok(l.length <= 40);
    }
  }
  assert.ok(EXIT_FLICKER.length >= 3);
});

test('NULL only says what is true of this player', () => {
  const firstVisit = { runs: 0, next: 1, ballsLost: 0, ballsEaten: 0, best: 0, coins: 0, hour: 14, input: 'key', cabinet: false, pongRally: 0, bpSectors: 0 };
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pick(NULL_LINES, 'boot', firstVisit, Math.random));
  for (const line of seen) {
    assert.ok(!/CABINET 01|CABINET 02|COINS|MIDNIGHT|THUMB|WALKED|YOUR BEST/.test(line), `not true of a first visit by keyboard, in the afternoon, from a link: ${line}`);
  }
  assert.ok([...seen].some((l) => l.includes('TYPED MY ADDRESS')), 'it knows there is no arcade around it');
  // someone who has played the other two cabinets hears about them
  const all = new Set();
  for (let i = 0; i < 400; i++) all.add(pick(NULL_LINES, 'boot', FULL, Math.random));
  assert.ok([...all].some((l) => l.includes('41')), 'the longest rally from cabinet 01');
  assert.ok([...all].some((l) => l.includes('12 SECTORS')), 'the sectors purged in cabinet 02');
  assert.ok([...all].some((l) => l.includes('MIDNIGHT')));
  assert.ok([...all].some((l) => l.includes('THUMB')));
  // an event with every line conditional still has something for anyone, or nothing at all
  assert.equal(pick(NULL_LINES, 'no-such-event', FULL), '');
});

test('nothing is repeated until everything that fits has been said', () => {
  const used = new Set();
  const n = NULL_LINES.ballEaten.length;
  const round = [];
  for (let i = 0; i < n; i++) round.push(pick(NULL_LINES, 'ballEaten', FULL, Math.random, used));
  assert.equal(new Set(round).size, n, 'one full round, no repeats');
  assert.ok(pick(NULL_LINES, 'ballEaten', FULL, Math.random, used), 'and then it starts again');
});

// ── what the page and the arcade ask of these files ──
test('every line the game asks for exists', () => {
  const game = src('nexus/js/game.js');
  const asked = [...game.matchAll(/Null\.say\('([a-zA-Z_]+)'[,)]/g)].map((m) => m[1]);
  assert.ok(asked.length > 20);
  for (const event of asked) assert.ok(NULL_LINES[event], `NULL has a line for ${event}`);
  for (const rule of [...R.SECTOR_RULES, R.EYE_RULE]) assert.ok(NULL_LINES['rule_' + rule.id], `a line for the ${rule.id} sector`);
  assert.ok(NULL_LINES.crash && NULL_LINES.bootFirst);
  for (const m of game.matchAll(/ballSay\('([a-zA-Z]+)'/g)) assert.ok(BALL_LINES[m[1]], `the ball has a line for ${m[1]}`);
  // what ended the run decides what NULL says about it
  for (const key of ['ballEaten', 'ballGaze', 'ballScore', 'ballDebris']) assert.ok(NULL_LINES[key]);
});

test('the page loads the arcade\'s shared files at the arcade\'s versions', () => {
  const html = src('nexus/index.html'), arcade = src('index.html');
  for (const shared of ['glitchpong-cosmetics.js', 'glitchcade-power.js']) {
    assert.ok(existsSync(new URL('../' + shared, import.meta.url)));
    const here = html.match(new RegExp(shared.replace('.', '\\.') + '(\\?v=[\\w-]+)'))[1];
    assert.ok(arcade.includes(shared + here), `${shared}${here} on both pages`);
  }
  assert.ok(html.indexOf('src="../glitchpong-cosmetics.js') < html.indexOf('src="js/game.js'), 'skins are loaded before the game asks for them');
  assert.match(html, /id="game"/, 'the arcade checks for this before it shows the frame');
  // the music and the Eye are the other cabinets' files
  const audio = src('nexus/js/audio.js'), game = src('nexus/js/game.js');
  for (const m of [...audio.matchAll(/'\.\.\/([^']+\.mp3)'/g), ...game.matchAll(/'\.\.\/([^']+\.png)'/g)]) {
    assert.ok(existsSync(new URL('../' + m[1], import.meta.url)), `${m[1]} exists`);
  }
});

test('the arcade knows cabinet 03', () => {
  const arcade = src('glitchcade.js'), floor = src('glitchcade-floor.js'), site = src('glitchpong-site.js'), admin = src('glitchpong-admin.js');
  assert.match(arcade, /NEXUS_URL = 'nexus\/index\.html\?cabinet'/);
  assert.match(arcade, /id: 'nexus', title: 'BLACK-HOLE NEXUS', slot: 3/);
  assert.match(arcade, /'glitchcade:nexus'/);
  assert.match(floor, /onNexusReport/);
  assert.ok(floor.includes(`'${R.SAVE_KEY}'`), 'the daily board reads this cabinet\'s coins');
  assert.ok(site.includes(R.SAVE_KEY + ':'), 'the save export carries the record');
  assert.ok(admin.includes(`"${R.SAVE_KEY}"`), 'Reset Progress clears it');
  // the frame posts what the arcade listens for
  const wallet = src('nexus/js/wallet.js');
  assert.match(wallet, /type: 'glitchcade:exit'/);
  assert.match(wallet, /type: 'glitchcade:nexus'/);
  assert.match(wallet, /KEY: 'glitchcade_wallet_v1'/);
});
