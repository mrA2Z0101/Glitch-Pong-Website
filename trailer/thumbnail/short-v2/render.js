// Renders cover.html -> glitch-pong-short-cover-v2.png (1080x1920) plus viewing-size proofs.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`file://${__dirname}/cover.html`);
  await p.evaluate(async () => { await document.fonts.load('900 118px Orbitron'); await document.fonts.ready; });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${__dirname}/glitch-pong-short-cover-v2.png` });
  await b.close();
})();
