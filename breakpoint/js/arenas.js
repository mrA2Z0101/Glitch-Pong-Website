// ============ BREAKPOINT — arena rules on the field ============
// Six of the twelve arena rules are carried out here; the other five hazards
// (light bar, hive tunnels, light beam, bad sector, gravity well) were already
// in js/entities.js, and GLITCH ARENA has none. Each class is what the rule
// looks like and where it touches the ball. The decisions (when a pulse fires,
// whether the defender blocks a shot, when the racks drop) are in js/rules.js.
//
// Loaded after js/entities.js, which declares HAZARDS.
'use strict';

// QUANTUM REACTOR — the core charges up, then throws every ball near it outward.
class ReactorPulse {
  constructor() { this.x = CFG.W / 2; this.y = Rules.ARENA_TUNING.pulse.y; this.s = { t: 2 }; this.charge = 0; this.ring = 0; }
  update(dt, g) {
    this.x = CFG.W / 2;
    const tick = Rules.pulseTick(this.s, dt);
    this.charge = tick.charge;
    this.ring = Math.max(0, this.ring - dt * 1.6);
    if (!tick.fired) return;
    this.ring = 1;
    let thrown = 0;
    for (const b of g.balls) if (!b.stuck && !b.dead && Rules.pulseKick(b, this.x, this.y)) thrown++;
    AudioSys.sfx(thrown ? 'emp' : 'wall');
    FX.spawn(this.x, this.y, COL.green, 26, { spd: 380 });
    if (thrown) { FX.shake(5); FX.flash(COL.green, 0.12); }
  }
  render(ctx) {
    const R = Rules.ARENA_TUNING.pulse.radius;
    ctx.save(); ctx.translate(this.x, this.y);
    // the reach, shown faintly all the time and brightly while it charges
    ctx.strokeStyle = COL.green; ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.1 + this.charge * 0.45;
    ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    if (this.charge > 0) {                       // a ring closing on the core counts it down
      ctx.globalAlpha = 0.25 + this.charge * 0.5;
      ctx.beginPath(); ctx.arc(0, 0, R * (1 - this.charge) + 16, 0, 7); ctx.stroke();
    }
    if (this.ring > 0) {                         // the pulse itself
      ctx.globalAlpha = this.ring * 0.8; ctx.lineWidth = 4;
      ctx.shadowColor = COL.green; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, R * (1 - this.ring) + 10, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowColor = COL.green; ctx.shadowBlur = 10 + this.charge * 22;
    ctx.fillStyle = this.charge > 0 ? '#eafff5' : COL.green;
    ctx.beginPath(); ctx.arc(0, 0, 8 + this.charge * 6, 0, 7); ctx.fill();
    ctx.restore();
  }
}

// MEMORY LEAK — nothing on the field: the paddle itself gets shorter (the game
// keeps the count). This draws how much is left, under the paddle.
class LeakGauge {
  update() {}
  render(ctx, g) {
    const p = g.paddle, k = g.paddleScale;
    if (!p || k >= 0.999) return;
    const full = p.baseW * (p.wideT > 0 ? 1.45 : 1), y = p.y + p.h / 2 + 7;
    ctx.save();
    ctx.strokeStyle = COL.violet; ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
    ctx.setLineDash([3, 4]);
    ctx.strokeRect(p.x - full / 2, p.y - p.h / 2, full, p.h);      // the length it had
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8; ctx.fillStyle = COL.violet;
    ctx.font = '700 10px Orbitron, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('LEAKING ' + Math.round(k * 100) + '%', p.x, y);
    ctx.restore();
  }
}

// AI MAINFRAME — the machine's own paddle. It slides toward a ball on its way
// up and knocks it back down; a falling ball passes through.
class Defender {
  constructor() { this.d = { x: CFG.W * 0.2, rest: 0 }; this.prev = new WeakMap(); this.flash = 0; }
  get x() { return this.d.x; }
  update(dt, g) {
    const t = Rules.ARENA_TUNING.defender;
    this.flash = Math.max(0, this.flash - dt * 4);
    Rules.defenderStep(this.d, g.balls, dt, CFG.W);
    for (const b of g.balls) {
      if (b.stuck || b.dead) { this.prev.delete(b); continue; }
      const prevY = this.prev.has(b) ? this.prev.get(b) : b.y;
      if (Rules.defenderBlocks(this.d, b, prevY)) {
        b.vy = Math.abs(b.vy);
        b.y = t.y + t.height / 2 + b.r + 1;
        this.d.rest = t.rest;                      // it reboots: the next shot gets through
        this.flash = 1;
        AudioSys.sfx('wall');
        FX.spawn(b.x, b.y, COL.blue, 8, { spd: 150, dir: Math.PI / 2, spread: 1.6 });
        FX.text(b.x, b.y + 22, 'BLOCKED', COL.blue, 10);
      }
      this.prev.set(b, b.y);
    }
  }
  render(ctx) {
    const t = Rules.ARENA_TUNING.defender, x = this.d.x - t.width / 2, y = t.y - t.height / 2;
    ctx.save();
    ctx.strokeStyle = COL.blue; ctx.globalAlpha = 0.14; ctx.lineWidth = 1;   // the rail it runs on
    ctx.setLineDash([2, 10]);
    ctx.beginPath(); ctx.moveTo(0, t.y); ctx.lineTo(CFG.W, t.y); ctx.stroke();
    ctx.setLineDash([]);
    const down = this.d.rest > 0;                  // rebooting: dim, flickering, and nothing to fear
    ctx.globalAlpha = down ? 0.22 + 0.1 * Math.sin(this.d.rest * 30) : 1;
    ctx.shadowColor = COL.blue; ctx.shadowBlur = down ? 0 : 14 + this.flash * 16;
    ctx.fillStyle = this.flash > 0 ? '#fff' : COL.blue;
    ctx.fillRect(x, y, t.width, t.height);
    if (down) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = COL.blue;
      ctx.font = '700 9px Orbitron, monospace'; ctx.textAlign = 'center';
      ctx.fillText('REBOOTING ' + Math.ceil(this.d.rest), this.d.x, y - 6);
      ctx.restore();
      return;
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillRect(x + 3, y + t.height - 4, t.width - 6, 2);                    // lit along its underside: that's the face that blocks
    ctx.fillStyle = COL.white;
    ctx.fillRect(x - 2, y, 4, t.height); ctx.fillRect(x + t.width - 2, y, 4, t.height);
    ctx.restore();
  }
}

// DATA TUNNEL — there are no side walls (Ball.update wraps the ball). This draws
// the two openings and lights the one a ball is about to go through.
class SideWrap {
  constructor() { this.t = 0; this.hot = [0, 0]; }
  update(dt, g) {
    this.t += dt;
    this.hot[0] = Math.max(0, this.hot[0] - dt * 3); this.hot[1] = Math.max(0, this.hot[1] - dt * 3);
    for (const b of g.balls) {
      if (b.stuck || b.dead) continue;
      if (b.wrapped) {                                           // set by Ball.update on the frame it crossed
        b.wrapped = false;
        this.hot = [1, 1];
        AudioSys.sfx('teleport');
        FX.spawn(b.x, b.y, COL.cyan, 8, { spd: 130 });
      }
    }
  }
  render(ctx) {
    const line = Rules.wrapLine(CFG.PADDLE_Y);                    // open above this, solid wall below
    ctx.save();
    for (const side of [0, 1]) {
      const x = side ? CFG.W : 0, dir = side ? -1 : 1;
      const g = ctx.createLinearGradient(x, 0, x + dir * 26, 0);
      g.addColorStop(0, `rgba(113,239,255,${(0.2 + this.hot[side] * 0.5).toFixed(2)})`); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(side ? CFG.W - 26 : 0, 0, 26, line);
      ctx.fillStyle = 'rgba(113,239,255,.75)';                    // the solid stretch of wall beside the paddle
      ctx.fillRect(side ? CFG.W - 4 : 0, line, 4, CFG.H - line);
      ctx.fillRect(side ? CFG.W - 16 : 0, line - 1, 16, 2);
      ctx.fillStyle = 'rgba(113,239,255,.55)';
      for (let y = (this.t * 40) % 46; y < line - 14; y += 46) {  // chevrons pointing out through the wall
        ctx.beginPath(); ctx.moveTo(x + dir * 12, y); ctx.lineTo(x + dir * 4, y + 6); ctx.lineTo(x + dir * 12, y + 12); ctx.lineTo(x + dir * 9, y + 6); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// INFINITE SERVER — the whole wall of bricks drops a row on a timer, until it is
// as low as it is allowed to go.
class RackDescent {
  constructor() { this.s = { t: 0 }; this.warn = 0; this.done = false; this.dropT = 0; }
  lowest(g) {
    let low = 0;
    for (const b of g.bricks) if (b.alive && b.type !== 'barrier') low = Math.max(low, b.y + b.h);
    return low;
  }
  update(dt, g) {
    this.dropT = Math.max(0, this.dropT - dt * 2.5);
    if (g.state !== 'play' || g.eventFlags.timeFreeze) return;
    this.done = !Rules.descendRoom(this.lowest(g), CFG.PADDLE_Y);
    if (this.done) { this.warn = 0; this.s.t = 0; return; }
    const tick = Rules.descendTick(this.s, dt);
    this.warn = tick.warn;
    if (!tick.drop) return;
    const step = Rules.ARENA_TUNING.descend.step;
    for (const b of g.bricks) {
      if (!b.alive || b.type === 'barrier') continue;
      b.y += step;
      if (b.type === 'rotating') b.cy += step;
      b.flashT = 0.12;
    }
    this.dropT = 1;
    AudioSys.sfx('heavy');
    FX.shake(3);
    FX.text(CFG.W / 2, CFG.BRICK_TOP - 18, 'RACKS DROPPED', COL.green, 13);
  }
  render(ctx, g) {
    const low = this.lowest(g);
    if (!low) return;
    ctx.save();
    const step = Rules.ARENA_TUNING.descend.step;
    if (this.warn > 0 && !this.done) {             // where the wall is about to be
      ctx.strokeStyle = COL.green; ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.25 + 0.5 * this.warn * (0.6 + 0.4 * Math.sin(this.warn * 40));
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(0, low + step); ctx.lineTo(CFG.W, low + step); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL.green; ctx.font = '700 10px Orbitron, monospace'; ctx.textAlign = 'right';
      ctx.fillText('DROP IN ' + Math.max(1, Math.ceil((1 - this.warn) * Rules.ARENA_TUNING.descend.warn)), CFG.W - 12, low + step - 6);
    }
    ctx.globalAlpha = 0.16; ctx.strokeStyle = COL.green; ctx.lineWidth = 1;   // as low as it goes
    const stop = CFG.PADDLE_Y - Rules.ARENA_TUNING.descend.gap;
    ctx.beginPath(); ctx.moveTo(0, stop); ctx.lineTo(CFG.W, stop); ctx.stroke();
    ctx.restore();
  }
}

// BROKEN SIMULATION — sideways gravity that swings back and forth (Ball.update
// applies it). This shows which way it is pulling and how hard.
class DriftWind {
  constructor() { this.t = 0; this.streaks = Array.from({ length: 14 }, (_, i) => ({ x: (i * 0.618 % 1) * CFG.W, y: 60 + (i * 0.381 % 1) * (CFG.H - 140) })); }
  update(dt, g) {
    this.t = g.time;
    const pull = Rules.driftAccel(g.time);
    for (const s of this.streaks) {
      s.x += pull * dt * 1.4;
      if (s.x < -40) s.x += CFG.W + 80; else if (s.x > CFG.W + 40) s.x -= CFG.W + 80;
    }
  }
  render(ctx) {
    const pull = Rules.driftAccel(this.t), k = pull / Rules.ARENA_TUNING.drift.accel;   // -1 .. 1
    ctx.save();
    ctx.strokeStyle = COL.red; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.12 + Math.abs(k) * 0.3;
    ctx.beginPath();
    for (const s of this.streaks) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - k * 46, s.y); }
    ctx.stroke();
    // a gauge at the top: the needle leans the way the ball will be pulled
    const cx = CFG.W / 2, y = 54, w = 120;
    ctx.globalAlpha = 0.5; ctx.strokeStyle = COL.red; ctx.lineWidth = 1;
    ctx.strokeRect(cx - w / 2, y - 4, w, 8);
    ctx.globalAlpha = 0.9; ctx.fillStyle = COL.red;
    ctx.fillRect(cx, y - 3, k * (w / 2 - 2), 6);
    ctx.font = '700 9px Orbitron, monospace'; ctx.textAlign = 'center';
    ctx.fillText(Math.abs(k) < 0.15 ? 'DRIFT' : k < 0 ? '◀ DRIFT' : 'DRIFT ▶', cx, y - 9);
    ctx.restore();
  }
}

Object.assign(HAZARDS, {
  reactorPulse: ReactorPulse, leakGauge: LeakGauge, defender: Defender,
  sideWrap: SideWrap, rackDescent: RackDescent, driftWind: DriftWind,
});
