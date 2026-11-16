import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as R from '../nexus/js/rules.js';
import { NULL_LINES, BALL_LINES, EXIT_FLICKER, pick, fill } from '../nexus/js/voice.js';

// Black-Hole Nexus (cabinet 03), a glitched take on the spin-and-thrust rock
// shooter: the rules in nexus/js/rules.js and the two voices in nexus/js/voice.js. The run is played here by the same bot that
// plays the attract mode behind the menu. The drawing and the menus
// (nexus/js/game.js) are not covered, apart from what they ask of these files.
const { TUNE } = R;
const DT = 1 / 60;
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// advance a run, collecting its events
function advance(s, seconds, input = {}, events = []) {
  for (let i = 0; i < Math.round(seconds / DT) && s.phase !== 'over'; i++) {
    R.step(s, typeof input === 'function' ? input(s) : input, DT);
    events.push(...s.events);
    s.events.length = 0;
  }
  return events;
}
// put the ball somewhere, at rest, facing a given way (default: straight at the hole)
function place(s, th, r, facing = th + Math.PI) {
  Object.assign(s.ball, { x: Math.cos(th) * r, y: Math.sin(th) * r, vx: 0, vy: 0, a: facing, inv: 0, cool: 0 });
  s.history = [];
}
// a run that is past its countdown, with nothing on the screen and nothing arriving
function playing(opts = {}) {
  const s = R.createRun(Object.assign({ seed: 11 }, opts));
  advance(s, TUNE.INTRO + 0.1);
  assert.equal(s.phase, 'play');
  s.objs = []; s.shots = [];
  s.spawnT = 1e9;
  place(s, 0, 200);
  return s;
}
let nextId = 9000;
const debris = (s, size, o) => {
  const obj = Object.assign({ id: nextId++, kind: 'debris', size, rad: TUNE.RAD[size], look: 'brick', tint: 0, age: 2, warm: 0.5, vx: 0, vy: 0, spin: 0, rot: 0 }, o);
  s.objs.push(obj);
  return obj;
};
const pieces = (s, size) => s.objs.filter((o) => o.kind === 'debris' && (size === undefined || o.size === size));
// the bot, deciding twenty times a second like the page's attract mode
function botRun(seed, maxSeconds, skill = 1) {
  const s = R.createRun({ seed });
  let hold = {}, n = 0;
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
  for (let n = 1; n <= 40; n++) { const q = R.quota(n); assert.ok(q >= last && q <= 91); last = q; }
  assert.equal(R.quota(1), 5 * TUNE.MASS[3], 'sector 1 is five big pieces, broken all the way down');
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
  assert.ok(TUNE.PIECE[1] > TUNE.PIECE[2] && TUNE.PIECE[2] > TUNE.PIECE[3], 'the small pieces are worth the most');
  assert.equal(TUNE.MASS[3], 1 + 2 * TUNE.MASS[2], 'a big piece is itself and two of the next size down');
});

test('the ball turns, thrusts the way it faces, and keeps drifting', () => {
  const s = playing();
  place(s, 0, 200, 0);
  advance(s, 0.5, { right: true });
  assert.ok(Math.abs(s.ball.a - TUNE.TURN * 0.5) < 0.05, 'turned at the turn rate');
  advance(s, 0.5, { left: true });
  assert.ok(Math.abs(s.ball.a) < 0.05, 'and back');
  // thrust along a tangent, then let go
  place(s, 0, 200, Math.PI / 2);
  advance(s, 0.4, { thrust: true });
  const v = s.ball.vy;
  assert.ok(v > 80, `moving the way it faces: ${v}`);
  advance(s, 0.4);
  assert.ok(s.ball.vy > v * 0.6, 'still drifting after the button is let go');
  assert.ok(Math.hypot(s.ball.vx, s.ball.vy) <= TUNE.MAX_SPEED);
});

test('the hole pulls harder near it, and thrust always wins', () => {
  assert.ok(R.gravity(60) > R.gravity(200) && R.gravity(200) > R.gravity(289));
  assert.ok(TUNE.THRUST > R.gravity(TUNE.R_HOLE) * TUNE.SURGE_PULL * 1.5, 'even at the horizon while it breathes in');
  const s = playing();
  place(s, 1, s.holeR + TUNE.BALL_R + 6, 1);        // at the horizon's edge, facing straight out
  s.surge = { state: 'on', t: 9 };
  advance(s, 1.5, { thrust: true });
  assert.ok(R.dist(s.ball) > 150, `climbed to ${R.dist(s.ball)}`);
  assert.equal(s.balls, TUNE.BALLS);
});

