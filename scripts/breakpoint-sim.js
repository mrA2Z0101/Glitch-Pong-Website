// Plays real Breakpoint runs with the game's own AI at the paddle, far faster than
// real time, and writes down what happened in each sector. This is what
// docs/breakpoint-balance.md was measured with.
//
// It needs Playwright (npm install playwright), which the site itself does not
// use, and the site served locally from the repository root:
//
//   python3 -m http.server 8765
//   node scripts/breakpoint-sim.js classic 50 runs.json
//   node scripts/breakpoint-sim-report.js "Classic" runs.json
//
// Usage: node scripts/breakpoint-sim.js <mode> <runs> [outfile]
//   mode      classic, endless, hardcore, bossrush, ... (the AI plays it as a player would)
//   BASE      where the site is served (default http://localhost:8765)
//   MAXLEVEL  stop endless modes at this sector (default 60)
//   NOISE     pixels of wandering aim error, for an imprecise player (default 0: the AI as it is)
//   LAG       frames the imprecise player's aim runs behind (default 0)
//   QUIET     set to print only the summary line
//
// The page runs on a made-up clock and draws nothing, so only the rules run.
const { chromium } = require('playwright');
const fs = require('fs');
const [mode = 'classic', runs = '10', out = ''] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:8765';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.addInitScript((save) => {
    try { localStorage.setItem('gb_save', save); } catch (e) {}
    const vt = window.__vt = { now: 1000, cb: null };
    window.requestAnimationFrame = (cb) => { vt.cb = cb; return 1; };
    performance.now = () => vt.now;
    window.__pump = (n, stop) => { for (let i = 0; i < n; i++) { vt.now += 1000 / 60; const cb = vt.cb; vt.cb = null; if (cb) cb(vt.now); if (stop && stop()) return true; } return false; };
  }, process.env.SAVE || JSON.stringify({ xp: 0, credits: 0, up: {}, ach: {}, best: {}, daily: {}, bossKills: {}, seen: {}, vol: 0, tutorialDone: true }));
  await page.goto(BASE + '/breakpoint/index.html');
  await page.waitForTimeout(1200);
  await page.evaluate(({ noise, lag }) => {
    game.render = () => {};                       // rules only: nothing is drawn
    const S = window.__S = { run: null, sec: null, done: [] };
    const wrap = (name, fn) => { const orig = game[name]; game[name] = function (...a) { return fn.call(this, orig, a); }; };
    wrap('startLevel', function (orig, a) {
      const r = orig.apply(this, a);
      if (S.run) {
        S.sec = { level: this.level, arena: this.arena.name, boss: this.boss ? this.boss.name : null, bricks0: this.bricks.length,
          broken: 0, drops: 0, caught: 0, events: 0, enemies: 0, lives: 0, returns: 0, time: 0, cleared: false, glitch: 0, corruption: 0 };
        S.run.sectors.push(S.sec);
      }
      return r;
    });
    wrap('destroyBrick', function (orig, a) { const n = this.powerups.length; const r = orig.apply(this, a); if (S.sec) { S.sec.broken++; if (this.powerups.length > n) S.sec.drops++; } return r; });
    wrap('applyPowerup', function (orig, a) { if (S.sec && a[0] !== 'random') { S.sec.caught++; S.run.powers[a[0]] = (S.run.powers[a[0]] || 0) + 1; } return orig.apply(this, a); });
    wrap('triggerEvent', function (orig, a) { if (S.sec) S.sec.events++; return orig.apply(this, a); });
    wrap('spawnEnemy', function (orig, a) { const n = this.enemies.length; const r = orig.apply(this, a); if (S.sec && this.enemies.length > n) S.sec.enemies++; return r; });
    wrap('collidePaddle', function (orig, a) { const vy = a[0].vy; const r = orig.apply(this, a); if (S.sec && vy > 0 && a[0].vy < 0) S.sec.returns++; return r; });
    wrap('loseLife', function (orig, a) {
      if (S.sec && !(this.boss && this.boss.dead)) { S.sec.lives++; S.sec.lostAt = (S.sec.lostAt || []).concat(Math.round(this.levelTime)); S.sec.lostDuring = (S.sec.lostDuring || []).concat(this.activeEvent ? this.activeEvent.id : this.paddle.stun > 0 ? 'stun' : '-'); }
      return orig.apply(this, a);
    });
    wrap('levelCleared', function (orig, a) { if (S.sec) { S.sec.cleared = true; S.sec.time = this.levelTime; S.sec.glitch = this.glitch; S.sec.corruption = this.corruption; } return orig.apply(this, a); });
    wrap('endRun', function (orig, a) {
      if (S.run) {
        if (S.sec && !S.sec.cleared) { S.sec.time = this.levelTime; S.sec.glitch = this.glitch; S.sec.corruption = this.corruption; S.sec.left = this.bricks.filter(b => b.alive && b.type !== 'barrier').length; }
        S.run.won = !!a[0]; S.run.level = this.level; S.run.score = Math.floor(this.score); S.run.maxCombo = this.maxCombo; S.run.time = this.time;
        S.done.push(S.run); S.run = null; S.sec = null;
      }
      return orig.apply(this, a);
    });
    // An imprecise player: the AI's aim, but late by LAG frames and off by a wandering error of about NOISE pixels.
    if (noise > 0) {
      const orig = game.computeAiInput.bind(game), q = [];
      let off = 0, offT = 0;
      game.computeAiInput = function () {
        const inp = orig();
        q.push(inp.mouseX);
        const x = q.length > lag ? q.shift() : q[0];
        if (--offT <= 0) { offT = 18 + Math.random() * 30; off = (Math.random() + Math.random() + Math.random() - 1.5) / 0.5 * noise; }
        inp.mouseX = Math.max(0, Math.min(CFG.W, x + off));
        return inp;
      };
    }
    window.__startRun = (mode) => {
      S.run = { mode, sectors: [], powers: {} };
      game.startRun(mode);
      if (!game.autoplay) game.setAutoplay(true, false);       // the AI plays the mode as a player would
    };
  }, { noise: Number(process.env.NOISE || 0), lag: Number(process.env.LAG || 0) });
  const maxLevel = Number(process.env.MAXLEVEL || 60);
  const t0 = Date.now(), all = [];
  for (let i = 0; i < Number(runs); i++) {
    await page.evaluate((m) => window.__startRun(m), mode);
    let over = false;
    for (let guard = 0; guard < Number(process.env.GUARD || 400) && !over; guard++) {
      over = await page.evaluate((maxLevel) => {
        const done = window.__pump(6000, () => game.state === 'over' || game.level > maxLevel);
        if (done && game.state !== 'over') game.endRun(false);    // endless modes: stop at the cap
        return game.state === 'over';
      }, maxLevel);
    }
    const run = await page.evaluate(() => { const r = window.__S.done.pop(); window.__S.done = []; return r || null; });
    if (!over || !run) { console.log('run', i, 'did not finish'); await page.evaluate(() => { game.endRun(false); }); continue; }
    all.push(run);
    if (!process.env.QUIET) console.log(`run ${i + 1}: ${run.won ? 'WON ' : 'lost'} at sector ${run.level}, score ${run.score}, ${(run.time / 60).toFixed(1)} game-min, sectors ${run.sectors.map(s => Math.round(s.time)).join(' ')}`);
  }
  const secs = (Date.now() - t0) / 1000;
  console.log(`${mode}: ${all.length} runs in ${secs.toFixed(0)}s (${(all.reduce((s, r) => s + r.time, 0) / secs).toFixed(0)}x real time)`);
  console.log(errors.length ? [...new Set(errors)].slice(0, 6).join('\n') : 'NO PAGE ERRORS');
  if (out) fs.writeFileSync(out, JSON.stringify(all));
  await browser.close();
})();
