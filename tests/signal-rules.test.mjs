import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as R from '../signal/js/rules.js';
import { STATIC_LINES, BALL_LINES, EXIT_FLICKER, pick, fill } from '../signal/js/voice.js';

// Signal Lost (cabinet 04), a glitched take on the maze chase: the rules in
// signal/js/rules.js and the two voices in signal/js/voice.js. The run is
// played here by the same bot that plays the attract mode behind the menu.
// The drawing and the menus (signal/js/game.js) are not covered, apart from
// what they ask of these files.
const { TUNE, W, H, idx } = R;
const DT = 1 / 60;
const RIGHT = 0, DOWN = 1, LEFT = 2, UP = 3;
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// advance a run, collecting its events
function advance(s, seconds, input = {}, events = []) {
  for (let i = 0; i < Math.round(seconds / DT) && s.phase !== 'over' && s.phase !== 'won'; i++) {
    R.step(s, typeof input === 'function' ? input(s) : input, DT);
    events.push(...s.events);
    s.events.length = 0;
  }
  return events;
}
// a run that is past its countdown, with the static shut in its pen
function playing(opts = {}) {
  const s = R.createRun(Object.assign({ seed: 11 }, opts));
  advance(s, TUNE.INTRO + 0.05);
  assert.equal(s.phase, 'play');
  for (const c of s.chasers) { c.state = 'pen'; c.wait = 1e9; c.cell = idx(9 + c.k % 3, 10); c.next = c.cell; c.dir = -1; c.t = 0; }
  s.ball.inv = 0;
  return s;
}
function put(e, x, y) { e.cell = idx(x, y); e.next = e.cell; e.dir = -1; e.t = 0; }
// let one of the static out, standing on a tile
function loose(s, k, x, y) {
  const c = s.chasers[k];
  put(c, x, y);
  c.state = 'out'; c.fright = 0; c.close = false;
  return c;
}
// the bot, deciding fifteen times a second
function botRun(seed, maxSeconds, opts = {}) {
  const s = R.createRun(Object.assign({ seed }, opts));
  let hold = {}, n = 0;
  const events = advance(s, maxSeconds, (st) => { if (n++ % 4 === 0) hold = R.botInput(st, 1); return hold; });
  return { s, events };
}
const reachable = (m) => { const d = R.distances(m, R.START); return [...m.packets, ...m.overrides].every((i) => d[i] >= 0); };

