const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`file://${__dirname}/short_cover.html`);
  await p.evaluate(async () => { await document.fonts.load("900 112px Orbitron"); await document.fonts.load("30px 'Press Start 2P'"); await document.fonts.ready; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${__dirname}/glitch-pong-short-cover.png` });
  await b.close();
})();
