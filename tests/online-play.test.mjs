import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// How an online match plays: the referee's simulation, and the parts of the
// client that have to agree with it. (The transports are covered by
// online-host.test.mjs and p2p.test.mjs.)
const sim = createRequire(import.meta.url)('../server/authoritative-pong.js');
const site = readFileSync(new URL('../glitchpong-site.js', import.meta.url), 'utf8');

function playing() {
  const state = sim.initialState();
  state.status = 'playing';
  sim.resetBall(state, 1);
  return state;
}

// Runs the match with nobody defending until a point is scored.
function untilPoint(state, clock) {
  const before = state.scores.left + state.scores.right;
  for (let i = 0; i < 2000 && state.scores.left + state.scores.right === before; i++) sim.step(state, 1 / 60, clock.now += 1000 / 60);
  assert.equal(state.scores.left + state.scores.right, before + 1, 'a point was scored');
}

test('paddles answer straight away, and keep answering in the pause after a point', () => {
  const state = playing(), clock = { now: 1_000_000 };
  state.paddles.left.direction = 'down';
  sim.step(state, 1 / 60, clock.now);
  assert.ok(state.paddles.left.y > (sim.HEIGHT - sim.PADDLE_H) / 2, 'moves on the first step');

  state.paddles.left.direction = 'stop';
  untilPoint(state, clock);
  assert.ok(state.resetAt > clock.now, 'the pause before the next serve has started');
  const y = state.paddles.right.y;
  state.paddles.right.direction = 'up';
  for (let i = 0; i < 20; i++) sim.step(state, 1 / 60, clock.now += 1000 / 60);
  assert.ok(state.resetAt > clock.now, 'still in the pause');
  assert.ok(state.paddles.right.y < y - 100, `the paddle moved during it (${Math.round(y - state.paddles.right.y)} units)`);
});

test('between points the ball waits in the middle of the court, in view, then is served', () => {
  const state = playing(), clock = { now: 5_000_000 };
  untilPoint(state, clock);
  for (let i = 0; i < 40; i++) {
    sim.step(state, 1 / 60, clock.now += 1000 / 60);
    assert.equal(state.ball.x, sim.WIDTH / 2);
    assert.equal(state.ball.y, sim.HEIGHT / 2);
    assert.equal(state.ball.vx, 0);
  }
  assert.equal(state.lastHit, 'neutral', 'the waiting ball is nobody\'s');
  for (let i = 0; i < 30; i++) sim.step(state, 1 / 60, clock.now += 1000 / 60);
  assert.notEqual(state.ball.vx, 0, 'served after about 0.9 seconds');
});

test('a paddle can reach both edges of the court', () => {
  const state = playing(), clock = { now: 9_000_000 };
  state.paddles.left.direction = 'up';
  state.paddles.right.direction = 'down';
  for (let i = 0; i < 120; i++) sim.step(state, 1 / 60, clock.now += 1000 / 60);
  assert.equal(state.paddles.left.y, 0);
  assert.equal(state.paddles.right.y, sim.HEIGHT - sim.PADDLE_H);
});

test('the client draws the court the referee plays on', () => {
  const court = site.match(/const ONLINE_COURT = \{([^}]*)\}/);
  assert.ok(court, 'found ONLINE_COURT');
  const value = (key) => Number(court[1].match(new RegExp(`${key}:\\s*(\\d+)`))[1]);
  assert.equal(value('width'), sim.WIDTH);
  assert.equal(value('height'), sim.HEIGHT);
  assert.equal(value('paddleX'), sim.PADDLE_X);
  assert.equal(value('paddleW'), sim.PADDLE_W);
  assert.equal(value('paddleH'), sim.PADDLE_H);
});

test('online, every way of moving a paddle reaches the referee', () => {
  // touch: the shared direction helper sends it, and a touch anywhere is yours
  const helper = site.match(/function applyP1Dir\(dir\) \{[\s\S]*?\n    \}/);
  assert.ok(helper && /onlineSendInput\(/.test(helper[0]), 'touch movement is sent');
  assert.ok(/\(onlineState\.active \|\| t\.clientX < canvas\.width \* P1_ZONE_X\) && !p1Touch/.test(site), 'the whole screen controls your paddle online');
  // keyboard: both pairs of movement keys
  const keys = site.match(/if \(onlineState\.active\) \{\s*if \(code === keyBindings\.p1Up \|\| code === keyBindings\.p2Up\)[\s\S]*?return;\s*\}/);
  assert.ok(keys, 'W/S and the arrow keys both move your paddle');
  assert.ok(/p1Down \|\| code === keyBindings\.p2Down/.test(keys[0]));
  // and a text box left focused can't swallow them
  assert.ok(/document\.activeElement\.blur\(\)/.test(site), 'focus is taken out of text boxes when a match starts');
});

test('the peer-to-peer host loads the current referee, not a cached old one', () => {
  const p2p = readFileSync(new URL('../glitchpong-p2p.js', import.meta.url), 'utf8');
  assert.ok(/loadScript\("server\/authoritative-pong\.js\?v=sim-\d+"\)/.test(p2p));
});
