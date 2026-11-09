// ============ GLITCH BREAKOUT — entities ============
'use strict';

// ---------------- Paddle ----------------
class Paddle {
  constructor(g) {
    this.g = g;
    this.baseW = CFG.PADDLE_W * (1 + 0.12 * g.meta.rank('pad_len'));
    this.w = this.baseW;
    this.h = CFG.PADDLE_H;
    this.x = CFG.W / 2;
    this.y = CFG.PADDLE_Y;
    this.speed = CFG.PADDLE_SPD * (1 + 0.14 * g.meta.rank('pad_spd'));
    this.magnet = g.meta.rank('magnet') > 0;
    this.magnetT = 0;      // timed magnet powerup
    this.wideT = 0;
    this.laserT = 0;       // timed laser powerup
    this.stun = 0;
    this.glow = 0;
  }
  get magnetic() { return this.magnet || this.magnetT > 0; }
  get hasLaser() { return this.laserT > 0; }
  update(dt, input) {
    if (this.stun > 0) this.stun -= dt;
    const mir = this.g.mods.mirror ? -1 : 1;
    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    move *= mir;
    const spd = this.speed * (this.stun > 0 ? 0.35 : 1);
    if (move) { this.x += move * spd * dt; this.usingMouse = false; }
    else if (input.mouseActive) {
      const tx = this.g.mods.mirror ? CFG.W - input.mouseX : input.mouseX;
      this.x = lerp(this.x, tx, clamp(dt * 18, 0, 1));
    }
    this.wideT = Math.max(0, this.wideT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.laserT = Math.max(0, this.laserT - dt);
    this.w = this.baseW * (this.wideT > 0 ? 1.45 : 1);
    this.x = clamp(this.x, this.w / 2 + 4, CFG.W - this.w / 2 - 4);
    this.glow = Math.max(0, this.glow - dt * 3);
  }
  render(ctx) {
    const { x, y, w, h } = this;
    // your Glitch Pong paddle colour, unless a powerup is recolouring it
    const col = this.hasLaser ? COL.red : this.magnetic ? COL.violet : PaddleColor.hex;
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 16 + this.glow * 20;
    ctx.fillStyle = col;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, 3);
    // edge nodes
    ctx.fillStyle = COL.white;
    ctx.fillRect(x - w / 2 - 2, y - h / 2, 4, h);
    ctx.fillRect(x + w / 2 - 2, y - h / 2, 4, h);
    if (this.hasLaser) {
      ctx.fillStyle = COL.red;
      ctx.fillRect(x - w / 2, y - h / 2 - 6, 3, 6);
      ctx.fillRect(x + w / 2 - 3, y - h / 2 - 6, 3, 6);
    }
    if (this.stun > 0 && Math.floor(this.stun * 12) % 2) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = COL.red;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
    }
    ctx.restore();
  }
}

