// Vertical (9:16) shorts for TikTok / Reels / Shorts (see docs/short-form-plan.md), "follow crop" layout:
// the game is captured as a normal 1920x1080 landscape court, then compose.js cuts a 9:16 window that
// tracks the action and draws the text upright on top. This script records the landscape frames plus,
// per frame, the ball position, optional camera focus/zoom and the vertical overlay layers.
// Usage: node shorts.js v_tired v_grudge ...   (output: ../frames/<name>/, camera track in meta.json "v")
const { open } = require('./harness');

const W = 1920, H = 1080;
const HIDE = 'hud.style.display="none"; help.style.display="none"; portraitWarnEl.style.display="none";';
const CALM = 'teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; decoyCooldown=99999;';
const J = (s) => JSON.parse(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(seed) {
  const g = await open({ width: W, height: H });
  await g.js(() => document.querySelector('#playNowHero').click());
  for (let k = 0; k < 60 && !(await g.js(() => typeof window.__gpEval === 'function')); k++) await g.step(10);
  await g.step(30);
  await g.js((s) => window.__seed(s), seed);
  return g;
}

async function start(g, arena = 'classic', diff = 'hard') {
  await g.ev(`aiVsAiMode=true; aiDifficulty='${diff}'; currentArenaId='${arena}'; {const a=getArena(); a.cleanup&&a.cleanup(); a.init&&a.init();} beginMode(false); ${HIDE} 1`);
  await g.step(150);
  await g.ev(HIDE);
}

// Recorder wrapper: landscape frame (no browser overlay) + vertical camera/overlay record.
function cropRec(g, name) {
  const rec = g.recorder(name);
  const V = [];
  return {
    get n() { return rec.n; },
    // cam: { f: [x, y] focus in game px, z: zoom (1 = full court height), snap: true to cut instead of pan }
    async shot(layers, fx = null, cam = {}) {
      await g.ev(HIDE);
      const b = J(await g.ev('JSON.stringify([Math.round(ballX), Math.round(ballY)])'));
      await rec.shot([], fx);
      V.push({ b, L: layers, ...cam });
    },
    hold(k) { rec.hold(k); for (let i = 0; i < k; i++) V.push(V[V.length - 1]); },
    save(marks) { return rec.save({ marks, v: V }); }
  };
}

const hook = (text, t) => ({ type: 'hook', text, t, y: 14 });
const word = (text, t, d, o = {}) => ({ type: 'word', text, t, d, y: 66, size: 88, ...o });
const strip = (text, t, y, o = {}) => ({ type: 'strip', text, t, y, size: 60, color: '#f4fbff', weight: 900, ...o });
const scan = { type: 'scan', alpha: 0.1 };
// Ring marker at a game-space position; compose.js maps gx/gy into the cropped frame.
const gring = (gx, gy, t, o = {}) => ({ type: 'ring', gx, gy, r: 38, t, color: '#ff4f6d', ...o });

async function endCard(g, r, { line1 = 'PLAY IN YOUR BROWSER', line2 = 'LINK IN BIO', frames = 54 } = {}) {
  const startAt = r.n;
  for (let i = 0; i < frames; i++) {
    await r.shot([
      { type: 'fill', color: '#02040a', alpha: 0.76 }, scan, { type: 'vignette', alpha: 0.5 },
      { type: 'logo', t: i, d: 999, scale: 0.62, y: 36 },
      { type: 'strip', text: line1, t: i, y: 52, size: 36, color: '#f4fbff', weight: 900 },
      { type: 'strip', text: line2, t: Math.max(0, i - 6), y: 58, size: 50, color: '#ffd166', weight: 900 }
    ], i < 5 ? { rgb: 16 - i * 3, slices: 4 } : null);
    await g.step(2);
  }
  return startAt;
}

const SHORTS = {
  // ── Pong, but… the ball gets tired ─────────────────────────────────────────
  async v_tired() {
    for (const seed of [201, 202, 203, 204, 205, 206]) {
      const g = await boot(seed);
      await start(g, 'classic', 'hard');
      const r = cropRec(g, 'v_tired');
      const M = {};
      const Hk = 'Pong, but the ball gets tired';
      await g.ev(CALM + 'heat=30; rallyHits=26; ballX=960; ballY=540; vx=-7; vy=2.5; ballTrail=[];');
      let ok = true;
      for (let k = 0; k < 900 && J(await g.ev('rallyHits')) < 29; k++) { await g.ev(CALM + 'heat=Math.min(heat,40);'); await g.step(2); }
      for (let i = 0; ; i++) {
        const st = J(await g.ev('JSON.stringify({r:rallyHits, s:leftScore+rightScore})'));
        if (st.s > 0 || st.r < 29 || i > 330) { ok = false; break; }
        if (st.r >= 30) break;
        await g.ev(CALM + 'heat=Math.min(heat,40);');
        await r.shot([hook(Hk, i), strip(`RALLY ${st.r}`, 20, 72, { size: 70 }), scan]);
        await g.step(2);
      }
      if (ok) {
        M.drowsy = r.n;
        for (let k = 0; k < 120; k++) {
          const st = J(await g.ev('JSON.stringify({x:ballX, y:ballY, s:leftScore+rightScore})'));
          if (st.s > 0) { ok = false; break; }
          await g.ev(CALM + 'rallyHits=Math.max(rallyHits,31); heat=Math.min(heat,40); vx=Math.sign(vx)*Math.min(Math.abs(vx),5.5); drowsyWarningTimer=0;');
          // Push in on the ball so the Z's read.
          await r.shot([hook(Hk, 99), strip('RALLY 30 💤', 20, 72, { size: 70, color: '#9fd8ff' }), scan], k < 3 ? { rgb: 8 } : null,
            { f: [st.x, st.y - 30], z: 1 + Math.min(0.7, k * 0.035) });
          await g.step(2);
        }
        if (ok) {
          M.punch = r.n;
          for (let k = 0; k < 75; k++) {
            await g.ev(CALM + 'rallyHits=Math.max(rallyHits,31); heat=Math.min(heat,40); vx=Math.sign(vx)*Math.min(Math.abs(vx),5.5); drowsyWarningTimer=0;');
            await r.shot([hook(Hk, 99), word('It needed a nap.', k, 75, { y: 70, size: 76 }), scan], null, { z: 1.7 - 0.7 * Math.min(1, k / 14) });
            await g.step(2);
          }
          M.end = await endCard(g, r);
          await r.save(M);
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
    const g = await boot(211);
    await start(g, 'classic', 'hard');
    const r = cropRec(g, 'v_grudge');
    const M = {};
    const Hk = 'Pong, but the ball holds a grudge';
    const GAP = 330;
    const ring = (t) => gring(28, GAP, t, { label: 'LAST MISS', size: 28 });
    const aim = `{ const t=(ballX-(leftX+paddleW))/-vx; vy=(${GAP}-ballY)/t; }`;
    // Miss #1: blue reads it wrong and the ball slips past the top.
    await g.ev(CALM + `aiVsAiMode=false; heat=40; leftY=520; ballX=1150; ballY=820; vx=-10; ballTrail=[]; keys.w=false; keys.s=false;`);
    await g.ev(aim);
    let miss = -1;
    for (let i = 0; miss < 0 || r.n < miss + 22; i++) {
      await g.ev(CALM + `keys.s = ${i > 6 && i < 22};`);
      const st = J(await g.ev('JSON.stringify({rs:rightScore})'));
      if (miss < 0 && st.rs > 0) { miss = r.n; M.miss1 = miss; }
      // Once it's scored, hold the camera on the goal line where it went in.
      await r.shot([hook(Hk, i), ...(miss >= 0 ? [ring(r.n - miss)] : []), scan], null, miss >= 0 ? { f: [200, 540] } : {});
      await g.step(2);
    }
    // Cut past the countdown to the next serve, which goes straight back to the gap.
    await g.ev('keys.s=false; keys.w=false;');
    for (let k = 0; k < 400 && J(await g.ev('JSON.stringify(roundFrozen || countdownActive)')); k++) await g.step(1);
    await g.ev(`leftY=520; ballX=1000; ballY=560; vx=-9.5; ballTrail=[];`);
    await g.ev(aim);
    M.serve = r.n;
    let miss2 = -1;
    for (let i = 0; miss2 < 0 || r.n < miss2 + 14; i++) {
      await g.ev(CALM + 'leftY=520;');
      const st = J(await g.ev('JSON.stringify({rs:rightScore, bx:ballX})'));
      if (miss2 < 0 && st.rs > 1) { miss2 = r.n; M.miss2 = miss2; }
      const layers = [hook(Hk, 99), ring(30 + i), scan];
      if (i < 50) layers.push(word('Next serve…', i, 50, { y: 70, size: 66 }));
      const slow = miss2 < 0 && st.bx < 420;
      await r.shot(layers, i < 4 ? { rgb: 14 - i * 3, slices: 4 } : null, { snap: i === 0, ...(miss2 >= 0 ? { f: [200, 540] } : {}) });
      await g.step(slow ? 1 : 2);
    }
    r.hold(8);
    M.punch = r.n;
    for (let k = 0; k < 60; k++) {
      await r.shot([hook(Hk, 99), ring(80 + k), word('It remembers.', k, 60, { y: 70, size: 84 }), scan], null, { f: [200, 540] });
      await g.step(2);
    }
    M.end = await endCard(g, r);
    await r.save(M);
    await g.close();
  },

  // ── Pong, but… the ball picks sides ────────────────────────────────────────
  async v_sides() {
    const g = await boot(221);
    await start(g, 'classic', 'hard');
    const r = cropRec(g, 'v_sides');
    const M = {};
    const Hk = 'Pong, but the ball picks sides';
    await g.ev(CALM + 'heat=35; leftScore=5; rightScore=1; spiteBias=-1; ballX=960; ballY=300; vx=9; vy=-6; ballTrail=[];');
    let staged = false, scored = -1;
    for (let i = 0; scored < 0 || r.n < scored + 16; i++) {
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW, ls:leftScore, rs:rightScore})'));
      if (!staged) await g.ev(CALM + 'leftScore=5; rightScore=1; spiteBias=-1;');
      else await g.ev(CALM);
      // After the setup, blue (the leader) gets beaten: the paddle drifts the wrong way.
      if (!staged && i > 90 && st.vx < 0 && st.bx < 1300) { staged = true; await g.ev('aiVsAiMode=false;'); }
      if (staged && scored < 0) {
        const t = (st.bx - st.lx) / Math.max(1, -st.vx);
        const target = st.by + st.vy * t, center = st.ly + st.ph / 2;
        await g.ev(`keys.w = ${target > center}; keys.s = ${target <= center};`);
      }
      if (scored < 0 && st.rs > 1) { scored = r.n; M.score = scored; await g.ev('keys.w=false; keys.s=false;'); }
      const ls = staged ? st.ls : 5, rs = staged ? st.rs : 1;
      const layers = [hook(Hk, i), strip(`BLUE ${ls}  —  RED ${rs}`, 10, 27, { size: 46, color: '#bff7ff' }), scan];
      if (i >= 16) layers.push({ type: 'alert', text: '⚠ BALL SPITE ACTIVE', t: i - 16, y: 33, size: 30 });
      await r.shot(layers, scored >= 0 && r.n - scored < 4 ? { rgb: 12 } : null, scored >= 0 ? { f: [200, 540] } : {});
      await g.step(2);
    }
    M.punch = r.n;
    for (let k = 0; k < 60; k++) {
      const st = J(await g.ev('JSON.stringify({ls:leftScore, rs:rightScore})'));
      await r.shot([hook(Hk, 99), strip(`BLUE ${st.ls}  —  RED ${st.rs}`, 30, 27, { size: 46, color: '#bff7ff' }),
        word('It always helps whoever’s losing.', k, 60, { y: 68, size: 64 }), scan]);
      await g.step(2);
    }
    M.end = await endCard(g, r);
    await r.save(M);
    await g.close();
  },

  // ── Pong, but… the ball can juke you ───────────────────────────────────────
  async v_juke() {
    const g = await boot(231);
    await start(g, 'classic', 'hard');
    const r = cropRec(g, 'v_juke');
    const M = {};
    const Hk = 'Pong, but the ball can juke you';
    await g.ev(CALM + 'heat=55; ballX=960; ballY=540; vx=-9; vy=3; ballTrail=[];');
    for (let i = 0; i < 70; i++) { await g.ev(CALM + 'heat=Math.max(heat,55);'); await r.shot([hook(Hk, i), scan]); await g.step(2); }
    await g.ev(CALM + `aiVsAiMode=false; leftY=470; ballX=1450; ballY=300; vx=-11; vy=3.4; ballTrail=[]; keys.w=false; keys.s=false;`);
    let juked = -1, passed = false, scored = -1, commit = null;
    for (let i = 0; scored < 0 || r.n < scored + 14; i++) {
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW, rs:rightScore})'));
      const t = st.vx < 0 ? (st.bx - st.lx) / -st.vx : 999;
      if (juked < 0) commit = st.by + st.vy * t;
      const center = st.ly + st.ph / 2;
      if (st.vx < 0 && i > 2 && !passed) await g.ev(`keys.s = ${commit > center + 10}; keys.w = ${commit < center - 10};`);
      if (juked < 0 && st.vx < 0 && st.bx < 330) {
        await g.ev('vy = -Math.sign(vy) * 8; glitchPulse = Math.max(glitchPulse, 14); pongAudio.juke();');
        juked = r.n; M.juke = juked;
      }
      await g.ev(CALM + 'heat=Math.max(heat,55);');
      if (scored < 0 && st.rs > 0) { scored = r.n; M.score = scored; }
      const slow = juked >= 0 && !passed;
      await r.shot([hook(Hk, 99), scan], slow ? { rgb: 5 } : null, juked >= 0 ? { f: [260, 540] } : {});
      if (!passed && juked >= 0 && st.bx < 34) {
        passed = true; await g.ev('keys.w=false; keys.s=false;');
        M.freeze = r.n;
        for (let h = 0; h < 18; h++) await r.shot([hook(Hk, 99), word('ANKLES: BROKEN', h, 60, { y: 66, size: 86 }), scan], h < 3 ? { rgb: 14, slices: 4 } : { rgb: 3 }, { f: [260, 540] });
      }
      await g.step(slow || (juked < 0 && st.bx < 520 && st.vx < 0) ? 1 : 2);
    }
    for (let k = 0; k < 40; k++) { await r.shot([hook(Hk, 99), word('ANKLES: BROKEN', 18 + k, 58, { y: 66, size: 86 }), scan]); await g.step(2); }
    M.end = await endCard(g, r);
    await r.save(M);
    await g.close();
  },

  // ── Pong, but… the walls glitch ────────────────────────────────────────────
  async v_walls() {
    const g = await boot(241);
    await start(g, 'classic', 'hard');
    const r = cropRec(g, 'v_walls');
    const M = {};
    const Hk = 'Pong, but the walls glitch';
    await g.ev(`teleportCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; heat=40; clearGlitchWalls();`);
    let placed = false, broke = -1, slowLeft = 0, wallAt = null;
    for (let i = 0; broke < 0 ? i < 600 : r.n < broke + 70; i++) {
      const h = Math.min(92, 40 + i * 0.5);
      await g.ev(`teleportCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; leftScore=0; rightScore=0; heat=Math.max(heat, ${h});`);
      if ([20, 40, 60, 80, 95].includes(i)) await g.ev('trySpawnGlitchWall()');
      // Stage the hit: a mid-court ball heading straight into a fresh wall.
      if (!placed && i === 100) {
        await g.ev(`ballX=640; ballY=560; vx=9; vy=0.6; ballTrail=[]; glitchWalls = glitchWalls.filter(w => w.x + w.w < 900 || w.x > 1250);
          glitchWalls.push({x:1050,y:470,w:34,h:150,phase:'warning',warningTimer:12,warningMax:12,solidTimer:400,dyingTimer:0,dyingMax:52,chunks:makeWallChunks(34,150),fragments:[],rgbOff:2,scanOff:3,__mine:true});`);
        placed = true; M.placed = r.n;
      }
      const st = J(await g.ev(`JSON.stringify({h:heat, b: glitchWalls.some(w => w.__mine && w.phase === 'dying'), w: glitchWalls.find(w => w.__mine) || null})`));
      if (st.w) wallAt = [st.w.x + st.w.w / 2, st.w.y + st.w.h / 2];
      if (broke < 0 && st.b) { broke = r.n; M.shatter = broke; slowLeft = 34; }
      const layers = [hook(Hk, i), { type: 'heat', v: st.h, top: 400, left: 40 }, scan];
      if (broke >= 0) layers.push(word('The arena fights back.', r.n - broke, 70, { y: 70, size: 68 }));
      // While the placed wall is live, frame it; zoom in for the shatter.
      const cam = slowLeft > 0 && wallAt ? { f: wallAt, z: 1.6 } : placed && wallAt && broke < 0 ? { f: wallAt } : {};
      await r.shot(layers, broke >= 0 && r.n - broke < 3 ? { rgb: 12, slices: 3 } : null, cam);
      await g.step(slowLeft > 0 ? 1 : 2);
      if (slowLeft > 0) slowLeft--;
    }
    if (broke < 0) throw new Error('v_walls: wall never shattered');
    M.end = await endCard(g, r);
    await r.save(M);
    await g.close();
  },

  // ── Pong, but… there's a black hole ────────────────────────────────────────
  async v_blackhole() {
    const g = await boot(251);
    await start(g, 'blackhole', 'hard');
    const r = cropRec(g, 'v_blackhole');
    const M = {};
    const Hk = "Pong, but there's a black hole";
    await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; heat=88;`);
    for (let i = 0; i < 90; i++) { await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; heat=Math.max(heat,88);`); await r.shot([hook(Hk, i), scan]); await g.step(2); }
    // A slow pass right past the singularity so the pull visibly bends the ball.
    await g.ev(`ballX=420; ballY=440; vx=5.6; vy=0.7; ballTrail=[]; teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999;`);
    M.pass = r.n;
    for (let k = 0; k < 120; k++) {
      await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999; heat=Math.max(heat,88);`);
      const z = k < 15 ? 1 + k * 0.01 : k > 100 ? 1.15 - (k - 100) * 0.0075 : 1.15;
      const b = J(await g.ev('JSON.stringify([ballX, ballY])'));
      await r.shot([hook(Hk, 99), ...(k > 10 ? [word('It bends the ball.', k - 10, 110, { y: 72, size: 70 })] : []), scan], null,
        { f: [(b[0] + 960) / 2, (b[1] + 540) / 2], z, snap: k === 0 });
      await g.step(k < 100 ? 1 : 2);
    }
    M.punch = r.n;
    for (let k = 0; k < 75; k++) {
      await g.ev(`powerupSpawnCooldown=99999; heat=Math.max(heat,88);`);
      await r.shot([hook(Hk, 99), word('Gravity is not on your side.', k, 75, { y: 70, size: 66 }), scan]);
      await g.step(2);
    }
    M.end = await endCard(g, r);
    await r.save(M);
    await g.close();
  },

  // ── Pong, but… there's a boss ──────────────────────────────────────────────
  async v_boss() {
    const g = await boot(261);
    await start(g, 'matrix', 'hard');
    await g.ev('ensureBossAssets(); 1');
    await sleep(2500); // let the Eye images finish loading (real time; the game clock is virtual)
    const r = cropRec(g, 'v_boss');
    const M = {};
    const Hk = "Pong, but there's a boss";
    for (let i = 0; ; i++) {
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, pb:preBossActive||bossModeActive})'));
      if (st.pb) throw new Error('v_boss: boss triggered early');
      const shown = Math.min(100, 88 + i * 0.3);
      if (i >= 40 && st.bx > 380 && st.bx < 1500 && st.by > 180 && st.by < 920) { await g.ev('heat=100; triggerPreBoss();'); M.trigger = r.n; break; }
      await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=99999; heat=Math.min(85, ${shown});`);
      const layers = [hook(Hk, i), { type: 'heat', v: i >= 40 ? 100 : shown, top: 400, left: 40 }, scan];
      if (i >= 40) layers.push({ type: 'alert', text: '⚡ HEAT 100%', t: i - 40, y: 28, size: 36 });
      await r.shot(layers, i >= 40 ? { rgb: 6 } : null);
      await g.step(2);
      if (i > 400) throw new Error('v_boss: no trigger window');
    }
    // Freeze + angry bubble (slow), glitch to center, morph with a push-in on the Eye.
    const snap = J(await g.ev('JSON.stringify([ballX, ballY])'));
    for (let k = 0; k < 194;) {
      const per = k < 40 ? 1 : 2;
      let cam;
      if (k < 80) cam = { f: [snap[0] + 50, snap[1] - 30], z: 1 + 0.35 * Math.min(1, k / 30) };
      else if (k < 120) cam = { f: [960, 540], z: 1.2 };
      else cam = { f: [960, 540], z: 1.2 + 1.3 * Math.min(1, (k - 120) / 60) };
      const glitching = k >= 80 && k < 120;
      await r.shot([hook(Hk, 99), { type: 'vignette', alpha: 0.55 }, scan], glitching ? { rgb: 8 + (k % 5) * 3, slices: k % 4 === 0 ? 4 : 0 } : null, cam);
      await g.step(per);
      k += per;
    }
    // Crisp close-up of the Eye (the game's own boss art).
    M.stare = r.n;
    for (let k = 0; k < 42; k++) {
      const look = k < 10 ? 'left' : k < 18 ? 'right' : 'neutral';
      await r.shot([{ type: 'fill', color: '#050006', alpha: 1 }, { type: 'eye', look, sy: k < 4 ? k / 4 : 1, w: 640 }, scan,
        word("IT'S BEEN", Math.max(0, k - 10), 60, { y: 30, size: 84 }), word('WATCHING YOU.', Math.max(0, k - 14), 60, { y: 70, size: 84 })],
        k < 3 ? { rgb: 14, flash: 0.3 } : null, { f: [960, 540], z: 1.3 });
      await g.step(2);
    }
    // Boss fight: the Eye and its orbital shots at the center of the court.
    M.alarm = r.n;
    for (let k = 0; k < 96; k++) {
      const layers = [hook(Hk, 99), scan];
      if (k >= 50) layers.push(word('Part 2?', k - 50, 60, { y: 70, size: 96 }));
      await r.shot(layers, k < 4 ? { flash: 0.45 - k * 0.1, rgb: 10 } : null, { f: [960, 540], z: 1.3 - Math.min(0.3, k * 0.01), snap: k === 0 });
      await g.step(2);
    }
    M.end = await endCard(g, r);
    await r.save(M);
    await g.close();
  },

  // ── Which one is real? (full reveal + teaser that ends on the freeze) ──────
  async v_real() {
    const g = await boot(271);
    await start(g, 'classic', 'hard');
    const r = cropRec(g, 'v_real');
    const M = {};
    const Hk = 'Only one of these is real.';
    await g.ev(CALM + `aiVsAiMode=false; heat=60; decoys=[]; leftY=470; rightY=480; ballX=1350; ballY=540; vx=10; vy=0.3; ballTrail=[];`);
    let split = -1, frozen = false, guess = null, scored = -1, groupX = null;
    for (let i = 0; scored < 0 || r.n < scored + 12; i++) {
      if (i === 2) await g.ev('grantPowerup("red","split")');
      const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW, rs:rightScore, dec:decoys.map(d=>[d.x,d.y,d.vx,d.vy])})'));
      if (split < 0 && i > 2 && st.vx < 0 && st.dec.length >= 2) split = r.n;
      const k = split < 0 ? -1 : r.n - split;
      await g.ev(CALM + 'heat=Math.max(heat,60);');
      // Blue commits to the decoy whose path diverges most from the real ball and moves to where it will arrive.
      if (split >= 0 && guess === null) guess = st.dec.reduce((bi, d, k, a) => (Math.abs(d[3] - st.vy) > Math.abs(a[bi][3] - st.vy) ? k : bi), 0);
      if (guess !== null && scored < 0 && st.dec[guess]) {
        const d = st.dec[guess];
        const target = Math.max(80, Math.min(1000, d[1] + d[3] * Math.max(0, (d[0] - st.lx) / Math.max(1, -d[2]))));
        await g.ev(`keys.s = ${target > st.ly + st.ph / 2 + 10}; keys.w = ${target < st.ly + st.ph / 2 - 10};`);
      }
      if (scored < 0 && st.rs > 0) { scored = r.n; M.score = scored; await g.ev('keys.w=false; keys.s=false;'); }
      if (!frozen && k === 26) {
        // Freeze with the three balls numbered top-to-bottom.
        const balls = [[st.bx, st.by, true], ...st.dec.map(([x, y]) => [x, y, false])].sort((a, b) => a[1] - b[1]);
        M.realIndex = balls.findIndex((b) => b[2]) + 1;
        M.freeze = r.n;
        groupX = balls.reduce((s, b) => s + b[0], 0) / balls.length;
        const rings = (t) => balls.map(([x, y], n) => gring(x, y, t, { color: '#ffd166', label: String(n + 1), size: 48 }));
        for (let h = 0; h < 96; h++) {
          await r.shot([{ type: 'fill', color: '#000', alpha: 0.35 }, hook(Hk, 99), ...rings(10 + h),
            word('Comment 1, 2 or 3', Math.min(h, 30), 999, { y: 70, size: 60 }), scan],
            h < 3 ? { rgb: 12, slices: 3 } : (h % 24 === 0 ? { rgb: 6 } : null), { f: [groupX, 540] });
        }
        M.freezeEnd = r.n;
        frozen = true;
        continue;
      }
      const near = frozen && scored < 0 && st.bx < 420 && st.vx < 0;
      const layers = [hook(Hk, i), scan];
      if (frozen && scored < 0) layers.push(gring(st.bx, st.by, 20, { color: '#55ff9a', label: 'REAL', size: 32, r: 34 }));
      await r.shot(layers, k >= 0 && k < 4 ? { rgb: 10, slices: 3 } : null);
      await g.step(near ? 1 : 2);
    }
    M.punch = r.n;
    for (let k = 0; k < 50; k++) { await r.shot([hook(Hk, 99), word(`It was #${M.realIndex}. Did you get it?`, k, 50, { y: 70, size: 64 }), scan]); await g.step(2); }
    M.end = await endCard(g, r);
    M.endEnd = r.n;
    M.teaserEnd = await endCard(g, r, { line1: 'ANSWER IN PART 2', line2: 'FOLLOW' });
    await r.save(M);
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