test('off one side of the screen, back on the other', () => {
  const s = playing();
  place(s, 0, TUNE.R_OUT - 3, 0);
  s.ball.vx = 200;
  const events = advance(s, 0.1);
  assert.ok(events.some((e) => e.type === 'wrap'));
  assert.ok(s.ball.x < -200, `it is on the far side: ${s.ball.x}`);
  assert.ok(s.ball.vx > 150, 'still going the same way');
  // debris does the same
  const o = debris(s, 2, { x: 0, y: TUNE.R_OUT - 2, vy: 60 });
  advance(s, 0.2);
  assert.ok(o.y < -200);
  // a shot does not: it stops at the edge
  place(s, 0, 200, 0);
  advance(s, 0.05, { fire: true });
  assert.equal(s.shots.length, 1);
  advance(s, 1);
  assert.equal(s.shots.length, 0);
});

test('doing nothing loses every ball and earns nothing', () => {
  for (const input of [{}, { fire: true }, { left: true, fire: true }]) {
    const s = R.createRun({ seed: 4 });
    const events = advance(s, 120, input);
    assert.equal(s.phase, 'over', JSON.stringify(input));
    assert.equal(s.stats.sectors, 0);
    assert.equal(s.stats.coins, 0);
    assert.ok(events.some((e) => e.type === 'gameOver'));
  }
});

test('a competent player clears the first sectors and can beat the first Eye', () => {
  const runs = [1, 2, 3, 4, 5, 6].map((seed) => botRun(seed, 420));
  const reached = runs.map((r) => r.s.sector);
  if (process.env.SHOW_SCORES) console.log('sectors reached', reached, 'scores', runs.map((r) => Math.floor(r.s.score)));
  assert.ok(reached.filter((n) => n >= 4).length >= 5, `most runs get to sector 4: ${reached}`);
  assert.ok(reached.filter((n) => n >= 6).length >= 3, `and half of them beat THE EYE: ${reached}`);
  for (const { s, events } of runs) {
    const clears = events.filter((e) => e.type === 'sectorClear');
    assert.ok(clears.length > 0, 'sector 1 was cleared');
    assert.equal(clears.reduce((sum, e) => sum + e.coins, 0), s.stats.coins, 'coins are what the sectors paid');
    assert.ok(clears.every((e) => e.coins === (e.eye ? R.COINS.eye : R.COINS.sector)));
    assert.ok(Number.isFinite(s.score) && s.score >= 0);
  }
});

test('a sector pays the same coins as Breakpoint', () => {
  assert.deepEqual(R.COINS, { sector: 2, eye: 10 });
  const wallet = src('breakpoint/js/wallet.js');
  assert.match(wallet, /const COINS = \{ sector: 2, boss: 10 \}/);
});

test('a shot breaks a big piece in two, and those in two again', () => {
  const s = playing();
  place(s, 0, 200, Math.PI / 2);                    // facing along the tangent
  const big = debris(s, 3, { x: 200, y: 110 });
  let events = advance(s, 0.3, { fire: true });
  const first = events.find((e) => e.type === 'break');
  assert.equal(first.size, 3);
  assert.equal(first.pts, R.points(TUNE.PIECE[3], 200, 0, 1));
  assert.ok(!s.objs.includes(big));
  assert.ok(pieces(s, 2).length >= 1, 'it left medium pieces behind');
  // shoot everything that is left: seven pieces in all from one big one.
  // (The ball is held still and the pieces are frozen where they land, so
  // this is only about what breaks into what.)
  s.freeze = 1e9;
  const pilot = (st) => {
    Object.assign(st.ball, { x: 200, y: 0, vx: 0, vy: 0, inv: 99 });
    const left = pieces(st);
    if (!left.length) return {};
    const o = left.reduce((p, q) => (Math.hypot(p.x - 200, p.y) < Math.hypot(q.x - 200, q.y) ? p : q));
    const off = R.angDiff(st.ball.a, Math.atan2(o.y, o.x - 200));
    return { left: off < -0.03, right: off > 0.03, fire: Math.abs(off) < 0.08 };
  };
  advance(s, 40, pilot, events);
  assert.equal(pieces(s).length, 0, 'all of it is gone');
  const breaks = events.filter((e) => e.type === 'break');
  assert.equal(breaks.length, TUNE.MASS[3]);
  assert.deepEqual(breaks.map((e) => e.size).sort(), [1, 1, 1, 1, 2, 2, 3]);
  assert.equal(s.stats.broken, 7);
  assert.equal(s.bits, 7, 'and each one counts toward the sector');
  assert.ok(s.bestChain >= 2, 'a rally');
  assert.ok(s.score > TUNE.PIECE[3]);
});

