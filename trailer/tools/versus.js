// "Normal Pong vs Glitch Pong" vertical short: two landscape courts stacked on a 1080x1920 frame.
// Top: a calm rally at 0% Heat. Bottom: the same arena at max Heat (walls, decoys, teleports),
// then the ball freezes and becomes the Eye.
// Usage: node versus.js capture   -> ../frames/vs_top, ../frames/vs_bottom   (capture-top redoes only the top court)
//        python3 postfx.py vs_top vs_bottom
//        node versus.js compose   -> ../vframes/v_versus  (then versus_mix.py + render_short.sh v_versus)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { open } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const GW = 1280, GH = 720;          // capture size (game proportions of a small laptop screen)
const N = 360, END = 54;            // 12s of gameplay + end card
const HIDE = 'hud.style.display="none"; help.style.display="none";';
const CALM = 'teleportCooldown=99999; jukeCooldown=99999; pulseCooldown=99999; powerupSpawnCooldown=99999; glitchWallSpawnCooldown=99999; decoyCooldown=99999;';
// Keep rallies flowing: skip the 3-2-1 countdown after a point.
const SKIP = 'if (countdownActive && !preBossActive && !bossModeActive) launchBallToPlayer();';
const J = (s) => JSON.parse(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(seed, arena, diff) {
  const g = await open({ width: GW, height: GH });
  await g.js(() => document.querySelector('#playNowHero').click());
  for (let k = 0; k < 60 && !(await g.js(() => typeof window.__gpEval === 'function')); k++) await g.step(10);
  await g.step(30);
  await g.js((s) => window.__seed(s), seed);
  await g.ev(`aiVsAiMode=true; aiDifficulty='${diff}'; currentArenaId='${arena}'; {const a=getArena(); a.cleanup&&a.cleanup(); a.init&&a.init();} beginMode(false); ${HIDE} 1`);
  await g.step(150);
  return g;
}

async function captureTop() {
  // Top: normal Pong. The game runs normally; compose.js redraws it from this state in classic black and white.
  const a = await boot(401, 'classic', 'medium');
  const top = a.recorder('vs_top');
  const st = [];
  for (let i = 0; i < N + END; i++) {
    await a.ev(HIDE + CALM + 'heat=0;' + SKIP);
    st.push(J(await a.ev('JSON.stringify({lx:leftX, ly:leftY, rx:rightX, ry:rightY, pw:paddleW, ph:paddleH, bx:ballX, by:ballY, br:BALL_R, ls:leftScore, rs:rightScore})')));
    await top.shot([]);
    await a.step(2);
  }
  await top.save({ st });
  await a.close();
}

async function capture() {
  await captureTop();

  // Bottom: Glitch Pong at high Heat, then the Eye.
  const b = await boot(402, 'classic', 'hard');
  await b.ev('ensureBossAssets(); 1');
  await sleep(2000); // Eye images load in real time; the game clock is virtual
  // Pre-heat so the very first frame (the cover) already shows walls and chaos.
  for (let k = 0; k < 160; k++) { await b.ev('heat=87;' + SKIP + (k % 20 === 0 ? 'trySpawnGlitchWall();' : '')); await b.step(2); }
  const bot = b.recorder('vs_bottom');
  const M = {};
  for (let i = 0; i < N + END; i++) {
    const st = J(await b.ev('JSON.stringify({bx:ballX, by:ballY, pb:preBossActive, bm:bossModeActive, rf:roundFrozen})'));
    if (M.trigger == null && i >= 200 && !st.rf && ((st.bx > 380 && st.bx < 900 && st.by > 160 && st.by < 600) || i >= 240)) {
      await b.ev('heat=100; triggerPreBoss();');
      M.trigger = i;
    }
    if (M.alarm == null && st.bm) M.alarm = i;
    // Heat held at 87%: maximum walls and chaos, but a paddle hit can't reach 100% and trigger the boss early.
    const pre = M.trigger == null ? 'heat=87;' + (i % 25 === 0 ? 'trySpawnGlitchWall();' : '') : '';
    await b.ev(HIDE + pre + SKIP);
    const fx = i === M.trigger ? { rgb: 12, slices: 4 } : (M.alarm != null && i - M.alarm < 4 ? { rgb: 10, flash: 0.35 - (i - M.alarm) * 0.08 } : null);
    await bot.shot([], fx);
    await b.step(st.pb ? 4 : 2); // the pre-boss cinematic plays at double speed
  }
  await bot.save({ marks: M });
  await b.close();
  console.log('captured', N + END, 'frames; marks', M);
}

const BAND_H = 530, TOP_Y = 410, BOT_Y = 1000, S = 1080 / GW, CROP = (GH * S - BAND_H) / 2;
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#04060c}
  body{background:radial-gradient(ellipse at 50% 50%,#0b1424 0%,#04060c 70%)}
  .band{position:absolute;left:0;width:1080px;height:${BAND_H}px;overflow:hidden}
  .band img{position:absolute;left:0;top:${-CROP}px;width:1080px;height:${GH * S}px}
  #top{top:${TOP_Y}px;background:#000;box-shadow:0 0 0 3px rgba(255,255,255,.75)}
  #ctop{position:absolute;left:0;top:0}
  .crt{position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(0,0,0,.32) 0 2px,transparent 2px 4px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.65) 100%)}
  #bot{top:${BOT_Y}px;box-shadow:0 0 0 3px rgba(255,79,216,.6),0 0 40px rgba(255,79,216,.3)}
  .tag{position:absolute;left:22px;top:18px;padding:8px 16px;font:700 30px Orbitron,sans-serif;letter-spacing:.08em;background:rgba(2,6,14,.78);border-radius:10px}
  .tag small{display:block;font:22px 'Share Tech Mono',monospace;letter-spacing:.16em;margin-top:2px}
  #ttop{color:#fff;background:#000;border:3px solid #fff;border-radius:0;font:20px 'Press Start 2P',monospace;letter-spacing:.04em;padding:10px 14px}
  #ttop small{font:12px 'Press Start 2P',monospace;letter-spacing:.06em;margin-top:8px;color:#bbb}
  #tbot{color:#ff9fdc;border:2px solid rgba(255,79,216,.7);text-shadow:0 0 12px rgba(255,79,216,.8)}
  #vs{position:absolute;left:0;right:0;top:${(TOP_Y + BAND_H + BOT_Y) / 2 - 26}px;height:52px;text-align:center;font:900 46px/52px Orbitron,sans-serif;color:#fff;
    text-shadow:-3px 0 0 rgba(255,40,200,.9),3px 0 0 rgba(0,230,255,.9),0 0 22px rgba(255,255,255,.5);z-index:5}
