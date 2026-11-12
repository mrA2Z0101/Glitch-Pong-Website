// A small stand-in for Glitch Pong's rally, for measuring how the computer
// players do against each other without a browser. It copies the numbers that
// decide a rally from glitchpong-site.js: the court, paddle speed and dash, how
// a return speeds the ball up, Heat, and the ball's teleports and jukes. It
// leaves out everything else (power-ups, glitch walls, the Eye's fight, arenas).
import { createRequire } from 'node:module';
const AI = createRequire(import.meta.url)('../../glitchpong-ai.js');

export const COURT = { width: 1280, height: 720, leftFace: 42, rightFace: 1238, paddleH: 140, step: 8, ballR: 10, dash: 76, dashCooldown: 60, maxSpeed: 24 };

export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Plays one rally from the serve. `players` is { left, right }, each
// { mind, profile } (or { hold: true } for a paddle nobody is moving).
// Returns { returns, winner, eye, frames, topSpeed }: `eye` means Heat reached
// 100%, where the real game brings in the Eye, and nobody won the rally.
export function playRally(players, rand, opts = {}) {
  const c = COURT, glitches = opts.glitches !== false, span = c.rightFace - c.leftFace;
  const ball = { x: c.width / 2, y: c.height / 2, vx: 6 * (rand() < 0.5 ? -1 : 1), vy: rand() * 4 - 2 };
  if (Math.abs(ball.vy) < 1.2) ball.vy = ball.vy < 0 ? -1.8 : 1.8;
  const pad = { left: { y: (c.height - c.paddleH) / 2, cool: 0 }, right: { y: (c.height - c.paddleH) / 2, cool: 0 } };
  let heat = 0, returns = 0, combo = 0, topSpeed = 6;
  let teleportIn = 600 + rand() * 600, jukeIn = 300 + rand() * 300;
  for (const side of ['left', 'right']) if (players[side].mind) AI.newPoint(players[side].mind);

  for (let frame = 0; frame < 60 * 180; frame++) {
    const hr = heat / 100;
    for (const side of ['left', 'right']) {
      const me = players[side], mine = pad[side], other = pad[side === 'left' ? 'right' : 'left'];
      if (mine.cool > 0) mine.cool--;
      if (!me.mind) continue;
      const act = AI.think(me.mind, me.profile, {
        side, ballX: ball.x, ballY: ball.y, vx: ball.vx, vy: ball.vy,
        faceX: side === 'left' ? c.leftFace : c.rightFace, span,
        paddleY: mine.y, paddleH: c.paddleH, step: c.step, top: 0, bottom: c.height,
        ballTop: c.ballR, ballBottom: c.height - c.ballR, height: c.height,
        dashReady: mine.cool === 0, rally: returns, critical: heat >= 80,
        matchPoint: !!opts.matchPoint, myScore: opts.scores ? opts.scores[side] : 0, theirScore: opts.scores ? opts.scores[side === 'left' ? 'right' : 'left'] : 0,
        opponentY: other.y + c.paddleH / 2
      }, rand);
      if (act.dash && mine.cool === 0) { mine.y += act.dash * (c.dash + Math.max(0, (hr - 0.5) * 2) * 14); mine.cool = c.dashCooldown; }
      else mine.y += act.move;
      mine.y = Math.max(0, Math.min(c.height - c.paddleH, mine.y));
    }

    heat = Math.max(0, Math.min(100, heat - (0.022 + hr * 0.017) * Math.min(4, Math.abs(ball.vx) / 8)));
    if (glitches) {
      if (--teleportIn <= 0) {
        ball.x = c.width * (0.2 + rand() * 0.6); ball.y = c.height * (0.15 + rand() * 0.7);
        if (rand() < 0.5 + hr * 0.15) ball.vx = -ball.vx;
        if (rand() < 0.35 + hr * 0.2) ball.vy = -ball.vy;
        teleportIn = Math.max(220, 600 - hr * 180) + rand() * 500;
      }
      if (--jukeIn <= 0 && ball.x > c.width * 0.25 && ball.x < c.width * 0.75 && ball.y > 50 && ball.y < c.height - 50) {
        if (rand() < 0.01 + hr * 0.018) { ball.vy = -ball.vy * (1 + hr * 0.08); jukeIn = Math.max(100, 300 - hr * 120) + rand() * 220; }
      }
    }

    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.y <= c.ballR) { ball.y = c.ballR; ball.vy = Math.abs(ball.vy); }
    else if (ball.y >= c.height - c.ballR) { ball.y = c.height - c.ballR; ball.vy = -Math.abs(ball.vy); }

    for (const side of ['left', 'right']) {
      const left = side === 'left', mine = pad[side];
      const reached = left ? ball.x <= c.leftFace && ball.vx < 0 : ball.x >= c.rightFace && ball.vx > 0;
      if (!reached || ball.y < mine.y || ball.y > mine.y + c.paddleH) continue;
      const faster = Math.max(4, Math.abs(ball.vx)) * (1 + hr * 0.035 + Math.min(combo * 0.01, 0.08));
      ball.vx = (left ? 1 : -1) * Math.min(c.maxSpeed, faster);
      ball.x = left ? c.leftFace + c.ballR : c.rightFace - c.ballR;
      ball.vy = Math.max(-9, Math.min(9, ball.vy + (ball.y - (mine.y + c.paddleH / 2)) * 0.04));
      heat = Math.min(100, heat + 12.5);
      returns++; combo++;
      topSpeed = Math.max(topSpeed, Math.abs(ball.vx));
    }
    if (heat >= 100 && opts.eye !== false) return { returns, winner: null, eye: true, frames: frame, topSpeed };
    if (ball.x < 0) return { returns, winner: 'right', eye: false, frames: frame, topSpeed };
    if (ball.x > c.width) return { returns, winner: 'left', eye: false, frames: frame, topSpeed };
  }
  return { returns, winner: null, eye: false, frames: 60 * 180, topSpeed };
}

// A first-to-`winScore` match. Rallies that would have brought the Eye are replayed.
export function playMatch(leftName, rightName, rand, winScore = 7) {
  const players = {
    left: { mind: AI.createMind(rand), profile: AI.PROFILES[leftName] },
    right: { mind: AI.createMind(rand), profile: AI.PROFILES[rightName] }
  };
  const scores = { left: 0, right: 0 };
  let eyeSeen = false;
  while (scores.left < winScore && scores.right < winScore) {
    const matchPoint = scores.left >= winScore - 1 || scores.right >= winScore - 1;
    const rally = playRally(players, rand, { scores, matchPoint, eye: !eyeSeen });
    if (rally.eye) { eyeSeen = true; continue; }       // the Eye comes once a match
    if (rally.winner) scores[rally.winner]++;
  }
  return scores.left > scores.right ? 'left' : 'right';
}

export { AI };