// ---------------- Ball ----------------
class Ball {
  constructor(x, y, angle, speed) {
    this.x = x; this.y = y;
    this.r = CFG.BALL_R;
    this.speed = speed || CFG.BALL_SPD;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.stuck = false; this.stuckDx = 0;
    this.fire = 0; this.pierce = 0; this.boom = 0; this.grav = 0; // timed flags (seconds)
    this.trail = [];
    this.dead = false;
    this.invisible = 0;
    // sentience (see Game.sentientSteer): paddle returns since this ball last
    // broke a brick, and its current mood — null, 'bored' or 'grudge'
    this.dull = 0;
    this.mood = null;
    this.rampage = 0;          // bricks broken since it got behind the wall (0 = not rampaging)
    this.rampaging = false;
    this.breaks = 0;           // bricks broken this multi-ball (sibling rivalry)
    this.protecting = null;    // the enemy it's going after for stunning your paddle
  }
  get color() {
    if (this.fire > 0) return COL.orange;
    if (this.pierce > 0) return COL.magenta;
    if (this.boom > 0) return COL.red;
    if (this.grav > 0) return COL.violet;
    if (this.rampaging) return '#ffd166';
    if (this.mood === 'protective') return '#ff8a3d';
    if (this.mood === 'bored') return '#8d97ad';
    if (this.mood === 'grudge') return '#ff8fb8';
    return COL.white;
  }
  setSpeed(s) {
    this.speed = clamp(s, 140, CFG.BALL_MAX);
    const m = Math.hypot(this.vx, this.vy) || 1;
    this.vx = this.vx / m * this.speed;
    this.vy = this.vy / m * this.speed;
  }
  // `recordTrail` is false on all but the last physics sub-step of a frame,
  // so sub-stepping fast balls doesn't shorten the visual trail
  update(dt, g, recordTrail = true) {
    for (const k of ['fire', 'pierce', 'boom', 'grav']) if (this[k] > 0) this[k] -= dt;
    this.invisible = Math.max(0, this.invisible - dt);
    if (this.stuck) {
      const p = g.paddle;
      this.x = clamp(p.x + this.stuckDx, this.r, CFG.W - this.r);
      this.y = p.y - p.h / 2 - this.r - 1;
      return;
    }
    // gravity influences
    let gy = 0;
    if (this.grav > 0) gy += 300;
    if (g.mods.randGravity) gy += Math.sin(g.time * 0.7) * 260;
    if (gy) { this.vy += gy * dt; }
    else {
      // renormalize to speed (momentum preservation)
      const m = Math.hypot(this.vx, this.vy) || 1;
      this.vx = this.vx / m * this.speed;
      this.vy = this.vy / m * this.speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // avoid flat horizontal loops
    if (Math.abs(this.vy) < this.speed * 0.14) this.vy += (this.vy >= 0 ? 1 : -1) * this.speed * 0.02;

    // walls
    const wallL = g.wallInsetL || 0, wallR = CFG.W - (g.wallInsetR || 0);
    if (this.x < wallL + this.r) { this.x = wallL + this.r; this.vx = Math.abs(this.vx); g.onWallHit(this); }
    if (this.x > wallR - this.r) { this.x = wallR - this.r; this.vx = -Math.abs(this.vx); g.onWallHit(this); }
    if (this.y < this.r + 2) { this.y = this.r + 2; this.vy = Math.abs(this.vy); g.onWallHit(this); }
    if (this.y > CFG.H + 40) this.dead = true;

    if (!recordTrail) return;
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.pop();
  }
  render(ctx) {
    if (this.invisible > 0 && Math.floor(this.invisible * 10) % 2 === 0) return;
    ctx.save();
    // trail
    for (let i = this.trail.length - 1; i > 0; i--) {
      const t = this.trail[i], a = 1 - i / this.trail.length;
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = this.color;
      const s = this.r * 2 * a;
      ctx.fillRect(t.x - s / 2, t.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = this.color; ctx.shadowBlur = 18;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.x - 2, this.y - 2, this.r * 0.4, 0, 7); ctx.fill();
    ctx.restore();
  }
}

// ---------------- Brick ----------------
let BRICK_ID = 0;
class Brick {
  constructor(x, y, type) {
    const def = BRICKS[type];
    this.id = ++BRICK_ID;
    this.x = x; this.y = y;
    this.w = CFG.BRICK_W; this.h = CFG.BRICK_H;
    this.type = type;
    this.hp = def.hp; this.maxHp = Math.max(1, def.hp);
    this.alive = true;
    this.flashT = 0;
    this.life = 0;        // for temporary (barrier) bricks
    // type-specific state
    this.timer = rand(1.5, 4);
    this.visT = rand(0.5, 3);   // invisible cycle
    this.vx = type === 'moving' ? (chance(0.5) ? 40 : -40) : 0;
    if (type === 'rotating') {
      this.cx = x; this.cy = y + 40;
      this.orbitR = rand(30, 55); this.ang = rand(0, 7); this.angV = rand(0.5, 1.1) * (chance(0.5) ? 1 : -1);
    }
    this.corrupt = 0;     // visual corruption 0..1
  }
  get cxm() { return this.x + this.w / 2; }
  get cym() { return this.y + this.h / 2; }
  morph(type) {
    const def = BRICKS[type];
    this.type = type;
    this.hp = def.hp; this.maxHp = Math.max(1, def.hp);
    this.flashT = 0.3;
  }
  update(dt, g) {
    this.flashT = Math.max(0, this.flashT - dt);
    // temporary (firewall barrier) bricks must expire even while time is frozen
    if (this.life > 0) { this.life -= dt; if (this.life <= 0) { this.alive = false; return; } }
    if (g.eventFlags.timeFreeze) return;
    this.timer -= dt;
    switch (this.type) {
      case 'moving': {
        this.x += this.vx * dt;
        if (this.x < 8 || this.x + this.w > CFG.W - 8) this.vx *= -1;
        break;
      }
      case 'rotating': {
        this.ang += this.angV * dt;
        this.x = this.cx + Math.cos(this.ang) * this.orbitR - this.w / 2;
        this.y = clamp(this.cy + Math.sin(this.ang) * this.orbitR * 0.6 - this.h / 2, 40, 420);
        break;
      }
      case 'invisible': {
        this.visT -= dt;
        if (this.visT <= 0) this.visT = this.visT < -0.6 ? rand(2, 4) : this.visT; // visible window handled in render
        if (this.visT < -0.6) this.visT = rand(2, 4);
        break;
      }
      case 'quantum': {
        if (this.timer <= 0) {
          this.timer = rand(2.5, 4.5);
          this.morph(choice(['normal', 'heavy', 'explosive', 'clone', 'virus', 'quantum', 'quantum']));
          if (this.type !== 'quantum') this.wasQuantum = true;
        }
        break;
      }
      case 'clone': {
        if (this.timer <= 0) {
          // first copy only after 8-14s (the shared start timer is 1.5-4s), then every 10-16s
          if (!this.cloneArmed) { this.cloneArmed = true; this.timer = rand(6.5, 10); break; }
          this.timer = rand(10, 16);
          g.tryCloneBrick(this);
        }
        break;
      }
      case 'healing': {
        if (this.timer <= 0) {
          this.timer = rand(3, 5);
          g.healNearBrick(this);
        }
        break;
      }
    }
    if (this.wasQuantum && this.timer <= 0) { // corrupted quantum bricks flicker back
      this.timer = rand(3, 5);
      if (chance(0.4)) { this.morph('quantum'); this.wasQuantum = false; }
    }
  }
  render(ctx, g) {
    const def = BRICKS[this.type];
    let col = def.color;
    let alpha = 1;
    if (this.type === 'invisible') {
      const vis = this.visT < 0 || this.flashT > 0;
      alpha = vis ? 0.9 : 0.06;
    }
    if (g.mods.ghostBricks) alpha = Math.min(alpha, 0.14 + 0.86 * Math.max(0, Math.sin(g.time * 1.2 + this.id)));
    if (this.type === 'shield' && g.generatorsAlive()) col = '#8a8fa8';
    ctx.save();
    ctx.globalAlpha = alpha;
    const { x, y, w, h } = this;
    // corruption jitter
    let jx = 0, jy = 0;
    if (this.corrupt > 0 && chance(this.corrupt * 0.3)) { jx = rand(-2, 2); jy = rand(-1, 1); }
    ctx.translate(jx, jy);
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.fillStyle = this.flashT > 0 ? '#ffffff' : col;
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.flashT > 0 ? '#fff' : col;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.shadowBlur = 0;
    // hp cracks
    if (this.maxHp > 1 && this.hp < this.maxHp && this.hp > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1;
      const cracks = this.maxHp - this.hp;
      ctx.beginPath();
      for (let i = 0; i < cracks * 2; i++) {
        const sx = x + ((this.id * 37 + i * 29) % w);
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + ((i % 2) ? 8 : -8), y + h * 0.5);
        ctx.lineTo(sx + ((i % 2) ? 2 : -4), y + h);
      }
      ctx.stroke();
    }
    // glyph
    if (def.glyph) {
      ctx.fillStyle = this.flashT > 0 ? '#000' : 'rgba(255,255,255,.85)';
      ctx.font = '700 13px "Share Tech Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.glyph, this.cxm, this.cym + 1);
    }
    // shield tint when protected
    if (this.type === 'shield' && g.generatorsAlive()) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(g.time * 4);
      ctx.strokeStyle = COL.violet;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }
    ctx.restore();
  }
}

