// Scene-by-scene capture for the Glitch Pong trailer (see docs/trailer-plan.md).
// Usage: node scenes.js s1 s3 ...   (output: ../frames/<scene>/)
const { open } = require('./harness');

const CALM = 'teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; decoyCooldown=99999;';

async function boot(seed = 1) {
  const g = await open();
  await g.page.click('#playNowHero');
  for (let k = 0; k < 60 && !(await g.js(() => typeof window.__gpEval === 'function')); k++) await g.step(10);
  await g.step(30);
  await g.js((s) => window.__seed(s), seed);
  return g;
}

async function startMatch(g, { arena = 'classic', diff = 'hard', aivai = true, skipCountdown = true } = {}) {
  await g.ev(`aiVsAiMode=${aivai}; aiDifficulty='${diff}'; currentArenaId='${arena}'; {const a=getArena(); a.cleanup&&a.cleanup(); a.init&&a.init();} beginMode(false); 1`);
  if (skipCountdown) await g.step(150);
}

// Run `frames` output shots; `each(i)` returns overlay layers and may mutate game state.
async function run(g, rec, frames, { per = 2, each } = {}) {
  for (let i = 0; i < frames; i++) {
    const out = each ? (await each(i)) || [] : [];
    const layers = Array.isArray(out) ? out : out.layers || [];
    await rec.shot(layers, Array.isArray(out) ? null : out.fx);
    await g.step(typeof per === 'function' ? per(i) : per);
  }
}

const L = {
  word: (text, t, d, o = {}) => ({ type: 'word', text, t, d, ...o }),
  typed: (text, t, d, o = {}) => ({ type: 'typed', text, t, d, ...o }),
  corner: (text, t, d, o = {}) => ({ type: 'corner', text, t, d, ...o }),
  alert: (text, t, o = {}) => ({ type: 'alert', text, t, ...o }),
  fill: (color, alpha) => ({ type: 'fill', color, alpha }),
  scan: (alpha) => ({ type: 'scan', alpha })
};
// Helper: show a layer only within [a, b) of the scene frame i.
const win = (i, a, b, fn) => (i >= a && i < b ? [fn(i - a, b - a)] : []);

