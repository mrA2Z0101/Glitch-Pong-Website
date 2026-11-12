import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// The rules for the sixteen maps that change how a rally plays: PENALTY BOX,
// STACK OVERFLOW, MEMORY LEAK and DEFRAG (the court), FREEFALL, COOLANT LEAK,
// ROOFTOP and BEAT DROP (the ball and paddles), BREAKPOINT CROSSOVER, TILT,
// QUANTUM SHIFT and LAST TRAIN (things on the court), and ECHO, KERNEL PANIC,
// ARCHIVE BUILD 0.1 and THE EYE'S LAIR (sight and story). The file is a plain
// script that also exports under Node; the drawing lives in glitchpong-site.js
// and is not covered here.
const A = createRequire(import.meta.url)('../glitchpong-arenas.js');
const T = A.TUNING;

// A desktop court: 1280x720, paddle faces at 42 and 1238, end walls behind them.
const court = (over = {}) => Object.assign({
  width: 1280, height: 720, leftFace: 42, rightFace: 1238, leftWall: 16, rightWall: 1264,
  ballR: 10, paddleH: 140, xScale: 1
}, over);
const phone = () => court({ width: 844, height: 390, leftFace: 36, rightFace: 808, leftWall: 10, rightWall: 834, ballR: 9, paddleH: 98, xScale: 0.65 });

// A repeatable random source, so a failure can be reproduced.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const begin = (id, c = court(), rand = seeded(7)) => { const s = A.createState(); A.start(s, id, c, rand); return s; };
const frames = (s, c, n, heat, critical = false, live = true, rand = seeded(11)) => { for (let i = 0; i < n; i++) A.update(s, c, heat, critical, live, rand); };

test('only the sixteen rule maps switch rules on', () => {
  for (const id of A.IDS) assert.equal(begin(id).id, id);
  for (const id of ['classic', 'matrix', 'construct', 'blackhole', null, undefined, 'nope']) {
    const s = begin(id), c = court();
    assert.equal(s.id, null);
    assert.equal(A.topAt(s, c, 600), 0);
    assert.equal(A.bottomAt(s, c, 600), c.height);
    assert.deepEqual(A.paddleBand(s, c), { top: 0, bottom: c.height });
    assert.deepEqual(A.mouth(s, c, 'left'), { top: 0, bottom: c.height });
    assert.equal(A.posts(s, c, { x: 20, y: 5, vx: -8, vy: 0, px: 40 }), null);
    assert.equal(A.fall(s, c, 3), 3);
    assert.equal(A.drift(s, 8), 0);
    assert.equal(A.slide(s, 'left', 100, 108, 0, 0, 580), 108);
    assert.equal(A.returnBoost(s, 'left'), 0);
    assert.equal(A.aimY(s, c, 300, 4, 10), 340);
    assert.equal(A.objects(s, c, { x: 640, y: 360, vx: 8, vy: 0, px: 600, py: 360 }), null);
    assert.deepEqual(A.obstacles(s, c), []);
    assert.equal(A.blocked(s, c, 640, 360, 10), false);
    A.echoReturn(s, c, 'left', 0.5);
    assert.equal(s.echo.ghosts.length, 0);
    A.panicHit(s);
    assert.equal(s.panic.flash, 0);
    assert.equal(A.archiveQuiet(s), false);
    assert.equal(A.eyeHeat(s), 1, 'the Eye waits for full Heat everywhere but its lair');
  }
});

test('starting a match clears whatever the last one left behind', () => {
  const c = court(), s = begin('leak');
  for (let i = 0; i < 9; i++) A.onReturn(s);
  frames(s, c, 60, 0.5);
  assert.ok(s.leak.inset > 0);
  A.start(s, 'penalty', c);
  assert.equal(s.leak.inset, 0);
  assert.equal(s.leak.returns, 0);
});

// ── PENALTY BOX ─────────────────────────────────────────────────────────────

test('PENALTY BOX: the goal mouth is the middle of the end wall', () => {
  for (const c of [court(), phone()]) {
    const s = begin('penalty', c);
    for (const side of ['left', 'right']) {
      const m = A.mouth(s, c, side);
      assert.ok(Math.abs((m.top + m.bottom) / 2 - c.height / 2) < 1e-9, 'centred until Critical Heat');
      assert.ok(m.top > 0 && m.bottom < c.height, 'there is post above and below');
      assert.ok(m.bottom - m.top >= c.paddleH * T.mouthMinPaddles - 1e-9, 'wider than a paddle can cover');
    }
  }
});

test('PENALTY BOX: a shot at the post comes back, a shot at the mouth goes in', () => {
  const c = court(), s = begin('penalty', c), m = A.mouth(s, c, 'left');

  const atPost = { x: c.leftWall + c.ballR - 3, y: m.top - 30, vx: -9, vy: 2, px: c.leftWall + c.ballR + 6 };
  assert.equal(A.posts(s, c, atPost), 'left');
  assert.ok(atPost.vx > 0, 'turned round');
  assert.equal(atPost.x, c.leftWall + c.ballR, 'put back on the face of the wall');
  assert.equal(atPost.vy, 2, 'the bounce does not touch vertical speed');
  assert.equal(s.penalty.flash.left, 1);

  const atMouth = { x: c.leftWall + c.ballR - 3, y: c.height / 2, vx: -9, vy: 2, px: c.leftWall + c.ballR + 6 };
  assert.equal(A.posts(s, c, atMouth), null);
  assert.equal(atMouth.vx, -9, 'still on its way in');

  const right = { x: c.rightWall - c.ballR + 4, y: m.bottom + 25, vx: 11, vy: -1, px: c.rightWall - c.ballR - 7 };
  assert.equal(A.posts(s, c, right), 'right');
  assert.ok(right.vx < 0);
  assert.equal(right.x, c.rightWall - c.ballR);
});

test('PENALTY BOX: a ball leaving the wall, or short of it, is left alone', () => {
  const c = court(), s = begin('penalty', c);
  const away = { x: c.leftWall + c.ballR, y: 20, vx: 9, vy: 0, px: c.leftWall + c.ballR - 9 };
  assert.equal(A.posts(s, c, away), null);
  assert.equal(away.vx, 9);
  const short = { x: c.leftWall + c.ballR + 30, y: 20, vx: -9, vy: 0, px: c.leftWall + c.ballR + 39 };
  assert.equal(A.posts(s, c, short), null);
  assert.equal(short.vx, -9);
});

test('PENALTY BOX: a ball that went in through the mouth stays in the goal', () => {
  const c = court(), s = begin('penalty', c), m = A.mouth(s, c, 'left');
  // Already past the wall face, drifting up out of the mouth: it meets the
  // inside of the post and keeps going towards the goal line.
  const ball = { x: c.leftWall - 8, y: m.top + 4, vx: -6, vy: -5, px: c.leftWall - 2 };
  assert.equal(A.posts(s, c, ball), null);
  assert.equal(ball.vx, -6, 'not thrown back out of the net');
  assert.equal(ball.y, m.top + c.ballR);
  assert.ok(ball.vy > 0);
});

test('PENALTY BOX: the mouths drift only at Critical Heat, and settle afterwards', () => {
  const c = court(), s = begin('penalty', c);
  frames(s, c, 300, 0.79, false);
  assert.equal(s.penalty.amount, 0, 'below Critical Heat nothing moves');

  let lo = Infinity, hi = -Infinity, apart = 0;
  for (let i = 0; i < 600; i++) {
    A.update(s, c, 0.9, true, true);
    const l = A.mouth(s, c, 'left'), r = A.mouth(s, c, 'right');
    lo = Math.min(lo, l.top); hi = Math.max(hi, l.bottom);
    apart = Math.max(apart, Math.abs(l.top - r.top));
    for (const m of [l, r]) assert.ok(m.top >= 0 && m.bottom <= c.height, 'the mouth stays on the wall');
  }
  assert.ok(hi - lo > (A.mouth(begin('penalty', c), c, 'left').bottom - A.mouth(begin('penalty', c), c, 'left').top) + c.height * 0.3, 'it travels a real distance');
  assert.ok(apart > c.height * 0.1, 'the two mouths are out of step');

  frames(s, c, 240, 0, false, false);
  assert.equal(s.penalty.amount, 0);
  const m = A.mouth(s, c, 'left');
  assert.ok(Math.abs((m.top + m.bottom) / 2 - c.height / 2) < 1e-9, 'back in the middle for the next serve');
});

// ── STACK OVERFLOW ──────────────────────────────────────────────────────────

test('STACK OVERFLOW: the ball leaves one edge and comes back through the other', () => {
  const c = court(), s = begin('overflow', c);
  const up = { x: 600, y: -4, vx: 7, vy: -6 };
  const a = A.walls(s, c, up);
  assert.equal(a.type, 'wrap');
  assert.equal(a.dir, -1);
  assert.equal(up.y, c.height - 4);
  assert.equal(up.vy, -6, 'it does not bounce');
  assert.equal(up.x, 600, 'no shift at low Heat');

  const down = { x: 600, y: c.height + 3, vx: -7, vy: 5 };
  assert.equal(A.walls(s, c, down).dir, 1);
  assert.equal(down.y, 3);
  assert.equal(down.vy, 5);

  assert.equal(A.walls(s, c, { x: 600, y: 300, vx: 7, vy: 5 }), null);
  assert.equal(A.walls(s, c, { x: 600, y: 0, vx: 7, vy: -5 }), null, 'y = 0 is still on the court');
});