// ---------------- PowerUp capsule ----------------
class PowerUp {
  constructor(x, y, kind) {
    this.x = x; this.y = y; this.kind = kind;
    this.vy = 110; this.w = 42; this.h = 18; this.dead = false; this.t = 0;
  }
  update(dt, g) {
    this.t += dt;
    this.y += this.vy * dt;
    this.vy = Math.min(220, this.vy + 60 * dt);
    if (this.y > CFG.H + 20) this.dead = true;
    const p = g.paddle;
    if (Math.abs(this.x - p.x) < (p.w + this.w) / 2 && Math.abs(this.y - p.y) < (p.h + this.h) / 2) {
      this.dead = true;
      g.applyPowerup(this.kind, this.x, this.y);
    }
  }
  render(ctx) {
    const d = POWERUPS[this.kind];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = d.color; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    const bob = Math.sin(this.t * 6) * 2;
    ctx.fillRect(-this.w / 2, -this.h / 2 + bob, this.w, this.h);
    ctx.strokeRect(-this.w / 2, -this.h / 2 + bob, this.w, this.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = d.color;
    ctx.font = '700 11px Orbitron, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.tag, 0, 1 + bob);
    ctx.restore();
  }
}

// ---------------- projectiles / lasers ----------------
class Projectile { // enemy shot
  constructor(x, y, vx, vy, color = COL.red) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color; this.dead = false; this.r = 4;
    this.src = null;   // the enemy or boss that fired it
  }
  from(src) { this.src = src; return this; }
  update(dt, g) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y > CFG.H + 20 || this.y < -20 || this.x < -20 || this.x > CFG.W + 20) this.dead = true;
    const p = g.paddle;
    if (Math.abs(this.x - p.x) < p.w / 2 + this.r && Math.abs(this.y - p.y) < p.h / 2 + this.r) {
      this.dead = true;
      g.paddleHitByProjectile(this);
    }
  }
  render(ctx) {
    ctx.save();
    ctx.shadowColor = this.color; ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 2, this.y - 6, 4, 12);
    ctx.restore();
  }
}

class Laser { // player shot
  constructor(x, y) { this.x = x; this.y = y; this.dead = false; }
  update(dt, g) {
    this.y -= 900 * dt;
    if (this.y < -20) this.dead = true;
    for (const b of g.bricks) {
      if (!b.alive) continue;
      if (this.x > b.x && this.x < b.x + b.w && this.y > b.y && this.y < b.y + b.h) {
        this.dead = true;
        g.damageBrick(b, 1, { laser: true, x: this.x, y: this.y });
        return;
      }
    }
    if (g.boss && !g.boss.dead && g.boss.pointHit(this.x, this.y)) {
      this.dead = true;
      g.boss.hit(1, g, this.x, this.y);
    }
    for (const e of g.enemies) {
      if (!e.dead && dist2(this.x, this.y, e.x, e.y) < (e.r + 3) ** 2) {
        this.dead = true; g.damageEnemy(e, 1);
        return;
      }
    }
  }
  render(ctx) {
    ctx.save();
    ctx.shadowColor = COL.red; ctx.shadowBlur = 8;
    ctx.fillStyle = COL.red;
    ctx.fillRect(this.x - 1.5, this.y - 10, 3, 16);
    ctx.restore();
  }
}

// ---------------- Enemies ----------------
class Enemy {
  constructor(x, y) { this.x = x; this.y = y; this.dead = false; this.r = 12; this.hp = 1; this.t = rand(0, 6); this.flash = 0; }
  baseUpdate(dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt); }
}

class DroneEnemy extends Enemy {
  constructor(x, y) { super(x, y); this.kind = 'drone'; this.hp = 2; this.shootT = rand(2, 4); this.homeY = y; }
  update(dt, g) {
    this.baseUpdate(dt);
    if (g.eventFlags.timeFreeze) return;
    this.x += Math.cos(this.t * 0.8) * 60 * dt;
    this.y = this.homeY + Math.sin(this.t * 1.7) * 24;
    this.x = clamp(this.x, 20, CFG.W - 20);
    this.shootT -= dt;
    if (this.shootT <= 0) {
      this.shootT = rand(2.5, 4.5);
      g.projectiles.push(new Projectile(this.x, this.y + 10, 0, 260).from(this));
      AudioSys.sfx('laser');
    }
  }
  render(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = COL.red; ctx.shadowBlur = 10;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : COL.red; ctx.lineWidth = 2;
    ctx.strokeRect(-10, -7, 20, 14);
    ctx.fillStyle = COL.red;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.strokeRect(-14, -2, 4, 4); ctx.strokeRect(10, -2, 4, 4);
    ctx.restore();
  }
}