test('there are ten mazes, and every one of them is fair', () => {
  assert.equal(R.MAZES.length, 10);
  assert.equal(R.LAST_MAZE, 10);
  const rules = new Set();
  for (let n = 1; n <= 10; n++) {
    const m = R.buildMaze(n), spec = R.mazeSpec(n);
    rules.add(m.rule);
    assert.ok(R.mazeIsSound(m), `${m.name}: every open cell can be reached and none is a dead end`);
    assert.ok(reachable(m), `${m.name}: every packet can be reached`);
    assert.ok(m.total >= 180, `${m.name}: ${m.total} things to take`);
    assert.equal(m.overrides.size, 4);
    assert.equal(m.grid[R.START], R.OPEN);
    assert.equal(m.grid[R.GATE], R.OPEN);
    assert.equal(m.grid[R.DOOR_CELL], R.DOOR);
    assert.ok(!m.packets.has(R.START) && !m.packets.has(R.GATE));
    // the same left and right
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) assert.equal(m.grid[idx(x, y)], m.grid[idx(W - 1 - x, y)], `${m.name} at ${x},${y}`);
    // the tunnel goes through the side walls and comes out the other side
    assert.equal(m.grid[idx(0, spec.tunnel)], R.OPEN);
    assert.equal(R.stepCell(m, idx(0, spec.tunnel), LEFT), idx(W - 1, spec.tunnel));
    // the same number is always the same maze
    assert.deepEqual([...R.buildMaze(n).grid], [...m.grid]);
    assert.match(spec.name, /^[A-Z' ]+$/);
    assert.ok(spec.line.length <= 60, `${spec.name}: the line fits the banner`);
  }
  assert.equal(rules.size, 10, 'each has its own rule');
  assert.deepEqual(R.MAZES.map((m) => m.rule), ['standard', 'overflow', 'panic', 'coolant', 'portal', 'leak', 'echo', 'defrag', 'train', 'lair']);
  // the top and bottom of STACK OVERFLOW wrap too; QUANTUM SHIFT has two doors
  const over = R.buildMaze(2);
  assert.equal(R.stepCell(over, idx(5, 0), UP), idx(5, H - 1));
  assert.equal(R.buildMaze(5).portals.length, 2);
  assert.equal(R.buildMaze(1).portals, null);
});

test('the static is never as fast as the ball, and gets better at junctions', () => {
  for (let n = 1; n <= 60; n++) {
    assert.ok(R.chaserSpeed(n) < TUNE.SPEED, `maze ${n}`);
    assert.ok(R.frightTime(n) >= TUNE.FRIGHT_MIN);
    assert.ok(R.lapseChance(n) >= 0.05 && R.lapseChance(n) <= 0.2);
  }
  assert.ok(R.chaserSpeed(10) > R.chaserSpeed(1));
  assert.ok(R.lapseChance(10) < R.lapseChance(1));
  assert.ok(R.frightTime(10) < R.frightTime(1));
  assert.ok(TUNE.TUNNEL_SPEED < R.chaserSpeed(1), 'and it is slow in the tunnel');
  // after the tenth maze they come round again, faster
  assert.equal(R.mazeSpec(11).rule, 'standard');
  assert.equal(R.tierOf(10), 0);
  assert.equal(R.tierOf(11), 1);
  assert.equal(R.CHASERS.length, 4);
  for (const c of R.CHASERS) assert.match(c.how, /^[A-Z ,.']+$/);
});

test('Heat multiplies on the other cabinets\' steps, and a maze pays what a Breakpoint sector pays', () => {
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(R.heatMultiplier), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
  assert.deepEqual(R.COINS, { maze: 2, lair: 10 });
  assert.match(src('breakpoint/js/wallet.js'), /const COINS = \{ sector: 2, boss: 10 \}/);
  assert.ok(R.clearBonus(8) > R.clearBonus(2));
});

test('the ball takes a turn that was asked for early, turns back anywhere, and stops at a wall', () => {
  const s = playing();
  const m = s.maze;
  // from the start it can go left or right along the ring; ask for right
  advance(s, 0.05, { dir: RIGHT });
  assert.equal(s.ball.dir, RIGHT);
  const x0 = R.pos(s.ball).x;
  advance(s, 0.2, { dir: -1 });
  assert.ok(R.pos(s.ball).x > x0 + 1, 'it keeps going with nothing pressed');
  assert.ok(Math.abs((R.pos(s.ball).x - x0) / 0.2 - TUNE.SPEED) < 0.6, 'at its own speed');
  // turn back in the middle of a corridor
  advance(s, 0.03, { dir: LEFT });
  assert.equal(s.ball.dir, LEFT);
  // a turn asked for before the junction is taken when it gets there
  const t = playing();
  put(t.ball, 7, 13);                                  // the ring's corner: up is open, left may not be
  assert.ok(R.stepCell(t.maze, idx(7, 13), UP) >= 0);
  put(t.ball, 9, 13);
  advance(t, 0.02, { dir: LEFT });
  advance(t, 0.5, { dir: UP });
  assert.equal(t.ball.dir, UP, 'it turned up at the corner');
  assert.equal(R.pos(t.ball).x, 7);
  // into a wall: it stops, and waits
  const w = playing();
  put(w.ball, 1, 1);
  advance(w, 0.3, { dir: UP });
  assert.equal(w.ball.dir, -1);
  assert.deepEqual(R.pos(w.ball), { x: 1, y: 1 });
  assert.equal(m.grid[idx(1, 0)], R.WALL);
});

test('the tunnel takes the ball from one side to the other', () => {
  const s = playing();
  const row = s.maze.tunnel;
  put(s.ball, 1, row);
  advance(s, 0.6, { dir: LEFT });
  assert.ok(R.pos(s.ball).x > W - 5, `it came out on the right: ${R.pos(s.ball).x}`);
  assert.equal(R.cellOf(s.ball) % W >= W - 4, true);
});

test('taking every packet clears the maze, pays, and opens the next', () => {
  const s = playing();
  const m = s.maze;
  put(s.ball, 9, 13);
  const before = m.packets.size;
  const events = advance(s, 0.4, { dir: LEFT });
  const got = events.filter((e) => e.type === 'packet');
  assert.ok(got.length >= 1);
  assert.equal(got[0].pts, TUNE.PACKET);
  assert.equal(m.packets.size, before - got.length);
  assert.equal(s.stats.packets, got.length);
  assert.ok(s.heat > 0 && s.chain === got.length);
  // down to the last one
  m.packets.clear(); m.overrides.clear();
  m.packets.add(R.stepCell(m, R.cellOf(s.ball), s.ball.dir));
  const done = advance(s, 0.5, {});
  const clear = done.find((e) => e.type === 'mazeClear');
  assert.ok(clear);
  assert.equal(clear.coins, 2);
  assert.equal(clear.lair, false);
  assert.equal(s.phase, 'clear');
  advance(s, TUNE.CLEAR + 0.1);
  assert.equal(s.n, 2);
  assert.equal(s.maze.rule, 'overflow');
  assert.equal(s.phase, 'intro');
  assert.ok(s.maze.packets.size > 150, 'a full maze again');
});

test('every third maze gives a ball back, up to five', () => {
  const clearNow = (s) => {
    s.maze.packets.clear(); s.maze.overrides.clear();
    put(s.ball, 9, 13);
    s.maze.packets.add(idx(8, 13));
    return advance(s, 0.5, { dir: LEFT }).find((e) => e.type === 'mazeClear');
  };
  const s = playing({ maze: 3 });
  s.balls = 2;
  assert.equal(clearNow(s).extra, true);
  assert.equal(s.balls, 3);
  const t = playing({ maze: 2 });
  assert.equal(clearNow(t).extra, false);
  const full = playing({ maze: 6 });
  full.balls = TUNE.MAX_BALLS;
  assert.equal(clearNow(full).extra, false);
  assert.equal(full.balls, TUNE.MAX_BALLS);
});

test('a piece of static takes a ball, and everything goes back to where it started', () => {
  const s = playing();
  put(s.ball, 3, 1);
  loose(s, 0, 3, 1);
  const events = advance(s, 0.3, {});
  const lost = events.find((e) => e.type === 'ballLost');
  assert.equal(lost.cause, 'static');
  assert.equal(lost.by, 'ping');
  assert.equal(s.balls, TUNE.BALLS - 1);
  assert.equal(s.phase, 'reset');
  advance(s, TUNE.RESET + 0.1);
  assert.equal(s.phase, 'play');
  assert.equal(s.ball.cell, R.START);
  assert.deepEqual(s.chasers.map((c) => c.state), ['out', 'pen', 'pen', 'pen']);
  assert.equal(R.runRecap(s).cause, 'CAUGHT BY PING');
  // three and it is over
  for (let k = 0; k < 2; k++) {
    for (const c of s.chasers) { c.state = 'pen'; c.wait = 1e9; }
    s.ball.inv = 0; s.loyalUsed = true;
    put(s.ball, 3, 1); loose(s, 1, 3, 1);
    advance(s, 0.3, {});
    advance(s, TUNE.RESET + 0.1);
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.stats.caughtBy, 3);
});

test('an override turns the chase round: the static runs, and can be caught for more each time', () => {
  const s = playing();
  const m = s.maze;
  const [ov] = [...m.overrides];
  const o = R.xy(ov);
  const a = loose(s, 0, o.x + 2, o.y), b = loose(s, 1, o.x + 4, o.y);
  put(s.ball, o.x, o.y + 1);
  let events = advance(s, 0.25, { dir: UP });
  assert.ok(events.some((e) => e.type === 'override'));
  assert.ok(a.fright > 0 && b.fright > 0);
  assert.equal(m.overrides.size, 3);
  // walk into the first, then the second
  const hunt = (c) => { const p = R.pos(c); put(s.ball, Math.round(p.x), Math.round(p.y)); s.ball.inv = 0; return advance(s, 0.2, {}); };
  events = hunt(a);
  const first = events.find((e) => e.type === 'catch');
  assert.equal(first.id, 'ping');
  assert.equal(first.pts, TUNE.CATCH);
  assert.equal(a.state, 'home');
  assert.equal(s.balls, TUNE.BALLS, 'catching it costs nothing');
  events = hunt(b);
  assert.equal(events.find((e) => e.type === 'catch').pts, TUNE.CATCH * 2, 'the second is worth double');
  // the one that was caught goes back to its box and comes out again
  const ev = advance(s, 8, (st) => { st.ball.inv = 9; return {}; });
  assert.ok(ev.some((e) => e.type === 'release' && e.id === 'ping'));
  assert.equal(s.phase, 'play');
  // when the time is up it hunts again
  const c = loose(s, 2, 15, 1);
  c.fright = 0.3;
  advance(s, 0.5, (st) => { st.ball.inv = 9; return {}; });
  assert.equal(c.fright, 0);
});

test('a close call scores, and so does the dash get you out of one', () => {
  const s = playing();
  put(s.ball, 1, 1);
  const c = loose(s, 0, 2, 1);
  c.close = true;                                    // it was right on the ball
  put(c, 9, 1);                                      // ...and now it is not
  const events = advance(s, 0.1, {});
  const close = events.find((e) => e.type === 'closeCall');
  assert.equal(close.pts, TUNE.CLOSE_CALL);
  assert.equal(s.stats.closeCalls, 1);
  assert.ok(s.heat > 4);
  // the dash: twice the speed for a moment, then a wait
  const d = playing();
  put(d.ball, 1, 1);
  advance(d, 0.02, { dir: RIGHT });
  const x0 = R.pos(d.ball).x;
  const ev = advance(d, 0.3, (st) => ({ dir: RIGHT, dash: true }));
  assert.equal(ev.filter((e) => e.type === 'dash').length, 1, 'held down, it still only fires once');
  assert.ok(R.pos(d.ball).x - x0 > TUNE.SPEED * 0.3 * 1.6, 'much further than it would have gone');
  assert.ok(d.dashCool > TUNE.DASH_COOL - 0.5);
  advance(d, TUNE.DASH_COOL, {});
  assert.equal(d.dashCool, 0);
});

test('LOYAL and GRUDGE: the last ball shrugs one touch off a maze, and remembers who caught it', () => {
  const s = playing();
  s.balls = 1;
  put(s.ball, 3, 1); loose(s, 0, 3, 1);
  let events = advance(s, 0.1, {});
  assert.ok(events.some((e) => e.type === 'loyal'));
  assert.equal(s.balls, 1);
  assert.ok(s.ball.inv > 0);
  s.ball.inv = 0;
  put(s.ball, 3, 1); put(s.chasers[0], 3, 1);
  events = advance(s, 0.3, {});
  assert.ok(events.some((e) => e.type === 'gameOver'), 'only once');
  const off = playing({ moods: false });
  off.balls = 1;
  put(off.ball, 3, 1); loose(off, 0, 3, 1);
  assert.ok(!advance(off, 0.3, {}).some((e) => e.type === 'loyal'));
  assert.equal(off.phase, 'over');
  // the one that caught it is worth double the next time it is caught
  const g = playing();
  g.grudge = 'cache';
  const c = loose(g, 1, 4, 1);
  c.fright = 5;
  put(g.ball, 4, 1);
  const caught = advance(g, 0.2, {}).find((e) => e.type === 'catch');
  assert.equal(caught.grudge, true);
  assert.equal(caught.pts, TUNE.CATCH * 2);
  assert.equal(g.grudge, null);
});

test('at full Heat THE EYE arrives, fires down the corridor the ball is in, and leaves', () => {
  const s = playing();
  s.heat = 100;
  put(s.ball, 1, 1);
  const events = advance(s, 0.1, {});
  assert.ok(events.some((e) => e.type === 'eyeArrive'));
  assert.equal(s.eye.shots, TUNE.EYE_SHOTS);
  // standing still in a straight line: it is hit
  advance(s, 1.3, {}, events);
  assert.ok(events.some((e) => e.type === 'lineWarn' && e.cause === 'gaze'));
  assert.ok(s.line.cells.has(idx(1, 1)), 'the line is the corridor the ball is in');
  advance(s, TUNE.EYE_WARN + 0.2, {}, events);
  assert.ok(events.some((e) => e.type === 'ballLost' && e.cause === 'gaze'));
  assert.equal(s.eye, null, 'and it leaves');
  // out of the line by a third of a tile is out of it
  const line = { cells: new Set([idx(1, 1), idx(2, 1), idx(3, 1)]) };
  assert.equal(R.onLine(line, { cell: idx(1, 1), next: idx(1, 1), dir: -1, t: 0 }), true);
  assert.equal(R.onLine(line, { cell: idx(1, 1), next: idx(2, 1), dir: RIGHT, t: 0.5 }), true, 'along it');
  assert.equal(R.onLine(line, { cell: idx(1, 1), next: idx(1, 2), dir: DOWN, t: 0.2 }), true, 'just starting to leave');
  assert.equal(R.onLine(line, { cell: idx(1, 1), next: idx(1, 2), dir: DOWN, t: 0.4 }), false, 'leaving');
  assert.equal(R.onLine(line, { cell: idx(1, 2), next: idx(1, 1), dir: UP, t: 0.5 }), false, 'not yet in');
  assert.equal(R.onLine(line, { cell: idx(1, 2), next: idx(1, 1), dir: UP, t: 0.8 }), true, 'nearly in');
  // the bot turns corners, and outlasts it
  const b = playing({ seed: 3 });
  b.heat = 100;
  let hold = {}, n = 0;
  const ev = advance(b, 14, (st) => { if (n++ % 4 === 0) hold = R.botInput(st, 1); return hold; });
  assert.equal(ev.filter((e) => e.type === 'lineFire').length, TUNE.EYE_SHOTS);
  const out = ev.find((e) => e.type === 'eyeSurvived');
  assert.ok(out, 'survived');
  assert.ok(out.pts >= TUNE.EYE_BONUS);
  assert.equal(b.stats.eyes, 1);
  assert.equal(b.balls, TUNE.BALLS);
});

test('STACK OVERFLOW wraps top to bottom; QUANTUM SHIFT sends the ball through its doors', () => {
  const s = playing({ maze: 2 });
  put(s.ball, 5, 1);
  advance(s, 0.5, { dir: UP });
  assert.ok(R.pos(s.ball).y > H - 5, 'out of the top, in at the bottom');
  const q = playing({ maze: 5 });
  const [a, b] = q.maze.portals;
  const pa = R.xy(a);
  // walk into the first door from whichever side is open
  const d = R.openDirs(q.maze, a)[0];
  const from = R.stepCell(q.maze, a, d);
  q.ball.cell = from; q.ball.next = from; q.ball.dir = -1; q.ball.t = 0;
  advance(q, 0.25, { dir: R.opposite(d) });
  const near = R.xy(R.cellOf(q.ball)), pb = R.xy(b);
  assert.ok(Math.abs(near.x - pb.x) + Math.abs(near.y - pb.y) <= 2, `it is at the other door: ${near.x},${near.y}`);
  assert.ok(Math.abs(near.x - pa.x) + Math.abs(near.y - pa.y) > 6);
});

test('COOLANT LEAK: the ball cannot turn back, and slides round corners', () => {
  const s = playing({ maze: 4 });
  put(s.ball, 1, 1);
  advance(s, 0.2, { dir: RIGHT });
  assert.equal(s.ball.dir, RIGHT);
  const x = R.pos(s.ball).x;
  advance(s, 0.2, { dir: LEFT });
  assert.ok(R.pos(s.ball).x > x, 'still going right');
  advance(s, 4, { dir: LEFT });
  assert.ok(s.ball.dir >= 0, 'it never stops');
});

test('MEMORY LEAK and DEFRAG move walls, with a warning, and never make the maze unfair', () => {
  for (const n of [6, 8]) {
    const { s, events } = botRun(5, 70, { maze: n });
    const moves = events.filter((e) => e.type === 'wallMove');
    assert.ok(moves.length >= 3, `maze ${n}: ${moves.length} walls moved`);
    assert.equal(events.filter((e) => e.type === 'wallWarn').length >= moves.length, true, 'each with a warning first');
    assert.ok(s.maze.closed.length <= TUNE.LEAK_MAX || n === 8);
  }
  // checked after every single change, with the static chasing and the ball moving
  for (const n of [6, 8]) {
    const s = R.createRun({ seed: 9, maze: n });
    let hold = {}, k = 0, changes = 0;
    for (let i = 0; i < 90 * 60 && s.phase !== 'over' && s.n === n; i++) {
      if (k++ % 4 === 0) hold = R.botInput(s, 1);
      R.step(s, hold, DT);
      for (const e of s.events) {
        if (e.type !== 'wallMove') continue;
        changes++;
        assert.ok(R.mazeIsSound(s.maze), `maze ${n}: still no dead ends, still all connected`);
        assert.ok(reachable(s.maze), `maze ${n}: every packet can still be reached`);
        for (const c of s.maze.closed) assert.ok(!s.maze.packets.has(c), 'a corridor only closes once it is empty');
      }
      s.events.length = 0;
    }
    assert.ok(changes >= 3);
  }
});

test('ECHO: the ball\'s own path follows it, and standing still lets it catch up', () => {
  const s = playing({ maze: 7 });
  put(s.ball, 1, 1);
  const events = advance(s, 1.5, { dir: RIGHT });
  advance(s, TUNE.ECHO_DELAY - 1 + 0.4, { dir: DOWN }, events);
  assert.ok(s.echo, 'the echo is out');
  assert.ok(!events.some((e) => e.type === 'ballLost'), 'it is behind the ball while the ball keeps moving');
  // run into a wall and wait
  const w = playing({ maze: 7 });
  put(w.ball, 3, 1);
  advance(w, 0.3, { dir: LEFT });
  const ev = advance(w, TUNE.ECHO_DELAY + 1.5, { dir: UP });
  assert.ok(ev.some((e) => e.type === 'ballLost' && e.cause === 'echo'));
});

test('LAST TRAIN: it runs along the tunnel row after a warning, and takes the static with it', () => {
  const s = playing({ maze: 9 });
  const row = s.maze.tunnel;
  s.trainT = 0.1;
  put(s.ball, 1, row === 1 ? 3 : 1);
  const c = loose(s, 0, 3, row);
  c.dir = -1;
  const events = advance(s, 0.3, {});
  assert.ok(events.some((e) => e.type === 'lineWarn' && e.cause === 'train'));
  assert.ok(s.line.cells.has(idx(1, row)) && s.line.cells.has(idx(W - 1, row)));
  put(c, 3, row);
  advance(s, TUNE.TRAIN_WARN, (st) => { put(st.chasers[0], 3, row); return {}; }, events);
  assert.ok(events.some((e) => e.type === 'lineFire'));
  assert.equal(c.state, 'home', 'the static on the row is sent back to its box');
  assert.equal(s.balls, TUNE.BALLS, 'the ball was not on the row');
  // on the tracks
  const t = playing({ maze: 9 });
  t.trainT = 0.1;
  put(t.ball, 1, t.maze.tunnel);
  const ev = advance(t, TUNE.TRAIN_WARN + 0.6, {});
  assert.ok(ev.some((e) => e.type === 'ballLost' && e.cause === 'train'));
});

test('THE EYE\'S LAIR: it is there from the start, fires on a schedule, and the maze pays 10', () => {
  const s = playing({ maze: 10 });
  assert.equal(s.eye.lair, true);
  put(s.ball, 1, 1);
  const events = advance(s, TUNE.LAIR_EVERY + 0.2, {});
  assert.ok(events.some((e) => e.type === 'lineWarn' && e.cause === 'gaze'));
  s.maze.packets.clear(); s.maze.overrides.clear();
  s.line = null; s.eye.t = 99;
  put(s.ball, 9, 13);
  s.maze.packets.add(idx(8, 13));
  const clear = advance(s, 0.5, { dir: LEFT }).find((e) => e.type === 'mazeClear');
  assert.equal(clear.coins, 10);
  assert.equal(clear.lair, true);
  // and that is the game: the signal is restored
  const ev = advance(s, TUNE.CLEAR + 0.1, {});
  assert.ok(ev.some((e) => e.type === 'restored'));
  assert.equal(s.phase, 'won');
  assert.equal(s.stats.restored, true);
  assert.equal(R.runRecap(s).restored, true);
  // it can carry on: the ten come round again
  R.continueRun(s);
  assert.equal(s.n, 11);
  assert.equal(s.phase, 'intro');
  assert.equal(s.maze.rule, 'standard');
  assert.deepEqual([...s.maze.grid], [...R.buildMaze(1).grid]);
});

test('doing nothing loses every ball and clears nothing', () => {
  for (const input of [{}, { dir: RIGHT }, { dir: LEFT, dash: true }]) {
    const s = R.createRun({ seed: 4 });
    const events = advance(s, 240, input);
    assert.equal(s.phase, 'over', JSON.stringify(input));
    assert.equal(s.stats.mazes, 0);
    assert.equal(s.stats.coins, 0);
    assert.ok(events.some((e) => e.type === 'gameOver'));
  }
});

test('the game can be beaten: a competent player clears all ten mazes', () => {
  const runs = [1, 2, 3, 4].map((seed) => botRun(seed, 1100));
  const reached = runs.map((r) => r.s.n), won = runs.filter((r) => r.s.phase === 'won').length;
  if (process.env.SHOW_SCORES) console.log('mazes reached', reached, 'won', won, 'scores', runs.map((r) => Math.floor(r.s.score)));
  assert.ok(won >= 2, `at least half the runs restore the signal: ${won} of 4 (reached ${reached})`);
  assert.ok(reached.every((n) => n >= 4), `and every run gets a good way in: ${reached}`);
  for (const { s, events } of runs) {
    const clears = events.filter((e) => e.type === 'mazeClear');
    assert.equal(clears.reduce((sum, e) => sum + e.coins, 0), s.stats.coins, 'coins are what the mazes paid');
    assert.ok(clears.every((e) => e.coins === (e.lair ? R.COINS.lair : R.COINS.maze)));
    if (s.phase === 'won') assert.equal(s.stats.coins, 9 * R.COINS.maze + R.COINS.lair);
  }
});

test('the save: junk is dropped, runs are folded in, bests only go up', () => {
  assert.deepEqual(R.sanitizeSave(null), R.defaultSave());
  assert.deepEqual(R.sanitizeSave('garbage'), R.defaultSave());
  const clean = R.sanitizeSave({ best: 4200.9, runs: -3, caughtBy: 'often', vol: 400, fx: 0, talk: false, noSignalSeen: 1, evil: { x: 1 } });
  assert.equal(clean.best, 4200);
  assert.equal(clean.runs, 0);
  assert.equal(clean.caughtBy, 0);
  assert.equal(clean.vol, 100);
  assert.equal(clean.fx, false);
  assert.equal(clean.talk, false);
  assert.equal(clean.moods, true, 'a switch that was never saved is on');
  assert.equal(clean.noSignalSeen, true);
  assert.equal('evil' in clean, false);
  assert.match(R.SAVE_KEY, /^[a-z0-9_-]{1,40}$/i, 'the key survives the save export\'s filter');
  const save = R.defaultSave();
  const s = R.createRun({ seed: 4 });
  advance(s, 240, {});
  s.score = 900;
  let fresh = R.recordRun(save, s);
  assert.deepEqual(fresh, { best: true, maze: true });
  assert.equal(save.best, 900);
  assert.equal(save.ballsLost, TUNE.BALLS);
  assert.equal(save.caughtBy, TUNE.BALLS);
  s.score = 10;
  fresh = R.recordRun(save, s);
  assert.equal(fresh.best, false);
  assert.equal(save.best, 900);
});

// ── the two voices ──
const FULL = {
  runs: 7, next: 8, caughtBy: 21, catches: 9, best: 5000, restored: 2, coins: 44, hour: 2, input: 'touch', cabinet: true,
  pongRally: 41, pongWins: 3, pongEyes: 4, bpSectors: 12, nexusEaten: 6, maze: 4, balls: 2, away: 12, name: 'PING'
};

test('the static talks in capitals, the ball in lower case, and no line is left with a hole in it', () => {
  for (const [event, lines] of Object.entries(STATIC_LINES)) {
    assert.ok(lines.length > 0, event);
    for (const l of lines) {
      const text = fill(typeof l === 'string' ? l : l.t, FULL);
      assert.ok(!/[{}]/.test(text), `${event}: every {name} is something the game knows: ${text}`);
      assert.equal(text, text.toUpperCase(), `${event}: ${text}`);
      assert.ok(text.length <= 125, `${event}: fits the terminal line (${text.length}): ${text}`);
    }
  }
  for (const [event, lines] of Object.entries(BALL_LINES)) {
    for (const l of lines) {
      assert.equal(l, l.toLowerCase(), `${event}: ${l}`);
      assert.ok(l.length <= 44);
    }
  }
  assert.ok(EXIT_FLICKER.length >= 3);
});

test('the static only says what is true of this player', () => {
  const firstVisit = { runs: 0, next: 1, caughtBy: 0, catches: 0, best: 0, restored: 0, coins: 0, hour: 14, input: 'key', cabinet: false, pongEyes: 0, nexusEaten: 0 };
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(pick(STATIC_LINES, 'boot', firstVisit, Math.random));
  for (const line of seen) assert.ok(!/CAUGHT YOU|CABINET 01|NULL|COINS|MIDNIGHT|WALKED|RESTORED|YOUR BEST/.test(line), `not true of a first visit: ${line}`);
  assert.ok([...seen].some((l) => l.includes('JUST A TAB')), 'it knows there is no arcade around it');
  const all = new Set();
  for (let i = 0; i < 500; i++) all.add(pick(STATIC_LINES, 'boot', FULL, Math.random));
  assert.ok([...all].some((l) => l.includes('CAUGHT YOU 21 TIMES')));
  assert.ok([...all].some((l) => l.includes('THE EYE 4 TIMES')), 'what you did in cabinet 01');
  assert.ok([...all].some((l) => l.includes('NULL SAYS IT HAS 6')), 'and in cabinet 03');
  assert.equal(pick(STATIC_LINES, 'caught', FULL, () => 0), 'PING GOT YOU. PING WILL BE UNBEARABLE NOW.');
  assert.equal(pick(STATIC_LINES, 'no-such-event', FULL), '');
  const used = new Set(), round = [];
  for (let i = 0; i < STATIC_LINES.override.length; i++) round.push(pick(STATIC_LINES, 'override', FULL, Math.random, used));
  assert.equal(new Set(round).size, STATIC_LINES.override.length, 'nothing repeats until it has all been said');
});

// ── what the page and the arcade ask of these files ──
test('every line the game asks for exists', () => {
  const game = src('signal/js/game.js');
  const asked = [...game.matchAll(/Static\.say\('([a-zA-Z_]+)'[,)]/g)].map((m) => m[1]);
  assert.ok(asked.length > 20);
  for (const event of asked) assert.ok(STATIC_LINES[event], `the static has a line for ${event}`);
  for (const m of R.MAZES) assert.ok(STATIC_LINES['maze_' + m.rule], `a line for ${m.name}`);
  assert.ok(STATIC_LINES.noSignal && STATIC_LINES.bootFirst && STATIC_LINES.ballEcho && STATIC_LINES.ballGaze && STATIC_LINES.ballTrain);
  for (const m of game.matchAll(/ballSay\('([a-zA-Z]+)'/g)) assert.ok(BALL_LINES[m[1]], `the ball has a line for ${m[1]}`);
});

test('the page loads the arcade\'s shared files at the arcade\'s versions, and its music exists', () => {
  const html = src('signal/index.html'), arcade = src('index.html');
  for (const shared of ['glitchpong-cosmetics.js', 'glitchcade-power.js']) {
    const here = html.match(new RegExp(shared.replace('.', '\\.') + '(\\?v=[\\w-]+)'))[1];
    assert.ok(arcade.includes(shared + here), `${shared}${here} on both pages`);
  }
  assert.ok(html.indexOf('src="../glitchpong-cosmetics.js') < html.indexOf('src="js/game.js'));
  assert.match(html, /id="game"/, 'the arcade checks for this before it shows the frame');
  assert.ok(html.includes('data-k="dash"'), 'a touch button for the dash');
  assert.ok(html.includes('id="scrWon"'), 'a screen for beating the game');
  // every maze has music, and every file is one the other cabinets already ship
  const audio = src('signal/js/audio.js');
  for (const m of R.MAZES) assert.match(audio, new RegExp(`\\n  ${m.rule}: \\[`), `music for ${m.name}`);
  const files = [...audio.matchAll(/M \+ '([^']+\.mp3)'/g)].map((m) => 'sounds/music/' + m[1]).concat([...audio.matchAll(/'\.\.\/([^']+\.mp3)'/g)].map((m) => m[1]));
  assert.ok(files.length >= 14);
  for (const f of files) assert.ok(existsSync(new URL('../' + f, import.meta.url)), `${f} exists`);
});

test('both cabinets draw with the same neon.js', () => {
  // the look is shared: one file, copied, and the copies must not drift apart
  assert.equal(src('signal/js/neon.js'), src('nexus/js/neon.js'));
  for (const page of ['signal/js/game.js', 'nexus/js/game.js']) {
    const game = src(page);
    assert.match(game, /from '\.\/neon\.js'/, `${page} uses it`);
    assert.match(game, /bloom\.apply\(/, `${page} blooms`);
    assert.match(game, /fxFull\(\) && !Power\.saving && !bloomOff/, `${page}: reduced FX, the battery saver and a slow machine all turn the bloom off`);
  }
});

test('the arcade knows cabinet 04', () => {
  const arcade = src('glitchcade.js'), floor = src('glitchcade-floor.js'), site = src('glitchpong-site.js'), admin = src('glitchpong-admin.js');
  assert.match(arcade, /SIGNAL_URL = 'signal\/index\.html\?cabinet'/);
  assert.match(arcade, /id: 'signal', title: 'SIGNAL LOST', slot: 4/);
  assert.match(arcade, /'glitchcade:signal'/);
  assert.match(floor, /onSignalReport/);
  assert.ok(floor.includes(`'${R.SAVE_KEY}'`), 'the daily board reads this cabinet\'s coins');
  assert.ok(site.includes(R.SAVE_KEY + ':'), 'the save export carries the record');
  assert.ok(admin.includes(`"${R.SAVE_KEY}"`), 'Reset Progress clears it');
  const wallet = src('signal/js/wallet.js');
  assert.match(wallet, /type: 'glitchcade:exit'/);
  assert.match(wallet, /type: 'glitchcade:signal'/);
  assert.match(wallet, /KEY: 'glitchcade_wallet_v1'/);
  assert.ok(src('index.html').includes('id="gcMenuSG"'));
});