test('STACK OVERFLOW: the seam only shifts at high Heat, and by a bounded amount', () => {
  const c = court(), s = begin('overflow', c), span = c.rightFace - c.leftFace;
  frames(s, c, 400, T.seamHeat, false);
  assert.equal(s.overflow.shift, 0);

  let biggest = 0;
  for (let i = 0; i < 900; i++) {
    A.update(s, c, 1, true, true);
    biggest = Math.max(biggest, Math.abs(s.overflow.shift));
    assert.ok(Math.abs(s.overflow.shift) <= T.seamMax * span + 1e-9);
  }
  assert.ok(biggest > T.seamMax * span * 0.8, 'at full Heat the seam really moves');

  frames(s, c, 300, 0, false, false);
  assert.equal(s.overflow.shift, 0, 'back in line for the next serve');
});

test('STACK OVERFLOW: a shifted ball re-enters offset, and the two edges undo each other', () => {
  const c = court(), s = begin('overflow', c);
  s.overflow.shift = 90;
  const ball = { x: 600, y: c.height + 2, vx: 7, vy: 5 };
  const out = A.walls(s, c, ball);
  assert.equal(out.fromX, 600);
  assert.equal(ball.x, 690);
  ball.y = -2; ball.vy = -5;
  A.walls(s, c, ball);
  assert.equal(ball.x, 600, 'out through the top brings it back where it started');
});

test('STACK OVERFLOW: a shift never drops the ball on top of a paddle or pulls one back from the goal', () => {
  const c = court(), s = begin('overflow', c), pad = c.ballR + T.seamPad * (c.rightFace - c.leftFace);
  s.overflow.shift = -200;
  const near = { x: c.leftFace + 120, y: c.height + 1, vx: -9, vy: 4 };
  A.walls(s, c, near);
  assert.equal(near.x, c.leftFace + pad, 'held off the paddle face');

  // already closer than the pad: a shift towards the paddle must not move it at all
  const close = { x: c.leftFace + 20, y: c.height + 1, vx: -9, vy: 4 };
  A.walls(s, c, close);
  assert.equal(close.x, c.leftFace + 20);

  // past the paddle and on its way out: wraps, never shifts
  s.overflow.shift = 200;
  const gone = { x: c.leftFace - 15, y: -1, vx: -9, vy: -4 };
  A.walls(s, c, gone);
  assert.equal(gone.x, c.leftFace - 15);
  assert.equal(gone.y, c.height - 1);
});

test('STACK OVERFLOW: the AI reads a shot that runs off the top as arriving at the bottom', () => {
  const c = court(), s = begin('overflow', c);
  assert.equal(A.predictY(s, c, -40), c.height - 40);
  assert.equal(A.predictY(s, c, c.height + 25), 25);
  assert.equal(A.predictY(s, c, 300), 300);
  assert.equal(A.predictY(begin('leak', c), c, -40), -40, 'other maps bounce, so no wrap');
});

// ── MEMORY LEAK ─────────────────────────────────────────────────────────────

test('MEMORY LEAK: each return narrows the court, down to a corridor', () => {
  for (const c of [court(), phone()]) {
    const s = begin('leak', c);
    let last = 0;
    for (let hit = 1; hit <= T.leakReturns + 6; hit++) {
      A.onReturn(s);
      frames(s, c, 90, 0.4);
      assert.ok(s.leak.inset >= last - 1e-9, 'never widens mid-rally');
      if (hit <= T.leakReturns) assert.ok(s.leak.inset > last, `return ${hit} costs height`);
      last = s.leak.inset;
    }
    const band = A.paddleBand(s, c), corridor = band.bottom - band.top;
    assert.ok(Math.abs(s.leak.inset - A.leakMaxInset(c)) < 1e-6, 'stops at the narrowest corridor');
    assert.ok(corridor >= c.paddleH * T.leakMinPaddles - 1e-6, 'a paddle can never block the whole corridor');
    assert.ok(corridor < c.height * 0.7, 'and it is a real squeeze');
    assert.equal(A.topAt(s, c, 500), band.top);
    assert.equal(A.bottomAt(s, c, 500), band.bottom);
  }
});

test('MEMORY LEAK: scoring frees the court before the next serve', () => {
  const c = court(), s = begin('leak', c);
  for (let i = 0; i < 12; i++) A.onReturn(s);
  frames(s, c, 120, 0.9);
  assert.ok(s.leak.inset > 100);
  A.roundReset(s, c);
  assert.equal(s.leak.snap, 1);
  frames(s, c, 24, 0, false, false);   // the pause between points
  assert.ok(s.leak.inset < 0.5, `open again within the score shake (inset ${s.leak.inset})`);
});

test('MEMORY LEAK: the Eye gets the whole court back', () => {
  const c = court(), s = begin('leak', c);
  for (let i = 0; i < 12; i++) A.onReturn(s);
  frames(s, c, 120, 1);
  A.openCourt(s);
  frames(s, c, 60, 1, true, false);
  assert.equal(s.leak.inset, 0);
});

test('MEMORY LEAK: the ball bounces off the moving walls and is never left inside one', () => {
  const c = court(), s = begin('leak', c);
  for (let i = 0; i < 8; i++) A.onReturn(s);
  frames(s, c, 200, 0.5);
  const top = A.topAt(s, c, 600), bottom = A.bottomAt(s, c, 600);

  const up = { x: 600, y: top + 3, vx: 8, vy: -6 };
  assert.deepEqual(A.walls(s, c, up), { type: 'bounce', wall: 'top' });
  assert.equal(up.y, top + c.ballR);
  assert.equal(up.vy, 6);

  const down = { x: 600, y: bottom - 2, vx: 8, vy: 4 };
  assert.deepEqual(A.walls(s, c, down), { type: 'bounce', wall: 'bottom' });
  assert.equal(down.y, bottom - c.ballR);
  assert.equal(down.vy, -4);

  // a wall that closes on a ball already heading away just carries it along
  const caught = { x: 600, y: top - 20, vx: 8, vy: 3 };
  assert.equal(A.walls(s, c, caught), null);
  assert.equal(caught.y, top + c.ballR);
  assert.equal(caught.vy, 3);
});

// ── DEFRAG ──────────────────────────────────────────────────────────────────

test('DEFRAG: every wall shape is jagged, shallow enough, and never too steep', () => {
  for (const c of [court(), phone()]) {
    const rand = seeded(42), seg = (c.rightFace - c.leftFace) / T.segments;
    for (let trial = 0; trial < 300; trial++) {
      const p = A.makeProfile(c, rand);
      assert.equal(p.length, T.segments + 1);
      assert.equal(p[0], 0); assert.equal(p[T.segments], 0);     // flush at the paddles
      let turns = 0;
      for (let i = 0; i < p.length; i++) {
        assert.ok(p[i] >= 0 && p[i] <= T.maxDepth * c.height + 1e-9);
        if (i) assert.ok(Math.abs(p[i] - p[i - 1]) / seg <= T.maxSlope + 1e-9, 'a face is never steeper than maxSlope');
        if (i > 1 && (p[i] - p[i - 1]) * (p[i - 1] - p[i - 2]) < 0) turns++;
      }
      assert.ok(turns >= 2, 'more than one bump');
      assert.ok(Math.max(...p) > c.height * 0.05, 'the blocks reach into the court');
    }
  }
});

test('DEFRAG: depth follows the blocks and is zero behind the paddles', () => {
  const c = court(), p = [0, 40, 10, 60, 20, 50, 30, 70, 15, 45, 0], seg = (c.rightFace - c.leftFace) / 10;
  assert.ok(Math.abs(A.profileAt(p, c, c.leftFace + seg).depth - 40) < 1e-9);
  assert.ok(Math.abs(A.profileAt(p, c, c.leftFace + seg * 1.5).depth - 25) < 1e-9);
  assert.ok(Math.abs(A.profileAt(p, c, c.leftFace + seg * 1.5).slope - (-30 / seg)) < 1e-12);
  assert.deepEqual(A.profileAt(p, c, c.leftFace - 5), { depth: 0, slope: 0 });
  assert.deepEqual(A.profileAt(p, c, c.rightFace + 5), { depth: 0, slope: 0 });
});

test('DEFRAG: a slanted block changes the angle of the bounce', () => {
  const c = court(), s = begin('defrag', c), seg = (c.rightFace - c.leftFace) / T.segments;
  const flat = new Array(T.segments + 1).fill(40);
  const rising = flat.map((d, i) => 40 + i * 0.25 * seg);        // the top wall gets deeper to the right
  const falling = flat.map((d, i) => 40 + (T.segments - i) * 0.25 * seg);
  const bounceOff = (profile) => {
    s.defrag.top = profile;
    const ball = { x: c.leftFace + seg * 4.5, y: 0, vx: 8, vy: -4 };
    ball.y = A.profileAt(profile, c, ball.x).depth + c.ballR - 2;
    assert.deepEqual(A.walls(s, c, ball), { type: 'bounce', wall: 'top' });
    assert.equal(ball.vx, 8, 'horizontal speed is the pace of the rally: untouched');
    assert.ok(Math.abs(ball.y - (A.profileAt(profile, c, ball.x).depth + c.ballR)) < 1e-9, 'put back on the surface');
    // leaving the surface: moving down faster than the face under it does
    assert.ok(ball.vy - A.profileAt(profile, c, ball.x).slope * ball.vx * c.xScale > 0, 'it always leaves the wall');
    return ball.vy;
  };
  const onFlat = bounceOff(flat), intoSlope = bounceOff(rising), alongSlope = bounceOff(falling);
  assert.equal(onFlat, 4, 'a flat block is a plain mirror bounce');
  assert.ok(intoSlope > onFlat + 1, `a block facing the ball throws it down harder (${intoSlope})`);
  assert.ok(alongSlope < onFlat - 1, `a block sloping away flattens the bounce (${alongSlope})`);
});