class VirusOrb extends Enemy {
  constructor(x, y) { super(x, y); this.kind = 'virus'; this.hp = 1; this.vx = rand(-50, 50); this.vy = rand(20, 45); }
  update(dt, g) {
    this.baseUpdate(dt);
    if (g.eventFlags.timeFreeze) return;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < 15 || this.x > CFG.W - 15) this.vx *= -1;
    if (this.y > 440) { this.vy = -Math.abs(this.vy); }
    if (this.y < 50) this.vy = Math.abs(this.vy);
    // infect a brick on contact
    for (const b of g.bricks) {
      if (!b.alive || b.type === 'virus' || b.type === 'bosscore' || b.type === 'barrier') continue;
      if (this.x > b.x - 4 && this.x < b.x + b.w + 4 && this.y > b.y - 4 && this.y < b.y + b.h + 4) {
        b.morph('virus'); b.corrupt = 1;
        FX.spawn(this.x, this.y, '#7dff5a', 8);
        this.vy *= -1; this.vx = rand(-60, 60);
        break;
      }
    }
  }
  render(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    const pul = 1 + Math.sin(this.t * 6) * 0.15;
    ctx.shadowColor = '#7dff5a'; ctx.shadowBlur = 12;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : '#7dff5a'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + this.t;
      const r = 9 * pul + (i % 2 ? 4 : 0);
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
}

class RepairBot extends Enemy {
  constructor(x, y) { super(x, y); this.kind = 'repair'; this.hp = 2; this.vx = 55; this.healT = 2; }
  update(dt, g) {
    this.baseUpdate(dt);
    if (g.eventFlags.timeFreeze) return;
    this.x += this.vx * dt;
    if (this.x < 20 || this.x > CFG.W - 20) this.vx *= -1;
    this.healT -= dt;
    if (this.healT <= 0) {
      this.healT = 2.2;
      // heal nearest damaged brick
      let best = null, bd = 1e9;
      for (const b of g.bricks) {
        if (!b.alive || b.hp >= b.maxHp || b.hp < 0) continue;
        const d = dist2(this.x, this.y, b.cxm, b.cym);
        if (d < bd) { bd = d; best = b; }
      }
      if (best && bd < 200 ** 2) {
        best.hp = Math.min(best.maxHp, best.hp + 1);
        best.flashT = 0.25;
        FX.spawn(best.cxm, best.cym, '#ff6ad5', 6, { spd: 60 });
        FX.text(best.cxm, best.cym, '+', '#ff6ad5', 12);
      }
    }
  }
  render(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = '#ff6ad5'; ctx.shadowBlur = 10;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : '#ff6ad5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ff6ad5';
    ctx.fillRect(-1.5, -6, 3, 12); ctx.fillRect(-6, -1.5, 12, 3);
    ctx.restore();
  }
}

class Turret extends Enemy {
  constructor(x, y) { super(x, y); this.kind = 'turret'; this.hp = 3; this.r = 14; this.shootT = rand(2, 3.5); }
  update(dt, g) {
    this.baseUpdate(dt);
    if (g.eventFlags.timeFreeze) return;
    this.shootT -= dt;
    if (this.shootT <= 0) {
      this.shootT = rand(2.8, 4.2);
      const a = Math.atan2(g.paddle.y - this.y, g.paddle.x - this.x);
      g.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 240, Math.sin(a) * 240, COL.orange).from(this));
      AudioSys.sfx('laser');
    }
  }
  render(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = COL.orange; ctx.shadowBlur = 10;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : COL.orange; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(0, -10); ctx.lineTo(12, 8); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = COL.orange; ctx.fillRect(-3, -2, 6, 6);
    ctx.restore();
  }
}