const SCENES = {
  // ── Scenes 1 + 2: Cold open, then the glitch (0:00–0:10) ──────────────────
  async s1() {
    const g = await boot(7);
    await startMatch(g, { arena: 'classic', diff: 'easy' });
    await g.ev(CALM + 'heat=0;');
    const r1 = g.recorder('s01_cold_open');
    await run(g, r1, 180, {
      each: async (i) => {
        await g.ev(CALM + 'heat=0; leftScore=0; rightScore=0;');
        return [...win(i, 24, 180, (t, d) => L.typed('YOU KNOW THE RULES.', t, d, { y: 84, size: 40, rate: 2 })), L.scan(0.12)];
      }
    });
    await r1.save();

    const r2 = g.recorder('s02_glitch');
    await g.ev('roundFrozen=true; vx=0; vy=0; pongAudio.glitch();');
    await run(g, r2, 120, {
      per: (i) => (i < 100 ? 1 : 0),
      each: async (i) => {
        const p = Math.min(1, i / 100);
        if (i % 9 === 0) await g.ev('glitchPulse=Math.max(glitchPulse, 18); triggerCameraKick((Math.random()-.5)*20,(Math.random()-.5)*12,0.01);');
        if (i === 66) await g.ev('pongAudio.glitch();');
        const jit = i < 100 && (i % 7 < 2) ? (Math.sin(i * 12.9) * 24) : 0;
        const layers = [L.scan(0.16)];
        if (i < 64) layers.push({ type: 'morph', a: 'YOU KNOW THE RULES.', b: "THE ARENA DOESN'T CARE.", t: i, d: 64, y: 84, size: 40 });
        else if (i < 104) layers.push({ type: 'morph', a: "THE ARENA DOESN'T CARE.", b: "THE ARENA DOESN'T CARE.", t: 64, d: 64, y: 84, size: 40 }, L.alert('⚠ SYSTEM CORRUPTED', i - 64, { y: 42, size: 40 }));
        if (i >= 104) layers.push(L.fill('#000', 1));
        return { layers, fx: i < 104 ? { rgb: 3 + p * 14 + (i % 7 < 2 ? 16 : 0), x: jit, slices: i % 7 < 2 ? 6 : (i % 13 === 0 ? 3 : 0) } : null };
      }
    });
    await r2.save();
    await g.close();
  },

  // ── Scene 3: Countdown & title slam (0:10–0:16) ───────────────────────────
  async s3() {
    const g = await boot(11);
    await startMatch(g, { arena: 'classic', diff: 'hard', skipCountdown: false });
    const rec = g.recorder('s03_countdown');
    // Countdown runs at half speed (140 game frames -> 140 shots), GO lands at shot 102.
    await run(g, rec, 180, {
      per: (i) => (i < 110 ? 1 : 2),
      each: async (i) => {
        const layers = [L.scan(0.12)];
        if (i >= 106) {
          const t = i - 106;
          layers.unshift(L.fill('#02040a', t < 3 ? 0.9 : 0.55));
          layers.push({ type: 'logo', t, d: 74, scale: 0.92, y: 47 });
          return { layers, fx: { rgb: t < 8 ? 22 - t * 2.5 : (t % 17 === 0 ? 8 : 0), slices: t < 6 ? 5 : 0, zoom: 1 + Math.max(0, 0.06 - t * 0.004) } };
        }
        return layers;
      }
    });
    await rec.save();
    await g.close();
  },
  // ── Scene 4: Dash / Teleport / Juke / Near miss (0:16–0:30) ───────────────
  async s4() {
    const g = await boot(31);
    await startMatch(g, { arena: 'classic', diff: 'hard' });
    const rec = g.recorder('s04_moves');
    const WORD = (text, t, d) => L.word(text, t, d, { y: 20, size: 130 });

    // a) DASH (120 frames): blue paddle races down, dashes at the last moment and saves.
    await g.ev(CALM + `aiVsAiMode=false; heat=58; clearGlitchWalls(); decoys=[]; leftY=120; rightY=380; ballX=1250; ballY=150; vx=-10.5; vy=4.1; ballTrail=[]; leftDashCooldown=0; keys.s=false;`);
    let dashed = false, zoomY = null, zoomOut = 0;
    for (let i = 0; i < 120; i++) {
      const st = JSON.parse(await g.ev(`JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW})`));
      const tArrive = st.vx < 0 ? (st.bx - st.lx) / -st.vx : 999;
      const target = st.by + st.vy * tArrive;
      const center = st.ly + st.ph / 2;
      await g.ev(CALM + 'heat=Math.max(heat,58);');
      if (tArrive <= 42 && st.vx < 0) await g.ev(`keys.s = ${target > center + 20}; keys.w = ${target < center - 60};`);
      else await g.ev('keys.s=false; keys.w=false;');
      if (!dashed && st.vx < 0 && tArrive < 9 && target > center + 8) { await g.ev('performPaddleDash("left", 1)'); dashed = true; }
      if (st.vx > 0) await g.ev('keys.s=false; keys.w=false;');
      const slow = st.vx < 0 && tArrive < 22;
      if (slow && zoomY === null) zoomY = Math.min(0.8, target / 900);
      if (st.vx > 0) zoomOut++;
      await rec.shot([...win(i, 0, 44, (t, d) => WORD('DASH', t, d)), L.scan(0.1)], zoomY !== null && zoomOut < 14 ? { zoom: 1.25, cx: 0.15, cy: zoomY } : null);
      await g.step(slow || (dashed && i < 95 && st.bx < 300) ? 1 : 2);
    }
    await g.ev('keys.s=false; keys.w=false;');

    // b) TELEPORT (90 frames): the ball glitches across the arena mid-rally.
    await g.ev(CALM + `aiVsAiMode=true; heat=52; ballX=520; ballY=300; vx=9; vy=3; ballTrail=[];`);
    await run(g, rec, 90, {
      each: async (i) => {
        await g.ev(CALM + 'heat=Math.max(heat,52);');
        if (i === 22 || i === 58) await g.ev('teleportCooldown=0;');
        const fx = (i >= 22 && i < 26) || (i >= 58 && i < 62) ? { rgb: 12, slices: 4 } : null;
        return { layers: [...win(i, 0, 44, (t, d) => WORD('TELEPORT', t, d)), L.scan(0.1)], fx };
      }
    });

    // c) JUKE (120 frames): blue commits to the ball's path, the late juke sends it the other way.
    await g.ev(CALM + `aiVsAiMode=false; heat=55; leftY=330; ballX=1300; ballY=240; vx=-10.5; vy=3.0; ballTrail=[]; keys.w=false; keys.s=false;`);
    let juked = false, holdDone = false, commit = null;
    for (let i = 0; rec.n < 330; i++) {
      const st = JSON.parse(await g.ev(`JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ph:paddleH, lx:leftX+paddleW})`));
      const tArrive = st.vx < 0 ? (st.bx - st.lx) / -st.vx : 999;
      if (!juked) commit = st.by + st.vy * tArrive;
      const center = st.ly + st.ph / 2;
      if (st.vx < 0 && i > 8) await g.ev(`keys.s = ${commit > center + 12}; keys.w = ${commit < center - 12};`);
      if (!juked && st.vx < 0 && st.bx < 1600 * 0.17) {
        await g.ev('vy = -Math.sign(vy) * 7.5; glitchPulse = Math.max(glitchPulse, 14); pongAudio.juke();');
        juked = true;
      }
      await g.ev(CALM + 'heat=Math.max(heat,55);');
      const close = juked && !holdDone;
      await rec.shot([...win(i, 0, 44, (t, d) => WORD('JUKE', t, d)), L.scan(0.1)], close ? { rgb: 6, zoom: 1.15, cx: 0.12, cy: st.by / 900 } : null);
      if (!holdDone && juked && st.bx < 30) { rec.hold(12); holdDone = true; await g.ev('keys.w=false; keys.s=false;'); }
      await g.step(close ? 1 : 2);
    }
    await g.ev('keys.w=false; keys.s=false;');

    // d) NEAR MISS (90 frames): the ball clips the very tip of the blue paddle.
    await g.ev(CALM + `aiVsAiMode=false; heat=60; leftY=380; ballX=900; ballY=300; vx=-11; ballTrail=[];`);
    // Aim so the ball arrives 4px inside the top edge of the paddle.
    await g.ev(`{ const t=(ballX-(leftX+paddleW))/-vx; vy=((leftY+4)-ballY)/t; }`);
    let hit = -1;
    for (let i = 0; rec.n < 420; i++) {
      const st = JSON.parse(await g.ev(`JSON.stringify({bx:ballX, vx})`));
      if (hit < 0 && st.vx > 0) { hit = rec.n; await g.ev('glitchPulse=Math.max(glitchPulse,16)'); }
      await g.ev(CALM + 'heat=Math.max(heat,60);');
      const k = hit < 0 ? -1 : rec.n - hit;
      const layers = [L.scan(0.1)];
      if (k >= 0) layers.push(L.alert('NEAR MISS DETECTED', k, { y: 28, size: 34 }));
      if (k >= 26) layers.push(L.corner('DASH RECHARGED', k - 26, 64, { pos: 'bl', size: 22 }));
      if (k === 26) await g.ev('pongAudio.dashReady()');
      const near = st.vx < 0 && st.bx < 260;
      await rec.shot(layers, near || (k >= 0 && k < 8) ? { zoom: 1.12, cx: 0.1, cy: 0.45 } : null);
      await g.step(near || (k >= 0 && k < 10) ? 1 : 2);
    }
    await rec.save();
    await g.close();
  },

  // ── Scene 5: Power-ups (0:30–0:40) ────────────────────────────────────────
  async s5() {
    const g = await boot(41);
    await startMatch(g, { arena: 'classic', diff: 'hard' });
    const rec = g.recorder('s05_powerups');
    const WORD = (text, t, d, o = {}) => L.word(text, t, d, { y: 20, size: 120, ...o });
    const S = async () => JSON.parse(await g.ev(`JSON.stringify({bx:ballX, by:ballY, vx, vy, ly:leftY, ry:rightY, ph:paddleH, ls:leftScore, rs:rightScore, dec:decoys.map(d=>[d.x,d.y])})`));

    // a) SHIELD (90): blue is out of position, the full-wall shield bounces the shot back.
    await g.ev(CALM + `aiVsAiMode=false; heat=50; clearGlitchWalls(); decoys=[]; leftY=50; ballX=1050; ballY=430; vx=-12; vy=3.2; ballTrail=[];`);
    let saved = -1;
    for (let i = 0; rec.n < 90; i++) {
      if (i === 6) await g.ev('grantPowerup("blue","shield")');
      const st = await S();
      if (saved < 0 && i > 6 && st.vx > 0) saved = rec.n;
      await g.ev(CALM + 'heat=Math.max(heat,50); leftY=50;');
      const near = st.vx < 0 && st.bx < 240;
      const k = saved < 0 ? -1 : rec.n - saved;
      await rec.shot([...win(i, 0, 44, (t, d) => WORD('SHIELD', t, d)), L.scan(0.1)],
        near || (k >= 0 && k < 6) ? { zoom: 1.18, cx: 0.1, cy: st.by / 900, rgb: k >= 0 && k < 4 ? 10 : 0 } : null);
      await g.step(near || (k >= 0 && k < 8) ? 1 : 2);
    }

    // b) POWER STRIKE (90): red cashes in a power strike, the return is brutal.
    await g.ev(CALM + `aiVsAiMode=false; heat=60; powerState.blue.shieldTimer=0; leftY=640; rightY=330; ballX=900; ballY=300; vx=12; vy=1.1; ballTrail=[];`);
    let struck = -1;
    for (let i = 0; rec.n < 180; i++) {
      if (i === 4) await g.ev('grantPowerup("red","power")');
      const st = await S();
      if (struck < 0 && i > 4 && st.vx < 0) { struck = rec.n; await g.ev('triggerCameraKick(-24, 8, 0.03); glitchPulse=Math.max(glitchPulse,26);'); }
      await g.ev(CALM + 'heat=Math.max(heat,60); leftY=600;');
      const k = struck < 0 ? -1 : rec.n - struck;
      const pre = i >= 44 && struck < 0 && st.vx > 0 && st.bx > 1300;
      const shake = k >= 0 && k < 10 ? { x: Math.round(Math.sin(k * 2.7) * (14 - k)), y: Math.round(Math.cos(k * 3.1) * (10 - k)), rgb: 14 - k } : null;
      await rec.shot([...win(i, 0, 44, (t, d) => WORD('POWER STRIKE', t, d)), L.scan(0.1)], pre ? { zoom: 1.15, cx: 0.88, cy: st.by / 900 } : shake);
      await g.step(pre ? 1 : 2);
    }

    // c) SPLIT (120): one ball becomes three. Freeze: which one is real? Blue guesses wrong.
    await g.ev(CALM + `aiVsAiMode=false; heat=62; decoys=[]; leftY=380; rightY=360; ballX=1180; ballY=430; vx=12; vy=0.4; ballTrail=[];`);
    let split = -1, frozen = false, guess = null;
    for (let i = 0; rec.n < 300; i++) {
      if (i === 3) await g.ev('grantPowerup("red","split")');
      const st = await S();
      if (split < 0 && i > 3 && st.vx < 0 && st.dec.length >= 2) split = rec.n;
      const k = split < 0 ? -1 : rec.n - split;
      await g.ev(CALM + 'heat=Math.max(heat,62);');
      if (split >= 0 && guess === null) {
        // Blue reads the nearest decoy as the real ball.
        guess = st.dec[0][1];
      }
      if (guess !== null) await g.ev(`keys.s = ${guess > st.ly + st.ph / 2 + 10}; keys.w = ${guess < st.ly + st.ph / 2 - 10};`);
      if (!frozen && k === 22) {
        const rings = [[st.bx, st.by], ...st.dec].map(([x, y]) => ({ type: 'ring', x, y, r: 30, t: 10, color: '#ffd166', label: '?' }));
        await rec.shot([L.fill('#000', 0.35), ...rings, L.word('WHICH ONE IS REAL?', 10, 60, { y: 20, size: 84 }), L.scan(0.12)], { rgb: 3 });
        for (let h = 0; h < 30; h++) {
          await rec.shot([L.fill('#000', 0.35), ...rings.map((r) => ({ ...r, t: 10 + h })), L.word('WHICH ONE IS REAL?', 10 + h, 60, { y: 20, size: 84 }), L.scan(0.12)], { rgb: h % 9 === 0 ? 8 : 2 });
        }
        frozen = true;
        continue;
      }
      await rec.shot([...win(i, 0, 40, (t, d) => WORD('SPLIT', t, d)), L.scan(0.1)], k >= 0 && k < 4 ? { rgb: 10, slices: 3 } : null);
      await g.step(2);
    }
    await g.ev('keys.w=false; keys.s=false;');
    await rec.save();
    await g.close();
  },

  // ── Scene 6: Heat rising (0:40–0:52) ──────────────────────────────────────
  async s6() {
    const g = await boot(61);
    await startMatch(g, { arena: 'classic', diff: 'hard' });
    const rec = g.recorder('s06_heat');
    await g.ev(`teleportCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; heat=20; clearGlitchWalls();`);
    const floorAt = (i) => (i < 60 ? 20 : i < 150 ? 41 : i < 240 ? 63 : 84);
    // Places a wall directly ahead of the ball so the impact shatters it.
    const wallAhead = `{ const ww=26, wh=96; const wx=Math.round(ballX + vx*34 - ww/2); const wy=Math.round(Math.max(30, Math.min(canvas.height-30-wh, ballY + vy*34 - wh/2)));
      glitchWalls.push({x:wx,y:wy,w:ww,h:wh,phase:'warning',warningTimer:22,warningMax:22,solidTimer:400,dyingTimer:0,dyingMax:52,chunks:makeWallChunks(ww,wh),fragments:[],rgbOff:2,scanOff:3}); }`;
    await run(g, rec, 360, {
      each: async (i) => {
        const f = floorAt(i);
        await g.ev(`teleportCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; heat=Math.max(heat, ${f});`);
        if ([62, 112, 152, 200, 242, 262, 290, 318].includes(i)) await g.ev('trySpawnGlitchWall()');
        if ([175, 300].includes(i)) await g.ev(`if (Math.abs(vx) > 3 && ballX > 500 && ballX < 1100) ${wallAhead}`);
        const st = JSON.parse(await g.ev('JSON.stringify({h:heat, w:glitchWalls.length})'));
        const jump = [60, 150, 240].includes(i);
        const layers = [L.scan(0.1), { type: 'heat', v: st.h }];
        layers.push(...win(i, 0, 56, (t, d) => L.word('EVERY RALLY', t, d, { y: 16, size: 92 })));
        layers.push(...win(i, 14, 70, (t, d) => L.word('FEEDS THE HEAT.', t, d, { y: 29, size: 92 })));
        layers.push(...win(i, 150, 236, (t, d) => L.corner('ARENA CORRUPTION AT ' + Math.round(st.h) + '%', t, d, { pos: 'tr', size: 22 })));
        layers.push(...win(i, 248, 330, (t, d) => L.corner('GLITCH WALLS: ' + st.w + ' ACTIVE', t, d, { pos: 'tr', size: 22 })));
        return { layers, fx: jump ? { rgb: 12, slices: 4, zoom: 1.03 } : null };
      }
    });
    await rec.save();
    await g.close();
  },

  // ── Scene 7: The sentient ball (0:52–1:02) ────────────────────────────────
  async s7() {
    const g = await boot(71);
    await startMatch(g, { arena: 'classic', diff: 'hard' });
    const rec = g.recorder('s07_sentient');
    const WORD = (text, t, d) => L.word(text, t, d, { y: 20, size: 104 });

    // a) IT PICKS SIDES (90): blue leads 5-1, the ball's spite favours red.
    await g.ev(CALM + `aiVsAiMode=true; heat=35; leftScore=5; rightScore=1; spiteBias=-1; ballX=700; ballY=200; vx=9; vy=-7; ballTrail=[];`);
    await run(g, rec, 90, {
      each: async (i) => {
        await g.ev(CALM + 'leftScore=5; rightScore=1; spiteBias=-1;');
        return [L.scan(0.1), ...win(i, 0, 60, (t, d) => WORD('IT PICKS SIDES.', t, d)), ...win(i, 12, 90, (t) => L.alert('⚠ BALL SPITE ACTIVE', t, { y: 34, size: 28 })),
          ...win(i, 0, 90, (t, d) => L.corner('BLUE 5 — RED 1', t, d, { pos: 'bl', size: 24 }))];
      }
    });

    // b) IT GETS TIRED (120): a 30-hit rally, the ball wobbles and Z's float up.
    await g.ev(CALM + `aiDifficulty='hard'; heat=30; leftScore=2; rightScore=2; spiteBias=0; rallyHits=30; ballX=1000; ballY=450; vx=-5.2; vy=1.2; ballTrail=[];`);
    let cam = null;
    await run(g, rec, 120, {
      each: async (i) => {
        await g.ev(CALM + 'rallyHits=Math.max(rallyHits,31); heat=Math.min(heat,40); vx=Math.sign(vx)*Math.min(Math.abs(vx),5.5);');
        const b = JSON.parse(await g.ev('JSON.stringify([ballX/canvas.width, (ballY-40)/canvas.height])'));
        cam = cam ? [cam[0] + (b[0] - cam[0]) * 0.15, cam[1] + (b[1] - cam[1]) * 0.15] : b;
        const z = i < 20 ? 1 + i * 0.03 : 1.6;
        await g.cam({ scale: z, ox: cam[0] * 100, oy: cam[1] * 100 });
        return { layers: [L.scan(0.1), ...win(i, 6, 70, (t, d) => WORD('IT GETS TIRED.', t, d))] };
      }
    });

    await g.cam({});
    // c) IT REMEMBERS (90): the serve goes straight back to blue's last miss.
    await g.ev(CALM + `aiVsAiMode=false; heat=40; rallyHits=0; drowsyZs=[]; leftScore=2; rightScore=3; leftY=470; ballX=820; ballY=470; vx=-10.5; ballTrail=[]; missMemory.left=[205];`);
    await g.ev(`{ const t=(ballX-(leftX+paddleW))/-vx; vy=(205-ballY)/t; }`);
    let scored = -1;
    for (let i = 0; rec.n < 300; i++) {
      await g.ev(CALM + 'leftY=470;');
      const st = JSON.parse(await g.ev('JSON.stringify({bx:ballX, by:ballY, rs:rightScore})'));
      if (scored < 0 && st.rs > 3) scored = rec.n;
      const layers = [L.scan(0.1), ...win(i, 0, 70, (t, d) => WORD('IT REMEMBERS.', t, d))];
      if (scored < 0) layers.push({ type: 'ring', x: 34, y: 205, r: 34, t: i, color: '#ff4f6d', label: 'LAST MISS' });
      const near = scored < 0 && st.bx < 300;
      await rec.shot(layers, near ? { zoom: 1.15, cx: 0.1, cy: 0.25 } : null);
      await g.step(near ? 1 : 2);
    }
    await rec.save();
    await g.close();
  },

  // ── Scene 8: Four arenas (1:02–1:16) ──────────────────────────────────────
  async s8() {
    const g = await boot(81);
    const rec = g.recorder('s08_arenas');
    const arenas = [
      ['classic', 'ARENA 01 // CLASSIC GRID', 72, null],
      ['matrix', 'ARENA 02 // MATRIX MAINFRAME', 64, null],
      ['construct', 'ARENA 03 // THE CONSTRUCT', 58, 'push'],
      ['blackhole', 'ARENA 04 // BLACK-HOLE NEXUS', 86, null]
    ];
    for (let a = 0; a < 4; a++) {
      const [id, label, h, move] = arenas[a];
      await startMatch(g, { arena: id, diff: 'hard' });
      await g.ev(`heat=${h}; powerupSpawnCooldown=99999;`);
      await g.step(150);
      const n0 = rec.n;
      await run(g, rec, 105, {
        each: async (i) => {
          await g.ev(`heat=Math.max(heat, ${h}); powerupSpawnCooldown=99999;`);
          const layers = [L.scan(0.08), ...win(i, 3, 102, (t, d) => L.corner(label, t, d, { pos: 'bl', size: 24 }))];
          if (a === 3) layers.push(...win(i, 66, 105, (t, d) => L.word('4 ARENAS', t, d + 4, { y: 22, size: 120 })));
          let fx = i < 4 ? { rgb: 16 - i * 4, slices: 5 - i } : null;
          if (move === 'push') fx = { ...(fx || {}), zoom: 1 + i * 0.0012, cx: 0.5, cy: 0.35 };
          return { layers, fx };
        }
      });
    }
    await rec.save();
    await g.close();
  },

  // ── Scene 9: Your way, your level (1:16–1:22) ─────────────────────────────
  async s9() {
    const g = await boot(91);
    const rec = g.recorder('s09_modes');
    const tag = (text, t) => L.word(text, t, 40, { y: 86, size: 70 });
    const cut = (i) => (i < 3 ? { rgb: 12 - i * 4, slices: 3 } : null);
    // 1) Difficulty select -> SOLO VS AI.
    await g.ev('showDifficultyMenu(); 1');
    await g.step(20);
    await run(g, rec, 30, { each: async (i) => ({ layers: [L.scan(0.1), tag('SOLO VS AI.', i + 6)], fx: cut(i) }) });
    // 2) Player 1 / Player 2 menu -> LOCAL 2P.
    await g.ev('showModeMenu(); 1');
    await g.step(10);
    await run(g, rec, 30, { each: async (i) => ({ layers: [L.scan(0.1), tag('LOCAL 2P.', i + 6)], fx: cut(i) }) });
    // 3) Arena select -> PICK YOUR ARENA.
    await g.ev('showArenaMenu(); 1');
    await g.step(10);
    await run(g, rec, 30, { each: async (i) => ({ layers: [L.scan(0.1), tag('PICK YOUR ARENA.', i + 6)], fx: cut(i) }) });
    // 4) Level-up cinematic -> 50 LEVELS.
    await startMatch(g, { arena: 'matrix', diff: 'hard' });
    await g.ev(`progScreen="levelUp"; progLevelData={level:25, title:GlitchProgression.getTitle(25)}; progScreenTimer=180;`);
    await g.step(66);
    await run(g, rec, 30, { per: 1, each: async (i) => ({ layers: [L.scan(0.1), tag('50 LEVELS.', i + 6)], fx: cut(i) }) });
    // 5) Perk selection -> 15 PERKS.
    await g.ev(`progScreen="perkSelect"; progPerkOptions=GlitchProgression.getRandomPerks(3); progSelectedPerk=1; progScreenTimer=0; progLevelData={level:27, title:GlitchProgression.getTitle(27)};`);
    await g.step(24);
    await run(g, rec, 30, { per: 1, each: async (i) => ({ layers: [L.scan(0.1), tag('15 PERKS.', i + 6)], fx: cut(i) }) });
    // 6) Paddle colour swaps mid-rally.
    await g.ev('progScreen=null;');
    const swaps = [['gold', 'cyan'], ['violet', 'orange'], ['white', 'magenta']];
    await run(g, rec, 30, {
      each: async (i) => {
        if (i % 10 === 0) { const [b, r] = swaps[i / 10]; await g.ev(`paddleColorSelection.red="${r}"; paddleColorSelection.blue="${b}"; glitchPulse=10;`); }
        return { layers: [L.scan(0.1), tag('YOUR COLORS.', i + 6)], fx: i % 10 < 2 ? { rgb: 8 } : null };
      }
    });
    await rec.save();
    await g.close();
  },

  // ── Scene 10: The Surveillance Eye (1:22–1:40) ────────────────────────────
  async s10() {
    const g = await boot(101);
    await startMatch(g, { arena: 'matrix', diff: 'hard' });
    await g.ev('heat=90; powerupSpawnCooldown=99999; teleportCooldown=99999;');
    await g.step(90);
    const rec = g.recorder('s10_boss');
    // a) Heat climbs to 100% (40 frames), then the cinematic triggers with the ball mid-court.
    let triggered = false;
    for (let i = 0; rec.n < 40 || !triggered; i++) {
      const st = JSON.parse(await g.ev('JSON.stringify({bx:ballX, by:ballY, pb:preBossActive||bossModeActive})'));
      if (st.pb) throw new Error('boss triggered early');
      const h = rec.n < 34 ? Math.min(99.5, 90 + i * 0.28) : 100;
      if (rec.n >= 34 && st.bx > 450 && st.bx < 1100 && st.by > 130) {
        await g.ev('heat=100; triggerPreBoss();');
        triggered = true;
      } else await g.ev(`heat=${Math.min(h, 85)}; powerupSpawnCooldown=99999; teleportCooldown=99999;`);
      if (triggered) break;
      const layers = [L.scan(0.1), { type: 'heat', v: h }];
      if (rec.n >= 34) layers.push(L.alert('⚡ HEAT 100%', rec.n - 34, { y: 22, size: 40 }));
      await rec.shot(layers, rec.n >= 34 ? { rgb: 6 + Math.min(10, (rec.n - 34) * 2) } : null);
      await g.step(2);
    }
    // b) Pre-boss cinematic at half speed: freeze + speech bubble, glitch to center, morph.
    const snap = JSON.parse(await g.ev('JSON.stringify([ballX/canvas.width*100, ballY/canvas.height*100])'));
    const ease = (t) => t * t * (3 - 2 * t);
    await run(g, rec, 194, {
      per: 1,
      each: async (i) => {
        let z, ox, oy;
        if (i < 80) { z = 1 + 0.4 * ease(Math.min(1, i / 30)); [ox, oy] = snap; }
        else if (i < 120) { const t = ease((i - 80) / 40); z = 1.4 - 0.2 * t; ox = snap[0] + (50 - snap[0]) * t; oy = snap[1] + (50 - snap[1]) * t; }
        else { const t = ease(Math.min(1, (i - 120) / 60)); z = 1.2 + 1.5 * t; ox = 50; oy = 50; }
        await g.cam({ scale: z, ox, oy });
        const glitching = i >= 80 && i < 120;
        const fx = glitching ? { rgb: 8 + (i % 5) * 3, slices: i % 4 === 0 ? 4 : 0 } : i >= 186 ? { rgb: 14 } : null;
        return { layers: [L.scan(0.12), { type: 'vignette', alpha: 0.5 + Math.min(0.3, i / 400) }], fx };
      }
    });
    // c) Boss alarm, center glitch, materialize (150 game frames at normal speed).
    await run(g, rec, 75, {
      each: async (i) => {
        const layers = [L.scan(0.12), { type: 'vignette', alpha: 0.55 }];
        layers.push(...win(i, 6, 72, (t, d) => L.word("IT'S BEEN", t, d, { y: 15, size: 96 })));
        layers.push(...win(i, 14, 72, (t, d) => L.word('WATCHING YOU.', t, d, { y: 85, size: 96 })));
        const z = i < 60 ? 2.7 - 0.5 * (i / 60) : 2.2 - 1.2 * ease(Math.min(1, (i - 60) / 15));
        await g.cam({ scale: z, ox: 50, oy: 50 });
        return { layers, fx: i < 4 ? { flash: 0.5 - i * 0.12, rgb: 10 } : null };
      }
    });
    await g.cam({});
    // d) Six orbital shots: first aim/throw at normal speed, later cycles slightly sped up.
    const total = 540;
    for (let i = 0; rec.n < total; i++) {
      const left = total - rec.n;
      const layers = [L.scan(0.1), L.corner('THREAT LOCK // TRACKING', i, 999, { pos: 'tr', size: 22 })];
      if (i < 40) layers.push(L.alert('BOSS ACTIVE', i, { y: 9, size: 30 }));
      const fx = left <= 6 ? { flash: (7 - left) / 6 } : null;
      await rec.shot(layers, fx);
      await g.step(i < 68 ? 2 : 3);
    }
    await rec.save();
    await g.close();
  },

  // ── Scene 11: Clutch Mode (1:40–1:50) ─────────────────────────────────────
  async s11() {
    for (const seed of [111, 112, 113, 114, 115, 116]) {
      const g = await boot(seed);
      await startMatch(g, { arena: 'classic', diff: 'hard' });
      await g.ev('leftScore=6; rightScore=6; heat=86; clutchMode=true; bossEncounteredThisMatch=true; powerupSpawnCooldown=99999;');
      await g.step(60);
      const rec = g.recorder('s11_clutch');
      const flashes = new Set([96, 150, 190, 216, 234, 246, 255, 262, 267, 271]);
      let ok = true, cam = null;
      for (let i = 0; i < 300; i++) {
        await g.ev('clutchMode=true; bossEncounteredThisMatch=true; heat=Math.min(97, Math.max(heat,86)); powerupSpawnCooldown=99999;');
        const st = JSON.parse(await g.ev('JSON.stringify({bx:ballX/canvas.width, by:ballY/canvas.height, ls:leftScore, rs:rightScore, fin:finalScoreCinematic})'));
        if (i < 285 && (st.ls > 6 || st.rs > 6 || st.fin)) { ok = false; break; }
        const layers = [L.scan(0.12), { type: 'vignette', alpha: 0.45 }];
        layers.push(...win(i, 0, 64, (t) => L.alert('MATCH POINT // 6 — 6', t, { y: 22, size: 38 })));
        layers.push(...win(i, 20, 272, (t, d) => L.corner('CLUTCH MODE ENGAGED', t, d, { pos: 'tr', size: 22 })));
        layers.push(...win(i, 72, 134, (t, d) => L.word('ONE POINT.', t, d, { y: 22, size: 120 })));
        layers.push(...win(i, 158, 222, (t, d) => L.word("DON'T CHOKE.", t, d, { y: 22, size: 120 })));
        let fx = null;
        if (flashes.has(i) || flashes.has(i - 1)) fx = { rgb: 14, slices: 5, bright: 1.25 };
        if (i >= 272) {
          cam = cam || [st.bx, st.by];
          cam = [cam[0] + (st.bx - cam[0]) * 0.35, cam[1] + (st.by - cam[1]) * 0.35];
          const k = i - 272;
          fx = { zoom: 1 + Math.min(1.8, k * 0.11), cx: cam[0], cy: cam[1], rgb: 4 + k, flash: k >= 17 ? Math.min(1, (k - 16) / 3) : 0 };
          if (k >= 21) { layers.push(L.fill('#000', 1)); fx = null; }
        }
        await rec.shot(layers, fx);
        await g.step(i >= 272 ? 1 : 2);
      }
      if (ok) { await rec.save({ seed }); await g.close(); return; }
      console.log('seed', seed, 'scored early, retrying');
      await g.close();
    }
    throw new Error('no clean clutch take');
  },

  // ── Scenes 12 + 13: End card and stinger (1:50–1:58) ──────────────────────
  async s12() {
    const g = await boot(121);
    await g.ev('mainMenu.style.display="none"; 1');
    const rec = g.recorder('s12_endcard');
    await run(g, rec, 180, {
      each: async (i) => {
        await g.ev('mainMenu.style.display="none"; 1');
        const layers = [L.fill('#02040a', 0.62), L.scan(0.12), { type: 'vignette', alpha: 0.6 }];
        layers.push({ type: 'logo', t: i, d: 999, scale: 0.6, y: 29 });
        if (i >= 18) layers.push({ type: 'strip', text: 'THE ARENA BREAKS. YOU FIGHT BACK.', t: i - 18, y: 55, size: 44, color: '#f4fbff', weight: 900 });
        if (i >= 40) layers.push({ type: 'strip', text: '1P VS AI /// LOCAL 2P /// 4 ARENAS /// BOSS FIGHTS /// 50 LEVELS /// 15 PERKS', t: i - 40, y: 65, size: 19 });
        if (i >= 62) layers.push({ type: 'strip', text: 'PLAY NOW ON ITCH.IO', t: i - 62, y: 77, size: 54, color: '#ffd166', weight: 900 });
        if (i >= 70) layers.push({ type: 'strip', text: 'noodlecometstudios.itch.io/glitch-pong', t: i - 70, y: 85, size: 34, color: '#9ff3ff' });
        const fx = i < 6 ? { rgb: 18 - i * 3, slices: 6 - i } : (i === 62 || i === 63) ? { rgb: 10 } : (i >= 172 ? { rgb: (i - 171) * 4, slices: i - 170 } : null);
        return { layers, fx };
      }
    });
    await rec.save();

    const r2 = g.recorder('s13_stinger');
    for (let i = 0; i < 60; i++) {
      let sy = 1, look = 'neutral';
      if (i < 8) sy = i / 8;
      else if (i >= 22 && i < 34) look = 'left';
      else if (i >= 44 && i < 50) sy = Math.abs(i - 47) / 3 * 0.95 + 0.05;
      if (i === 2) await g.ev('pongAudio.glitch()');
      const layers = [L.fill('#000', 1), { type: 'eye', look, sy, w: 520 }, L.scan(0.15)];
      if (i >= 56) layers.push(L.fill('#000', (i - 55) / 4));
      await r2.shot(layers, i >= 54 && i < 58 ? { rgb: 16, slices: 6 } : null);
      await g.step(2);
    }
    await r2.save();
    await g.close();
  }
};

(async () => {
  for (const name of process.argv.slice(2)) {
    const t = Date.now();
    await SCENES[name]();
    console.log(name, 'done in', Math.round((Date.now() - t) / 1000), 's');
  }
})().catch((e) => { console.error(e); process.exit(1); });

module.exports = { boot, startMatch, run, L, win, CALM };