test('DEFRAG: no bounce ever leaves the ball in a wall, heading into one, or too fast', () => {
  for (const c of [court(), phone()]) {
    const rand = seeded(99), s = begin('defrag', c, rand);
    for (let trial = 0; trial < 4000; trial++) {
      if (trial % 40 === 0) { s.defrag.top = A.makeProfile(c, rand); s.defrag.bottom = A.makeProfile(c, rand); }
      const top = rand() < 0.5;
      const ball = { x: c.leftFace + rand() * (c.rightFace - c.leftFace), y: 0, vx: (rand() < 0.5 ? -1 : 1) * (4 + rand() * 18), vy: (rand() * 2 - 1) * T.vyMax };
      const depth = A.profileAt(top ? s.defrag.top : s.defrag.bottom, c, ball.x);
      ball.y = top ? depth.depth + c.ballR - rand() * 8 : c.height - depth.depth - c.ballR + rand() * 8;
      const before = ball.vx;
      A.walls(s, c, ball);
      assert.equal(ball.vx, before);
      assert.ok(Math.abs(ball.vy) <= T.vyMax + 1e-9);
      assert.ok(ball.y - c.ballR >= A.topAt(s, c, ball.x) - 1e-9, 'clear of the top wall');
      assert.ok(ball.y + c.ballR <= A.bottomAt(s, c, ball.x) + 1e-9, 'clear of the bottom wall');
      // moving away from the surface it just touched
      const vxp = ball.vx * c.xScale;
      if (top) assert.ok(ball.vy - depth.slope * vxp > 0, 'leaving the top wall');
      else assert.ok(-depth.slope * vxp - ball.vy > 0, 'leaving the bottom wall');
    }
  }
});

test('DEFRAG: the walls rearrange between points and settle before the serve', () => {
  const c = court(), s = begin('defrag', c);
  const before = s.defrag.top.slice();
  assert.deepEqual(s.defrag.top, s.defrag.topTarget, 'a match starts with the walls already in place');
  A.roundReset(s, c, seeded(3));
  assert.notDeepEqual(s.defrag.topTarget, before);
  frames(s, c, 24, 0, false, false);   // the pause between points
  for (const wall of ['top', 'bottom']) {
    s.defrag[wall].forEach((d, i) => assert.ok(Math.abs(d - s.defrag[wall + 'Target'][i]) < 0.5, `${wall} wall settled`));
  }
});

test('DEFRAG: walls hold still at low Heat and shift, with a warning, at high Heat', () => {
  const c = court(), s = begin('defrag', c);
  const still = JSON.stringify([s.defrag.top, s.defrag.bottom]);
  frames(s, c, 1200, T.shiftHeat - 0.01);
  assert.equal(JSON.stringify([s.defrag.top, s.defrag.bottom]), still);

  let warned = 0, shifts = 0, lastTarget = JSON.stringify([s.defrag.topTarget, s.defrag.bottomTarget]);
  const walls = new Set();
  for (let i = 0; i < 1500; i++) {
    A.update(s, c, 0.9, true, true, seeded(i + 1));
    if (s.defrag.pending) { warned++; walls.add(s.defrag.pending.wall); }
    const target = JSON.stringify([s.defrag.topTarget, s.defrag.bottomTarget]);
    if (target !== lastTarget) {
      shifts++;
      assert.ok(warned >= T.shiftWarn - 1, 'the new shape was outlined before the wall moved');
      warned = 0;
      lastTarget = target;
    }
  }
  assert.ok(shifts >= 4, `walls shift repeatedly at high Heat (${shifts})`);
  assert.deepEqual([...walls].sort(), ['bottom', 'top'], 'both walls take a turn');
});

test('DEFRAG: nothing is placed where a wall is, or is about to be', () => {
  const c = court(), s = begin('defrag', c);
  frames(s, c, 400, 1, true, true);
  const band = A.band(s, c);
  for (let x = c.leftFace; x <= c.rightFace; x += 7) {
    assert.ok(A.topAt(s, c, x) <= band.top + 1e-9);
    assert.ok(A.bottomAt(s, c, x) >= band.bottom - 1e-9);
  }
  if (s.defrag.pending) {
    const deepest = Math.max(...s.defrag.pending.profile);
    if (s.defrag.pending.wall === 'top') assert.ok(band.top >= deepest - 1e-9);
    else assert.ok(band.bottom <= c.height - deepest + 1e-9);
  }
  assert.ok(band.bottom - band.top > c.height * 0.7, 'most of the court stays open');
});

// ── FREEFALL ────────────────────────────────────────────────────────────────

test('FREEFALL: the ball falls, faster each frame, up to a top speed', () => {
  for (const c of [court(), phone()]) {
    const s = begin('freefall', c);
    assert.ok(A.gravity(s, c) > 0, 'down the screen');
    assert.ok(Math.abs(A.gravity(s, c) - T.gravity * c.height) < 1e-12, 'scaled to the court, so arcs look the same on a phone');
    let vy = 0, last = 0;
    for (let i = 0; i < 400; i++) {
      vy = A.fall(s, c, vy);
      assert.ok(vy >= last);
      assert.ok(vy <= T.fallMax);
      last = vy;
    }
    assert.equal(vy, T.fallMax);
  }
});

test('FREEFALL: a ball on the floor always hops, however gently it landed', () => {
  for (const c of [court(), phone()]) {
    const s = begin('freefall', c), floor = c.height - c.ballR;
    const ball = { x: 600, y: floor - 1, vx: 6, vy: 0.2 };
    let highest = floor, bounces = 0;
    for (let f = 0; f < 1200; f++) {
      ball.vy = A.fall(s, c, ball.vy);
      ball.y += ball.vy;
      const hit = A.walls(s, c, ball);
      if (hit) { assert.equal(hit.wall, 'bottom'); bounces++; }
      if (bounces) highest = Math.min(highest, ball.y);
    }
    assert.ok(bounces >= 5, `it keeps bouncing (${bounces})`);
    assert.ok(floor - highest >= c.height * T.hop * 0.9, `each hop clears ${T.hop * 100}% of the height (rose ${Math.round(floor - highest)}px)`);
  }
});

test('FREEFALL: gravity flips at Critical Heat and comes back afterwards', () => {
  const c = court(), s = begin('freefall', c);
  frames(s, c, 200, 0.79, false);
  assert.equal(s.freefall.dir, 1, 'below Critical Heat gravity points down');

  frames(s, c, 1, 0.85, true);
  assert.ok(s.freefall.flip > 0.95, 'the flip is announced the frame it starts');
  assert.ok(s.freefall.dir < 1 && s.freefall.dir > 0.8, 'and turns over gradually, not in one frame');
  frames(s, c, T.flipFrames, 0.85, true);
  assert.equal(s.freefall.dir, -1);
  assert.ok(A.gravity(s, c) < 0, 'up the screen');

  // upside down, the ceiling is the floor: the ball hops off it
  const ball = { x: 600, y: c.ballR + 0.1, vx: 6, vy: -0.2 };
  ball.vy = A.fall(s, c, ball.vy);
  ball.y += ball.vy;
  assert.deepEqual(A.walls(s, c, ball), { type: 'bounce', wall: 'top' });
  assert.ok(ball.vy >= A.hopSpeed(s, c) - 1e-9);

  frames(s, c, T.flipFrames + 2, 0, false, false);   // a point is scored
  assert.equal(s.freefall.dir, 1, 'the next serve falls the normal way');
});

test('FREEFALL: the AI reads the arc the ball will actually take', () => {
  for (const c of [court(), phone()]) {
    const s = begin('freefall', c), rand = seeded(5);
    for (let trial = 0; trial < 200; trial++) {
      const ball = { x: 600, y: c.ballR + rand() * (c.height - 2 * c.ballR), vx: 8, vy: (rand() * 2 - 1) * 8 };
      const ahead = 1 + Math.floor(rand() * 22);
      const read = A.aimY(s, c, ball.y, ball.vy, ahead);
      for (let i = 0; i < ahead; i++) { ball.vy = A.fall(s, c, ball.vy); ball.y += ball.vy; A.walls(s, c, ball); }
      // The read ignores the minimum hop, so allow a little slack after a bounce.
      assert.ok(Math.abs(read - ball.y) < c.height * 0.12, `read ${Math.round(read)}, ball went to ${Math.round(ball.y)}`);
    }
    // and it is not the straight line a bouncing-wall map would give
    assert.ok(A.aimY(s, c, c.height / 2, 0, 20) > c.height / 2 + 10);
  }
});

// ── COOLANT LEAK ────────────────────────────────────────────────────────────