// player assist drone (powerup)
class AssistDrone {
  constructor() { this.x = CFG.W / 2; this.y = 520; this.t = 0; this.shootT = 1; this.life = POWERUPS.drone.dur; this.dead = false; }
  update(dt, g) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.x = lerp(this.x, g.paddle.x + Math.sin(this.t * 2) * 80, dt * 4);
    this.y = 500 + Math.sin(this.t * 3) * 14;
    this.shootT -= dt;
    if (this.shootT <= 0) {
      this.shootT = 1.1;
      let best = null, bd = 1e9;
      for (const b of g.bricks) {
        if (!b.alive || b.hp < 0) continue;
        const d = dist2(this.x, this.y, b.cxm, b.cym);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { g.lasers.push(new Laser(this.x, this.y)); AudioSys.sfx('laser'); }
    }
  }
  render(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = COL.green; ctx.shadowBlur = 10;
    ctx.strokeStyle = COL.green; ctx.lineWidth = 2;
    ctx.strokeRect(-8, -6, 16, 12);
    ctx.fillStyle = COL.green; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
}

// ---------------- Bosses ----------------
class Boss {
  constructor(name, hp) {
    this.name = name; this.hp = hp; this.maxHp = hp;
    this.x = CFG.W / 2; this.y = 170; this.r = 42;
    this.dead = false; this.t = 0; this.flash = 0; this.invuln = 0;
    this.attackT = 3;
  }
  pointHit(px, py) { return dist2(px, py, this.x, this.y) < this.r * this.r; }
  hit(dmg, g, hx, hy) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= dmg; this.flash = 0.15;
    AudioSys.sfx('bosshit');
    FX.spawn(hx ?? this.x, hy ?? this.y, COL.red, 10, { spd: 220 });
    FX.shake(3);
    g.addScore(120, this.x, this.y - this.r);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; g.onBossDeath(this); }
    return true;
  }
  // returns true if ball was handled (bounced)
  collideBall(ball, g) {
    if (this.dead) return false;
    if (dist2(ball.x, ball.y, this.x, this.y) < (this.r + ball.r) ** 2) {
      const a = Math.atan2(ball.y - this.y, ball.x - this.x);
      ball.x = this.x + Math.cos(a) * (this.r + ball.r + 1);
      ball.y = this.y + Math.sin(a) * (this.r + ball.r + 1);
      const sp = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
      this.hit(1, g, ball.x, ball.y);
      return true;
    }
    return false;
  }
  baseUpdate(dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt); this.invuln = Math.max(0, this.invuln - dt); }
  renderBody(ctx, col, glyph) {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = col; ctx.shadowBlur = 24;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : col; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + this.t * 0.4;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * this.r, Math.sin(a) * this.r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = 0.15; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = this.flash > 0 ? '#fff' : col;
    ctx.font = '900 26px Orbitron, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 0, 2);
    if (this.invuln > 0) {
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(this.t * 10);
      ctx.strokeStyle = COL.white;
      ctx.beginPath(); ctx.arc(0, 0, this.r + 8, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}

class MemoryGuardian extends Boss {
  constructor(tier) {
    super('MEMORY GUARDIAN', 26 + tier * 8);
    this.shieldR = 86; this.segs = 3; this.rot = 0;
  }
  update(dt, g) {
    this.baseUpdate(dt);
    this.rot += dt * 0.9;
    this.x = CFG.W / 2 + Math.sin(this.t * 0.4) * 120;
    this.attackT -= dt;
    if (this.attackT <= 0) {
      this.attackT = rand(3.5, 5);
      const a = Math.atan2(g.paddle.y - this.y, g.paddle.x - this.x);
      g.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 220, Math.sin(a) * 220, COL.violet).from(this));
    }
    // rotating shield deflects balls
    for (const ball of g.balls) {
      const d = Math.sqrt(dist2(ball.x, ball.y, this.x, this.y));
      if (Math.abs(d - this.shieldR) < ball.r + 5) {
        let a = Math.atan2(ball.y - this.y, ball.x - this.x) - this.rot;
        a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const segArc = Math.PI * 2 / this.segs;
        const inSeg = (a % segArc) < segArc * 0.62; // 62% coverage
        if (inSeg) {
          const na = Math.atan2(ball.y - this.y, ball.x - this.x);
          const out = d > this.shieldR ? 1 : -1;
          ball.x = this.x + Math.cos(na) * (this.shieldR + (ball.r + 6) * out);
          ball.y = this.y + Math.sin(na) * (this.shieldR + (ball.r + 6) * out);
          const sp = Math.hypot(ball.vx, ball.vy);
          ball.vx = Math.cos(na) * sp * out; ball.vy = Math.sin(na) * sp * out;
          AudioSys.sfx('wall');
          FX.spawn(ball.x, ball.y, COL.violet, 5, { spd: 120 });
        }
      }
    }
  }
  render(ctx) {
    // shield arcs
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    ctx.shadowColor = COL.violet; ctx.shadowBlur = 14;
    ctx.strokeStyle = COL.violet; ctx.lineWidth = 5;
    const segArc = Math.PI * 2 / this.segs;
    for (let i = 0; i < this.segs; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, this.shieldR, i * segArc, i * segArc + segArc * 0.62);
      ctx.stroke();
    }
    ctx.restore();
    this.renderBody(ctx, COL.violet, '◆');
  }
}

class VirusQueen extends Boss {
  constructor(tier) { super('VIRUS QUEEN', 30 + tier * 8); this.infectT = 3; }
  update(dt, g) {
    this.baseUpdate(dt);
    this.x = CFG.W / 2 + Math.sin(this.t * 0.7) * 250;
    this.y = 160 + Math.sin(this.t * 1.3) * 30;
    this.infectT -= dt;
    if (this.infectT <= 0) {
      this.infectT = rand(2.5, 4);
      const targets = g.bricks.filter(b => b.alive && b.type !== 'virus' && b.type !== 'barrier');
      if (targets.length && chance(0.7)) {
        const b = choice(targets); b.morph('virus'); b.corrupt = 1;
        FX.spawn(b.cxm, b.cym, '#7dff5a', 10);
      } else if (g.enemies.length < 5) {
        g.enemies.push(new VirusOrb(this.x, this.y + 30));
      }
      AudioSys.sfx('event');
    }
  }
  render(ctx) { this.renderBody(ctx, '#7dff5a', 'V'); }
}

class FirewallTitan extends Boss {
  constructor(tier) { super('FIREWALL TITAN', 34 + tier * 9); this.y = 190; this.r = 48; }
  update(dt, g) {
    this.baseUpdate(dt);
    this.x = CFG.W / 2 + Math.sin(this.t * 0.5) * 200;
    this.attackT -= dt;
    if (this.attackT <= 0) {
      this.attackT = rand(2.5, 4);
      g.projectiles.push(new Projectile(this.x - 20, this.y + 30, 0, 250, COL.orange).from(this));
      g.projectiles.push(new Projectile(this.x + 20, this.y + 30, 0, 250, COL.orange).from(this));
    }
  }
  collideBall(ball, g) {
    if (this.dead) return false;
    if (dist2(ball.x, ball.y, this.x, this.y) < (this.r + ball.r) ** 2) {
      const a = Math.atan2(ball.y - this.y, ball.x - this.x);
      const fromBelow = Math.sin(a) > 0.25; // ball beneath = front = immune
      ball.x = this.x + Math.cos(a) * (this.r + ball.r + 1);
      ball.y = this.y + Math.sin(a) * (this.r + ball.r + 1);
      const sp = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
      if (fromBelow && !(ball.fire > 0)) {
        AudioSys.sfx('wall');
        FX.text(this.x, this.y + this.r + 16, 'FRONT ARMORED', COL.orange, 11);
      } else {
        this.hit(fromBelow ? 1 : 2, g, ball.x, ball.y);
      }
      return true;
    }
    return false;
  }
  render(ctx) {
    this.renderBody(ctx, COL.orange, 'F');
    // front armor
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = COL.orange; ctx.shadowBlur = 12;
    ctx.strokeStyle = COL.orange; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, this.r + 8, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    ctx.restore();
  }
}

