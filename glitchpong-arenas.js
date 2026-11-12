"use strict";

// Rules for the Glitch Pong maps that change how a rally plays.
//
// Four change the court:
//   penalty   PENALTY BOX     only the middle of each end wall is a goal
//   overflow  STACK OVERFLOW  the top and bottom walls wrap instead of bounce
//   leak      MEMORY LEAK     the court narrows with every return
//   defrag    DEFRAG          the top and bottom walls are jagged and rearrange
//
// Four change the ball, or the paddles that meet it:
//   freefall  FREEFALL        the ball has gravity, which flips at Critical Heat
//   coolant   COOLANT LEAK    paddles slide on ice until Heat melts it
//   rooftop   ROOFTOP         wind pushes the ball along the court
//   beat      BEAT DROP       a return hit on the beat comes off faster
//
// Nothing here touches the page or the canvas: glitchpong-site.js owns the
// drawing and calls in with a description of the court. That keeps the rules
// testable under Node (tests/arenas.test.mjs). See docs/arenas.md.
//
// A court is { width, height, leftFace, rightFace, leftWall, rightWall, ballR,
// paddleH, xScale }: the paddle faces, the end-wall faces behind them, and how
// many pixels one unit of the ball's horizontal speed covers. A ball is
// { x, y, vx, vy } with vy in pixels a frame.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlitchArenas = api;
})(typeof self !== "undefined" ? self : this, function () {
  const IDS = ["penalty", "overflow", "leak", "defrag", "freefall", "coolant", "rooftop", "beat"];

  const TUNING = {
    vyMax: 9,                 // the same cap a paddle hit puts on vertical speed

    // PENALTY BOX
    mouth: 0.52,              // goal mouth as a share of court height
    mouthMinPaddles: 1.5,     // ...but never less than this many paddles
    driftSpeed: 0.021,        // radians a frame once the mouths start drifting
    driftOffset: 2.4,         // the right mouth runs this far out of step with the left

    // STACK OVERFLOW
    seamHeat: 0.5,            // Heat ratio where the seam starts to shift
    seamMax: 0.16,            // largest shift, as a share of the gap between the paddles
    seamSpeed: 0.016,         // radians a frame
    seamPad: 0.06,            // a shifted ball never re-enters closer to a paddle than this share of the gap

    // MEMORY LEAK
    leakReturns: 16,          // returns until the corridor is at its narrowest
    leakMinPaddles: 2.2,      // narrowest corridor, in paddle heights...
    leakMinShare: 0.36,       // ...or as a share of court height, whichever is taller

    // DEFRAG
    segments: 10,             // each wall is this many slanted blocks
    maxDepth: 0.15,           // how far a block can reach into the court (share of height)
    minDepth: 0.04,
    maxSlope: 0.3,            // rise over run of a block face
    shiftHeat: 0.5,           // Heat ratio where a wall starts shifting mid-rally
    shiftEvery: [300, 150],   // frames between shifts at 50% and at 100% Heat
    shiftWarn: 40,            // frames the new shape is outlined before the wall moves
    awaySpeed: 0.8,           // slowest a ball leaves a block face

    // FREEFALL
    gravity: 0.00017,         // pull on the ball each frame, per pixel of court height
    fallMax: 10,              // fastest the ball falls
    hop: 0.18,                // a bounce off the floor always rises at least this share of the height
    flipFrames: 36,           // how long gravity takes to turn over

    // COOLANT LEAK
    gripCold: 0.1,            // share of the asked-for speed a paddle picks up each frame on solid ice
    gripHeat: 0.8,            // Heat ratio where the ice is gone and paddles move as normal
    gripCurve: 1.5,           // above 1, grip comes back slowly at first
    rebound: 0.35,            // share of its speed a sliding paddle keeps when it hits the edge

    // ROOFTOP
    windCalm: 1.4,            // strongest gust at no Heat, in the ball's horizontal speed units
    windHeat: 1.8,            // extra gust strength at full Heat
    windShare: 0.45,          // wind never moves the ball by more than this share of its own speed
    gustEvery: [150, 360],    // frames between changes of wind
    strikeEvery: [150, 250],  // frames between lightning strikes at Critical Heat

    // BEAT DROP
    bpm: [104, 160],          // tempo at no Heat and at full Heat
    beatWindow: 5,            // a return this many frames either side of a beat is on it
    beatBoost: 0.14           // extra speed on an on-beat return (a Power Strike is 0.22)
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mod = (v, n) => ((v % n) + n) % n;

  function createState() {
    return {
      id: null,
      penalty: { amount: 0, phase: 0, flash: { left: 0, right: 0 } },
      overflow: { amount: 0, phase: 0, shift: 0, flash: 0 },
      leak: { returns: 0, inset: 0, snap: 0 },
      defrag: { top: [], bottom: [], topTarget: [], bottomTarget: [], rate: 1, timer: 0, warn: 0, pending: null, next: "top", moved: 0 },
      freefall: { dir: 1, want: 1, flip: 0 },
      coolant: { grip: TUNING.gripCold, v: { left: 0, right: 0 } },
      rooftop: { wind: 0, gust: 0, timer: 0, strikeIn: 0, flash: 0, struck: false, bolt: 0 },
      beat: { phase: 0, step: 0, ticked: false, bpm: TUNING.bpm[0], hit: 0, hitSide: null }
    };
  }

  // ── PENALTY BOX ──────────────────────────────────────────────────────────
  function mouthHeight(c) {
    return clamp(c.height * TUNING.mouth, Math.min(c.height, c.paddleH * TUNING.mouthMinPaddles), c.height * 0.8);
  }

  // The open part of an end wall: { top, bottom }. Everything else is post.
  function mouth(s, c, side) {
    if (s.id !== "penalty") return { top: 0, bottom: c.height };
    const h = mouthHeight(c);
    const travel = Math.max(0, (c.height - h) / 2 - 4);
    const phase = s.penalty.phase + (side === "right" ? TUNING.driftOffset : 0);
    const centre = c.height / 2 + travel * s.penalty.amount * Math.sin(phase);
    return { top: centre - h / 2, bottom: centre + h / 2 };
  }

  // Bounces the ball off a post. The ball keeps its colour, so the shooter has
  // to deal with their own shot coming back. Returns "left", "right" or null.
  // `ball.px` is where the ball was before this frame's move: only a ball that
  // crosses the wall face this frame can hit it. One already past the face went
  // in through the mouth, and is kept inside the goal until it scores.
  function posts(s, c, ball) {
    if (s.id !== "penalty") return null;
    const r = c.ballR, px = typeof ball.px === "number" ? ball.px : ball.x - ball.vx * c.xScale;
    for (const side of ["left", "right"]) {
      const dir = side === "left" ? -1 : 1, wall = side === "left" ? c.leftWall : c.rightWall;
      if (ball.vx * dir <= 0 || (ball.x + dir * r - wall) * dir < 0) continue;   // not at this wall
      const m = mouth(s, c, side);
      if ((px + dir * r - wall) * dir < 0) {
        if (ball.y >= m.top && ball.y <= m.bottom) return null;                  // through the mouth
        ball.x = wall - dir * r;
        ball.vx = -ball.vx;
        s.penalty.flash[side] = 1;
        return side;
      }
      if (ball.y - r < m.top) { ball.y = m.top + r; ball.vy = Math.abs(ball.vy); }
      else if (ball.y + r > m.bottom) { ball.y = m.bottom - r; ball.vy = -Math.abs(ball.vy); }
      return null;
    }
    return null;
  }

  // ── MEMORY LEAK ──────────────────────────────────────────────────────────
  function leakMaxInset(c) {
    const corridor = Math.min(c.height, Math.max(c.paddleH * TUNING.leakMinPaddles, c.height * TUNING.leakMinShare));
    return Math.max(0, (c.height - corridor) / 2);
  }

  function leakTarget(s, c) {
    const max = leakMaxInset(c);
    return Math.min(max, s.leak.returns * (max / TUNING.leakReturns));
  }

  // ── DEFRAG ───────────────────────────────────────────────────────────────
  // A wall is a row of slanted blocks: segments + 1 depths, joined by straight
  // faces. Both ends are flush with the screen edge so the paddles keep their
  // full travel.
  function makeProfile(c, rand) {
    const n = TUNING.segments;
    const step = TUNING.maxSlope * ((c.rightFace - c.leftFace) / n);
    const lo = TUNING.minDepth * c.height, hi = TUNING.maxDepth * c.height;
    const p = [0];
    let peak = rand() < 0.5;
    for (let i = 1; i < n; i++) {
      if (rand() < 0.75) peak = !peak;                   // mostly peak, valley, peak: a sawtooth, not a hill
      const share = peak ? 0.6 + rand() * 0.4 : rand() * 0.35;
      p.push(lo + (hi - lo) * share);
    }
    p.push(0);
    // No face steeper than maxSlope: shave whatever sticks up too far.
    for (let i = 1; i <= n; i++) p[i] = Math.min(p[i], p[i - 1] + step);
    for (let i = n - 1; i >= 0; i--) p[i] = Math.min(p[i], p[i + 1] + step);
    return p;
  }

  // Depth and slope (change in depth per pixel) of a wall under x.
  function profileAt(p, c, x) {
    const n = p.length - 1;
    if (n < 1) return { depth: 0, slope: 0 };
    const span = c.rightFace - c.leftFace;
    const t = (x - c.leftFace) / span * n;
    if (!(span > 0) || t <= 0 || t >= n) return { depth: 0, slope: 0 };
    const i = Math.min(n - 1, Math.floor(t));
    return { depth: p[i] + (p[i + 1] - p[i]) * (t - i), slope: (p[i + 1] - p[i]) / (span / n) };
  }

  function defragBounce(s, c, ball) {
    const vxp = ball.vx * c.xScale, r = c.ballR;
    const top = profileAt(s.defrag.top, c, ball.x);
    if (ball.y - r < top.depth) {
      // surface y = depth(x); the court is below it
      const k = top.slope, into = ball.vy - k * vxp;
      ball.y = top.depth + r;
      if (into >= 0) return null;                        // already leaving: the wall just moved under it
      ball.vy = clamp(Math.max(ball.vy - 2 * into / (1 + k * k), k * vxp + TUNING.awaySpeed), -TUNING.vyMax, TUNING.vyMax);
      return "top";
    }
    const bottom = profileAt(s.defrag.bottom, c, ball.x);
    if (ball.y + r > c.height - bottom.depth) {
      // surface y = height - depth(x); the court is above it
      const k = -bottom.slope, into = k * vxp - ball.vy;
      ball.y = c.height - bottom.depth - r;
      if (into >= 0) return null;
      ball.vy = clamp(Math.min(ball.vy + 2 * into / (1 + k * k), k * vxp - TUNING.awaySpeed), -TUNING.vyMax, TUNING.vyMax);
      return "bottom";
    }
    return null;
  }

  function shiftInterval(heatRatio) {
    const t = clamp((heatRatio - TUNING.shiftHeat) / (1 - TUNING.shiftHeat), 0, 1);
    return Math.round(TUNING.shiftEvery[0] + (TUNING.shiftEvery[1] - TUNING.shiftEvery[0]) * t);
  }

  // ── FREEFALL ─────────────────────────────────────────────────────────────
  // The pull on the ball this frame: positive is down the screen, negative up.
  function gravity(s, c) {
    return s.id === "freefall" ? TUNING.gravity * c.height * s.freefall.dir : 0;
  }

  // Vertical speed after a frame of gravity.
  function fall(s, c, vy) {
    if (s.id !== "freefall") return vy;
    return clamp(vy + gravity(s, c), -TUNING.fallMax, TUNING.fallMax);
  }

  // Slowest the ball leaves the surface gravity is pulling it onto, so it
  // never ends up rolling along the floor.
  function hopSpeed(s, c) {
    return Math.sqrt(2 * Math.abs(gravity(s, c)) * TUNING.hop * c.height);
  }

  // ── COOLANT LEAK ─────────────────────────────────────────────────────────
  // Where a paddle ends up this frame. `fromY` is where it was, `wantY` where
  // its player or the AI put it, and `jump` how much of that move was a dash
  // (a dash is a blink and does not slide). The rest is what was asked for; on
  // ice the paddle only picks up part of it, and keeps moving after the input
  // stops. With full grip this returns wantY unchanged.
  function slide(s, side, fromY, wantY, jump, lo, hi) {
    if (s.id !== "coolant") return wantY;
    const st = s.coolant;
    let v = st.v[side];
    v += (wantY - fromY - jump - v) * st.grip;
    let y = fromY + jump + v;
    if (y < lo) { y = lo; v = Math.abs(v) * TUNING.rebound; }
    else if (y > hi) { y = hi; v = -Math.abs(v) * TUNING.rebound; }
    st.v[side] = v;
    return y;
  }

  // ── ROOFTOP ──────────────────────────────────────────────────────────────
  // How far the wind carries a ball moving at `vx` this frame, in the same
  // units as vx. Positive is towards the right paddle. It is added to the
  // ball's movement, never to its speed, and never enough to stop the ball.
  function drift(s, vx) {
    if (s.id !== "rooftop") return 0;
    const most = Math.abs(vx) * TUNING.windShare;
    return clamp(s.rooftop.wind, -most, most);
  }

  // ── BEAT DROP ────────────────────────────────────────────────────────────
  // How many frames the clock is from the nearest beat.
  function beatDistance(s) {
    const part = s.beat.phase - Math.floor(s.beat.phase);
    return Math.min(part, 1 - part) * (3600 / s.beat.bpm);
  }

  function onBeat(s) {
    return s.id === "beat" && beatDistance(s) <= TUNING.beatWindow;
  }

  // Extra speed for a return made now. Call it once, when a paddle hits.
  function returnBoost(s, side) {
    if (!onBeat(s)) return 0;
    s.beat.hit = 1;
    s.beat.hitSide = side;
    return TUNING.beatBoost;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  // Begin a match on `id`. Anything that isn't one of the four maps (another
  // arena, an online match, the menu) switches every rule off.
  function start(s, id, c, rand = Math.random) {
    Object.assign(s, createState());
    s.id = IDS.includes(id) ? id : null;
    if (s.id === "defrag" && c) {
      s.defrag.top = makeProfile(c, rand);
      s.defrag.bottom = makeProfile(c, rand);
      s.defrag.topTarget = s.defrag.top.slice();
      s.defrag.bottomTarget = s.defrag.bottom.slice();
      s.defrag.timer = TUNING.shiftEvery[0];
    }
    return s.id;
  }

  // A point was scored, or the Eye left: the next serve is coming.
  function roundReset(s, c, rand = Math.random) {
    if (s.id === "leak") {
      if (s.leak.returns > 0) s.leak.snap = 1;
      s.leak.returns = 0;
    } else if (s.id === "defrag") {
      s.defrag.topTarget = makeProfile(c, rand);
      s.defrag.bottomTarget = makeProfile(c, rand);
      s.defrag.rate = 0.28;                              // settles inside the pause between points
      s.defrag.pending = null;
      s.defrag.warn = 0;
      s.defrag.timer = TUNING.shiftEvery[0];
      s.defrag.moved = 1;
    } else if (s.id === "rooftop") {
      s.rooftop.gust = 0;                                // every serve starts in a lull
      s.rooftop.timer = 90;
      s.rooftop.strikeIn = 0;
    }
  }

  // A paddle returned the ball.
  function onReturn(s) {
    if (s.id === "leak") s.leak.returns += 1;
  }

  // The Eye needs the whole court: its shots are aimed across the full height.
  function openCourt(s) {
    if (s.id === "leak" && s.leak.returns > 0) { s.leak.returns = 0; s.leak.snap = 1; }
  }

  // Once a frame. `live` is false whenever the ball is not in play.
  function update(s, c, heatRatio, critical, live, rand = Math.random) {
    if (s.id === "penalty") {
      const p = s.penalty, want = critical && live ? 1 : 0;
      p.amount += (want - p.amount) * (want > p.amount ? 0.04 : 0.08);
      if (p.amount < 0.001) p.amount = 0;
      if (p.amount > 0) p.phase += TUNING.driftSpeed;
      p.flash.left = Math.max(0, p.flash.left - 0.06);
      p.flash.right = Math.max(0, p.flash.right - 0.06);
    } else if (s.id === "overflow") {
      const o = s.overflow;
      const want = live ? clamp((heatRatio - TUNING.seamHeat) / (1 - TUNING.seamHeat), 0, 1) : 0;
      o.amount += (want - o.amount) * 0.05;
      if (o.amount < 0.001) o.amount = 0;
      if (o.amount > 0) o.phase += TUNING.seamSpeed;
      o.shift = o.amount ? o.amount * TUNING.seamMax * (c.rightFace - c.leftFace) * Math.sin(o.phase) : 0;
      o.flash = Math.max(0, o.flash - 0.07);
    } else if (s.id === "leak") {
      const l = s.leak, want = leakTarget(s, c);
      l.inset += (want - l.inset) * (want < l.inset ? 0.3 : 0.16);
      if (Math.abs(want - l.inset) < 0.05) l.inset = want;
      l.snap = Math.max(0, l.snap - 0.05);
    } else if (s.id === "defrag") {
      const d = s.defrag;
      if (live && heatRatio >= TUNING.shiftHeat) {
        if (d.pending) {
          if (--d.warn <= 0) {
            d[d.pending.wall + "Target"] = d.pending.profile;
            d.rate = 0.07;                               // slow enough to read while the ball is moving
            d.pending = null;
            d.moved = 1;
          }
        } else if (--d.timer <= 0) {
          d.pending = { wall: d.next, profile: makeProfile(c, rand) };
          d.next = d.next === "top" ? "bottom" : "top";
          d.warn = TUNING.shiftWarn;
          d.timer = shiftInterval(heatRatio);
        }
      } else if (d.pending) {
        d.pending = null;
        d.warn = 0;
      }
      for (const wall of ["top", "bottom"]) {
        const cur = d[wall], target = d[wall + "Target"];
        for (let i = 0; i < cur.length; i++) {
          cur[i] += (target[i] - cur[i]) * d.rate;
          if (Math.abs(target[i] - cur[i]) < 0.05) cur[i] = target[i];
        }
      }
      d.moved = Math.max(0, d.moved - 0.04);
    } else if (s.id === "freefall") {
      const f = s.freefall, want = critical && live ? -1 : 1;
      if (want !== f.want) { f.want = want; f.flip = 1; }
      f.dir += clamp(want - f.dir, -2 / TUNING.flipFrames, 2 / TUNING.flipFrames);
      f.flip = Math.max(0, f.flip - 0.012);
    } else if (s.id === "coolant") {
      const melt = clamp(heatRatio / TUNING.gripHeat, 0, 1);
      s.coolant.grip = TUNING.gripCold + (1 - TUNING.gripCold) * Math.pow(melt, TUNING.gripCurve);
    } else if (s.id === "rooftop") {
      const r = s.rooftop, strongest = TUNING.windCalm + TUNING.windHeat * heatRatio;
      const between = (range) => range[0] + rand() * (range[1] - range[0]);
      r.struck = false;
      if (!live) {
        r.gust = 0;
      } else {
        if (--r.timer <= 0) {
          // one gust in five is a lull; the rest blow one way or the other
          r.gust = rand() < 0.2 ? 0 : (rand() < 0.5 ? -1 : 1) * (0.45 + rand() * 0.55);
          r.timer = Math.round(between(TUNING.gustEvery));
        }
        if (critical && --r.strikeIn <= 0) {
          // Lightning: the wind turns round at full strength.
          r.gust = r.gust > 0 || (r.gust === 0 && rand() < 0.5) ? -1 : 1;
          r.timer = Math.round(between(TUNING.gustEvery));
          r.strikeIn = Math.round(between(TUNING.strikeEvery));
          r.flash = 1;
          r.struck = true;
          r.bolt = rand();
        }
        if (!critical) r.strikeIn = Math.min(r.strikeIn, 20);     // the first strike comes soon after Critical Heat
      }
      r.wind += (r.gust * strongest - r.wind) * (r.flash > 0.5 ? 0.12 : 0.03);
      if (Math.abs(r.wind) < 0.001 && r.gust === 0) r.wind = 0;
      r.flash = Math.max(0, r.flash - 0.045);
    } else if (s.id === "beat") {
      // The beat runs whenever the match does, so the music never stops between points.
      const b = s.beat;
      b.bpm = TUNING.bpm[0] + (TUNING.bpm[1] - TUNING.bpm[0]) * clamp(heatRatio, 0, 1);
      b.phase += b.bpm / 3600;
      const step = Math.floor(b.phase * 2);              // eighth notes
      b.ticked = step !== b.step;
      b.step = step;
      b.hit = Math.max(0, b.hit - 0.05);
    }
  }

  // ── Where the court is ───────────────────────────────────────────────────
  function topAt(s, c, x) {
    if (s.id === "leak") return s.leak.inset;
    if (s.id === "defrag") return profileAt(s.defrag.top, c, x).depth;
    return 0;
  }

  function bottomAt(s, c, x) {
    if (s.id === "leak") return c.height - s.leak.inset;
    if (s.id === "defrag") return c.height - profileAt(s.defrag.bottom, c, x).depth;
    return c.height;
  }

  // A band that is clear of the walls all the way across, for placing things.
  function band(s, c) {
    if (s.id === "leak") return { top: s.leak.inset, bottom: c.height - s.leak.inset };
    if (s.id === "defrag") {
      const d = s.defrag;
      const deepest = (...lists) => Math.max(0, ...lists.map((p) => Math.max(0, ...p)));
      return {
        top: deepest(d.top, d.topTarget, d.pending && d.pending.wall === "top" ? d.pending.profile : []),
        bottom: c.height - deepest(d.bottom, d.bottomTarget, d.pending && d.pending.wall === "bottom" ? d.pending.profile : [])
      };
    }
    return { top: 0, bottom: c.height };
  }

  // How far a paddle can travel. Only MEMORY LEAK squeezes the paddles.
  function paddleBand(s, c) {
    if (s.id === "leak") return { top: s.leak.inset, bottom: c.height - s.leak.inset };
    return { top: 0, bottom: c.height };
  }

  // Where a ball heading for y will actually be. Paddle AI uses it.
  function predictY(s, c, y) {
    if (s.id === "overflow") return mod(y, c.height);
    return y;
  }

  // Where a ball at y, moving at vy, will be in `frames` frames. Paddle AI
  // uses it, so it reads a falling ball as an arc and a wrapping one as a wrap.
  function aimY(s, c, y, vy, frames) {
    if (s.id !== "freefall") return predictY(s, c, y + vy * frames);
    const g = gravity(s, c), top = c.ballR, bottom = c.height - c.ballR;
    for (let i = 0; i < frames; i++) {
      vy = clamp(vy + g, -TUNING.fallMax, TUNING.fallMax);
      y += vy;
      if (y > bottom) { y = bottom; vy = -Math.abs(vy); }
      else if (y < top) { y = top; vy = Math.abs(vy); }
    }
    return y;
  }

  // ── The top and bottom walls ─────────────────────────────────────────────
  // Moves the ball out of a wall and turns it round, or wraps it. Returns
  // null, { type: "bounce", wall } or { type: "wrap", dir, fromX, toX } where
  // dir is -1 for a ball that left through the top and 1 through the bottom.
  function walls(s, c, ball) {
    if (s.id === "overflow") {
      if (ball.y >= 0 && ball.y < c.height) return null;
      const dir = ball.y < 0 ? -1 : 1, fromX = ball.x;
      ball.y = mod(ball.y, c.height);
      // A ball already past a paddle is on its way out; leave it alone.
      if (s.overflow.shift && ball.x > c.leftFace && ball.x < c.rightFace) {
        const pad = c.ballR + TUNING.seamPad * (c.rightFace - c.leftFace);
        ball.x = clamp(ball.x + dir * s.overflow.shift, Math.min(c.leftFace + pad, fromX), Math.max(c.rightFace - pad, fromX));
      }
      s.overflow.flash = 1;
      return { type: "wrap", dir, fromX, toX: ball.x };
    }
    if (s.id === "defrag") {
      const wall = defragBounce(s, c, ball);
      return wall ? { type: "bounce", wall } : null;
    }
    const top = topAt(s, c, ball.x) + c.ballR, bottom = bottomAt(s, c, ball.x) - c.ballR;
    if (ball.y <= top) {
      ball.y = top;
      if (ball.vy > 0) return null;                      // the wall caught up with a ball already moving away
      ball.vy = -ball.vy;
      if (s.id === "freefall" && s.freefall.dir < 0) ball.vy = Math.max(ball.vy, hopSpeed(s, c));
      return { type: "bounce", wall: "top" };
    }
    if (ball.y >= bottom) {
      ball.y = bottom;
      if (ball.vy < 0) return null;
      ball.vy = -ball.vy;
      if (s.id === "freefall" && s.freefall.dir > 0) ball.vy = Math.min(ball.vy, -hopSpeed(s, c));
      return { type: "bounce", wall: "bottom" };
    }
    return null;
  }

  return {
    IDS, TUNING, createState, start, roundReset, onReturn, openCourt, update,
    mouth, posts, walls, topAt, bottomAt, band, paddleBand, predictY, aimY,
    makeProfile, profileAt, leakMaxInset,
    gravity, fall, hopSpeed, slide, drift, beatDistance, onBeat, returnBoost
  };
});
