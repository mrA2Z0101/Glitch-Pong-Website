// ============ GLITCH BREAKOUT — visual effects ============
'use strict';

const FX = (() => {
  let particles = [], texts = [];
  let shakeAmt = 0, flashA = 0, flashCol = '#fff';
  let rgb = 0;            // rgb split intensity 0..1
  let slices = 0;         // horizontal slice-tear time remaining
  let offsetX = 0, offsetY = 0; // systemError screen shift

  function reset() { particles = []; texts = []; shakeAmt = 0; flashA = 0; rgb = 0; slices = 0; offsetX = offsetY = 0; }

  function spawn(x, y, color, n = 10, opts = {}) {
    const { spd = 180, life = 0.6, size = 3, spread = Math.PI * 2, dir = 0, grav = 0, square = true } = opts;
    if (particles.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = dir + rand(-spread / 2, spread / 2);
      const v = rand(spd * 0.3, spd);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rand(life * 0.5, life), max: life, color, size: rand(size * 0.5, size * 1.4), grav, square,
      });
    }
  }

  function text(x, y, str, color = COL.white, size = 14) {
    texts.push({ x, y, str, color, size, life: 1.0 });
  }

  // REDUCED mode (Settings, or the OS "reduce motion" preference): softer shake,
  // capped flashes (KERNEL PANIC is a near-white full-screen flash), no slice tearing
  let reduced = false;
  function setReduced(r) { reduced = !!r; if (reduced) { slices = 0; flashA = Math.min(flashA, 0.18); } }

  function shake(a) { shakeAmt = Math.min(reduced ? 5 : 24, shakeAmt + a * (reduced ? 0.3 : 1)); }
  function flash(col = '#fff', a = 0.5) { flashCol = col; flashA = Math.max(flashA, reduced ? Math.min(a * 0.35, 0.18) : a); }
  function setRgb(a) { rgb = Math.max(rgb, reduced ? a * 0.35 : a); }
  function tear(t = 0.4) { if (!reduced) slices = Math.max(slices, t); }
  function shift(x, y) { const k = reduced ? 0.3 : 1; offsetX = x * k; offsetY = y * k; }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= (1 - dt * 2); p.vy *= (1 - dt * 1.2);
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt * 0.9; t.y -= 34 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
    shakeAmt = Math.max(0, shakeAmt - dt * 40);
    flashA = Math.max(0, flashA - dt * 1.8);
    rgb = Math.max(0, rgb - dt * 1.6);
    slices = Math.max(0, slices - dt);
    offsetX *= (1 - dt * 6); offsetY *= (1 - dt * 6);
  }

  // draw particles + texts into the scene context
  function render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + a * 0.5);
      if (p.square) ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.font = `700 ${t.size}px Orbitron, monospace`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color; ctx.shadowBlur = 8;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }

  // composite offscreen scene → visible canvas with glitch treatments
  function composite(main, scene) {
    const W = scene.width, H = scene.height;
    main.clearRect(0, 0, W, H);
    main.save();
    const sx = offsetX + (shakeAmt ? rand(-shakeAmt, shakeAmt) : 0);
    const sy = offsetY + (shakeAmt ? rand(-shakeAmt, shakeAmt) : 0);
    main.translate(Math.round(sx), Math.round(sy));

    if (rgb > 0.02) {
      const o = 2 + rgb * 8;
      main.globalAlpha = 1; main.drawImage(scene, 0, 0);
      main.globalAlpha = 0.35 * rgb + 0.15;
      main.globalCompositeOperation = 'screen';
      main.drawImage(scene, -o, 0);
      main.drawImage(scene, o, 0);
      main.globalCompositeOperation = 'source-over';
      main.globalAlpha = 1;
    } else {
      main.drawImage(scene, 0, 0);
    }

    // horizontal slice tearing
    if (slices > 0) {
      const n = randInt(2, 5);
      for (let i = 0; i < n; i++) {
        const y = randInt(0, H - 30), h = randInt(6, 26), off = randInt(-40, 40);
        main.drawImage(scene, 0, y, W, h, off, y, W, h);
      }
    }

    if (flashA > 0.01) {
      main.globalAlpha = flashA;
      main.fillStyle = flashCol;
      main.fillRect(-30, -30, W + 60, H + 60);
      main.globalAlpha = 1;
    }
    main.restore();
  }

  return { reset, spawn, text, shake, flash, setRgb, tear, shift, update, render, composite, setReduced,
           get rgb() { return rgb; }, get reduced() { return reduced; } };
})();
