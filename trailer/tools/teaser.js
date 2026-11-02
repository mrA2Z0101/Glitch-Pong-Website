// 25s cryptic teaser (landscape 1920x1080 after upscale). Records the clips that teaser_edit.py
// assembles: a dark calm rally, arena flash inserts, the Heat build into the pre-boss freeze,
// the boss fight + end card, and the Eye card.
// Usage: node teaser.js   (output: ../frames/tz_*/)
const ARGS = process.argv.slice(2);
process.argv.length = 2; // scenes.js runs its own CLI on require; keep it idle
const { boot, startMatch, run, L, win, CALM } = require('./scenes');

const J = (s) => JSON.parse(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dark = (a) => ({ type: 'fill', color: '#000', alpha: a });
const vig = (a) => ({ type: 'vignette', alpha: a });

const HIDE = 'hud.style.display="none"; help.style.display="none";';

(async () => {
  const g = await boot(301);
  // Hide the status bar and controls hint on every recorded frame for a cleaner, cinematic look.
  const makeRecorder = g.recorder.bind(g);
  g.recorder = (name) => {
    const rec = makeRecorder(name);
    const shot = rec.shot.bind(rec);
    rec.shot = async (layers, fx) => { await g.ev(HIDE); return shot(layers, fx); };
    return rec;
  };

  // ── Flash inserts: Black-Hole Nexus and Matrix Mainframe at high Heat ─────
  for (const [arena, name] of [['blackhole', 'tz_bh'], ['matrix', 'tz_matrix']]) {
    await startMatch(g, { arena, diff: 'hard' });
    await g.ev('heat=90; powerupSpawnCooldown=99999;');
    await g.step(90);
    const rec = g.recorder(name);
    await run(g, rec, 12, { each: async () => { await g.ev('heat=Math.max(heat,90);'); return [L.scan(0.12)]; } });
    await rec.save();
  }

  // ── A + B base: a slow, dim rally. "Just a game." -> "It never was." ──────
  await startMatch(g, { arena: 'classic', diff: 'easy' });
  await g.ev(CALM + 'heat=0;');
  const calm = g.recorder('tz_calm');
  await run(g, calm, 270, {
    each: async (i) => {
      await g.ev(CALM + 'heat=0; leftScore=0; rightScore=0;');
      const layers = [dark(0.6), vig(0.85), L.scan(0.16)];
      if (i >= 24 && i < 150) layers.push(L.typed('Just a game.', i - 24, 999, { y: 82, size: 42, rate: 3 }));
      if (i >= 150) layers.push({ type: 'morph', a: 'Just a game.', b: 'It never was.', t: i - 150, d: 80, y: 82, size: 42 });
      return { layers, fx: i >= 150 && i % 11 === 0 ? { rgb: 6, slices: 2 } : null };
    }
  });
  await calm.save();

  // ── C: Heat climbs, the screen wakes up. Ends on the boss trigger. ────────
  await startMatch(g, { arena: 'classic', diff: 'hard' });
  await g.ev('ensureBossAssets(); powerupSpawnCooldown=99999; heat=30;');
  await sleep(2000); // Eye images load in real time
  const heat = g.recorder('tz_heat');
  for (let i = 0; ; i++) {
    const shown = Math.min(99, 30 + i * 0.6);
    const st = J(await g.ev('JSON.stringify({bx:ballX, by:ballY, pb:preBossActive||bossModeActive})'));
    if (st.pb) throw new Error('boss triggered early');
    if (i >= 112 && st.bx > 450 && st.bx < 1100 && st.by > 260 && st.by < 760) { await g.ev('heat=100; triggerPreBoss();'); break; }
    await g.ev(`powerupSpawnCooldown=99999; teleportCooldown=Math.max(teleportCooldown,60); heat=${Math.min(85, shown)};`);
    if ([40, 70, 90, 105].includes(i)) await g.ev('trySpawnGlitchWall()');
    const layers = [dark(Math.max(0, 0.55 - i * 0.008)), vig(0.6), L.scan(0.12), { type: 'heat', v: shown }];
    await heat.shot(layers, i % 30 === 29 ? { rgb: 8, slices: 2 } : null);
    await g.step(2);
    if (i > 400) throw new Error('no trigger window');
  }
  await heat.save();

  // ── D + F + end card: freeze/bubble/glitch (slow), then the fight, then the logo. ─
  const boss = g.recorder('tz_boss');
  const M = {};
  await run(g, boss, 120, {
    per: 1,
    each: async (i) => ({ layers: [vig(0.65), L.scan(0.14)], fx: i >= 80 ? { rgb: 6 + (i % 5) * 3, slices: i % 4 === 0 ? 4 : 0 } : null })
  });
  M.preEnd = boss.n;
  // Morph -> alarm -> aim -> six throws, no text.
  for (let i = 0; i < 260; i++) {
    const st = J(await g.ev('JSON.stringify({m:bossModeActive, p:bossPhase})'));
    if (M.alarm == null && st.m) M.alarm = boss.n;
    if (M.throw == null && st.p === 'throw') M.throw = boss.n;
    await boss.shot([L.scan(0.1)]);
    await g.step(2);
  }
  M.end = boss.n;
  for (let i = 0; i < 100; i++) {
    const layers = [dark(i < 3 ? 0.9 : 0.62), vig(0.6), L.scan(0.12), { type: 'logo', t: i, d: 999, scale: 0.8, y: 38 }];
    if (i >= 26) layers.push({ type: 'strip', text: 'PLAY NOW ON ITCH.IO', t: i - 26, y: 72, size: 54, color: '#ffd166', weight: 900 });
    if (i >= 34) layers.push({ type: 'strip', text: 'noodlecometstudios.itch.io/glitch-pong', t: i - 34, y: 80, size: 32, color: '#9ff3ff' });
    await boss.shot(layers, i < 6 ? { rgb: 20 - i * 3, slices: 6 - i } : (i >= 94 ? { rgb: (i - 93) * 4, slices: i - 92 } : null));
    await g.step(2);
  }
  await boss.save({ marks: M });

  // ── E: the Eye opens in the dark and stares at you ───────────────────────
  const eye = g.recorder('tz_eye');
  const ease = (t) => t * t * (3 - 2 * t);
  for (let i = 0; i < 120; i++) {
    const look = i < 40 ? 'neutral' : i < 56 ? 'left' : i < 72 ? 'right' : 'neutral';
    const layers = [dark(1), { type: 'eye', look, sy: i < 30 ? ease(i / 30) : 1, w: 520 + i * 0.9 }, L.scan(0.16)];
    if (i >= 80) layers.push(L.typed("It's been watching.", i - 80, 999, { y: 82, size: 42, rate: 2 }));
    await eye.shot(layers, i === 72 ? { rgb: 10 } : null);
    await g.step(2);
  }
  await eye.save();
  await g.close();
})().catch((e) => { console.error(e); process.exit(1); });