test('COOLANT LEAK: grip is lowest with no Heat and complete once the ice has melted', () => {
  const c = court(), s = begin('coolant', c);
  let last = 0;
  for (let heat = 0; heat <= 1.0001; heat += 0.05) {
    frames(s, c, 1, heat);
    assert.ok(s.coolant.grip >= last - 1e-12, 'more Heat never means less grip');
    last = s.coolant.grip;
    if (heat === 0) assert.equal(s.coolant.grip, T.gripCold);
    if (heat >= T.gripHeat) assert.equal(s.coolant.grip, 1);
  }
});

test('COOLANT LEAK: with full grip a paddle goes exactly where it is put', () => {
  const c = court(), s = begin('coolant', c);
  frames(s, c, 1, 1);
  let y = 200;
  for (const move of [8, 8, -8, 0, 3, -8, 0, 0]) {
    const next = A.slide(s, 'left', y, y + move, 0, 0, c.height - c.paddleH);
    assert.equal(next, y + move);
    y = next;
  }
});

test('COOLANT LEAK: on ice a paddle is slow to start and keeps going after you let go', () => {
  const c = court(), s = begin('coolant', c), hi = c.height - c.paddleH;
  frames(s, c, 1, 0);
  let y = 100;
  // hold "down" for 12 frames: a normal paddle would have moved 96px
  for (let i = 0; i < 12; i++) y = A.slide(s, 'left', y, y + 8, 0, 0, hi);
  assert.ok(y - 100 < 96 * 0.6, `slow off the mark (moved ${Math.round(y - 100)}px of 96)`);
  assert.ok(y - 100 > 96 * 0.2, 'but it does move');
  assert.ok(s.coolant.v.left > 0 && s.coolant.v.left < 8, 'still building speed');

  // let go: it carries on, slower each frame, and comes to rest
  const letGoAt = y;
  let last = s.coolant.v.left;
  for (let i = 0; i < 120; i++) {
    y = A.slide(s, 'left', y, y, 0, 0, hi);
    assert.ok(s.coolant.v.left <= last + 1e-12);
    last = s.coolant.v.left;
  }
  assert.ok(y - letGoAt > 25, `slid on after release (${Math.round(y - letGoAt)}px)`);
  assert.ok(Math.abs(s.coolant.v.left) < 0.01, 'and stopped in the end');
  assert.equal(s.coolant.v.right, 0, 'the other paddle is untouched');
});

test('COOLANT LEAK: a dash is a blink, not a slide', () => {
  const c = court(), s = begin('coolant', c);
  frames(s, c, 1, 0);
  const y = A.slide(s, 'right', 300, 376, 76, 0, c.height - c.paddleH);   // the AI dashed 76px this frame
  assert.equal(y, 376);
  assert.equal(s.coolant.v.right, 0, 'and it leaves no momentum behind');
});

test('COOLANT LEAK: a sliding paddle stays on the court and rebounds off the edge', () => {
  const c = court(), s = begin('coolant', c), hi = c.height - c.paddleH;
  frames(s, c, 1, 0);
  let y = hi - 30, hitEdge = false;
  for (let i = 0; i < 60; i++) {
    y = A.slide(s, 'left', y, y + 8, 0, 0, hi);
    assert.ok(y >= 0 && y <= hi);
    if (y === hi && !hitEdge) {
      hitEdge = true;
      assert.ok(s.coolant.v.left < 0, 'thrown back off the edge');
      assert.ok(Math.abs(s.coolant.v.left) < 8 * T.rebound + 1e-9, 'with only part of its speed');
    }
  }
  assert.ok(hitEdge);
});

// ── ROOFTOP ─────────────────────────────────────────────────────────────────

test('ROOFTOP: the wind gusts both ways, with lulls, and is stronger at high Heat', () => {
  const c = court();
  const gusts = (heat) => {
    const s = begin('rooftop', c), rand = seeded(21);
    let left = 0, right = 0, calm = 0, strongest = 0;
    for (let f = 0; f < 20000; f++) {
      A.update(s, c, heat, false, true, rand);
      const w = s.rooftop.wind;
      strongest = Math.max(strongest, Math.abs(w));
      assert.ok(Math.abs(w) <= T.windCalm + T.windHeat * heat + 1e-9);
      if (w > 0.3) right++; else if (w < -0.3) left++; else calm++;
    }
    return { left, right, calm, strongest };
  };
  const cool = gusts(0), hot = gusts(0.7);
  for (const g of [cool, hot]) {
    assert.ok(g.left > 2000 && g.right > 2000, `blows both ways (${g.left} left, ${g.right} right)`);
    assert.ok(g.calm > 1000, `and drops (${g.calm} calm frames)`);
  }
  assert.ok(hot.strongest > cool.strongest + 0.8, 'Heat makes the gusts stronger');
});

test('ROOFTOP: wind carries the ball but never stops it or turns it round', () => {
  const c = court(), s = begin('rooftop', c);
  s.rooftop.wind = 3;
  assert.equal(A.drift(s, 20), 3, 'a fast ball takes the whole gust');
  assert.equal(A.drift(s, -20), 3, 'whichever way it is travelling');
  assert.equal(A.drift(s, 4), 4 * T.windShare, 'a slow ball only part of it');
  assert.equal(A.drift(s, -4), 4 * T.windShare);
  s.rooftop.wind = -3;
  assert.equal(A.drift(s, 4), -4 * T.windShare);
  for (const vx of [4, 6, 12, 24, -4, -6, -12, -24]) {
    const moved = vx + A.drift(s, vx);
    assert.ok(Math.sign(moved) === Math.sign(vx) && Math.abs(moved) >= Math.abs(vx) * (1 - T.windShare) - 1e-9);
  }
});

test('ROOFTOP: every serve starts in a lull, and the air is still between points', () => {
  const c = court(), s = begin('rooftop', c), rand = seeded(8);
  frames(s, c, 2000, 0.6, false, true, rand);
  A.roundReset(s, c);
  assert.equal(s.rooftop.gust, 0);
  frames(s, c, 200, 0, false, false, rand);
  assert.ok(Math.abs(s.rooftop.wind) < 0.05, 'the wind dies while nobody is playing');
  frames(s, c, 60, 0, false, true, rand);
  assert.ok(Math.abs(s.rooftop.wind) < 0.05, 'and the first second of the rally is calm');
});

test('ROOFTOP: lightning only strikes at Critical Heat, and each strike turns the wind round', () => {
  const c = court(), s = begin('rooftop', c), rand = seeded(13);
  for (let f = 0; f < 3000; f++) {
    A.update(s, c, 0.79, false, true, rand);
    assert.equal(s.rooftop.struck, false);
    assert.equal(s.rooftop.flash, 0);
  }
  let strikes = 0, lastAt = -Infinity, gustBefore = s.rooftop.gust, first = null;
  for (let f = 0; f < 3000; f++) {
    A.update(s, c, 0.9, true, true, rand);
    if (s.rooftop.struck) {
      if (first === null) first = f;
      assert.ok(f - lastAt >= T.strikeEvery[0], 'never two flashes close together');
      assert.equal(Math.abs(s.rooftop.gust), 1, 'full strength');
      if (gustBefore !== 0) assert.equal(Math.sign(s.rooftop.gust), -Math.sign(gustBefore), 'the other way');
      assert.equal(s.rooftop.flash > 0.9, true);
      strikes++;
      lastAt = f;
    }
    gustBefore = s.rooftop.gust;
  }
  assert.ok(first !== null && first <= 20, `the first strike comes with Critical Heat (frame ${first})`);
  assert.ok(strikes >= 10 && strikes <= 21, `a strike every few seconds (${strikes} in 50s)`);
});

// ── BEAT DROP ───────────────────────────────────────────────────────────────

test('BEAT DROP: Heat raises the tempo', () => {
  const c = court(), s = begin('beat', c);
  frames(s, c, 3600, 0);
  assert.ok(Math.abs(s.beat.phase - T.bpm[0]) < 1e-6, `${T.bpm[0]} beats in a minute at no Heat`);
  const before = s.beat.phase;
  frames(s, c, 3600, 1);
  assert.ok(Math.abs(s.beat.phase - before - T.bpm[1]) < 1e-6, `${T.bpm[1]} at full Heat`);
  frames(s, c, 1, 0.5);
  assert.equal(s.beat.bpm, (T.bpm[0] + T.bpm[1]) / 2);
});

test('BEAT DROP: the music gets one step for every eighth note, and never stops between points', () => {
  const c = court(), s = begin('beat', c);
  let steps = 0, lastStep = s.beat.step;
  for (let f = 0; f < 3600; f++) {
    A.update(s, c, 0.3, false, f % 400 < 300);      // in and out of play
    if (s.beat.ticked) { steps++; assert.equal(s.beat.step, lastStep + 1, 'no step skipped or repeated'); lastStep = s.beat.step; }
  }
  assert.equal(steps, Math.floor(s.beat.phase * 2));
  assert.ok(steps > 200);
});

