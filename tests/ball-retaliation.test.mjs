import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const config = await readFile(new URL('../breakpoint/js/config.js', import.meta.url), 'utf8');
const entities = await readFile(new URL('../breakpoint/js/entities.js', import.meta.url), 'utf8');
const sandbox = { Image: class {}, FX: { reduced: false } };
vm.runInNewContext(config + '\n' + entities + '\nglobalThis.BallClass = Ball; globalThis.settings = CFG; globalThis.colors = COL; globalThis.Hydra = DataHydra; globalThis.Guardian = MemoryGuardian;', sandbox);
const Ball = sandbox.BallClass, CFG = sandbox.settings;

function world(target) {
  return {
    mods: {}, paddle: { x: 480, y: 600, w: 110, h: 13 }, hits: 0,
    onWallHit() { this.hits++; },
    steerProtectiveBall(ball, dt) { ball.protecting = target; ball.homeOn(target, dt); return true; },
  };
}

test('a ball moving away turns around and reaches its shooter without a paddle bounce', () => {
  const target = { x: 400, y: 120, r: 12 };
  const ball = new Ball(400, 460, Math.PI / 2, 400), g = world(target);
  let hit = false;
  for (let i = 0; i < 240; i++) {
    ball.update(1 / 120, g);
    if (Math.hypot(ball.x - target.x, ball.y - target.y) < ball.r + target.r) { hit = true; break; }
  }
  assert.ok(hit, 'retaliation must actively reverse a falling ball');
  assert.equal(ball.speed, 400, 'guidance must preserve the base speed');
});

test('guidance follows a moving shooter at different update rates', () => {
  for (const hz of [60, 120, 240]) {
    const target = { x: 650, y: 180, r: 12 };
    const ball = new Ball(160, 460, Math.PI, 400), g = world(target);
    let hit = false;
    for (let i = 0; i < hz * 3; i++) {
      target.x = 650 + 70 * Math.sin(i / hz * 2);
      target.y = 180 + 25 * Math.cos(i / hz * 3);
      ball.update(1 / hz, g);
      if (Math.hypot(ball.x - target.x, ball.y - target.y) < ball.r + target.r) { hit = true; break; }
    }
    assert.ok(hit, `failed to track at ${hz} Hz`);
  }
});

test('missile boost is capped and ends without changing the normal ball speed', () => {
  const target = { x: 700, y: 160 };
  const ball = new Ball(400, 400, -Math.PI / 2, 400), g = world(target);
  ball.update(1 / 120, g);
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - 472) < 0.001);
  g.steerProtectiveBall = b => { b.protecting = null; return false; };
  ball.update(1 / 120, g);
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - 400) < 0.001);
  const fast = new Ball(400, 400, -Math.PI / 2, CFG.BALL_MAX);
  fast.homeOn(target, 1 / 120);
  assert.ok(Math.hypot(fast.vx, fast.vy) <= CFG.BALL_MAX + 0.001);
});

test('protective visuals take priority over powerup colours and return to normal afterward', () => {
  const target = { x: 600, y: 100 };
  const ball = new Ball(300, 450, -Math.PI / 2, 300), g = world(target);
  ball.fire = 10; ball.rampaging = true;
  for (let i = 0; i < 40; i++) ball.update(1 / 120, g);
  assert.equal(ball.color, '#ff8a3d');
  assert.equal(ball.trail.length, 34);
  g.steerProtectiveBall = b => { b.protecting = null; return false; };
  ball.fire = 0; ball.rampaging = false;
  ball.update(1 / 120, g);
  assert.equal(ball.color, sandbox.colors.white);
  assert.equal(ball.trail.length, 14, 'long missile trails must not remain after pursuit');
});

test('an unreachable target still produces pursuit while walls remain solid', () => {
  const target = { x: -100, y: 100 };
  const ball = new Ball(100, 400, -Math.PI / 2, 400), g = world(target);
  for (let i = 0; i < 360; i++) {
    ball.update(1 / 120, g);
    assert.ok(ball.x >= ball.r && ball.x <= CFG.W - ball.r);
    assert.ok(ball.y >= ball.r + 2);
    if (ball.dead) break; // pursuit does not make the ball immune to being lost
  }
  assert.ok(g.hits > 0);
  assert.equal(ball.protecting, target);
});

test('guidance handles close targets and angle wrapping without invalid velocities', () => {
  const ball = new Ball(200, 200, Math.PI - 0.01, 400);
  ball.homeOn({ x: 200, y: 200 }, 1 / 120);
  assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy));
  ball.homeOn({ x: 0, y: 198 }, 1 / 120);
  assert.ok(ball.vx < 0);
  assert.ok(Math.abs(ball.vy) < 15, 'take the short turn across the angle boundary');
});

test('stuck balls wait for launch and ordinary balls retain their usual movement', () => {
  const ball = new Ball(400, 400, -Math.PI / 2, 400), g = world({ x: 700, y: 100 });
  ball.stuck = true;
  ball.update(1 / 60, g);
  assert.equal(ball.stuck, true);
  assert.equal(ball.x, g.paddle.x);
  const normal = new Ball(200, 200, -Math.PI / 2, 400);
  delete g.steerProtectiveBall;
  normal.update(0.01, g);
  assert.ok(Math.abs(normal.x - 200) < 0.001);
  assert.ok(Math.abs(normal.y - 196) < 0.001);
});

test('a ball hunting the hydra steers at a living head, not at the gap between them', () => {
  const hydra = new sandbox.Hydra(1);
  assert.equal(hydra.heads.length, 3);
  hydra.heads[1].hp = 0;                                   // the middle head is gone
  const ball = new Ball(480, 460, -Math.PI / 2, 400);
  const aim = hydra.aimPoint(ball);
  assert.ok(aim === hydra.heads[0] || aim === hydra.heads[2], 'it picks a head that is still alive');
  assert.ok(Math.abs(aim.x - 480) > 100, 'which is not where the dead one was');
  // and it gets there, where homing on the hydra's own position (the middle) never arrives
  const g = { mods: {}, paddle: { x: 480, y: 600, w: 110, h: 13 }, onWallHit() {},
    steerProtectiveBall(b, dt) { b.protecting = hydra; b.homeOn(hydra.aimPoint(b), dt); return true; } };
  let hit = false;
  for (let i = 0; i < 600 && !hit; i++) {
    ball.update(1 / 120, g);
    hit = hydra.aliveHeads.some((h) => Math.hypot(ball.x - h.x, ball.y - h.y) < ball.r + h.r);
  }
  assert.ok(hit, 'the chase ends in a hit');
  // nearest first: from the far left it goes for the left head
  assert.equal(hydra.aimPoint({ x: 20, y: 160 }), hydra.heads[0]);
  assert.equal(hydra.aimPoint({ x: 940, y: 160 }), hydra.heads[2]);
  // a boss with a body is its own target
  const guardian = new sandbox.Guardian(1);
  assert.equal(guardian.aimPoint(ball), guardian);
});
