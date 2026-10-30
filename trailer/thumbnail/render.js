const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  for (const v of ['A', 'B']) {
    await p.goto(`file://${__dirname}/thumbnail.html?v=${v}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${__dirname}/glitch-pong-thumbnail-${v}.png` });
  }
  await b.close();
})();