test('BEAT DROP: a return is on the beat only within a few frames of it', () => {
  const c = court(), s = begin('beat', c);
  let on = 0, total = 0;
  for (let f = 0; f < 7200; f++) {
    A.update(s, c, 0, false, true);
    const part = s.beat.phase - Math.floor(s.beat.phase);
    const framesAway = Math.min(part, 1 - part) * (3600 / s.beat.bpm);
    assert.ok(Math.abs(A.beatDistance(s) - framesAway) < 1e-9);
    assert.equal(A.onBeat(s), framesAway <= T.beatWindow);
    if (A.onBeat(s)) on++;
    total++;
  }
  const expected = (2 * T.beatWindow) / (3600 / T.bpm[0]);
  assert.ok(Math.abs(on / total - expected) < 0.05, `about ${Math.round(expected * 100)}% of frames are on the beat (${Math.round(100 * on / total)}%)`);
});

test('BEAT DROP: only an on-beat return gets the extra speed', () => {
  const c = court(), s = begin('beat', c);
  s.beat.phase = 12.02;                              // just after a beat
  assert.equal(A.returnBoost(s, 'right'), T.beatBoost);
  assert.equal(s.beat.hit, 1);
  assert.equal(s.beat.hitSide, 'right');
  s.beat.hit = 0;
  s.beat.phase = 12.5;                               // half way to the next
  assert.equal(A.returnBoost(s, 'left'), 0);
  assert.equal(s.beat.hit, 0);
  s.beat.phase = 12.98;                              // just before the next
  assert.equal(A.returnBoost(s, 'left'), T.beatBoost);
  assert.ok(T.beatBoost < 0.22, 'smaller than a Power Strike');
});

// ── BREAKPOINT CROSSOVER ────────────────────────────────────────────────────

// A ball fired straight along the court from `fromX` at height y.
const shot = (c, fromX, y, vx, vy = 0) => ({ x: fromX + vx * c.xScale, y: y + vy, vx, vy, px: fromX, py: y, lock: -1 });

test('BREAKPOINT CROSSOVER: an odd column of bricks fills the centre line, with a hole for the serve', () => {
  for (const c of [court(), phone()]) {
    const s = begin('bricks', c), list = s.bricks.list, mid = (list.length - 1) / 2;
    assert.equal(list.length % 2, 1);
    assert.ok(list.length >= 5);
    list.forEach((brick, i) => assert.equal(brick.on, i !== mid));
    // top to bottom with no gaps
    assert.equal(A.brickBox(s, c, 0).y, 0);
    assert.ok(Math.abs(A.brickBox(s, c, list.length - 1).y + A.brickBox(s, c, 0).h - c.height) < 1e-9);
    // the serve starts in the hole and gets out without touching anything
    const ball = { x: c.width / 2, y: c.height / 2, vx: 6, vy: 3.8, lock: -1 };
    for (let f = 0; f < 20; f++) {
      ball.px = ball.x; ball.py = ball.y;
      ball.x += ball.vx * c.xScale; ball.y += ball.vy;
      assert.equal(A.objects(s, c, ball), null, `frame ${f}`);
    }
    assert.ok(A.brickBox(s, c, mid).h > c.ballR * 3, 'the hole is comfortably taller than the ball');
  }
});

test('BREAKPOINT CROSSOVER: a brick breaks when hit, and the ball comes back', () => {
  const c = court(), s = begin('bricks', c), box = A.brickBox(s, c, 1);
  const ball = shot(c, box.x - 40, box.y + box.h / 2, 60);            // fast enough to jump the brick in one frame
  const hit = A.objects(s, c, ball);
  assert.equal(hit.type, 'brick');
  assert.equal(hit.index, 1);
  assert.equal(hit.reversed, true, 'it turned round, so the game makes it neutral');
  assert.ok(ball.vx < 0);
  assert.ok(ball.x < box.x - c.ballR, 'left on the side it came from, not the far side');
  assert.equal(s.bricks.list[1].on, false);
  assert.equal(s.bricks.list.filter((b) => b.on).length, s.bricks.list.length - 2, 'only that one broke');

  // the next ball through the same spot goes straight through
  const next = shot(c, box.x - 40, box.y + box.h / 2, 60);
  assert.equal(A.objects(s, c, next), null);
  assert.equal(next.vx, 60);

  // from the other side it comes back the other way
  const other = A.brickBox(s, c, 6), back = shot(c, other.x + other.w + 15, other.y + other.h / 2, -12);
  assert.equal(A.objects(s, c, back).reversed, true);
  assert.ok(back.vx > 0);
});

test('BREAKPOINT CROSSOVER: clipping the edge of a brick from inside a gap only turns the ball up or down', () => {
  const c = court(), s = begin('bricks', c), mid = (s.bricks.list.length - 1) / 2, below = A.brickBox(s, c, mid + 1);
  // travelling right through the serve hole, drifting down into the brick underneath
  const ball = { x: below.x + 6, y: below.y - c.ballR + 2, vx: 3, vy: 4, px: below.x + 3, py: below.y - c.ballR - 2, lock: -1 };
  const hit = A.objects(s, c, ball);
  assert.equal(hit.type, 'brick');
  assert.equal(hit.reversed, false);
  assert.equal(ball.vx, 3);
  assert.ok(ball.vy < 0);
});

test('BREAKPOINT CROSSOVER: bricks regrow, sooner at high Heat, with a warning and never on the ball', () => {
  const c = court();
  const regrowTime = (heat) => {
    const s = begin('bricks', c), far = { x: 100, y: 100 };
    A.objects(s, c, shot(c, 600, A.brickBox(s, c, 0).h / 2, 60));
    assert.equal(s.bricks.list[0].on, false);
    let warned = 0;
    for (let f = 1; f < 2000; f++) {
      A.update(s, c, heat, false, true, seeded(1), far);
      if (s.bricks.list[0].warn > 0) warned++;
      if (s.bricks.list[0].on) { assert.ok(warned >= T.regrowWarn - 1, 'outlined first'); return f; }
    }
    return Infinity;
  };
  const cool = regrowTime(0), hot = regrowTime(1);
  assert.ok(Math.abs(cool - (T.regrow[0] + T.regrowWarn)) <= 2, `about ${T.regrow[0]} frames at no Heat (${cool})`);
  assert.ok(Math.abs(hot - (T.regrow[1] + T.regrowWarn)) <= 2, `about ${T.regrow[1]} at full Heat (${hot})`);

  // a ball sitting in the gap holds the brick off until it leaves
  const s = begin('bricks', c), box = A.brickBox(s, c, 0), inGap = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  A.objects(s, c, shot(c, 600, box.h / 2, 60));
  frames(s, c, 1500, 1, false, true, seeded(1));       // (frames() passes no ball)
  for (let f = 0; f < 1500; f++) A.update(s, c, 1, false, true, seeded(1), inGap);
  assert.equal(s.bricks.list[0].on, true, 'sanity: with no ball in the way it had already regrown');
  const s2 = begin('bricks', c);
  A.objects(s2, c, shot(c, 600, box.h / 2, 60));
  for (let f = 0; f < 1500; f++) A.update(s2, c, 1, false, true, seeded(1), inGap);
  assert.equal(s2.bricks.list[0].on, false, 'waits for the ball');
  A.update(s2, c, 1, false, true, seeded(1), { x: 100, y: 100 });
  assert.equal(s2.bricks.list[0].on, true, 'and closes as soon as it has gone');
});

test('BREAKPOINT CROSSOVER: every point starts with the wall rebuilt', () => {
  const c = court(), s = begin('bricks', c);
  for (const i of [0, 2, 5, 7]) A.objects(s, c, shot(c, 600, A.brickBox(s, c, i).y + 20, 60));
  assert.ok(s.bricks.list.filter((b) => b.on).length <= s.bricks.list.length - 5);
  A.roundReset(s, c);
  assert.equal(s.bricks.list.filter((b) => b.on).length, s.bricks.list.length - 1);
});

// ── TILT ────────────────────────────────────────────────────────────────────

test('TILT: more bumpers light as Heat rises, and the table looks the same from both ends', () => {
  const c = court(), s = begin('tilt', c), far = { x: 60, y: 60 };
  const litAt = (heat) => { A.update(s, c, heat, false, true, seeded(1), far); return s.tilt.lit.filter(Boolean).length; };
  let last = 0;
  for (let heat = 0; heat <= 1.001; heat += 0.05) {
    const lit = litAt(heat);
    assert.ok(lit >= last, 'never fewer at higher Heat');
    last = lit;
  }
  assert.equal(litAt(0), 2);
  assert.equal(litAt(1), T.bumperSlots.length);
  assert.equal(litAt(0), 2, 'and they go dark again when Heat drops');
  // every bumper has a twin on the far side of the centre spot
  const spots = T.bumperSlots.map((unused, i) => A.bumperAt(c, i));
  spots.forEach((b, i) => {
    const twin = spots.findIndex((o, k) => T.bumperHeat[k] === T.bumperHeat[i] && Math.abs(o.x - (c.width - b.x)) < 1e-6 && Math.abs(o.y - (c.height - b.y)) < 1e-6);
    assert.ok(twin >= 0, `bumper ${i} has a twin that lights at the same Heat`);
  });
});