class QuantumCore extends Boss {
  constructor(tier) { super('QUANTUM CORE', 26 + tier * 7); this.teleT = 3; this.r = 34; }
  update(dt, g) {
    this.baseUpdate(dt);
    this.teleT -= dt;
    if (this.teleT <= 0) {
      this.teleT = rand(2.2, 3.4);
      FX.spawn(this.x, this.y, COL.white, 16, { spd: 240 });
      this.x = rand(90, CFG.W - 90);
      this.y = rand(110, 300);
      this.invuln = 0.5;
      AudioSys.sfx('teleport');
      if (chance(0.4)) {
        const a = Math.atan2(g.paddle.y - this.y, g.paddle.x - this.x);
        g.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 230, Math.sin(a) * 230, COL.white).from(this));
      }
    }
  }
  render(ctx) { this.renderBody(ctx, COL.white, '?'); }
}

class DataHydra extends Boss {
  constructor(tier) {
    super('DATA HYDRA', 1); // hp tracked per head
    this.heads = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      this.heads.push({ x: CFG.W / 2 + (i - 1) * 220, y: 160, hp: 10 + tier * 3, maxHp: 10 + tier * 3, r: 28, ph: rand(0, 6) });
    }
    this.maxHp = this.heads.reduce((s, h) => s + h.maxHp, 0);
    this.hp = this.maxHp;
  }
  get aliveHeads() { return this.heads.filter(h => h.hp > 0); }
  pointHit(px, py) { return this.aliveHeads.some(h => dist2(px, py, h.x, h.y) < h.r * h.r); }
  hit(dmg, g, hx, hy) {
    // damage nearest alive head
    let best = null, bd = 1e9;
    for (const h of this.aliveHeads) {
      const d = dist2(hx ?? h.x, hy ?? h.y, h.x, h.y);
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) return false;
    best.hp -= dmg; this.flash = 0.15;
    this.hp = this.heads.reduce((s, h) => s + Math.max(0, h.hp), 0);
    AudioSys.sfx('bosshit');
    FX.spawn(hx ?? best.x, hy ?? best.y, COL.cyan, 10, { spd: 200 });
    if (best.hp <= 0) { FX.spawn(best.x, best.y, COL.cyan, 30, { spd: 300 }); FX.shake(8); AudioSys.sfx('explode'); }
    g.addScore(120, hx ?? best.x, (hy ?? best.y) - 30);
    if (this.hp <= 0) { this.dead = true; g.onBossDeath(this); }
    return true;
  }
  collideBall(ball, g) {
    if (this.dead) return false;
    for (const h of this.aliveHeads) {
      if (dist2(ball.x, ball.y, h.x, h.y) < (h.r + ball.r) ** 2) {
        const a = Math.atan2(ball.y - h.y, ball.x - h.x);
        ball.x = h.x + Math.cos(a) * (h.r + ball.r + 1);
        ball.y = h.y + Math.sin(a) * (h.r + ball.r + 1);
        const sp = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
        this.hit(1, g, ball.x, ball.y);
        return true;
      }
    }
    return false;
  }
  update(dt, g) {
    this.baseUpdate(dt);
    this.attackT -= dt;
    for (const h of this.aliveHeads) {
      h.ph += dt;
      h.x += Math.cos(h.ph) * 40 * dt;
      h.y = 160 + Math.sin(h.ph * 1.4) * 34;
      h.x = clamp(h.x, 60, CFG.W - 60);
    }
    if (this.attackT <= 0 && this.aliveHeads.length) {
      this.attackT = rand(2.2, 3.6);
      const h = choice(this.aliveHeads);
      const a = Math.atan2(g.paddle.y - h.y, g.paddle.x - h.x);
      g.projectiles.push(new Projectile(h.x, h.y, Math.cos(a) * 240, Math.sin(a) * 240, COL.cyan).from(this));
    }
  }
  render(ctx) {
    // linking arcs
    const alive = this.aliveHeads;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,.3)'; ctx.lineWidth = 2;
    for (let i = 0; i < alive.length - 1; i++) {
      ctx.beginPath(); ctx.moveTo(alive[i].x, alive[i].y); ctx.lineTo(alive[i + 1].x, alive[i + 1].y); ctx.stroke();
    }
    for (const h of alive) {
      ctx.shadowColor = COL.cyan; ctx.shadowBlur = 18;
      ctx.strokeStyle = this.flash > 0 ? '#fff' : COL.cyan; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + h.ph * 0.5;
        const px = h.x + Math.cos(a) * h.r, py = h.y + Math.sin(a) * h.r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = COL.cyan; ctx.font = '900 18px Orbitron';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', h.x, h.y + 1);
    }
    ctx.restore();
  }
}

// ---------------- THE EYE — the entity from the Pong arena ----------------
const EYE_IMGS = {};
let EYE_READY = false;
{
  const files = {
    neutral: 'assets/boss_eye_neutral.png',
    left:    'assets/boss_eye_left.png',
    right:   'assets/boss_eye_right.png',
    blink:   'assets/straight_eye_blink.png',
  };
  let loaded = 0;
  const keys = Object.keys(files);
  for (const k of keys) {
    const img = new Image();
    img.onload = () => { if (++loaded === keys.length) EYE_READY = true; };
    img.src = files[k];
    EYE_IMGS[k] = img;
  }
}