</style></head><body>
<div class="band" id="top"><canvas id="ctop" width="1080" height="${BAND_H}"></canvas><div class="crt"></div><div class="tag" id="ttop"></div></div>
<div id="vs">VS</div>
<div class="band" id="bot"><img id="ibot"><div class="tag" id="tbot"></div></div>
<script>
  // Classic black-and-white court: white blocks, square ball, dashed net, chunky 3x5 pixel digits.
  const DIGITS = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001',
                  '111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  window.drawRetro = (st) => {
    const c = document.getElementById('ctop'), x = c.getContext('2d');
    const S = 1080 / ${GW}, CROP = (${GH} * S - ${BAND_H}) / 2;
    x.setTransform(1, 0, 0, 1, 0, 0); x.shadowBlur = 0; x.fillStyle = '#000'; x.fillRect(0, 0, 1080, ${BAND_H});
    x.setTransform(S, 0, 0, S, 0, -CROP);
    x.fillStyle = '#f4f4f4'; x.shadowColor = 'rgba(255,255,255,.6)'; x.shadowBlur = 10;
    for (let y = 6; y < ${GH}; y += 36) x.fillRect(${GW} / 2 - 4, y, 8, 18);
    const num = (v, cx) => {
      const str = String(v), B = 16, w = str.length * 4 * B - B;
      [...str].forEach((d, k) => { const g = DIGITS[+d]; for (let p = 0; p < 15; p++) if (g[p] === '1')
        x.fillRect(cx - w / 2 + k * 4 * B + (p % 3) * B, 60 + Math.floor(p / 3) * B, B, B); });
    };
    num(st.ls, ${GW} / 2 - 130); num(st.rs, ${GW} / 2 + 130);
    x.fillRect(st.lx, st.ly, st.pw, st.ph); x.fillRect(st.rx, st.ry, st.pw, st.ph);
    x.fillRect(st.bx - st.br, st.by - st.br, st.br * 2, st.br * 2);
  };