test('TILT: a lit bumper kicks the ball away faster; a dark one lets it through', () => {
  const c = court(), s = begin('tilt', c), b = A.bumperAt(c, 0);
  A.update(s, c, 0, false, true, seeded(1), { x: 60, y: 60 });
  assert.equal(s.tilt.lit[0], true);

  // head on: straight back, faster
  const ball = { x: b.x - b.r - c.ballR + 3, y: b.y, vx: 8, vy: 0, lock: -1 };
  const hit = A.objects(s, c, ball);
  assert.equal(hit.type, 'bumper');
  assert.equal(hit.reversed, true);
  assert.ok(Math.abs(ball.vx + 8 * T.kick) < 1e-9, `left at ${ball.vx}`);
  assert.ok(Math.hypot(ball.x - b.x, ball.y - b.y) > b.r + c.ballR, 'clear of the bumper');

  // the same bumper rests for a moment, so one touch is one kick
  assert.equal(A.objects(s, c, { x: b.x - b.r, y: b.y, vx: 8, vy: 0 }), null);
  frames(s, c, T.bumperRest, 0);

  // a glancing hit off the top keeps the ball going the same way, deflected up
  const glance = { x: b.x - 6, y: b.y - b.r - c.ballR + 2, vx: 8, vy: 3, lock: -1 };
  const graze = A.objects(s, c, glance);
  assert.equal(graze.reversed, false);
  assert.ok(glance.vx > 8);
  assert.ok(glance.vy < 0);

  // the centre bumper is dark at no Heat
  const centre = A.bumperAt(c, 2), through = { x: centre.x, y: centre.y, vx: 8, vy: 0, lock: -1 };
  assert.equal(s.tilt.lit[2], false);
  assert.equal(A.objects(s, c, through), null);
  assert.equal(through.vx, 8);
});

test('TILT: bumpers speed the ball up only so far, and never slow it down', () => {
  const c = court(), s = begin('tilt', c), b = A.bumperAt(c, 0);
  const kick = (vx) => {
    frames(s, c, T.bumperRest + 1, 0);
    const ball = { x: b.x - b.r - c.ballR + 3, y: b.y, vx, vy: 0, lock: -1 };
    A.objects(s, c, ball);
    return Math.abs(ball.vx);
  };
  assert.ok(Math.abs(kick(17) - T.kickMax) < 1e-9, 'capped at kickMax');
  assert.equal(kick(22), 22, 'a ball already faster than that keeps its speed');
  assert.ok(kick(2) >= 4, 'and it always leaves at a playable pace');
});

test('TILT: a bumper never lights up on top of the ball', () => {
  const c = court(), s = begin('tilt', c), centre = A.bumperAt(c, 2);
  for (let f = 0; f < 200; f++) A.update(s, c, 0.9, true, true, seeded(1), { x: centre.x + 5, y: centre.y });
  assert.equal(s.tilt.lit[2], false);
  A.update(s, c, 0.9, true, true, seeded(1), { x: 60, y: 60 });
  assert.equal(s.tilt.lit[2], true);
});

// ── QUANTUM SHIFT ───────────────────────────────────────────────────────────

test('QUANTUM SHIFT: the ball goes in one portal and out of the other with the same velocity', () => {
  for (const c of [court(), phone()]) {
    const s = begin('portal', c), a = A.portalAt(s, c, 0), b = A.portalAt(s, c, 1);
    assert.equal(a.x, c.width / 2);
    assert.equal(b.x, c.width / 2, 'both start on the centre line');
    const ball = { x: a.x - a.r + 4, y: a.y + 6, vx: 9, vy: -2, lock: -1 };
    const hit = A.objects(s, c, ball);
    assert.equal(hit.type, 'portal');
    assert.equal(ball.vx, 9);
    assert.equal(ball.vy, -2);
    assert.ok(Math.abs(ball.x - (b.x - a.r + 4)) < 1e-9 && Math.abs(ball.y - (b.y + 6)) < 1e-9, 'same place on the other portal');
    assert.ok(ball.y > c.ballR && ball.y < c.height - c.ballR, 'still on the court');

    // it flies on across the portal it came out of without being sent back...
    let jumps = 0;
    for (let f = 0; f < 40; f++) { ball.x += ball.vx * c.xScale; ball.y += ball.vy; if (A.objects(s, c, ball)) jumps++; }
    assert.equal(jumps, 0);
    assert.equal(ball.lock, -1, 'and once clear, portals work for it again');

    // ...and the trip works in both directions
    const back = { x: b.x, y: b.y + b.r - 3, vx: -5, vy: -6, lock: -1 };
    assert.equal(A.objects(s, c, back).type, 'portal');
    assert.ok(Math.abs(back.y - (a.y + a.r - 3)) < 1e-9);
  }
});

test('QUANTUM SHIFT: the portals hold still until high Heat, then roam, mirrored, and stay on the court', () => {
  const c = court(), s = begin('portal', c), home = [A.portalAt(s, c, 0), A.portalAt(s, c, 1)];
  frames(s, c, 600, T.portalHeat);
  assert.deepEqual(A.portalAt(s, c, 0), home[0]);

  let farX = 0, farY = 0;
  for (let f = 0; f < 2400; f++) {
    A.update(s, c, 1, true, true);
    const a = A.portalAt(s, c, 0), b = A.portalAt(s, c, 1);
    farX = Math.max(farX, Math.abs(a.x - home[0].x));
    farY = Math.max(farY, Math.abs(a.y - home[0].y));
    assert.ok(Math.abs((a.x - home[0].x) + (b.x - home[1].x)) < 1e-9 && Math.abs((a.y - home[0].y) + (b.y - home[1].y)) < 1e-9, 'they move in opposite directions');
    for (const p of [a, b]) {
      assert.ok(p.y - p.r > 0 && p.y + p.r < c.height, 'never off the top or bottom');
      assert.ok(p.x - p.r > c.leftFace + 100 && p.x + p.r < c.rightFace - 100, 'never near a paddle');
    }
  }
  const span = c.rightFace - c.leftFace;
  assert.ok(farX > span * T.portalReach[0] * 0.9 && farY > c.height * T.portalReach[1] * 0.9, 'they really travel');

  frames(s, c, 400, 0, false, false);
  assert.deepEqual(A.portalAt(s, c, 0), home[0], 'home again for the next serve');
});

// ── LAST TRAIN ──────────────────────────────────────────────────────────────

// Runs the schedule and reports each train: when the signals started, when it
// arrived and left, and what kind it was.
function timetable(c, heat, totalFrames) {
  const s = begin('train', c), trains = [];
  let seen = 'idle';
  for (let f = 0; f < totalFrames; f++) {
    A.update(s, c, heat, heat >= 0.8, true, seeded(1), { x: 100, y: 100 });
    const phase = s.train.phase;
    if (phase !== seen) {
      if (phase === 'warning') trains.push({ signal: f, express: s.train.express, dir: s.train.dir });
      else if (phase === 'passing') trains[trains.length - 1].arrive = f;
      else trains[trains.length - 1].leave = f;
      seen = phase;
    }
  }
  return trains;
}

test('LAST TRAIN: trains keep to a schedule, announced by the signals, from alternate ends', () => {
  for (const c of [court(), phone()]) {
    const trains = timetable(c, 0.2, 6000);
    assert.ok(trains.length >= 5, `several trains in 100 seconds (${trains.length})`);
    assert.equal(trains[0].signal, T.trainFirst - 1, 'nothing on the track for the first few seconds of a rally');
    const wait = Math.round(T.trainEvery[0] + (T.trainEvery[1] - T.trainEvery[0]) * 0.2);
    trains.forEach((train, i) => {
      assert.equal(train.express, false);
      if (train.arrive === undefined) return;                       // the last one may still be on its way
      assert.equal(train.arrive - train.signal, T.trainWarn[0], 'the signals always give the same warning');
      if (i) {
        assert.equal(train.dir, -trains[i - 1].dir, 'the next one comes from the other end');
        assert.equal(train.signal - trains[i - 1].leave, wait, 'the same gap every time');
      }
    });
    // on a phone the train is scaled to the court, so it is on screen just as long
    const passing = trains[0].leave - trains[0].arrive;
    assert.ok(Math.abs(passing - (1 + T.trainLength[0]) * 720 / T.trainSpeed[0]) <= 2, `on the court for ${passing} frames`);
  }
});

test('LAST TRAIN: Heat brings expresses: more often, faster, with a shorter warning', () => {
  const c = court(), local = timetable(c, 0.2, 6000), express = timetable(c, 0.9, 6000);
  assert.ok(express.every((train) => train.express));
  assert.ok(express.length > local.length * 1.5, `${express.length} expresses against ${local.length} locals`);
  const done = (list) => list.find((train) => train.leave !== undefined);
  assert.ok(done(express).leave - done(express).arrive < (done(local).leave - done(local).arrive) / 2, 'through in under half the time');
  assert.equal(done(express).arrive - done(express).signal, T.trainWarn[1]);
  assert.ok(T.trainWarn[1] >= 45, 'still most of a second to react');
});

test('LAST TRAIN: the ball bounces off the side of the train', () => {
  const c = court(), s = begin('train', c);
  while (s.train.phase !== 'passing') A.update(s, c, 0, false, true);
  frames(s, c, 60, 0);                                              // let it get well onto the court
  const box = A.trainBox(s, c), lane = A.trainLane(c);
  assert.ok(box && box.x === lane.x && box.w === lane.w);
  const y = box.y + box.h - 40;
  const ball = shot(c, lane.x - 60, y, 70);                         // would jump the whole train in one frame
  const hit = A.objects(s, c, ball);
  assert.equal(hit.type, 'train');
  assert.equal(hit.reversed, true);
  assert.ok(ball.vx < 0 && ball.x < lane.x - c.ballR);
  // ahead of the train the track is clear
  assert.equal(A.objects(s, c, shot(c, lane.x - 60, box.y + box.h + 60, 70)), null);
});