test('breaking the last piece of the quota clears the sector and pays', () => {
  const s = playing();
  place(s, 0, 200, Math.PI / 2);
  s.bits = s.quota - 1;
  debris(s, 1, { x: 200, y: 90 });
  debris(s, 3, { x: -100, y: -100 });
  const events = advance(s, 0.3, { fire: true });
  const clear = events.find((e) => e.type === 'sectorClear');
  assert.ok(clear);
  assert.equal(clear.coins, 2);
  assert.equal(s.phase, 'clear');
  assert.equal(s.objs.length, 0, 'what was left is swept away');
  advance(s, TUNE.CLEAR + 0.1);
  assert.equal(s.sector, 2);
  assert.equal(s.rule.id, 'leak');
  assert.equal(s.bits, 0);
  // the rally ends if nothing else is broken in time
  const r = playing();
  place(r, 0, 200, Math.PI / 2);
  debris(r, 1, { x: 200, y: 90 });
  advance(r, 0.3, { fire: true });
  assert.equal(r.chain, 1);
  const later = advance(r, TUNE.CHAIN_WINDOW + 0.3, (st) => ({ thrust: R.dist(st.ball) < 180, left: false }));
  assert.ok(later.some((e) => e.type === 'chainBreak'));
  assert.equal(r.chain, 0);
});

test('a kill is worth more the nearer the ball is to the hole when it makes it', () => {
  const at = (r) => {
    const s = playing();
    place(s, 0, r, Math.PI / 2);
    debris(s, 1, { x: r, y: 80 });
    return advance(s, 0.3, { fire: true }).find((e) => e.type === 'break');
  };
  const far = at(240), mid = at(180), near = at(110);
  assert.deepEqual([far.band, mid.band, near.band], [1, 2, 3]);
  assert.equal(mid.pts, far.pts * 2);
  assert.equal(near.pts, far.pts * 3);
});

test('something still materialising can\'t be touched or shot', () => {
  const s = playing();
  const o = debris(s, 2, { x: s.ball.x, y: s.ball.y, age: 0, warm: 1 });
  let events = advance(s, 0.3, { fire: true });
  assert.equal(s.balls, TUNE.BALLS, 'the ball passed through it while it formed');
  assert.ok(!events.some((e) => e.type === 'break'));
  o.x = s.ball.x; o.y = s.ball.y; o.age = 0.95;
  events = advance(s, 0.3);
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'debris'), 'solid now');
});

test('debris takes a ball; a near miss scores instead', () => {
  const s = playing();
  debris(s, 2, { x: s.ball.x + 10, y: s.ball.y });
  let events = advance(s, 0.2);
  const lost = events.find((e) => e.type === 'ballLost');
  assert.equal(lost.cause, 'debris');
  assert.equal(s.balls, TUNE.BALLS - 1);
  assert.ok(s.ball.inv > 0, 'the new ball can\'t be hurt for a moment');
  assert.ok(R.dist(s.ball) > 190, 'and it starts again from high up');
  assert.ok(Math.hypot(s.ball.vx, s.ball.vy) > 40, 'already moving round the hole');
  // a graze: close enough to count, not close enough to hit
  const g = playing();
  debris(g, 2, { x: g.ball.x + TUNE.RAD[2] * 0.88 + TUNE.BALL_R + 7, y: g.ball.y });
  events = advance(g, 0.1);
  assert.ok(events.some((e) => e.type === 'graze'));
  assert.equal(g.balls, TUNE.BALLS);
  assert.equal(g.stats.grazes, 1);
  assert.ok(g.score > 0 && g.heat > 0);
});