class TheEye extends Boss {
  constructor(tier) {
    super('THE EYE', 46 + tier * 10);
    this.r = 56;                     // core hit radius
    this.rx = 96; this.ry = 58;      // ellipse extents (sprite is wide)
    this.y = 168;
    this.gaze = 'neutral';
    this.blinkT = rand(6, 9);
    this.blinking = 0;
    this.volleyT = 4.5;
    this.teleT = rand(8, 12);
    this.tier = tier;
  }
  pointHit(px, py) {
    const dx = (px - this.x) / this.rx, dy = (py - this.y) / this.ry;
    return dx * dx + dy * dy <= 1;
  }
  collideBall(ball, g) {
    if (this.dead) return false;
    const dx = (ball.x - this.x) / (this.rx + ball.r), dy = (ball.y - this.y) / (this.ry + ball.r);
    if (dx * dx + dy * dy > 1) return false;
    const a = Math.atan2(ball.y - this.y, ball.x - this.x);
    ball.x = this.x + Math.cos(a) * (this.rx + ball.r + 2);
    ball.y = this.y + Math.sin(a) * (this.ry + ball.r + 2);
    const sp = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
    if (this.blinking > 0) {
      AudioSys.sfx('wall');
      FX.text(this.x, this.y + this.ry + 18, 'EYELID ARMORED', '#c084fc', 12);
    } else {
      this.hit(1, g, ball.x, ball.y);
    }
    return true;
  }
  update(dt, g) {
    this.baseUpdate(dt);
    // drift lazily toward the nearest ball — it is watching you
    let target = CFG.W / 2, bd = 1e9, nearest = null;
    for (const b of g.balls) {
      const d = dist2(b.x, b.y, this.x, this.y);
      if (d < bd) { bd = d; nearest = b; }
    }
    if (nearest) target = nearest.x;
    this.x += clamp(target - this.x, -70, 70) * dt * 0.55;
    this.x = clamp(this.x, this.rx + 20, CFG.W - this.rx - 20);
    this.y = 168 + Math.sin(this.t * 0.9) * 14;
    // gaze tracks the ball
    if (nearest) {
      const dx = nearest.x - this.x;
      this.gaze = dx < -60 ? 'left' : dx > 60 ? 'right' : 'neutral';
    }
    // blink cycle — eyelid closes, boss becomes armored
    if (this.blinking > 0) {
      this.blinking -= dt;
      this.invuln = Math.max(this.invuln, 0.05);
    } else {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinkT = rand(6, 9);
        this.blinking = 1.4;
        FX.spawn(this.x, this.y, COL.violet, 8, { spd: 100 });
      }
    }
    // six punishment shots, straight out of the Pong arena
    this.volleyT -= dt;
    if (this.volleyT <= 0) {
      this.volleyT = (this.hp < this.maxHp * 0.5 ? rand(4, 6) : rand(6, 8.5)) - Math.min(this.tier * 0.3, 2);
      const base = Math.atan2(g.paddle.y - this.y, g.paddle.x - this.x);
      for (let i = 0; i < 6; i++) {
        const a = base + (i - 2.5) * 0.16;
        g.projectiles.push(new Projectile(this.x, this.y + 20, Math.cos(a) * 230, Math.sin(a) * 230, COL.violet).from(this));
      }
      AudioSys.sfx('event');
      FX.text(this.x, this.y - this.ry - 14, 'THE EYE SEES YOU', COL.magenta, 13);
      FX.setRgb(0.5);
    }
    // glitch teleport
    this.teleT -= dt;
    if (this.teleT <= 0) {
      this.teleT = rand(8, 12);
      FX.spawn(this.x, this.y, COL.violet, 22, { spd: 260 });
      FX.tear(0.5); FX.setRgb(0.7);
      this.x = rand(this.rx + 30, CFG.W - this.rx - 30);
      this.invuln = Math.max(this.invuln, 0.5);
      AudioSys.sfx('teleport');
    }
  }
  render(ctx) {
    const img = this.blinking > 0 ? EYE_IMGS.blink : EYE_IMGS[this.gaze];
    ctx.save();
    if (EYE_READY && img && img.complete && img.naturalWidth) {
      const w = this.rx * 2.4;
      const h = w * (img.naturalHeight / img.naturalWidth);
      const pulse = 26 + Math.sin(this.t * 2.2) * 8 + (this.flash > 0 ? 30 : 0);
      ctx.shadowColor = this.flash > 0 ? '#ffffff' : COL.violet;
      ctx.shadowBlur = pulse;
      // corruption jitter when hurt
      const jx = this.flash > 0 ? rand(-4, 4) : 0;
      ctx.drawImage(img, this.x - w / 2 + jx, this.y - h / 2, w, h);
      if (this.flash > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(img, this.x - w / 2 - 5, this.y - h / 2, w, h);
        ctx.drawImage(img, this.x - w / 2 + 5, this.y - h / 2, w, h);
      }
    } else {
      ctx.restore();
      this.renderBody(ctx, COL.violet, '◉');
      return;
    }
    if (this.invuln > 0 && this.blinking <= 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.t * 10);
      ctx.strokeStyle = COL.white; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.rx + 10, this.ry + 10, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}

const BOSS_LIST = [MemoryGuardian, VirusQueen, FirewallTitan, QuantumCore, DataHydra];

