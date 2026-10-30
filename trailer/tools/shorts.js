// Vertical (9:16) shorts for TikTok / Reels / Shorts (see docs/short-form-plan.md).
// The game renders natively in a 900x1600 portrait window; render_short.sh upscales to 1080x1920.
// Usage: node shorts.js v_tired v_grudge ...   (output: ../frames/<name>/)
const { open } = require('./harness');

const VW = 900, VH = 1600;
const HIDE = 'hud.style.display="none"; help.style.display="none"; portraitWarnEl.style.display="none";';
const CALM = 'teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; decoyCooldown=99999;';
const J = (s) => JSON.parse(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vboot(seed) {
  const g = await open({ width: VW, height: VH });
  await g.js(() => document.querySelector('#playNowHero').click());
  for (let k = 0; k < 60 && !(await g.js(() => typeof window.__gpEval === 'function')); k++) await g.step(10);
  await g.step(30);
  await g.js((s) => {
    window.__seed(s); window.__ov.vertical(true);
    const st = document.createElement('style'); st.textContent = '#gpRotatePrompt{display:none!important}'; document.head.appendChild(st);
  }, seed);
  return g;
}

async function vstart(g, arena = 'classic', diff = 'hard') {
  await g.ev(`aiVsAiMode=true; aiDifficulty='${diff}'; currentArenaId='${arena}'; {const a=getArena(); a.cleanup&&a.cleanup(); a.init&&a.init();} beginMode(false); ${HIDE} 1`);
  await g.step(150);
  await g.ev(HIDE);
}

const hook = (text, t) => ({ type: 'hook', text, t, y: 14 });
const word = (text, t, d, o = {}) => ({ type: 'word', text, t, d, y: 66, size: 88, ...o });
const strip = (text, t, y, o = {}) => ({ type: 'strip', text, t, y, size: 60, color: '#f4fbff', weight: 900, ...o });
const scan = { type: 'scan', alpha: 0.1 };

// Shared end card: gameplay keeps running behind it. ~1.8s so the "GLITCH PONG" voice fits.
async function endCard(g, rec, { line1 = 'PLAY IN YOUR BROWSER', line2 = 'LINK IN BIO', frames = 54, each } = {}) {
  const start = rec.n;
  for (let i = 0; i < frames; i++) {
    if (each) await each(i);
    await g.ev(HIDE);
    await rec.shot([
      { type: 'fill', color: '#02040a', alpha: 0.76 }, scan, { type: 'vignette', alpha: 0.5 },
      { type: 'logo', t: i, d: 999, scale: 0.62, y: 36 },
      { type: 'strip', text: line1, t: i, y: 52, size: 36, color: '#f4fbff', weight: 900 },
      { type: 'strip', text: line2, t: Math.max(0, i - 6), y: 58, size: 50, color: '#ffd166', weight: 900 }
    ], i < 5 ? { rgb: 16 - i * 3, slices: 4 } : null);
    await g.step(2);
  }
  return start;
}

const SHORTS = {
  // ── Pong, but… the ball gets tired ─────────────────────────────────────────
  async v_tired() {
    for (const seed of [201, 202, 203, 204, 205]) {
      const g = await vboot(seed);
      await vstart(g, 'classic', 'hard');
      const rec = g.recorder('v_tired');
      const M = {};
      const H = 'Pong, but the ball gets tired';
      await g.ev(CALM + HIDE + 'heat=30; rallyHits=26; ballX=450; ballY=800; vx=-7; vy=2.5; ballTrail=[];');
      let ok = true;
      for (let k = 0; k < 900 && J(await g.ev('rallyHits')) < 28; k++) { await g.ev(CALM + HIDE + 'heat=Math.min(heat,40);'); await g.step(2); }
      for (let i = 0; ; i++) {
        const st = J(await g.ev('JSON.stringify({r:rallyHits, s:leftScore+rightScore})'));
        if (st.s > 0 || st.r < 28 || i > 300) { ok = false; break; }
        if (st.r >= 30) break;
        await g.ev(CALM + HIDE + 'heat=Math.min(heat,40);');
        await rec.shot([hook(H, i), strip(`RALLY ${st.r}`, 20, 72, { size: 70 }), scan]);
        await g.step(2);
      }
      if (ok) {
        M.drowsy = rec.n;
        let cam = null;
        for (let k = 0; k < 150; k++) {
          const st = J(await g.ev('JSON.stringify({x:ballX/canvas.width, y:ballY/canvas.height, s:leftScore+rightScore})'));
          if (st.s > 0) { ok = false; break; }
          await g.ev(CALM + HIDE + 'rallyHits=Math.max(rallyHits,31); heat=Math.min(heat,40); vx=Math.sign(vx)*Math.min(Math.abs(vx),5.5);');
          cam = cam ? [cam[0] + (st.x - cam[0]) * 0.12, cam[1] + (st.y - cam[1]) * 0.12] : [st.x, st.y];
          await g.cam({ scale: 1 + Math.min(0.55, k * 0.03), ox: cam[0] * 100, oy: cam[1] * 100 });
          await rec.shot([hook(H, 99), strip('RALLY 30 💤', 20, 72, { size: 70, color: '#9fd8ff' }), scan], k < 3 ? { rgb: 8 } : null);
          await g.step(2);
        }
        if (ok) {
          M.punch = rec.n;
          for (let k = 0; k < 75; k++) {
            await g.ev(CALM + HIDE + 'rallyHits=Math.max(rallyHits,31); heat=Math.min(heat,40); vx=Math.sign(vx)*Math.min(Math.abs(vx),5.5);');
            const z = 1.55 - 0.55 * Math.min(1, k / 12);
            await g.cam({ scale: z, ox: 50, oy: 50 });
            await rec.shot([hook(H, 99), word('It needed a nap.', k, 75, { y: 70, size: 76 }), scan]);
            await g.step(2);
          }
          await g.cam({});
          M.end = await endCard(g, rec);
          await rec.save({ marks: M });
          await g.close();
          return;
        }
      }
      console.log('v_tired seed', seed, 'rally broke, retrying');
      await g.close();
    }
    throw new Error('v_tired: no clean take');
  },

  // ── Pong, but… the ball holds a grudge ─────────────────────────────────────
  async v_grudge() {
    const g = await vboot(211);
    await vstart(g, 'classic', 'hard');
    const rec = g.recorder('v_grudge');
    const M = {};
    const H = 'Pong, but the ball holds a grudge';
    const GAP = 430;
    const ring = (t) => ({ type: 'ring', x: 28, y: GAP, r: 38, t, color: '#ff4f6d', label: 'LAST MISS', size: 28 });
    const aim = `{ const t=(ballX-(leftX+paddleW))/-vx; vy=(${GAP}-ballY)/t; }`;
    // Miss #1: blue reads it wrong and the ball slips past the top.
    await g.ev(CALM + HIDE + `aiVsAiMode=false; heat=40; leftY=760; ballX=760; ballY=1180; vx=-9; ballTrail=[]; keys.w=false; keys.s=false;`);
    await g.ev(aim);
    let miss = -1;
    for (let i = 0; miss < 0 || rec.n < miss + 22; i++) {
      await g.ev(CALM + HIDE + `keys.s = ${i > 6 && i < 26};`);
      const st = J(await g.ev('JSON.stringify({rs:rightScore})'));
      if (miss < 0 && st.rs > 0) { miss = rec.n; M.miss1 = miss; }
      await rec.shot([hook(H, i), ...(miss >= 0 ? [ring(rec.n - miss)] : []), scan]);
      await g.step(2);
    }
    // Cut past the countdown to the next serve, which goes straight back to the gap.
    await g.ev('keys.s=false; keys.w=false;');
    for (let k = 0; k < 400 && J(await g.ev('JSON.stringify(roundFrozen || countdownActive)')); k++) await g.step(1);
    await g.ev(HIDE + `leftY=760; ballX=620; ballY=820; vx=-8.5; ballTrail=[];`);
    await g.ev(aim);
    M.serve = rec.n;
    let miss2 = -1;
    for (let i = 0; miss2 < 0 || rec.n < miss2 + 14; i++) {
      await g.ev(CALM + HIDE + 'leftY=760;');
      const st = J(await g.ev('JSON.stringify({rs:rightScore, bx:ballX})'));
      if (miss2 < 0 && st.rs > 1) { miss2 = rec.n; M.miss2 = miss2; }
      const layers = [hook(H, 99), ring(30 + i), scan];
      if (i < 50) layers.push(word('Next serve…', i, 50, { y: 70, size: 66 }));
      const slow = miss2 < 0 && st.bx < 260;
      await rec.shot(layers, i < 4 ? { rgb: 14 - i * 3, slices: 4 } : null);
      if (slow) { await g.step(1); continue; }
      await g.step(2);
    }
    rec.hold(8);
    M.punch = rec.n;
    for (let k = 0; k < 60; k++) {
      await g.ev(HIDE);
      await rec.shot([hook(H, 99), ring(80 + k), word('It remembers.', k, 60, { y: 70, size: 84 }), scan]);
      await g.step(2);
    }
    M.end = await endCard(g, rec);
    await rec.save({ marks: M });
    await g.close();
  },

  // ── Pong, but… the ball picks sides ────────────────────────────────────────
  async v_sides() {
    const g = await vboot(221);
    await vstart(g, 'classic', 'hard');
    const rec = g.recorder('v_sides');
    const M = {};
    const H = 'Pong, but the ball picks sides';
    await g.ev(CALM + HIDE + 'heat=35; leftScore=5; rightScore=1; spiteBias=-1; ballX=450; ballY=500; vx=8; vy=-7; ballTrail=[];');
    let staged = false, scored = -1;
    for (let i = 0; scored < 0 || rec.n < scored + 16; i++) {
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW, ls:leftScore, rs:rightScore})'));
      if (!staged) await g.ev(CALM + HIDE + 'leftScore=5; rightScore=1; spiteBias=-1;');
      else await g.ev(CALM + HIDE);
      // After the setup, blue (the leader) gets beaten: the paddle drifts the wrong way.
      if (!staged && i > 170 && st.vx < 0 && st.bx < 620) { staged = true; await g.ev('aiVsAiMode=false;'); }
      if (staged && scored < 0) {
        const t = (st.bx - st.lx) / Math.max(1, -st.vx);
        const target = st.by + st.vy * t, center = st.ly + st.ph / 2;
        await g.ev(`keys.w = ${target > center}; keys.s = ${target <= center};`);
      }
      if (scored < 0 && st.rs > 1) { scored = rec.n; M.score = scored; await g.ev('keys.w=false; keys.s=false;'); }
      const ls = staged ? st.ls : 5, rs = staged ? st.rs : 1;
      const layers = [hook(H, i), strip(`BLUE ${ls}  —  RED ${rs}`, 10, 27, { size: 46, color: '#bff7ff' }), scan];
      if (i >= 16) layers.push({ type: 'alert', text: '⚠ BALL SPITE ACTIVE', t: i - 16, y: 33, size: 30 });
      await rec.shot(layers, scored >= 0 && rec.n - scored < 4 ? { rgb: 12 } : null);
      await g.step(2);
    }
    M.punch = rec.n;
    for (let k = 0; k < 75; k++) {
      await g.ev(HIDE);
      const st = J(await g.ev('JSON.stringify({ls:leftScore, rs:rightScore})'));
      await rec.shot([hook(H, 99), strip(`BLUE ${st.ls}  —  RED ${st.rs}`, 30, 27, { size: 46, color: '#bff7ff' }),
        word('It always helps whoever’s losing.', k, 75, { y: 68, size: 64 }), scan]);
      await g.step(2);
    }
    M.end = await endCard(g, rec);
    await rec.save({ marks: M });
    await g.close();
  },

  // ── Pong, but… the ball can juke you ───────────────────────────────────────
  async v_juke() {
    const g = await vboot(231);
    await vstart(g, 'classic', 'hard');
    const rec = g.recorder('v_juke');
    const M = {};
    const H = 'Pong, but the ball can juke you';
    // Short natural rally, then the juke on blue's next return.
    await g.ev(CALM + HIDE + 'heat=55; ballX=450; ballY=800; vx=-8; vy=3; ballTrail=[];');
    for (let i = 0; i < 70; i++) { await g.ev(CALM + HIDE + 'heat=Math.max(heat,55);'); await rec.shot([hook(H, i), scan]); await g.step(2); }
    await g.ev(CALM + HIDE + `aiVsAiMode=false; leftY=700; ballX=820; ballY=560; vx=-9.5; vy=4.2; ballTrail=[]; keys.w=false; keys.s=false;`);
    let juked = -1, passed = false, scored = -1, commit = null;
    for (let i = 0; scored < 0 || rec.n < scored + 14; i++) {
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW, rs:rightScore})'));
      const t = st.vx < 0 ? (st.bx - st.lx) / -st.vx : 999;
      if (juked < 0) commit = st.by + st.vy * t;
      const center = st.ly + st.ph / 2;
      if (st.vx < 0 && i > 2 && !passed) await g.ev(`keys.s = ${commit > center + 10}; keys.w = ${commit < center - 10};`);
      if (juked < 0 && st.vx < 0 && st.bx < VW * 0.30) {
        await g.ev('vy = -Math.sign(vy) * 7.5; glitchPulse = Math.max(glitchPulse, 14); pongAudio.juke();');
        juked = rec.n; M.juke = juked;
      }
      await g.ev(CALM + HIDE + 'heat=Math.max(heat,55);');
      if (scored < 0 && st.rs > 0) { scored = rec.n; M.score = scored; }
      const slow = juked >= 0 && !passed;
      await rec.shot([hook(H, 99), scan], slow ? { rgb: 5 } : null);
      if (!passed && juked >= 0 && st.bx < 34) {
        passed = true; await g.ev('keys.w=false; keys.s=false;');
        M.freeze = rec.n;
        for (let h = 0; h < 18; h++) await rec.shot([hook(H, 99), word('ANKLES: BROKEN', h, 60, { y: 66, size: 86 }), scan], h < 3 ? { rgb: 14, slices: 4 } : { rgb: 3 });
      }
      await g.step(slow || (juked < 0 && st.bx < 330 && st.vx < 0) ? 1 : 2);
    }
    for (let k = 0; k < 40; k++) { await g.ev(HIDE); await rec.shot([hook(H, 99), word('ANKLES: BROKEN', 18 + k, 58, { y: 66, size: 86 }), scan]); await g.step(2); }
    M.end = await endCard(g, rec);
    await rec.save({ marks: M });
    await g.close();
  },

  // ── Pong, but… the walls glitch ────────────────────────────────────────────
  async v_walls() {
    const g = await vboot(241);
    await vstart(g, 'classic', 'hard');
    const rec = g.recorder('v_walls');
    const M = {};
    const H = 'Pong, but the walls glitch';
    const wallAhead = `{ const ww=34, wh=150; const wx=Math.round(Math.max(90, Math.min(canvas.width-130, ballX + vx*22 - ww/2))); const wy=Math.round(Math.max(60, Math.min(canvas.height-210, ballY + vy*22 - wh/2)));
      glitchWalls.push({x:wx,y:wy,w:ww,h:wh,phase:'warning',warningTimer:12,warningMax:12,solidTimer:400,dyingTimer:0,dyingMax:52,chunks:makeWallChunks(ww,wh),fragments:[],rgbOff:2,scanOff:3,__mine:true}); }`;
    await g.ev(`teleportCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; ${HIDE} heat=40; clearGlitchWalls();`);
    let placed = false, broke = -1, slowLeft = 0;
    for (let i = 0; broke < 0 ? i < 600 : rec.n < broke + 70; i++) {
      const h = Math.min(92, 40 + i * 0.5);
      await g.ev(`teleportCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; leftScore=0; rightScore=0; ${HIDE} heat=Math.max(heat, ${h});`);
      if ([20, 40, 60, 80, 95].includes(i)) await g.ev('trySpawnGlitchWall()');
      if (!placed && i >= 100) {
        const ok = J(await g.ev('JSON.stringify(!roundFrozen && Math.abs(vx) > 4 && ballX > 250 && ballX < 650 && ballY > 300 && ballY < 1300)'));
        if (ok) { await g.ev('glitchWalls = glitchWalls.filter(w => !w.__mine);' + wallAhead); placed = true; M.placed = rec.n; }
      }
      if (placed && broke < 0 && rec.n - M.placed > 60) placed = false;
      const st = J(await g.ev(`JSON.stringify({h:heat, b: glitchWalls.some(w => w.__mine && w.phase === 'dying'), w: glitchWalls.find(w => w.__mine) || null})`));
      if (broke < 0 && st.b) { broke = rec.n; M.shatter = broke; slowLeft = 34; }
      const layers = [hook(H, i), { type: 'heat', v: st.h, top: 400, left: 40 }, scan];
      if (broke >= 0) layers.push(word('The arena fights back.', rec.n - broke, 70, { y: 70, size: 68 }));
      if (st.w && slowLeft > 0) await g.cam({ scale: 1.5, ox: (st.w.x + st.w.w / 2) / VW * 100, oy: (st.w.y + st.w.h / 2) / VH * 100 });
      else if (slowLeft === 0) await g.cam({});
      await rec.shot(layers, broke >= 0 && rec.n - broke < 3 ? { rgb: 12, slices: 3 } : null);
      await g.step(slowLeft > 0 ? 1 : 2);
      if (slowLeft > 0) slowLeft--;
    }
    if (broke < 0) throw new Error('v_walls: wall never shattered');
    await g.cam({});
    M.end = await endCard(g, rec);
    await rec.save({ marks: M });
    await g.close();
  },

  // ── Pong, but… there's a black hole ────────────────────────────────────────
  async v_blackhole() {
    const g = await vboot(251);
    await vstart(g, 'blackhole', 'hard');
    const rec = g.recorder('v_blackhole');
    const M = {};
    const H = "Pong, but there's a black hole";
    await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; ${HIDE} heat=88;`);
    for (let i = 0; i < 100; i++) { await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; ${HIDE} heat=Math.max(heat,88);`); await rec.shot([hook(H, i), scan]); await g.step(2); }
    // A slow pass right past the singularity so the pull visibly bends the ball.
    await g.ev(`ballX=120; ballY=640; vx=5.2; vy=0.8; ballTrail=[]; teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999;`);
    M.pass = rec.n;
    for (let k = 0; k < 110; k++) {
      await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999; ${HIDE} heat=Math.max(heat,88);`);
      const z = k < 15 ? 1 + k * 0.025 : k > 95 ? 1.375 - (k - 95) * 0.025 : 1.375;
      await g.cam({ scale: z, ox: 50, oy: 50 });
      await rec.shot([hook(H, 99), ...(k > 10 ? [word('It bends the ball.', k - 10, 100, { y: 72, size: 70 })] : []), scan]);
      await g.step(k < 95 ? 1 : 2);
    }
    await g.cam({});
    M.punch = rec.n;
    for (let k = 0; k < 75; k++) {
      await g.ev(`powerupSpawnCooldown=99999; ${HIDE} heat=Math.max(heat,88);`);
      await rec.shot([hook(H, 99), word('Gravity is not on your side.', k, 75, { y: 70, size: 66 }), scan]);
      await g.step(2);
    }
    M.end = await endCard(g, rec);
    await rec.save({ marks: M });
    await g.close();
  },

  // ── Pong, but… there's a boss ──────────────────────────────────────────────
  async v_boss() {
    const g = await vboot(261);
    await vstart(g, 'matrix', 'hard');
    await g.ev('ensureBossAssets(); 1');
    await sleep(2500); // let the Eye images finish loading (real time; the game clock is virtual)
    const rec = g.recorder('v_boss');
    const M = {};
    const H = "Pong, but there's a boss";
    let trig = false;
    for (let i = 0; !trig; i++) {
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, pb:preBossActive||bossModeActive})'));
      if (st.pb) throw new Error('v_boss: boss triggered early');
      const shown = Math.min(100, 88 + i * 0.3);
      if (i >= 40 && st.bx > 220 && st.bx < 680 && st.by > 420 && st.by < 1250) { await g.ev(HIDE + 'heat=100; triggerPreBoss();'); trig = true; M.trigger = rec.n; break; }
      await g.ev(`${HIDE} powerupSpawnCooldown=99999; teleportCooldown=99999; heat=Math.min(85, ${shown});`);
      const layers = [hook(H, i), { type: 'heat', v: i >= 40 ? 100 : shown, top: 400, left: 40 }, scan];
      if (i >= 40) layers.push({ type: 'alert', text: '⚡ HEAT 100%', t: i - 40, y: 28, size: 36 });
      await rec.shot(layers, i >= 40 ? { rgb: 6 } : null);
      await g.step(2);
      if (i > 400) throw new Error('v_boss: no trigger window');
    }
    // Freeze + angry bubble (slow), glitch to center, morph with a push-in.
    const snap = J(await g.ev('JSON.stringify([ballX/canvas.width*100, ballY/canvas.height*100])'));
    for (let k = 0; k < 194;) {
      const per = k < 40 ? 1 : 2;
      let z = 1, ox = snap[0], oy = snap[1];
      if (k < 80) z = 1 + 0.35 * Math.min(1, k / 30);
      else if (k < 120) { const t = (k - 80) / 40; z = 1.35 - 0.2 * t; ox = snap[0] + (50 - snap[0]) * t; oy = snap[1] + (50 - snap[1]) * t; }
      else { z = 1.15 + 1.2 * Math.min(1, (k - 120) / 60); ox = 50; oy = 50; }
      await g.cam({ scale: z, ox, oy });
      await g.ev(HIDE);
      const glitching = k >= 80 && k < 120;
      await rec.shot([hook(H, 99), { type: 'vignette', alpha: 0.55 }, scan], glitching ? { rgb: 8 + (k % 5) * 3, slices: k % 4 === 0 ? 4 : 0 } : null);
      await g.step(per);
      k += per;
    }
    await g.cam({});
    // Crisp close-up of the Eye (the game's own boss art).
    M.stare = rec.n;
    for (let k = 0; k < 42; k++) {
      const look = k < 10 ? 'left' : k < 18 ? 'right' : 'neutral';
      await rec.shot([{ type: 'fill', color: '#050006', alpha: 1 }, { type: 'eye', look, sy: k < 4 ? k / 4 : 1, w: 640 }, scan,
        word("IT'S BEEN", Math.max(0, k - 10), 60, { y: 30, size: 84 }), word('WATCHING YOU.', Math.max(0, k - 14), 60, { y: 70, size: 84 })],
        k < 3 ? { rgb: 14, flash: 0.3 } : null);
      await g.step(2);
    }
    // Boss alarm: red arena, orbital shots.
    M.alarm = rec.n;
    for (let k = 0; k < 96; k++) {
      await g.ev(HIDE);
      const layers = [hook(H, 99), scan];
      if (k >= 50) layers.push(word('Part 2?', k - 50, 60, { y: 70, size: 96 }));
      await rec.shot(layers, k < 4 ? { flash: 0.45 - k * 0.1, rgb: 10 } : null);
      await g.step(2);
    }
    M.end = await endCard(g, rec);
    await rec.save({ marks: M });
    await g.close();
  },

  // ── Which one is real? (full reveal + teaser that ends on the freeze) ──────
  async v_real() {
    const g = await vboot(271);
    await vstart(g, 'classic', 'hard');
    const rec = g.recorder('v_real');
    const M = {};
    const H = 'Only one of these is real.';
    await g.ev(CALM + HIDE + `aiVsAiMode=false; heat=60; decoys=[]; leftY=730; rightY=740; ballX=520; ballY=800; vx=9; vy=0.3; ballTrail=[];`);
    let split = -1, frozen = false, guess = null, real = null, scored = -1;
    for (let i = 0; scored < 0 || rec.n < scored + 12; i++) {
      if (i === 2) await g.ev('grantPowerup("red","split")');
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, vx, ly:leftY, ph:paddleH, rs:rightScore, dec:decoys.map(d=>[d.x,d.y])})'));
      if (split < 0 && i > 2 && st.vx < 0 && st.dec.length >= 2) split = rec.n;
      const k = split < 0 ? -1 : rec.n - split;
      await g.ev(CALM + HIDE + 'heat=Math.max(heat,60);');
      if (split >= 0 && guess === null) guess = st.dec[0][1];
      if (guess !== null && scored < 0) await g.ev(`keys.s = ${guess > st.ly + st.ph / 2 + 10}; keys.w = ${guess < st.ly + st.ph / 2 - 10};`);
      if (scored < 0 && st.rs > 0) { scored = rec.n; M.score = scored; await g.ev('keys.w=false; keys.s=false;'); }
      if (!frozen && k === 24) {
        // Freeze with the three balls numbered top-to-bottom.
        const balls = [[st.bx, st.by, true], ...st.dec.map(([x, y]) => [x, y, false])].sort((a, b) => a[1] - b[1]);
        real = balls.findIndex((b) => b[2]);
        M.realIndex = real + 1;
        M.freeze = rec.n;
        const rings = (t) => balls.map(([x, y], n) => ({ type: 'ring', x, y, r: 38, t, color: '#ffd166', label: String(n + 1), size: 48 }));
        for (let h = 0; h < 96; h++) {
          await rec.shot([{ type: 'fill', color: '#000', alpha: 0.35 }, hook(H, 99), ...rings(10 + h),
            word('Comment 1, 2 or 3', Math.min(h, 30), 999, { y: 70, size: 60 }), scan], h < 3 ? { rgb: 12, slices: 3 } : (h % 24 === 0 ? { rgb: 6 } : null));
        }
        M.freezeEnd = rec.n;
        frozen = true;
        continue;
      }
      const near = frozen && scored < 0 && st.bx < 260 && st.vx < 0;
      const layers = [hook(H, i), scan];
      if (frozen && scored < 0) layers.push({ type: 'ring', x: st.bx, y: st.by, r: 34, t: 20, color: '#55ff9a', label: 'REAL', size: 32 });
      await rec.shot(layers, k >= 0 && k < 4 ? { rgb: 10, slices: 3 } : null);
      await g.step(near ? 1 : 2);
    }
    M.punch = rec.n;
    for (let k = 0; k < 50; k++) { await g.ev(HIDE); await rec.shot([hook(H, 99), word(`It was #${M.realIndex}. Did you get it?`, k, 50, { y: 70, size: 64 }), scan]); await g.step(2); }
    M.end = await endCard(g, rec);
    M.endEnd = rec.n;
    M.teaserEnd = await endCard(g, rec, { line1: 'ANSWER IN PART 2', line2: 'FOLLOW' });
    await rec.save({ marks: M });
    await g.close();
  }
};

(async () => {
  for (const name of process.argv.slice(2)) {
    const t = Date.now();
    await SHORTS[name]();
    console.log(name, 'done in', Math.round((Date.now() - t) / 1000), 's');
  }
})().catch((e) => { console.error(e); process.exit(1); });