test('LOYAL: the last ball refuses the horizon once a sector, if its moods are on', () => {
  const s = playing();
  s.balls = 1;
  place(s, 2, s.holeR + TUNE.BALL_R + 1);
  let events = advance(s, 0.4);
  assert.ok(events.some((e) => e.type === 'loyal'));
  assert.equal(s.balls, 1);
  assert.ok(s.ball.vx * s.ball.x + s.ball.vy * s.ball.y > 0, 'thrown back out');
  events = advance(s, 20);
  assert.ok(events.some((e) => e.type === 'gameOver'), 'the second time it goes in');
  // moods off: no refusal
  const off = playing({ moods: false });
  off.balls = 1;
  place(off, 2, off.holeR + TUNE.BALL_R + 1);
  events = advance(off, 0.4);
  assert.ok(!events.some((e) => e.type === 'loyal'));
  assert.equal(off.phase, 'over');
});

test('power-ups: a firewall takes one hit, a spread fires three, a freeze stops the debris', () => {
  const s = playing();
  s.objs.push({ id: nextId++, kind: 'power', power: 'shield', x: s.ball.x, y: s.ball.y, vx: 0, vy: 0, rad: 12, age: 1, warm: 0.2, life: 9 });
  advance(s, 0.1);
  assert.equal(s.shield, true);
  debris(s, 2, { x: s.ball.x + 8, y: s.ball.y });
  const events = advance(s, 0.2);
  assert.ok(events.some((e) => e.type === 'shieldBreak'));
  assert.equal(s.shield, false);
  assert.equal(s.balls, TUNE.BALLS);
  assert.equal(pieces(s).length, 0, 'the firewall destroyed what it hit');

  const m = playing();
  m.spread = TUNE.SPREAD_T;
  advance(m, 0.05, { fire: true });
  assert.equal(m.shots.length, 3);
  m.spread = 0; m.shots = []; m.ball.cool = 0;
  advance(m, 0.05, { fire: true });
  assert.equal(m.shots.length, 1);

  const f = playing();
  f.freeze = TUNE.FREEZE_T;
  const junk = debris(f, 2, { x: -150, y: 0, vx: 0, vy: 40 });
  advance(f, 1, { thrust: true });
  assert.equal(junk.y, 0);
  f.ball.inv = 99;
  advance(f, TUNE.FREEZE_T);
  assert.ok(junk.y > 0, 'and it moves again afterwards');
  // a power-up left alone goes away
  const p = playing();
  p.objs.push({ id: nextId++, kind: 'power', power: 'freeze', x: -200, y: 0, vx: 0, vy: 0, rad: 12, age: 1, warm: 0.2, life: 0.5 });
  p.ball.inv = 99;
  advance(p, 0.7, { thrust: true });
  assert.equal(p.objs.length, 0);
});

test('MEMORY LEAK: every piece the hole eats widens it, up to a limit', () => {
  const s = playing({ sector: 2 });
  assert.equal(s.rule.id, 'leak');
  place(s, 0, 250, 0);
  s.ball.inv = 99;
  const before = s.holeR;
  for (let i = 0; i < 30; i++) debris(s, 1, { x: Math.cos(i) * (s.holeR + 2 + i * 0.01), y: Math.sin(i) * (s.holeR + 2 + i * 0.01), vx: -Math.cos(i) * 60, vy: -Math.sin(i) * 60 });
  const events = advance(s, 1, { thrust: true });
  assert.ok(events.filter((e) => e.type === 'debrisEaten').length >= 12);
  assert.equal(s.leak, TUNE.LEAK_MAX);
  assert.ok(Math.abs(s.holeR - before - TUNE.LEAK_MAX) < 2);
  assert.equal(s.bits, 0, 'what the hole eats does not count toward the sector');
  // breaking a piece yourself narrows it again
  place(s, 0, 250, Math.PI / 2);
  s.objs = [];
  debris(s, 1, { x: 250, y: 80 });
  advance(s, 0.3, { fire: true });
  assert.equal(s.leak, TUNE.LEAK_MAX - TUNE.LEAK_PLUG);
  // a standard sector's hole does not grow from what it eats
  const plain = playing();
  place(plain, 0, 250, 0);
  debris(plain, 1, { x: plain.holeR + 1, y: 0, vx: -60 });
  advance(plain, 0.5, { thrust: true });
  assert.equal(plain.leak, 0);
});

