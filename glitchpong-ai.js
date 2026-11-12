"use strict";

// How the computer plays Glitch Pong.
//
// The paddle it controls is the same as a player's: same speed, same dash,
// same cooldown. What makes it an opponent rather than a machine is that it
// plays through a model of a person:
//
//   - It needs time to react. When the ball does something it did not expect
//     (the other paddle hits it, it teleports, it jukes), it keeps playing the
//     old ball for a moment before it catches up.
//   - It judges where a ball will arrive, and judges fast, steep and distant
//     balls worse. The judgement sharpens as the ball gets close.
//   - Its hands re-aim a few times a second, not every frame, and not exactly.
//   - It has nerves: long rallies, Critical Heat, match point and having just
//     lost a point all make it play worse. Now and then its attention slips.
//   - It can be fooled by decoy balls, dash late or the wrong way, and it
//     leans towards where its opponent usually hits.
//
// A difficulty is how good that person is (PROFILES below), not how fast the
// paddle moves. Nothing here touches the page: glitchpong-site.js describes the
// court each frame and moves the paddle by what `think` returns, and
// tests/ai.test.mjs plays whole matches with it under Node. See docs/ai.md.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlitchAI = api;
})(typeof self !== "undefined" ? self : this, function () {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mod = (v, n) => ((v % n) + n) % n;
  // Roughly bell-shaped, mean 0 and spread 1, from any 0..1 random source.
  const bell = (rand) => (rand() + rand() + rand() + rand() - 2) * 1.732;

  // Times are in frames (60 a second). Distances are pixels unless they say a share.
  const PROFILES = {
    // Someone new to the game: watches the ball more than where it is going.
    easy: {
      reaction: 20,      // frames before it responds to something unexpected (about a third of a second)
      reread: 10,        // frames between re-aiming the paddle
      lookAhead: 14,     // how far ahead it can picture the ball's path
      readError: 0.180,  // how wrong its first guess at the landing spot is: share of court height, for an ordinary shot from the far side
      aimError: 0.22,    // error that never goes away: share of half a paddle
      motor: 14,         // how far its hands miss the spot they meant
      slack: 16,         // close enough: it doesn't fidget inside this
      lapse: 0.15,       // chance its attention slips on a shot
      dashUse: 0.15,     // chance it thinks to dash when it needs one
      dashWrong: 0.12,   // chance a dash goes the wrong way
      dashLate: 10,      // it only dashes this close to the ball arriving
      fooled: 0.45,      // chance it follows a decoy ball
      wise: 0.20,        // ...until the real ball is this close (share of the court)
      lean: 0,           // how much it shades towards where the opponent usually hits
      strategy: 0,       // how far off-centre it takes the ball to place its return (share of a paddle)
      retreat: 0.45,     // how much it goes back to the middle between shots, as opposed to following the ball
      nerve: 1.2         // how much pressure gets to it
    },
    // Someone who plays regularly.
    medium: {
      reaction: 14, reread: 7, lookAhead: 40, readError: 0.150, aimError: 0.14, motor: 9, slack: 10,
      lapse: 0.14, dashUse: 0.4, dashWrong: 0.06, dashLate: 14, fooled: 0.28, wise: 0.28,
      lean: 0.3, strategy: 0.07, retreat: 0.6, nerve: 1.0
    },
    // Someone very good: quick, accurate and hard to fool, but still a person.
    hard: {
      reaction: 11, reread: 5, lookAhead: 600, readError: 0.110, aimError: 0.08, motor: 5, slack: 6,
      lapse: 0.10, dashUse: 0.6, dashWrong: 0.02, dashLate: 18, fooled: 0.12, wise: 0.36,
      lean: 0.6, strategy: 0.14, retreat: 0.75, nerve: 0.75
    },
    // The two paddles in the menu's background rally. Not a person: it never misses.
    demo: {
      reaction: 0, reread: 1, lookAhead: 22, readError: 0, aimError: 0, motor: 0, slack: 0.5,
      lapse: 0, dashUse: 1, dashWrong: 0, dashLate: 12, fooled: 0, wise: 1,
      lean: 0, strategy: 0, retreat: 0.25, nerve: 0
    }
  };

  const TUNING = {
    lapseCost: 2.2,       // a slipped reaction takes this many times longer...
    lapseOff: [1.0, 1.6], // when its attention slips it sets up this far off the ball, in paddle heights...
    wake: [0.02, 0.10],   // ...and wakes up when the ball is somewhere between these shares of the court away
    telegraph: 0.4,       // share of the usual reaction time needed for something announced in advance (the Eye looks before it throws)
    tired: [6, 0.04, 0.6],// from this many returns in a rally, each one adds this much to its errors, up to this much
    critical: 0.2,        // added at Critical Heat
    matchPoint: 0.15,     // added at match point
    tilt: 0.3,            // added just after losing a point, fading over...
    tiltFrames: 360,
    glow: 0.1,            // taken off just after winning one, fading over...
    glowFrames: 300,
    form: [0.92, 1.12],   // how well it happens to be playing this match
    dashRest: 30,         // frames before it will consider another dash
    focus: 0.3,           // how late a misjudged ball becomes clear: below 1, the error hangs on until the ball is close
    slowest: 0.8,         // a slow ball is still this hard to judge, where 1 is a ball moving 10 pixels a frame
    steep: 1.0,           // how much harder a ball at the steepest angle is to judge than a flat one
    rushed: 1.6           // how much worse it judges a ball that changed course on its way in
  };

  function createMind(rand = Math.random) {
    return {
      belief: null,        // the ball as it understands it: { x, y, vx, vy }
      blind: 0,            // frames left before it catches up with something unexpected
      slipped: false,      // the reaction in progress is a slow one
      shot: null,          // its read of the shot coming at it
      incoming: false,
      goal: null,          // where its hands are taking the paddle
      rereadIn: 0,
      dashRest: 0,
      form: TUNING.form[0] + rand() * (TUNING.form[1] - TUNING.form[0]),
      tilt: 0,             // 1 just after losing a point
      glow: 0,             // 1 just after winning one
      habit: 0,            // where the opponent's shots tend to arrive: -0.5 top, 0.5 bottom
      mine: null, theirs: null
    };
  }

  // The start of a new point: forget the last ball, keep the mood.
  function newPoint(mind) {
    mind.belief = null;
    mind.blind = 0;
    mind.slipped = false;
    mind.shot = null;
    mind.incoming = false;
    mind.goal = null;
    mind.rereadIn = 0;
  }

  // Where a ball at `y` moving at `vy` will be in `frames` frames, bouncing off
  // the top and bottom of the court (or wrapping, or falling) on the way.
  function projectY(y, vy, frames, w) {
    const lo = w.ballTop, hi = w.ballBottom, span = hi - lo;
    if (!(span > 0)) return y;
    if (w.gravity) {
      const cap = w.fallMax || 10;
      for (let i = 0, n = Math.min(600, Math.ceil(frames)); i < n; i++) {
        vy = clamp(vy + w.gravity, -cap, cap);
        y += vy;
        if (y > hi) { y = hi; vy = -Math.abs(vy); } else if (y < lo) { y = lo; vy = Math.abs(vy); }
      }
      return y;
    }
    const travelled = y + vy * frames - lo;
    if (w.wrap) return lo + mod(travelled, span);
    const folded = mod(travelled, span * 2);
    return lo + (folded <= span ? folded : span * 2 - folded);
  }

  // Moves its idea of the ball on by one frame, the way it expects a ball to move.
  function carryOn(b, w) {
    b.x += b.vx;
    if (w.gravity) b.vy = clamp(b.vy + w.gravity, -(w.fallMax || 10), w.fallMax || 10);
    b.y += b.vy;
    const lo = w.ballTop, hi = w.ballBottom;
    if (w.wrap) { if (hi > lo) b.y = lo + mod(b.y - lo, hi - lo); }
    else if (b.y > hi) { b.y = hi - (b.y - hi); b.vy = -Math.abs(b.vy); }
    else if (b.y < lo) { b.y = lo + (lo - b.y); b.vy = Math.abs(b.vy); }
  }

  // How much worse than its best it is playing right now. 1 is normal.
  function nerves(mind, p, w) {
    if (!p.nerve) return 1;
    const tired = Math.min(TUNING.tired[2], Math.max(0, (w.rally || 0) - TUNING.tired[0]) * TUNING.tired[1]);
    const pressure = tired + (w.critical ? TUNING.critical : 0) + (w.matchPoint ? TUNING.matchPoint : 0)
      + mind.tilt * TUNING.tilt - mind.glow * TUNING.glow;
    return clamp(mind.form * (1 + p.nerve * pressure), 0.6, 2.2);
  }

  // A fresh look at a ball that is coming its way.
  function readShot(mind, p, w, rand, slipped) {
    const lapse = slipped || rand() < p.lapse * nerves(mind, p, w) * (w.sharp === undefined ? 1 : w.sharp);
    const shot = {
      bias: bell(rand),          // which way, and how badly, it misjudges the landing spot
      residual: bell(rand),      // the part of that it never corrects
      // An attention slip: it sets up well off the ball and only notices when
      // the ball is nearly on it. Whether that is in time depends on the ball's speed.
      lapse,
      lapseOff: lapse ? (rand() < 0.5 ? -1 : 1) * (TUNING.lapseOff[0] + rand() * (TUNING.lapseOff[1] - TUNING.lapseOff[0])) * w.paddleH : 0,
      wake: (TUNING.wake[0] + rand() * (TUNING.wake[1] - TUNING.wake[0])) * w.span,
      rushed: mind.incoming,     // the ball changed course while already on its way: less time to judge it
      willDash: rand() < p.dashUse,
      wrongDash: rand() < p.dashWrong,
      chase: null
    };
    if (w.decoys && w.decoys.length) {
      const decoy = w.decoys[Math.floor(rand() * w.decoys.length)];
      if (rand() < p.fooled * (decoy.weight === undefined ? 1 : decoy.weight)) shot.chase = decoy.ref;
    }
    mind.shot = shot;
    mind.rereadIn = 0;           // look, then move
  }

  // One frame of play. `w` describes the court from this paddle's side:
  //
  //   side          "left" or "right"
  //   ballX, ballY  where the ball is
  //   vx, vy        how far it moves each frame, in pixels
  //   faceX         the x of this paddle's face
  //   span          the distance between the two paddle faces
  //   paddleY, paddleH, step   this paddle: its top, its height, how far it moves in a frame
  //   top, bottom   how far up and down the paddle can go
  //   ballTop, ballBottom      where the ball turns round at the top and bottom of the court
  //   height        the court's height
  //   wrap, gravity, fallMax   set on maps where the ball wraps or falls
  //   dashReady     its dash is off cooldown
  //   rally, critical, matchPoint, myScore, theirScore   the state of the match
  //   opponentY     the middle of the other paddle
  //   decoys        fake balls heading its way: [{ ref, x, y, vx, vy, weight }]
  //   telegraphed   what it is facing was announced before it happened
  //   sharp         a multiplier on its errors (below 1 plays better)
  //
  // Returns { move, dash }: how far to move the paddle this frame (never more
  // than `step`), and -1 or 1 to dash up or down.
  function think(mind, profile, w, rand = Math.random) {
    const p = profile;
    if (mind.dashRest > 0) mind.dashRest--;
    mind.tilt = Math.max(0, mind.tilt - 1 / TUNING.tiltFrames);
    mind.glow = Math.max(0, mind.glow - 1 / TUNING.glowFrames);
    if (mind.mine !== null && w.myScore !== undefined) {
      if (w.theirScore > mind.theirs) mind.tilt = 1;
      if (w.myScore > mind.mine) mind.glow = 1;
    }
    if (w.myScore !== undefined) { mind.mine = w.myScore; mind.theirs = w.theirScore; }
    const pressure = nerves(mind, p, w), sharp = w.sharp === undefined ? 1 : w.sharp;

    // 1. What it thinks the ball is doing. While the ball does what it expects,
    // it sees it exactly. When the ball does anything else, it carries on with
    // the ball it expected until its reaction time is up.
    const truth = { x: w.ballX, y: w.ballY, vx: w.vx, vy: w.vy };
    let fresh = false;
    if (!mind.belief) { mind.belief = truth; fresh = true; }
    else {
      const b = mind.belief;
      carryOn(b, w);
      const surprised = Math.hypot(truth.x - b.x, truth.y - b.y) > 10 || Math.hypot(truth.vx - b.vx, truth.vy - b.vy) > 1.2;
      if (mind.blind > 0) {
        if (--mind.blind === 0) { mind.belief = truth; fresh = true; }
      } else if (surprised) {
        mind.slipped = rand() < p.lapse * pressure * sharp;
        const wait = p.reaction * (0.8 + rand() * 0.4) * (mind.slipped ? TUNING.lapseCost : 1) * (w.telegraphed ? TUNING.telegraph : 1);
        mind.blind = Math.round(wait);
        if (mind.blind <= 0) { mind.belief = truth; fresh = true; }
      } else {
        mind.belief = truth;
      }
    }
    const b = mind.belief;
    const toward = w.side === "left" ? b.vx < 0 : b.vx > 0;
    const mid = (w.top + w.bottom) / 2;

    if (toward && (fresh || !mind.incoming || !mind.shot)) readShot(mind, p, w, rand, mind.slipped && fresh);
    if (fresh) mind.slipped = false;
    if (!toward && mind.incoming) {
      // that shot is over: remember roughly where it came in
      mind.habit = mind.habit * 0.7 + clamp((b.y - mid) / w.height, -0.5, 0.5) * 0.3;
      mind.shot = null;
    }
    mind.incoming = toward;

    // 2. Where it wants the paddle.
    const gap = Math.abs(b.x - w.faceX), arrives = gap / Math.max(0.5, Math.abs(b.vx));
    let want;
    if (toward && mind.shot) {
      const shot = mind.shot;
      // following a decoy, until the real ball is close enough to tell them apart
      let from = b;
      if (shot.chase) {
        const decoy = (w.decoys || []).find((d) => d.ref === shot.chase);
        if (!decoy || gap < p.wise * w.span) shot.chase = null;
        else from = decoy;
      }
      const landing = projectY(from.y, from.vy || 0, Math.min(arrives, p.lookAhead), w);
      // Fast, steep and distant balls are harder to judge.
      const hard = clamp(Math.abs(b.vx) / 10, TUNING.slowest, 2.4) * (1 + Math.abs(b.vy) / 9 * TUNING.steep) * (shot.rushed ? TUNING.rushed : 1);
      const far = Math.pow(clamp(gap / w.span, 0, 1), TUNING.focus);
      const asleep = shot.lapse && gap > shot.wake;
      const misjudged = asleep ? shot.lapseOff
        : shot.bias * p.readError * w.height * hard * far + shot.residual * p.aimError * w.paddleH * 0.5;
      // Good players take the ball off-centre to send it away from the opponent.
      const place = asleep || w.opponentY === undefined ? 0 : (w.opponentY < mid ? -1 : 1) * w.paddleH * p.strategy;
      want = landing + misjudged * pressure * sharp + place;
    } else {
      want = b.y + (mid + mind.habit * p.lean * w.height * 0.5 - b.y) * p.retreat;
    }
    want = clamp(want, w.top + w.paddleH / 2, w.bottom - w.paddleH / 2);

    // 3. Its hands. They re-aim a few times a second and land near the spot,
    // not on it.
    if (mind.goal === null || --mind.rereadIn <= 0) {
      mind.goal = want + bell(rand) * p.motor * (p.nerve ? pressure : 1);
      mind.rereadIn = Math.max(1, Math.round(p.reread * (0.7 + rand() * 0.6)));
    }
    const off = mind.goal - (w.paddleY + w.paddleH / 2);
    const move = Math.abs(off) <= p.slack ? 0 : clamp(off, -w.step, w.step);

    // 4. The dash: a late lunge when walking won't get there.
    let dash = 0;
    if (toward && mind.shot && mind.shot.willDash && w.dashReady && mind.dashRest === 0 && arrives <= p.dashLate) {
      const short = Math.abs(off) - w.paddleH * 0.3 - w.step * arrives;
      if (short > 0) {
        dash = (off > 0 ? 1 : -1) * (mind.shot.wrongDash ? -1 : 1);
        mind.shot.willDash = false;
        mind.dashRest = TUNING.dashRest;
        mind.goal = null;                               // look again after the lunge
      }
    }
    return { move, dash };
  }

  return { PROFILES, TUNING, createMind, newPoint, think, projectY, nerves };
});