test('LAST TRAIN: a ball caught on the track is thrown clear the way it was going, never turned round', () => {
  const c = court(), s = begin('train', c);
  while (s.train.phase !== 'passing') A.update(s, c, 0, false, true);
  frames(s, c, 30, 0);
  const lane = A.trainLane(c), box = A.trainBox(s, c);
  for (const vx of [6, -6]) {
    const ball = { x: lane.x + lane.w / 2, y: box.y + box.h - 4, vx, vy: 0, px: lane.x + lane.w / 2 - vx, py: box.y + box.h - 4, lock: -1 };
    const hit = A.objects(s, c, ball);
    assert.equal(hit.shoved, true);
    assert.equal(hit.reversed, false);
    assert.equal(ball.vx, vx);
    assert.ok(vx > 0 ? ball.x > lane.x + lane.w + c.ballR : ball.x < lane.x - c.ballR, 'out on the far side');
    assert.equal(ball.vy, s.train.dir * T.trainShove, 'dragged along with the train');
    assert.equal(A.blocked(s, c, ball.x, ball.y, c.ballR - 1), false);
  }
});

test('LAST TRAIN: the track is cleared for every serve, and the schedule waits while play is stopped', () => {
  const c = court(), s = begin('train', c);
  while (s.train.phase !== 'passing') A.update(s, c, 0, false, true);
  A.openCourt(s);
  assert.equal(A.trainBox(s, c), null, 'no train runs through the Eye');
  while (s.train.phase !== 'passing') A.update(s, c, 0, false, true);
  A.roundReset(s, c);
  assert.equal(A.trainBox(s, c), null);
  assert.equal(s.train.timer, T.trainFirst);
  frames(s, c, 5000, 0, false, false);
  assert.equal(s.train.phase, 'idle');
  assert.equal(s.train.timer, T.trainFirst, 'the clock does not run between points');
});

// ── Keeping other things clear of them ──────────────────────────────────────

test('object maps say where power-ups and glitch walls must not go, and what is solid', () => {
  const c = court();
  const bricks = begin('bricks', c);
  assert.deepEqual(A.obstacles(bricks, c), [{ x: c.width / 2 - T.brickWide / 2, y: 0, w: T.brickWide, h: c.height }]);
  assert.equal(A.blocked(bricks, c, c.width / 2, 20, 8), true);
  assert.equal(A.blocked(bricks, c, c.width / 2, c.height / 2, 8), false, 'the serve hole is not solid');

  const tilt = begin('tilt', c);
  A.update(tilt, c, 0, false, true, seeded(1), { x: 60, y: 60 });
  assert.equal(A.obstacles(tilt, c).length, T.bumperSlots.length, 'dark bumpers are kept clear too: they may light');
  const lit = A.bumperAt(c, 0), dark = A.bumperAt(c, 2);
  assert.equal(A.blocked(tilt, c, lit.x, lit.y, 8), true);
  assert.equal(A.blocked(tilt, c, dark.x, dark.y, 8), false);

  const portal = begin('portal', c);
  assert.equal(A.obstacles(portal, c).length, 2);
  assert.equal(A.blocked(portal, c, c.width / 2, c.height * 0.27, 8), false, 'a portal is not solid');

  const train = begin('train', c);
  assert.deepEqual(A.obstacles(train, c), [A.trainLane(c)]);
  assert.equal(A.blocked(train, c, c.width / 2, 300, 8), false, 'an empty track is not solid');
  while (train.train.phase !== 'passing') A.update(train, c, 0, false, true);
  frames(train, c, 40, 0);
  assert.equal(A.blocked(train, c, c.width / 2, A.trainBox(train, c).y + 10, 8), true);
});

// ── ECHO ────────────────────────────────────────────────────────────────────

// Plays a rally between two paddles that never miss, on a court with no walls
// in the way, and hands each frame to `watch`.
function echoRally(s, c, totalFrames, heatAt, watch = () => {}) {
  const ball = { x: c.width / 2, y: c.height / 2, vx: 7, vy: 3.3 };
  for (let f = 0; f < totalFrames; f++) {
    const heat = heatAt(f);
    A.update(s, c, heat, heat >= 0.8, true, seeded(f + 1), ball);
    ball.x += ball.vx * c.xScale; ball.y += ball.vy;
    A.walls(s, c, ball);
    if (ball.x <= c.leftFace + c.ballR && ball.vx < 0) { ball.x = c.leftFace + c.ballR; ball.vx = -ball.vx; ball.vy += 0.9; A.echoReturn(s, c, 'left', heat, seeded(f)); }
    if (ball.x >= c.rightFace - c.ballR && ball.vx > 0) { ball.x = c.rightFace - c.ballR; ball.vx = -ball.vx; ball.vy -= 0.7; A.echoReturn(s, c, 'right', heat, seeded(f)); }
    watch(f, ball, heat);
  }
  return ball;
}

test('ECHO: there is nothing to replay until a shot has crossed the court', () => {
  const c = court(), s = begin('echo', c);
  A.echoReturn(s, c, 'left', 0.2);
  assert.equal(s.echo.ghosts.length, 0, 'the first return of a match has no ghosts');
  echoRally(s, c, 700, () => 0.2);
  assert.ok(s.echo.shots.left.length >= 1 && s.echo.shots.right.length >= 1, 'now both paddles have shots on file');
});

test('ECHO: ghosts replay real earlier shots, from the same paddle, level with the ball', () => {
  for (const c of [court(), phone()]) {
    const s = begin('echo', c), span = c.rightFace - c.leftFace;
    let framesWithGhosts = 0, worstGap = 0;
    echoRally(s, c, 4000, () => 0.3, (f, ball) => {
      for (const ghost of s.echo.ghosts) {
        framesWithGhosts++;
        // moving the same way as the real ball, and keeping pace with it across the court
        assert.equal(ghost.side === 'left', ball.vx > 0, 'a ghost leaves from the paddle that just hit');
        worstGap = Math.max(worstGap, Math.abs(ghost.x - ball.x));
        assert.ok(ghost.y >= 0 && ghost.y <= c.height, 'on the court');
        assert.ok(s.echo.shots[ghost.side].includes(ghost.path) || ghost.path.length > 5, 'following a recorded shot');
      }
    });
    assert.ok(framesWithGhosts > 2000, `ghosts are out for most of a rally (${framesWithGhosts} of 4000 frames)`);
    assert.ok(worstGap < span * 0.03, `never more than a ball or two ahead or behind (${Math.round(worstGap)}px)`);
    for (const side of ['left', 'right']) {
      assert.ok(s.echo.shots[side].length <= T.echoKeep, 'old shots are forgotten');
      for (const path of s.echo.shots[side]) {
        assert.ok(path[path.length - 1].p >= 0.9, 'only shots that made it across are kept');
        for (let i = 1; i < path.length; i++) assert.ok(path[i].p > path[i - 1].p, 'recorded in order across the court');
      }
    }
  }
});

test('ECHO: one ghost at low Heat, two from half Heat, and they look more solid as Heat rises', () => {
  const c = court(), s = begin('echo', c);
  let low = 0, high = 0;
  echoRally(s, c, 6000, (f) => (f < 3000 ? 0.2 : 0.7), (f) => {
    if (f > 1000 && f < 3000) low = Math.max(low, s.echo.ghosts.length);
    if (f > 3600) high = Math.max(high, s.echo.ghosts.length);
  });
  assert.equal(low, 1);
  assert.equal(high, 2);

  assert.equal(A.ghostAlpha(0), T.echoAlpha[0]);
  assert.ok(T.echoAlpha[0] <= 0.25, 'faint at no Heat');
  assert.ok(A.ghostAlpha(0.8) >= 0.9 && A.ghostAlpha(1) >= 0.9, 'nearly solid at Critical Heat');
  let last = 0;
  for (let heat = 0; heat <= 1.001; heat += 0.05) { assert.ok(A.ghostAlpha(heat) >= last); last = A.ghostAlpha(heat); }
});

test('ECHO: a point ends the ghosts but keeps what was learned', () => {
  const c = court(), s = begin('echo', c);
  echoRally(s, c, 1500, () => 0.6);
  assert.ok(s.echo.ghosts.length > 0);
  const kept = s.echo.shots.left.length + s.echo.shots.right.length;
  A.roundReset(s, c);
  assert.equal(s.echo.ghosts.length, 0);
  assert.equal(s.echo.recording, null, 'the unfinished shot is thrown away');
  assert.equal(s.echo.shots.left.length + s.echo.shots.right.length, kept);
  A.echoReturn(s, c, 'left', 0.2, seeded(4));
  assert.equal(s.echo.ghosts.length, 1, 'so the next rally has ghosts from its first return');
});

// ── KERNEL PANIC ────────────────────────────────────────────────────────────

test('KERNEL PANIC: a hit flashes the lights, and the flash fades in about a third of a second', () => {
  const c = court(), s = begin('panic', c);
  assert.equal(s.panic.flash, 0);
  A.panicHit(s);
  assert.equal(s.panic.flash, 1);
  let f = 0;
  while (s.panic.flash > 0) { A.update(s, c, 0.3, false, true); f++; }
  assert.ok(f >= 12 && f <= 30, `gone in ${f} frames`);
  assert.ok(T.panicDark > 0.85 && T.panicDark < 1, 'the unlit court is very dark but not invisible');
});