test('LAG SPIKE puts the ball back where it was; QUANTUM SHIFT moves the debris across', () => {
  const s = playing({ sector: 4 });
  assert.equal(s.rule.id, 'lag');
  place(s, 0, 220, Math.PI / 2);
  s.lag = { state: 'idle', t: 1 };
  const events = [];
  advance(s, 1 + TUNE.LAG_WARN - 0.05, { thrust: true }, events);
  assert.ok(events.some((e) => e.type === 'lagWarn'), 'warned first');
  assert.ok(!events.some((e) => e.type === 'lagSnap'));
  const target = R.lagTarget(s);
  const yBefore = s.ball.y;
  advance(s, 0.1, { thrust: true }, events);
  assert.ok(events.some((e) => e.type === 'lagSnap'));
  assert.ok(s.ball.y < yBefore - 30, 'it went backwards');
  assert.ok(Math.hypot(s.ball.x - target.x, s.ball.y - target.y) < 40, 'to about where the warning showed');
  assert.ok(s.ball.inv > 0);

  const q = playing({ sector: 6 });
  assert.equal(q.rule.id, 'shift');
  const far = debris(q, 2, { x: 100, y: -150 });
  const onBall = debris(q, 2, { x: -q.ball.x + 20, y: -q.ball.y });     // its far side is where the ball is
  assert.equal(R.shiftLands(q, far), true);
  assert.equal(R.shiftLands(q, onBall), false);
  q.shift = { state: 'warn', t: 0.05 };
  const ev = advance(q, 0.1);
  assert.ok(ev.some((e) => e.type === 'shiftJump'));
  assert.ok(Math.abs(far.x + 100) < 3 && Math.abs(far.y - 150) < 3, 'to the far side of the hole');
  assert.ok(onBall.x < 0, 'but nothing lands on the ball');
  assert.equal(q.balls, TUNE.BALLS);
});

test('OVERCLOCK drifts the debris faster and pays half again for a kill', () => {
  const s = playing({ sector: 7 });
  assert.equal(s.rule.id, 'overclock');
  place(s, 0, 250, Math.PI / 2);
  const junk = debris(s, 2, { x: 0, y: -280, vx: 0, vy: 0 });
  junk.vx = 50;
  const x = junk.x;
  advance(s, 1, {});
  assert.ok(Math.abs(junk.x - x - 50 * TUNE.OVERCLOCK) < 4, `moved ${junk.x - x}`);
  s.heat = 0;
  place(s, 0, 250, Math.PI / 2);
  debris(s, 1, { x: 250, y: 80 });
  const ev = advance(s, 0.3, { fire: true });
  assert.equal(ev.find((e) => e.type === 'break').pts, R.points(TUNE.PIECE[1] * 1.5, 250, 0, 1));
});

test('at Critical Heat the hole breathes in and NULL throws your score at you', () => {
  const s = playing();
  place(s, 0, 240, 0);
  s.score = 123456;
  s.heat = 95; s.theftT = 0.1; s.surge = { state: 'idle', t: 0.1 };
  const events = advance(s, 0.3, { thrust: true });
  assert.ok(events.some((e) => e.type === 'heatCritical'));
  const theft = events.find((e) => e.type === 'hudTheft');
  assert.equal(theft.digits, '3456', 'the last four digits of the score');
  const glyphs = s.objs.filter((o) => o.look === 'glyph');
  assert.deepEqual(glyphs.map((o) => o.ch), ['3', '4', '5', '6']);
  assert.ok(glyphs.every((o) => o.warm >= 1 && o.size === 1), 'small pieces that take a moment to become solid');
  assert.ok(events.some((e) => e.type === 'surgeWarn'));
  advance(s, TUNE.SURGE_WARN + 0.1, { thrust: true }, events);
  assert.equal(s.surge.state, 'on');
  // one of your own digits is a cause of death with its own name
  const g = glyphs[0];
  g.age = 5; g.x = s.ball.x; g.y = s.ball.y; g.vx = g.vy = 0;
  s.ball.inv = 0;
  advance(s, 0.1, {}, events);
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'score'));
  assert.ok(R.CAUSES.score);
  assert.ok(s.heat < 95 - 20, 'losing a ball cools things down');
});

test('NULL notices when you stop shooting', () => {
  const s = playing();
  s.ball.inv = 999;
  const events = advance(s, TUNE.IDLE + 1, (st) => ({ thrust: R.dist(st.ball) < 200, left: false }));
  assert.ok(events.some((e) => e.type === 'idle'));
});