// ---------------- Arena hazards ----------------
class GravityWell {
  constructor() { this.x = CFG.W / 2; this.y = 330; this.r = 150; this.t = 0; }
  update(dt, g) {
    this.t += dt;
    this.x = CFG.W / 2 + Math.sin(this.t * 0.3) * 180;
    for (const b of g.balls) {
      if (b.stuck) continue;
      const d2 = dist2(b.x, b.y, this.x, this.y);
      if (d2 < this.r * this.r && d2 > 100) {
        const d = Math.sqrt(d2);
        const f = (1 - d / this.r) * 460;
        b.vx += (this.x - b.x) / d * f * dt;
        b.vy += (this.y - b.y) / d * f * dt;
      }
    }
  }
  render(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    for (let i = 0; i < 3; i++) {
      const rr = ((this.t * 40 + i * 50) % this.r);
      ctx.globalAlpha = 0.25 * (1 - rr / this.r);
      ctx.strokeStyle = COL.violet;
      ctx.beginPath(); ctx.arc(0, 0, this.r - rr, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = COL.violet; ctx.shadowBlur = 16;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = COL.violet; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}

class MovingBarrier {
  constructor() { this.w = 130; this.h = 12; this.x = CFG.W / 2; this.y = 400; this.vx = 120; }
  update(dt, g) {
    this.x += this.vx * dt;
    if (this.x - this.w / 2 < 10 || this.x + this.w / 2 > CFG.W - 10) this.vx *= -1;
    for (const b of g.balls) {
      if (b.stuck) continue;
      if (Math.abs(b.x - this.x) < this.w / 2 + b.r && Math.abs(b.y - this.y) < this.h / 2 + b.r) {
        b.vy = b.y < this.y ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y = this.y + (b.y < this.y ? -(this.h / 2 + b.r + 1) : this.h / 2 + b.r + 1);
        AudioSys.sfx('wall');
        FX.spawn(b.x, b.y, COL.magenta, 4, { spd: 90 });
      }
    }
  }
  render(ctx) {
    ctx.save();
    ctx.shadowColor = COL.magenta; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,0,212,.25)';
    ctx.strokeStyle = COL.magenta; ctx.lineWidth = 1.5;
    ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    ctx.strokeRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

class TeleportGates {
  constructor() {
    this.a = { x: 80, y: 350 }; this.b = { x: CFG.W - 80, y: 250 };
    this.r = 24; this.t = 0; this.cool = new WeakMap();
  }
  update(dt, g) {
    this.t += dt;
    for (const ball of g.balls) {
      if (ball.stuck) continue;
      const last = this.cool.get(ball) || 0;
      if (g.time - last < 1) continue;
      for (const [from, to] of [[this.a, this.b], [this.b, this.a]]) {
        if (dist2(ball.x, ball.y, from.x, from.y) < this.r * this.r) {
          ball.x = to.x; ball.y = to.y;
          this.cool.set(ball, g.time);
          AudioSys.sfx('teleport');
          FX.spawn(from.x, from.y, COL.cyan, 10); FX.spawn(to.x, to.y, COL.cyan, 10);
          break;
        }
      }
    }
  }
  render(ctx) {
    for (const p of [this.a, this.b]) {
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.rotate(this.t * 1.4);
      ctx.shadowColor = COL.cyan; ctx.shadowBlur = 14;
      ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

class CorruptedZone {
  constructor() { this.x = rand(200, CFG.W - 200); this.y = 340; this.w = 220; this.h = 110; this.t = 0; }
  update(dt, g) {
    this.t += dt;
    for (const b of g.balls) {
      if (b.stuck) continue;
      if (Math.abs(b.x - this.x) < this.w / 2 && Math.abs(b.y - this.y) < this.h / 2) {
        if (chance(dt * 3)) {
          const a = rand(-0.5, 0.5);
          const cos = Math.cos(a), sin = Math.sin(a);
          const vx = b.vx * cos - b.vy * sin, vy = b.vx * sin + b.vy * cos;
          b.vx = vx; b.vy = vy;
          FX.spawn(b.x, b.y, COL.red, 3, { spd: 60 });
        }
      }
    }
  }
  render(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(this.t * 5) * 0.08;
    ctx.strokeStyle = COL.red;
    ctx.setLineDash([4, 8]);
    ctx.strokeRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = COL.red;
      ctx.fillRect(this.x - this.w / 2 + rand(0, this.w - 20), this.y - this.h / 2 + rand(0, this.h - 6), 20, 4);
    }
    ctx.restore();
  }
}

class LaserSweep {
  constructor() { this.y = 380; this.dir = 1; this.active = 0; this.chargeT = 4; }
  update(dt, g) {
    this.chargeT -= dt;
    if (this.chargeT <= 0 && this.active <= 0) { this.active = 1.4; this.chargeT = rand(6, 9); AudioSys.sfx('laser'); }
    if (this.active > 0) {
      this.active -= dt;
      this.y += this.dir * 90 * dt;
      if (this.y > 480 || this.y < 220) this.dir *= -1;
      // deflects balls sharply
      for (const b of g.balls) {
        if (b.stuck) continue;
        if (Math.abs(b.y - this.y) < b.r + 3) {
          b.vy *= -1;
          b.y = this.y + (b.vy > 0 ? 6 : -6);
          FX.spawn(b.x, b.y, COL.red, 6, { spd: 140 });
          AudioSys.sfx('wall');
        }
      }
    }
  }
  render(ctx) {
    ctx.save();
    if (this.active > 0) {
      ctx.shadowColor = COL.red; ctx.shadowBlur = 14;
      ctx.strokeStyle = COL.red; ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(0, this.y); ctx.lineTo(CFG.W, this.y); ctx.stroke();
    } else if (this.chargeT < 1.2) {
      ctx.globalAlpha = 0.25 + Math.sin(this.chargeT * 20) * 0.15;
      ctx.strokeStyle = COL.red; ctx.lineWidth = 1;
      ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(0, this.y); ctx.lineTo(CFG.W, this.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

const HAZARDS = {
  gravityWell: GravityWell, movingBarrier: MovingBarrier,
  teleportGates: TeleportGates, corruptedZone: CorruptedZone, laserSweep: LaserSweep,
};
