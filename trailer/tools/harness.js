const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const W = 1600, H = 900;

async function open({ url = 'http://127.0.0.1:8765/glitch-pong.html', storage, width = W, height = H } = {}) {
  const browser = await chromium.launch({ args: ['--mute-audio', '--disable-gpu-vsync'] });
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  if (storage) await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  await context.addInitScript({ path: path.join(__dirname, 'vclock.js') });
  await context.addInitScript({ path: path.join(__dirname, 'overlay.js') });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(url);
  await page.waitForLoadState('load');
  const cdp = await context.newCDPSession(page);
  const g = {
    browser, page, cdp,
    step: (n = 1) => page.evaluate((n) => window.__step(n), n),
    ev: (code) => page.evaluate((c) => window.__gpEval(c), code),
    js: (fn, arg) => page.evaluate(fn, arg),
    async shot(file) {
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    // Record `count` output frames into dir, advancing `per` game frames between shots.
    // `hook(i)` runs before each shot for scripted actions.
    async record(dir, count, { per = 2, hook, start = 0 } = {}) {
      fs.mkdirSync(dir, { recursive: true });
      const f0 = await page.evaluate(() => window.__gpFrame);
      const sfx0 = await page.evaluate(() => window.__sfxLog.length);
      for (let i = 0; i < count; i++) {
        if (hook) await hook(i);
        await g.shot(path.join(dir, String(start + i).padStart(5, '0') + '.jpg'));
        await g.step(per);
      }
      const sfx = await page.evaluate((n) => window.__sfxLog.slice(n), sfx0);
      return { f0, sfx };
    },
    ov: (layers, frame) => page.evaluate(([l, f]) => window.__ov.render(l, f), [layers, frame]),
    cam: (o) => page.evaluate((o) => window.__ov.cam(o), o),
    // Scene recorder: shots go to frames/<name>/NNNNN.jpg; sfx mapped to output frame index.
    recorder(name) {
      const dir = path.join(ROOT, 'frames', name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const map = [], fx = {};
      let n = 0, sfxStart = null;
      return {
        get n() { return n; },
        async shot(layers = [], f = null) {
          if (f && Object.keys(f).length) fx[n] = f;
          if (sfxStart === null) sfxStart = await page.evaluate(() => window.__sfxLog.length);
          await g.ov(layers, n);
          map.push(await page.evaluate(() => window.__gpFrame));
          await g.shot(path.join(dir, String(n).padStart(5, '0') + '.jpg'));
          n++;
        },
        hold(k) { // duplicate last frame k times (freeze frame)
          const last = path.join(dir, String(n - 1).padStart(5, '0') + '.jpg');
          for (let i = 0; i < k; i++) { if (fx[n - 1 - i] && !fx[n]) fx[n] = fx[n - 1 - i]; fs.copyFileSync(last, path.join(dir, String(n).padStart(5, '0') + '.jpg')); map.push(map[map.length - 1]); n++; }
        },
        async save(extra = {}) {
          const log = await page.evaluate((s) => window.__sfxLog.slice(s), sfxStart || 0);
          const sfx = log.map((e) => { let i = map.findIndex((m) => m >= e.f); if (i < 0) i = map.length; return { ...e, out: i }; }).filter((e) => e.out < n);
          fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ frames: n, sfx, fx, ...extra }, null, 1));
          console.log(name, 'frames', n, 'sfx', sfx.length);
        }
      };
    },
    close: () => browser.close()
  };
  return g;
}
module.exports = { open, ROOT, W, H };
