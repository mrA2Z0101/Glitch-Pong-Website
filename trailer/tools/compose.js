// Follow-crop compositor for the vertical shorts: cuts a smoothed 9:16 window out of each landscape
// frame (fx/<scene>/) along the camera track recorded by shorts.js, draws the upright overlays, and
// writes 1080x1920 frames to vframes/<scene>/.
// Usage: node compose.js v_tired v_grudge ...
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const GW = 1920, GH = 1080, OW = 1080, OH = 1920, OV = 1.2; // overlays are authored for a 900x1600 canvas
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#000;overflow:hidden;width:${OW}px;height:${OH}px}
#bg{position:absolute;left:0;top:0;width:${GW}px;height:${GH}px;transform-origin:0 0}</style></head>
<body><img id="bg"></body></html>`;

// Smoothed camera: follows the ball with a little lead, or an explicit focus; zoom eases too.
function cameraTrack(V) {
  const cams = [];
  let cx = null, cy = null, cz = null;
  for (let i = 0; i < V.length; i++) {
    const v = V[i];
    const zT = v.z || 1;
    const prev = V[Math.max(0, i - 1)].b;
    const vx = Math.max(-60, Math.min(60, v.b[0] - prev[0]));
    const tx = v.f ? v.f[0] : v.b[0] + vx * 5;
    const ty = v.f ? v.f[1] : (zT > 1 ? v.b[1] : GH / 2);
    if (cx === null || v.snap) { cx = tx; cy = ty; cz = zT; }
    else { cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16; cz += (zT - cz) * 0.2; }
    const ch = GH / cz, cw = ch * 9 / 16;
    cx = Math.max(cw / 2, Math.min(GW - cw / 2, cx));
    cy = Math.max(ch / 2, Math.min(GH - ch / 2, cy));
    cams.push({ left: cx - cw / 2, top: cy - ch / 2, S: OH / ch });
  }
  return cams;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: OW, height: OH } });
  await context.addInitScript({ path: path.join(__dirname, 'overlay.js') });
  await context.route('http://compose.local/**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/' || u.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: PAGE });
    if (u.pathname.startsWith('/f/')) return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(ROOT, 'fx', decodeURIComponent(u.pathname.slice(3)))) });
    if (u.pathname.startsWith('/assets/')) return route.fulfill({ path: path.join(REPO, decodeURIComponent(u.pathname)) });
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await context.newPage();
  await page.goto('http://compose.local/index.html');
  await page.evaluate(async () => {
    window.__ov.vertical(true);
    document.getElementById('__ovroot').style.zoom = '1.2';
    await document.fonts.ready;
  });
  const cdp = await context.newCDPSession(page);

  for (const scene of process.argv.slice(2)) {
    const t0 = Date.now();
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'fx', scene, 'meta.json')));
    const cams = cameraTrack(meta.v);
    const out = path.join(ROOT, 'vframes', scene);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    for (let i = 0; i < meta.frames; i++) {
      const c = cams[i];
      // Map game-space markers into the cropped frame (overlay space is 1/1.2 of output pixels).
      const layers = meta.v[i].L.map((L) => (L.gx == null ? L : { ...L, x: (L.gx - c.left) * c.S / OV, y: (L.gy - c.top) * c.S / OV }));
      await page.evaluate(async ({ src, c, layers, i }) => {
        const img = document.getElementById('bg');
        if (img.getAttribute('src') !== src) { img.src = src; await img.decode(); }
        img.style.transform = `scale(${c.S}) translate(${-c.left}px, ${-c.top}px)`;
        window.__ov.render(layers, i);
      }, { src: `/f/${scene}/${String(i).padStart(5, '0')}.jpg`, c, layers, i });
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
      fs.writeFileSync(path.join(out, String(i).padStart(5, '0') + '.jpg'), Buffer.from(r.data, 'base64'));
    }
    console.log(scene, meta.frames, 'frames composed in', Math.round((Date.now() - t0) / 1000), 's');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