</script>
</body></html>`;

async function compose() {
  const mt = JSON.parse(fs.readFileSync(path.join(ROOT, 'fx', 'vs_top', 'meta.json')));
  const mb = JSON.parse(fs.readFileSync(path.join(ROOT, 'fx', 'vs_bottom', 'meta.json')));
  const M = mb.marks;
  const frames = Math.min(mt.frames, mb.frames);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  await context.addInitScript({ path: path.join(__dirname, 'overlay.js') });
  await context.route('http://compose.local/**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: PAGE });
    if (u.pathname.startsWith('/f/')) return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(ROOT, 'fx', decodeURIComponent(u.pathname.slice(3)))) });
    if (u.pathname.startsWith('/assets/')) return route.fulfill({ path: path.join(REPO, decodeURIComponent(u.pathname)) });
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await context.newPage();
  await page.goto('http://compose.local/index.html');
  await page.evaluate(async () => {
    window.__ov.vertical(true); document.getElementById('__ovroot').style.zoom = '1.2';
    // Load every face used, so frame 0 doesn't fall back to a default font.
    await Promise.all(["20px 'Press Start 2P'", "700 30px Orbitron", "900 46px Orbitron", "22px 'Share Tech Mono'"].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  });
  const cdp = await context.newCDPSession(page);
  const out = path.join(ROOT, 'vframes', 'v_versus');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const cap = M.alarm ?? M.trigger + 50; // the title flips when the bottom court goes red

  for (let i = 0; i < frames; i++) {
    const n = String(i).padStart(5, '0');
    const botTag = M.trigger == null || i < M.trigger ? 'HEAT 95%' : i < cap ? 'HEAT 100%' : '⚠ BOSS ACTIVE';
    let layers;
    if (i >= N) {
      const k = i - N;
      layers = [{ type: 'fill', color: '#02040a', alpha: 0.78 }, { type: 'scan', alpha: 0.1 }, { type: 'vignette', alpha: 0.5 },
        { type: 'logo', t: k, d: 999, scale: 0.62, y: 36 },
        { type: 'strip', text: 'PLAY IN YOUR BROWSER', t: k, y: 52, size: 36, color: '#f4fbff', weight: 900 },
        { type: 'strip', text: 'LINK IN BIO', t: Math.max(0, k - 6), y: 58, size: 50, color: '#ffd166', weight: 900 }];
    } else {
      const hook = i < cap ? { type: 'hook', text: 'Normal Pong\nvs Glitch Pong', t: i, y: 10, size: 50 } : { type: 'hook', text: 'Same rules.\nDifferent game.', t: i - cap, y: 10, size: 50 };
      layers = [hook, { type: 'scan', alpha: 0.08 }];
    }
    await page.evaluate(async ({ n, botTag, layers, i, st }) => {
      const set = async (id, src) => { const img = document.getElementById(id); if (img.getAttribute('src') !== src) { img.src = src; await img.decode(); } };
      window.drawRetro(st);
      await set('ibot', `/f/vs_bottom/${n}.jpg`);
      document.getElementById('ttop').innerHTML = 'NORMAL PONG<small>CLASSIC RULES</small>';
      document.getElementById('tbot').innerHTML = `GLITCH PONG<small>${botTag}</small>`;
      window.__ov.render(layers, i);
    }, { n, botTag, layers, i, st: mt.st[i] });
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
    fs.writeFileSync(path.join(out, n + '.jpg'), Buffer.from(r.data, 'base64'));
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ frames, marks: { ...M, caption: cap, end: N } }));
  console.log('composed', frames, 'frames');
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'capture') await capture();
  else if (mode === 'capture-top') await captureTop();
  else if (mode === 'compose') await compose();
  else throw new Error('usage: node versus.js capture|compose');
})().catch((e) => { console.error(e); process.exit(1); });