test('KERNEL PANIC: the ball carries a small light that shrinks as Heat rises', () => {
  const c = court(), s = begin('panic', c);
  frames(s, c, 1, 0);
  assert.equal(s.panic.light, T.panicLight[0]);
  let last = Infinity;
  for (let heat = 0; heat <= 1.001; heat += 0.1) {
    frames(s, c, 1, heat);
    assert.ok(s.panic.light <= last);
    last = s.panic.light;
  }
  assert.ok(Math.abs(s.panic.light - T.panicLight[1]) < 1e-9);
  assert.ok(T.panicLight[0] < 0.25, 'small: the circle is well under half the court tall');
  assert.ok(T.panicLight[1] * 390 > 9 * 3, 'but always clearly bigger than the ball, even on a phone');
});

// ── ARCHIVE BUILD 0.1 ───────────────────────────────────────────────────────

test('ARCHIVE BUILD 0.1: all prototype at low Heat, all modern at high Heat, and it goes back', () => {
  const c = court(), s = begin('archive', c);
  frames(s, c, 300, T.bleedHeat[0]);
  assert.equal(s.archive.bleed, 0);
  assert.equal(A.archiveQuiet(s), true, 'the prototype has no glitches');

  let last = 0;
  for (let heat = T.bleedHeat[0]; heat <= 1.001; heat += 0.05) {
    frames(s, c, 200, heat);
    assert.ok(s.archive.bleed >= last - 1e-9, 'more Heat never shows less of the modern game');
    last = s.archive.bleed;
  }
  assert.equal(s.archive.bleed, 1);
  assert.equal(A.archiveQuiet(s), false);

  frames(s, c, 300, 0, false, false);                 // a point is scored
  assert.equal(s.archive.bleed, 0, 'every point starts in the prototype again');
});

test('ARCHIVE BUILD 0.1: the glitches come back before the modern game has taken over', () => {
  const c = court(), s = begin('archive', c);
  let quietUntil = null;
  for (let heat = 0; heat <= 1.001; heat += 0.01) {
    frames(s, c, 200, heat);
    if (quietUntil === null && !A.archiveQuiet(s)) quietUntil = heat;
  }
  assert.ok(quietUntil > T.bleedHeat[0] && quietUntil < 0.45, `glitches return at about ${Math.round(quietUntil * 100)}% Heat`);
});

// ── THE EYE'S LAIR ──────────────────────────────────────────────────────────

test("THE EYE'S LAIR: the Eye arrives sooner here than anywhere else", () => {
  const c = court();
  assert.equal(A.eyeHeat(begin('lair', c)), T.lairHeat);
  assert.ok(T.lairHeat < 1 && T.lairHeat >= 0.5);
  for (const id of A.IDS.filter((id) => id !== 'lair')) assert.equal(A.eyeHeat(begin(id, c)), 1);
});

test("THE EYE'S LAIR: the pupil follows the ball, and the lid shuts while the real Eye is out", () => {
  const c = court(), s = begin('lair', c);
  const lookAt = (x, y) => { for (let f = 0; f < 120; f++) A.update(s, c, 0.3, false, true, seeded(1), { x, y }); return s.lair.look; };
  let look = lookAt(c.width, 0);
  assert.ok(look.x > 0.95 && look.y < -0.95, 'top right');
  look = lookAt(0, c.height);
  assert.ok(look.x < -0.95 && look.y > 0.95, 'bottom left');
  look = lookAt(c.width / 2, c.height / 2);
  assert.ok(Math.abs(look.x) < 0.02 && Math.abs(look.y) < 0.02, 'centre');
  // it turns, it doesn't snap
  A.update(s, c, 0.3, false, true, seeded(1), { x: c.width, y: c.height / 2 });
  assert.ok(s.lair.look.x > 0 && s.lair.look.x < 0.3);

  assert.ok(s.lair.lid > 0.99, 'open during play');
  A.openCourt(s);                                     // the Eye arrives
  frames(s, c, 60, 0.7, false, false);
  assert.ok(s.lair.lid < 0.01, 'shut: there are never two Eyes');
  A.roundReset(s, c);
  frames(s, c, 60, 0, false, false);
  assert.ok(s.lair.lid > 0.99, 'open again for the next serve');
});

// ── A whole rally on every map ──────────────────────────────────────────────

test('a long rally on any rule map keeps the ball on the court', () => {
  for (const id of A.IDS) {
    for (const c of [court(), phone()]) {
      const rand = seeded(id.length * 31 + c.width), s = begin(id, c, rand);
      const ball = { x: c.width / 2, y: c.height / 2, vx: 7, vy: 3.1, lock: -1 };
      for (let f = 0; f < 6000; f++) {
        const heat = Math.min(1, f / 3000);
        A.update(s, c, heat, heat >= 0.8, true, rand, ball);
        ball.px = ball.x;
        ball.vy = A.fall(s, c, ball.vy);
        const drift = A.drift(s, ball.vx);
        assert.ok(Math.abs(drift) < Math.abs(ball.vx), `${id}: frame ${f} the wind never stops the ball`);
        ball.x += (ball.vx + drift) * c.xScale;
        ball.y += ball.vy;
        A.walls(s, c, ball);
        assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y) && Number.isFinite(ball.vy), `${id}: frame ${f}`);
        if (id === 'overflow') assert.ok(ball.y >= 0 && ball.y < c.height, `${id}: frame ${f} y ${ball.y}`);
        else {
          assert.ok(ball.y >= A.topAt(s, c, ball.x) + c.ballR - 1e-6, `${id}: frame ${f} above the top wall`);
          assert.ok(ball.y <= A.bottomAt(s, c, ball.x) - c.ballR + 1e-6, `${id}: frame ${f} below the bottom wall`);
        }
        A.posts(s, c, ball);
        ball.py = ball.y - ball.vy;
        const hit = A.objects(s, c, ball);
        if (hit && hit.type !== 'portal') assert.equal(A.blocked(s, c, ball.x, ball.y, c.ballR - 1), false, `${id}: frame ${f} left inside what it hit`);
        assert.ok(Math.abs(ball.vx) >= 4 - 1e-9 && Math.abs(ball.vy) <= T.fallMax + 1e-9, `${id}: frame ${f} speed ${ball.vx}, ${ball.vy}`);
        // stand-in paddles that never miss
        if (ball.x <= c.leftFace + c.ballR && ball.vx < 0) { ball.x = c.leftFace + c.ballR; ball.vx = Math.min(20, -ball.vx * 1.02); A.onReturn(s); }
        if (ball.x >= c.rightFace - c.ballR && ball.vx > 0) { ball.x = c.rightFace - c.ballR; ball.vx = -Math.min(20, ball.vx * 1.02); A.onReturn(s); }
        assert.ok(ball.x >= c.leftFace - 1e-6 && ball.x <= c.rightFace + 1e-6, `${id}: frame ${f} x ${ball.x}`);
      }
    }
  }
});

// ── The game around the rules ───────────────────────────────────────────────

test('the game lists the four court maps and loads their rules', () => {
  const site = readFileSync(new URL('../glitchpong-site.js', import.meta.url), 'utf8');
  const registry = site.match(/const ARENA_REGISTRY = \[([\s\S]*?)\n    \]/);
  assert.ok(registry, 'found ARENA_REGISTRY');
  const ids = [...registry[1].matchAll(/\bid:\s*"([a-z]+)"/g)].map((m) => m[1]);
  for (const id of A.IDS) assert.ok(ids.includes(id), `${id} is in the arena menu`);

  // WORLD TOUR asks for a win in every arena, so its goal follows the list.
  const tour = site.match(/\{\s*id:\s*"world_tour"[^}]*\}/);
  assert.ok(tour, 'found the world_tour achievement');
  assert.equal(Number(tour[0].match(/goal:\s*(\d+)/)[1]), ids.length, 'world_tour goal equals the number of arenas');

  // THE EYE'S LAIR is the Eye Gauntlet's reward: marked in the list, checked
  // against the arcade's save, and announced by the arcade when it is earned.
  const lair = registry[1].slice(registry[1].indexOf('id:       "lair"'));
  assert.ok(/eyeReward:\s*true/.test(lair), 'the lair is marked as the gauntlet reward');
  assert.equal((registry[1].match(/eyeReward:\s*true/g) || []).length, 1, 'and it is the only locked arena');
  assert.ok(/glitchcade_floor_v1/.test(site) && /gauntlet\.clears > 0/.test(site), 'the menu reads gauntlet clears from the arcade save');
  const floor = readFileSync(new URL('../glitchcade-floor.js', import.meta.url), 'utf8');
  assert.ok(floor.includes("NEW ARENA: THE EYE'S LAIR"), 'the arcade says so when the gauntlet is first cleared');

  // The page and the offline cache both have to fetch the rules file.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tag = html.match(/<script src="(glitchpong-arenas\.js[^"]*)"/);
  assert.ok(tag, 'index.html loads glitchpong-arenas.js');
  assert.ok(html.indexOf(tag[0]) < html.indexOf('<script src="glitchpong-site.js'), 'before the game itself');
  const worker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.ok(worker.includes(`"./${tag[1]}"`), 'service-worker.js caches the same URL');
});