test('THE EYE gets harder each time it comes back', () => {
  const a = R.eyeSpec(5), b = R.eyeSpec(10), c = R.eyeSpec(15), z = R.eyeSpec(500);
  assert.ok(b.hp > a.hp && b.gazeW > a.gazeW && b.gapHalf < a.gapHalf);
  assert.equal(a.beams, 1);
  assert.equal(b.beams, 1);
  assert.equal(c.beams, 2, 'from the third Eye it looks both ways');
  assert.ok(z.hp <= 96 && z.gapHalf >= 34 && z.gazeW <= 0.95, 'and it stops getting worse');
  assert.ok(a.gapHalf * 2 > TUNE.BALL_R * 8, 'the gap is a good deal wider than the ball');
});

test('THE EYE: its gaze takes a ball anywhere but the gap, and not while it is shut', () => {
  const eye = (r, lid = 'open') => {
    const s = playing({ sector: 5 });
    assert.equal(s.rule.id, 'eye');
    s.eye.lidT = 1e9; s.eye.gapSpeed = 0; s.eye.lid = lid;
    place(s, 1, r(s));
    s.eye.gazeTh = 1 - 0.1;                       // the bar is just about to sweep over the ball
    return s;
  };
  let s = eye((st) => R.gapRadius(st.eye));
  advance(s, 0.5);
  assert.equal(s.balls, TUNE.BALLS, 'threaded the gap');
  s = eye((st) => R.gapRadius(st.eye) + st.eye.gapHalf + 30);
  const events = advance(s, 0.5);
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'gaze'));
  s = eye((st) => R.gapRadius(st.eye) + st.eye.gapHalf + 30, 'shut');
  advance(s, 0.5);
  assert.equal(s.balls, TUNE.BALLS, 'shut: it isn\'t looking');
});

test('THE EYE: shots hurt it while it is open, bounce off while it is shut, and it pays 10', () => {
  const s = playing({ sector: 5 });
  s.eye.lidT = 1e9; s.eye.gazeW = 0; s.eye.gazeTh = Math.PI;       // looking the other way
  place(s, 0, 150);                                                 // facing the hole
  const hp = s.eye.hp;
  assert.ok(hp >= 40, 'it takes a lot of shots');
  s.eye.lid = 'shut';
  let events = advance(s, 0.6, (st) => ({ fire: true, thrust: false, left: false, right: false }));
  assert.ok(events.some((e) => e.type === 'eyeDeflect'));
  assert.equal(s.eye.hp, hp, 'wasted');
  s.eye.lid = 'open';
  place(s, 0, 150);
  events = advance(s, 0.6, { fire: true });
  assert.ok(events.some((e) => e.type === 'eyeHit'));
  assert.ok(s.eye.hp < hp);
  // the last one
  s.eye.hp = 1;
  place(s, 0, 150);
  events = advance(s, 0.6, { fire: true });
  const clear = events.find((e) => e.type === 'sectorClear');
  assert.ok(events.some((e) => e.type === 'eyeDefeated'));
  assert.equal(clear.eye, true);
  assert.equal(clear.coins, 10);
  assert.equal(s.stats.eyes, 1);
});

test('GRUDGE: against THE EYE the ball\'s shots bend toward it, if its moods are on', () => {
  const bend = (moods) => {
    const s = playing({ sector: 5, moods });
    s.eye.lidT = 1e9; s.eye.gazeW = 0; s.eye.gazeTh = Math.PI;
    place(s, 0, 200, Math.PI / 2 + 0.5);            // firing well wide of the hole
    advance(s, 0.03, { fire: true });
    const shot = s.shots[0];
    advance(s, 0.3, { thrust: false });
    return shot.vx;                                 // how hard it has been pulled toward the middle
  };
  assert.ok(bend(true) < bend(false) - 20, 'pulled in harder with moods on');
});

test('the run recap names what ended it', () => {
  const s = R.createRun({ seed: 9 });
  advance(s, 120);
  const r = R.runRecap(s);
  assert.ok(r.cause === R.CAUSES.eaten || r.cause === R.CAUSES.debris);
  assert.equal(r.sector, 1);
  assert.equal(r.coins, 0);
  assert.equal(r.broken, 0);
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
  advance(s, 120);
  s.score = 900;
  let fresh = R.recordRun(save, s);
  assert.deepEqual(fresh, { best: true, sector: true });
  assert.equal(save.best, 900);
  assert.equal(save.ballsLost, TUNE.BALLS);
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
  for (const k of ['left', 'right', 'thrust', 'fire']) assert.ok(html.includes(`data-k="${k}"`), `a touch button for ${k}`);
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
