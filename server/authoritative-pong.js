"use strict";

// Isolated server simulation. Clients only submit up/down/stop intent; this
// module owns all positions, collisions, points, resets, and win conditions.
//
// Runs unchanged in Node (the socket.io server) and in a browser (the player who
// hosts a peer-to-peer game runs it as window.GlitchPongSim).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlitchPongSim = api;
})(typeof self !== "undefined" ? self : this, function () {
const WIDTH = 960;
const HEIGHT = 540;
const PADDLE_X = 38;      // gap between the side of the court and the back of a paddle
const PADDLE_W = 16;
const PADDLE_H = 118;
const BALL_R = 9;
const PADDLE_SPEED = 430;
const WIN_SCORE = 11;

function initialState() {
  return {
    width: WIDTH, height: HEIGHT, status: "waiting", heat: 0,
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 },
    paddles: { left: { y: (HEIGHT - PADDLE_H) / 2, direction: "stop" }, right: { y: (HEIGHT - PADDLE_H) / 2, direction: "stop" } },
    scores: { left: 0, right: 0 },
    lastHit: "neutral", winner: null, resetAt: 0
  };
}

function resetBall(state, direction) {
  state.ball.x = WIDTH / 2;
  state.ball.y = HEIGHT / 2;
  state.ball.vx = direction * 315;
  state.ball.vy = (Math.random() < 0.5 ? -1 : 1) * (145 + Math.random() * 95);
  state.lastHit = "neutral";
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function step(state, dt, now = Date.now()) {
  if (state.status !== "playing") return;

  // Paddles answer all the time, including in the pause between points, so a
  // player can get into position for the serve.
  for (const side of ["left", "right"]) {
    const paddle = state.paddles[side];
    const velocity = paddle.direction === "up" ? -PADDLE_SPEED : paddle.direction === "down" ? PADDLE_SPEED : 0;
    paddle.y = clamp(paddle.y + velocity * dt, 0, HEIGHT - PADDLE_H);
  }

  if (state.resetAt) {
    if (now < state.resetAt) return;
    state.resetAt = 0;
    resetBall(state, Math.random() < 0.5 ? -1 : 1);
  }

  const ball = state.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y - BALL_R <= 0 || ball.y + BALL_R >= HEIGHT) {
    ball.y = clamp(ball.y, BALL_R, HEIGHT - BALL_R);
    ball.vy *= -1;
  }

  const left = state.paddles.left;
  const right = state.paddles.right;
  if (ball.vx < 0 && ball.x - BALL_R <= PADDLE_X + PADDLE_W && ball.x > 22 && ball.y >= left.y - BALL_R && ball.y <= left.y + PADDLE_H + BALL_R) {
    ball.x = PADDLE_X + PADDLE_W + BALL_R;
    ball.vx = Math.abs(ball.vx) * 1.025;
    ball.vy += (ball.y - (left.y + PADDLE_H / 2)) * 3.3;
    state.lastHit = "left";
    state.heat = Math.min(100, state.heat + 4.5);
  }
  if (ball.vx > 0 && ball.x + BALL_R >= WIDTH - PADDLE_X - PADDLE_W && ball.x < WIDTH - 22 && ball.y >= right.y - BALL_R && ball.y <= right.y + PADDLE_H + BALL_R) {
    ball.x = WIDTH - PADDLE_X - PADDLE_W - BALL_R;
    ball.vx = -Math.abs(ball.vx) * 1.025;
    ball.vy += (ball.y - (right.y + PADDLE_H / 2)) * 3.3;
    state.lastHit = "right";
    state.heat = Math.min(100, state.heat + 4.5);
  }
  ball.vy = clamp(ball.vy, -530, 530);

  if (ball.x < -BALL_R || ball.x > WIDTH + BALL_R) {
    const scorer = ball.x < 0 ? "right" : "left";
    state.scores[scorer] += 1;
    if (state.scores[scorer] >= WIN_SCORE) {
      state.status = "ended";
      state.winner = scorer;
      ball.vx = 0; ball.vy = 0;
    } else {
      // The ball waits in the middle, where both players can see it, then is served.
      state.resetAt = now + 900;
      ball.x = WIDTH / 2; ball.y = HEIGHT / 2;
      ball.vx = 0; ball.vy = 0;
      state.lastHit = "neutral";
    }
  }
  state.heat = Math.max(0, state.heat - dt * 1.2);
}

function snapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

return { initialState, resetBall, step, snapshot, WIDTH, HEIGHT, PADDLE_X, PADDLE_W, PADDLE_H, BALL_R, WIN_SCORE };
});
