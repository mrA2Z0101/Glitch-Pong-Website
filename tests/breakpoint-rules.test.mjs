import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

// Breakpoint's rules (breakpoint/js/rules.js): scoring, sector layouts, the boss
// schedule, the upgrade tree, each arena's rule, the codex, the guided first
// sector and the run recap. The file is a plain page script that reads the
// tables in js/config.js, so both are loaded into one sandbox here. The drawing
// (js/game.js, js/entities.js, js/arenas.js, js/backdrops.js) is not covered.
const read = (p) => readFileSync(new URL('../breakpoint/' + p, import.meta.url), 'utf8');
const sandbox = {};
vm.runInNewContext(read('js/config.js') + '\n' + read('js/rules.js') +
  '\nglobalThis.R = Rules; globalThis.T = { CFG, BRICKS, ARENAS, MUSIC, POWERUPS, POWERUP_KEYS, EVENTS, UPGRADES, MODES, DAILY_MODS,' +
  ' BRICK_INFO, ENEMY_INFO, BOSS_INFO, EVENT_INFO, MOOD_INFO, brickWeights, mulberry32 };', sandbox);
const R = sandbox.R, T = sandbox.T;
// values made inside the sandbox have its own Array and Object, so compare copies
const plain = (v) => JSON.parse(JSON.stringify(v));
const seeded = (seed) => T.mulberry32(seed);

test('XP turns into levels on a rising curve', () => {
  assert.equal(R.levelFromXp(0).level, 1);
  assert.equal(R.levelFromXp(99).level, 1);
  assert.equal(R.levelFromXp(100).level, 2);
  assert.equal(R.levelFromXp(100).progress, 0);
  const need2 = Math.floor(100 * Math.pow(2, 1.35));           // what level 2 to 3 costs
  assert.equal(R.levelFromXp(100 + need2 - 1).level, 2);
  assert.equal(R.levelFromXp(100 + need2).level, 3);
  assert.ok(Math.abs(R.levelFromXp(150).progress - 50 / need2) < 1e-9);
  let last = 0;
  for (let xp = 0; xp < 200000; xp += 997) { const lv = R.levelFromXp(xp).level; assert.ok(lv >= last); last = lv; }
  assert.equal(R.levelFromXp(-5).level, 1, 'a damaged save still has a level');
  assert.equal(R.levelFromXp(undefined).level, 1);
});

test('score: the Glitch meter and the combo both multiply a brick', () => {
  assert.deepEqual([0, 24.9, 25, 49.9, 50, 74.9, 75, 100].map((g) => R.glitchMultiplier(g)), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
  assert.equal(R.scoreMultiplier(80, true), 6, 'SCORE x2 doubles it again');
  assert.equal(R.comboBonus(0), 1);
  assert.equal(R.comboBonus(10), 1.5);
  assert.equal(R.comboBonus(40), 3);
  assert.equal(R.comboBonus(400), 3, 'the combo bonus stops growing at 40');
  assert.equal(R.points(50, 0, 0, false), 50);
  assert.equal(R.points(50, 10, 50, false), 150);
  assert.equal(R.points(50, 40, 100, true), 900, 'the most a plain brick can be worth');
  assert.equal(R.clearBonus(1), 600);
  assert.equal(R.clearBonus(12), 1700);
  assert.equal(R.timeBonus(0), 4000);
  assert.equal(R.timeBonus(60), 2500);
  assert.equal(R.timeBonus(160), 0);
  assert.equal(R.timeBonus(900), 0, 'never negative');
  assert.deepEqual(plain(R.runRewards(11000, 6, 0)), { xp: 1100, credits: 290 });
  assert.equal(R.runRewards(11000, 6, 3).xp, 1760, 'DATA MINER adds 20% a rank');
  assert.equal(R.startingLives('classic', 0), 3);
  assert.equal(R.startingLives('classic', 2), 5);
  assert.equal(R.startingLives('hardcore', 2), 1, 'Hardcore is one life whatever you own');
  assert.equal(R.serveSpeed(1, false), T.CFG.BALL_SPD * 1.015);
  assert.ok(R.serveSpeed(12, false) < T.CFG.BALL_MAX, 'even sector 12 is served well under the top speed');
  assert.equal(R.serveSpeed(4, true), T.CFG.BALL_SPD * 1.5 * 1.06);
  assert.equal(R.dropChance(0, 0), T.CFG.DROP_CHANCE);
  assert.ok(Math.abs(R.dropChance(3, 60) - (T.CFG.DROP_CHANCE + 0.12 + 0.04)) < 1e-9);
});

test('some bricks shrug off some hits', () => {
  assert.equal(R.brickImmune('normal', false, {}), null);
  assert.equal(R.brickImmune('barrier', false, { emp: true }), 'BARRIER', 'nothing breaks a barrier');
  assert.equal(R.brickImmune('shield', true, {}), 'SHIELDED');
  assert.equal(R.brickImmune('shield', false, {}), null, 'with the generators gone it is an ordinary brick');
  assert.equal(R.brickImmune('bosscore', true, { laser: true }), 'LOCKED');
  assert.equal(R.brickImmune('bosscore', false, {}), null);
  assert.equal(R.brickImmune('firewall', false, {}), 'FIREWALL', 'the plain ball bounces off');
  for (const how of ['laser', 'fire', 'emp', 'explosion']) assert.equal(R.brickImmune('firewall', false, { [how]: true }), null, how);
  assert.equal(R.brickImmune('firewall', false, undefined), 'FIREWALL');

  assert.equal(R.onlyFirewallsLeft(['firewall', 'firewall']), true);
  assert.equal(R.onlyFirewallsLeft(['firewall', 'normal']), false);
  assert.equal(R.onlyFirewallsLeft([]), false, 'an empty board is a cleared sector, not a stuck one');
  for (const kind of R.BREACH_KIT) assert.ok(T.POWERUPS[kind], `${kind} is a real power-up`);

  // what can drop: everything, except that Hardcore's one life stays one life
  assert.deepEqual(plain(R.dropPool('classic')), plain(T.POWERUP_KEYS));
  assert.equal(R.dropPool('hardcore').includes('life'), false);
  assert.equal(R.dropPool('hardcore').length, T.POWERUP_KEYS.length - 1);
  assert.ok(R.dropPool('hardcore').includes('random'), 'the randomizer still drops there');
});

test('every fifth sector is a boss, and THE EYE takes every tenth', () => {
  for (let lv = 1; lv <= 40; lv++) {
    assert.equal(R.isBossSector('classic', lv), lv % 5 === 0, `sector ${lv}`);
    assert.equal(R.isBossSector('puzzle', lv), false, 'Puzzle has no bosses');
    assert.equal(R.isBossSector('bossrush', lv), true);
  }
  assert.deepEqual(plain([5, 10, 15, 20, 25, 30].map((lv) => R.bossFor('endless', lv))),
    [{ boss: 0, tier: 1 }, { boss: 'eye', tier: 2 }, { boss: 2, tier: 3 }, { boss: 'eye', tier: 4 }, { boss: 4, tier: 5 }, { boss: 'eye', tier: 6 }]);
  // Boss Rush: the five mini bosses in order, then THE EYE
  assert.deepEqual(plain([1, 2, 3, 4, 5, 6].map((lv) => R.bossFor('bossrush', lv).boss)), [0, 1, 2, 3, 4, 'eye']);
  assert.equal(T.MODES.bossrush.levels, 6, 'so its sixth and last sector is THE EYE');
  assert.equal(T.MODES.classic.levels, 12, 'and Classic meets THE EYE once, at sector 10');

  assert.equal(R.arenaIndex(1), 0);
  assert.equal(R.arenaIndex(12), 11);
  assert.equal(R.arenaIndex(13), 0, 'the arenas come round again');
  assert.deepEqual(plain(R.enemyKinds(2)), []);
  assert.deepEqual(plain(R.enemyKinds(3)), ['drone']);
  assert.deepEqual(plain(R.enemyKinds(6)), ['drone', 'virus', 'repair', 'turret']);
  for (const kind of R.enemyKinds(20)) assert.ok(T.ENEMY_INFO[kind], `${kind} is in the codex`);
  assert.equal(R.enemyCap(3, false), 1);
  assert.equal(R.enemyCap(8, false), 3);
  assert.equal(R.enemyCap(8, true), 9, 'TRIPLE ENEMIES');
});

test('a sector\'s wall: rows, patterns and which bricks arrive when', () => {
  assert.deepEqual([1, 2, 3, 9, 10, 11, 30].map((lv) => R.sectorRows(lv)), [4, 5, 5, 8, 9, 9, 9]);
  assert.equal(R.patternHolds('full', 3, 7, 6, 12), true);
  assert.equal(R.patternHolds('checker', 0, 0, 6, 12), true);
  assert.equal(R.patternHolds('checker', 0, 1, 6, 12), false);
  assert.equal(R.patternHolds('columns', 2, 2, 6, 12), false, 'every third column is a gap');
  assert.equal(R.patternHolds('pyramid', 0, 0, 6, 12), false, 'the top of a pyramid is narrow');
  assert.equal(R.patternHolds('pyramid', 5, 0, 6, 12), true);
  assert.equal(R.pickWeighted({ normal: 60, heavy: 40 }, 0), 'normal');
  assert.equal(R.pickWeighted({ normal: 60, heavy: 40 }, 0.59), 'normal');
  assert.equal(R.pickWeighted({ normal: 60, heavy: 40 }, 0.61), 'heavy');

  // the same seed lays the same wall (this is what makes the Daily Glitch the same for everyone)
  assert.deepEqual(plain(R.layoutSector(7, 12, seeded(42))), plain(R.layoutSector(7, 12, seeded(42))));
  assert.notDeepEqual(plain(R.layoutSector(7, 12, seeded(42))), plain(R.layoutSector(7, 12, seeded(43))));

  const seenPatterns = new Set();
  for (let lv = 1; lv <= 30; lv++) {
    const allowed = new Set([...Object.keys(T.brickWeights(lv)), 'bosscore', 'generator']);
    for (let seed = 1; seed <= 40; seed++) {
      for (const cols of [8, 12, 16]) {
        const cells = R.layoutSector(lv, cols, seeded(seed * 131 + lv));
        seenPatterns.add(cells.pattern);
        assert.ok(cells.length >= 6, `sector ${lv} has a wall worth the name (${cells.length} bricks, ${cells.pattern}, ${cols} columns)`);
        const rows = R.sectorRows(lv), spots = new Set();
        for (const cell of cells) {
          assert.ok(cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols);
          assert.ok(T.BRICKS[cell.type], `${cell.type} is a brick`);
          assert.ok(allowed.has(cell.type), `${cell.type} in sector ${lv}`);
          assert.ok(!spots.has(cell.r + ',' + cell.c), 'one brick to a cell');
          spots.add(cell.r + ',' + cell.c);
        }
        const cores = cells.filter((cell) => cell.type === 'bosscore').length, gens = cells.filter((cell) => cell.type === 'generator').length;
        assert.ok(cores <= 1);
        if (cores) { assert.ok(lv >= 8, 'boss cores hide in deep sectors only'); assert.equal(gens, 2, 'a boss core is guarded by two generators'); }
        else assert.equal(gens, 0, 'no generators without something to guard');
        // the ball alone can always make progress: never a wall of nothing but firewall bricks
        assert.ok(!R.onlyFirewallsLeft(cells.map((cell) => cell.type)));
      }
    }
  }
  assert.deepEqual([...seenPatterns].sort(), plain(R.PATTERNS).sort(), 'all six patterns turn up');

  // sector 1 is the gentle one: plain bricks and a few heavy ones
  for (let seed = 1; seed <= 60; seed++) for (const cell of R.layoutSector(1, 12, seeded(seed))) assert.ok(cell.type === 'normal' || cell.type === 'heavy');
  // the green ones hold off: virus at 5, clone at 6
  assert.equal(T.brickWeights(4).virus, undefined);
  assert.ok(T.brickWeights(5).virus > 0);
  assert.equal(T.brickWeights(5).clone, undefined);
  assert.ok(T.brickWeights(6).clone > 0);
});

test('the upgrade tree: three branches, bought top to bottom', () => {
  const inTree = R.UPGRADE_TREE.flatMap((b) => plain(b.nodes));
  assert.deepEqual(inTree.slice().sort(), T.UPGRADES.map((u) => u.id).sort(), 'every upgrade sits in exactly one branch');
  assert.equal(new Set(inTree).size, inTree.length);
  for (const branch of R.UPGRADE_TREE) {
    assert.equal(branch.nodes.length, 4);
    assert.equal(R.upgradeParent(branch.nodes[0]), null);
    for (let i = 1; i < 4; i++) assert.equal(R.upgradeParent(branch.nodes[i]), branch.nodes[i - 1]);
  }
  assert.equal(R.upgradeCost('pad_len', 0), 350);
  assert.equal(R.upgradeCost('pad_len', 1), 700, 'each rank costs double');
  assert.equal(R.upgradeCost('pad_len', 2), 1400);

  // a fresh save with 400 credits: the top of each branch is all it can think about
  assert.equal(R.upgradeState('pad_len', {}, 400).state, 'buy');
  assert.deepEqual(plain(R.upgradeState('luck', {}, 400)), { id: 'luck', rank: 0, max: 3, cost: 450, state: 'short', parent: null, short: 50 });
  assert.equal(R.upgradeState('pad_spd', {}, 99999).state, 'locked', 'whatever you can afford, the node above comes first');
  assert.equal(R.upgradeState('pad_spd', {}, 99999).parent, 'pad_len');
  assert.equal(R.upgradeState('pad_spd', { pad_len: 1 }, 350).state, 'buy');
  assert.equal(R.upgradeState('pad_len', { pad_len: 3 }, 0).state, 'max');
  assert.equal(R.upgradeState('magnet', { magnet: 1 }, 0).state, 'max', 'a one-rank upgrade you own');
  // someone who bought the laser before the tree existed keeps it, and could still rank it up if it had ranks
  assert.equal(R.upgradeState('laser', { laser: 1 }, 0).state, 'max');
  assert.equal(R.upgradeState('crit', { crit: 1 }, 5000).state, 'buy', 'owned already, so the node above does not gate it');

  assert.equal(R.buyUpgrade('pad_spd', {}, 99999), null, 'locked');
  assert.equal(R.buyUpgrade('pad_len', {}, 349), null, 'one credit short');
  const before = { luck: 1 };
  assert.deepEqual(plain(R.buyUpgrade('pad_len', before, 1000)), { ranks: { luck: 1, pad_len: 1 }, credits: 650 });
  assert.deepEqual(before, { luck: 1 }, 'the save is not changed until the game stores the result');
  // buying every rank of everything, cheapest available first, always terminates
  let ranks = {}, credits = 1e9, bought = 0;
  for (let guard = 0; guard < 200; guard++) {
    const next = inTree.find((id) => R.upgradeState(id, ranks, credits).state === 'buy');
    if (!next) break;
    ({ ranks, credits } = R.buyUpgrade(next, ranks, credits));
    bought++;
  }
  assert.equal(bought, T.UPGRADES.reduce((n, u) => n + u.max, 0), 'the whole tree can be bought');
  for (const u of T.UPGRADES) assert.equal(R.upgradeState(u.id, ranks, 0).state, 'max');
});

test('the Daily Glitch picks the same two or three mutators for everyone', () => {
  const ids = (date) => plain(R.dailyMods(date)).map((m) => m.id);
  assert.deepEqual(ids('2026-11-12'), ids('2026-11-12'));
  const seen = new Set(), sets = new Set();
  for (let day = 1; day <= 28; day++) {
    const mods = ids(`2026-02-${String(day).padStart(2, '0')}`);
    assert.ok(mods.length === 2 || mods.length === 3);
    assert.equal(new Set(mods).size, mods.length, 'no mutator twice in a day');
    for (const id of mods) { assert.ok(T.DAILY_MODS.some((m) => m.id === id)); seen.add(id); }
    sets.add(mods.join());
  }
  assert.equal(seen.size, T.DAILY_MODS.length, 'every mutator comes up within a month');
  assert.ok(sets.size > 10, 'and the days differ');
  assert.equal(R.dailySeed('2026-11-12'), R.dailySeed('2026-11-12'));
  assert.notEqual(R.dailySeed('2026-11-12'), R.dailySeed('2026-11-13'));
});

test('each of the twelve arenas has a place, a rule, a hazard and a soundtrack of its own', () => {
  assert.equal(T.ARENAS.length, 12);
  const rules = plain(T.ARENAS.map((a) => a.rule));
  assert.equal(new Set(rules).size, 12, 'no two arenas share a rule');
  assert.deepEqual(rules.slice().sort(), Object.keys(R.ARENA_RULES).sort(), 'and every rule belongs to an arena');
  assert.equal(T.ARENAS[0].rule, 'standard', 'sector 1 is always the plain court');
  assert.equal(T.ARENAS[0].hazard, null);

  const hazardSource = read('js/entities.js') + read('js/arenas.js'), backdrops = read('js/backdrops.js');
  for (const a of T.ARENAS) {
    const rule = R.arenaRule(a);
    assert.ok(rule.name && rule.line, `${a.name} says what it does`);
    assert.ok(rule.line.length < 90, `${a.name}'s line fits the countdown caption`);
    if (a.hazard) assert.ok(new RegExp(`\\b${a.hazard}:`).test(hazardSource), `${a.name}: ${a.hazard} is a hazard the game has`);
    assert.ok(backdrops.includes(`'${a.name}': {`), `${a.name} has a backdrop`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(a.accent) && /^#[0-9a-f]{6}$/i.test(a.bg), `${a.name}'s colours are plain hex (the backdrops rely on it)`);
    // its soundtrack: a theme with recordings that are in the repository
    assert.ok(T.MUSIC[a.music], `${a.name} plays a theme that exists`);
    for (const file of T.MUSIC[a.music]) {
      const path = file.includes('/') ? '../breakpoint/' + file + '.mp3' : '../breakpoint/sounds/music/' + file + '.mp3';
      assert.ok(existsSync(new URL(path, import.meta.url)), `${file}.mp3 is there`);
    }
  }
  assert.equal(R.arenaRule({ rule: 'nope' }).name, 'STANDARD', 'an unknown rule plays as the plain court');
  assert.ok(new Set(T.ARENAS.map((a) => a.music)).size >= 6, 'at least six different themes across the arenas');
  for (const file of T.MUSIC.eye) assert.ok(existsSync(new URL('../breakpoint/sounds/music/' + file + '.mp3', import.meta.url)));
});

test('MEMORY LEAK: a wasted return shortens the paddle, down to four fifths', () => {
  const t = R.ARENA_TUNING.leak;
  assert.equal(R.leakFactor(0), 1);
  assert.equal(R.leakFactor(1), 1 - t.perReturn);
  assert.ok(Math.abs(R.leakFactor(5) - (1 - 5 * t.perReturn)) < 1e-9);
  assert.equal(R.leakFactor(500), t.least, 'it stops shrinking');
  assert.equal(R.leakFactor(-3), 1);
  let last = 1;
  for (let n = 0; n < 40; n++) { const k = R.leakFactor(n); assert.ok(k <= last && k >= t.least); last = k; }
  assert.ok(t.least >= 0.7, 'never less than 70% of the paddle: the shortest paddle is still a fair one');
  assert.ok((1 - t.least) / t.perReturn >= 6, 'and it takes at least six wasted returns to get there');
});

test('QUANTUM REACTOR: the core warns, fires, and throws nearby balls outward', () => {
  const t = R.ARENA_TUNING.pulse, s = { t: 0 };
  let fired = 0, sawWarning = false;
  for (let i = 0; i < 60 * 30; i++) {
    const tick = R.pulseTick(s, 1 / 60);
    if (tick.fired) fired++;
    else if (tick.charge > 0) { sawWarning = true; assert.ok(s.t > t.every - t.warn - 0.02); }
    assert.ok(tick.charge >= 0 && tick.charge <= 1);
  }
  assert.equal(fired, 3, 'three pulses in thirty seconds');
  assert.ok(sawWarning);
  assert.ok(t.warn >= 1, 'at least a second of warning');

  const ball = { x: 580, y: 340, vx: 300, vy: -200 };            // a hundred pixels right of a core at (480, 340)
  assert.equal(R.pulseKick(ball, 480, 340), true);
  assert.ok(Math.abs(ball.vx - Math.hypot(300, 200)) < 1e-6 && Math.abs(ball.vy) < 1e-6, 'straight away from the core, at the speed it had');
  const far = { x: 480 + t.radius + 1, y: 340, vx: 0, vy: 400 };
  assert.equal(R.pulseKick(far, 480, 340), false, 'out of reach');
  assert.equal(far.vy, 400);
  const onTop = { x: 480, y: 340, vx: 0, vy: 380 };
  R.pulseKick(onTop, 480, 340);
  assert.ok(onTop.vy < 0 && Number.isFinite(onTop.vx), 'a ball on the core is thrown up, not left with nowhere to go');
});

test('AI MAINFRAME: the defender chases a rising ball and only blocks on the way up', () => {
  const t = R.ARENA_TUNING.defender, d = { x: 200 };
  const rising = { x: 600, y: t.y + 100, vy: -300, r: 7 };
  R.defenderStep(d, [rising], 0.5, 960);
  assert.equal(d.x, 200 + t.speed * 0.5, 'it moves at its own speed, not the ball\'s');
  R.defenderStep(d, [{ x: 600, y: t.y + 100, vy: 300, r: 7 }], 0.5, 960);
  assert.equal(d.x, 200 + t.speed * 0.5, 'a falling ball is none of its business');
  R.defenderStep(d, [{ x: 600, y: t.y + t.sees + 50, vy: -300, r: 7 }], 0.5, 960);
  assert.equal(d.x, 200 + t.speed * 0.5, 'nor one too far below to see');
  R.defenderStep(d, [{ x: 600, y: t.y - 50, vy: -300, r: 7 }], 0.5, 960);
  assert.equal(d.x, 200 + t.speed * 0.5, 'nor one already past it');
  R.defenderStep(d, [{ x: 600, y: t.y + 100, vy: -300, r: 7, stuck: true }], 0.5, 960);
  assert.equal(d.x, 200 + t.speed * 0.5);
  for (let i = 0; i < 200; i++) R.defenderStep(d, [rising], 0.05, 960);
  assert.equal(d.x, 600, 'given time it gets there and stops');
  R.defenderStep(d, [{ x: 9999, y: t.y + 10, vy: -300, r: 7 }], 60, 960);
  assert.equal(d.x, 960 - t.width / 2, 'it stays on the field');
  // two balls: it goes for the one that will arrive first
  const dd = { x: 480 };
  R.defenderStep(dd, [{ x: 100, y: t.y + 200, vy: -300, r: 7 }, { x: 900, y: t.y + 40, vy: -300, r: 7 }], 0.1, 960);
  assert.ok(dd.x > 480);

  const bar = { x: 480 }, under = t.y + t.height / 2;
  const ball = (x, y, vy) => ({ x, y, vy, r: 7 });
  assert.equal(R.defenderBlocks(bar, ball(480, under + 5, -400), under + 12), true, 'reached the underside on this step');
  assert.equal(R.defenderBlocks(bar, ball(480, under - 30, -400), under + 12), true, 'a fast ball that would have jumped clean over it is still caught');
  assert.equal(R.defenderBlocks(bar, ball(480, under + 40, -400), under + 60), false, 'not there yet');
  assert.equal(R.defenderBlocks(bar, ball(480, under - 20, 400), under - 40), false, 'a falling ball passes through');
  assert.equal(R.defenderBlocks(bar, ball(480 + t.width / 2 + 8, under + 5, -400), under + 12), false, 'wide of it');
  assert.equal(R.defenderBlocks(bar, ball(480 + t.width / 2 + 6, under + 5, -400), under + 12), true, 'clipping its end counts');
  assert.equal(R.defenderBlocks(bar, ball(480, under - 60, -400), under - 30), false, 'already above it');
  // after a block it reboots: for a while it neither blocks nor moves, so the next shot always gets through
  const resting = { x: 480, rest: t.rest };
  assert.equal(R.defenderBlocks(resting, ball(480, under + 5, -400), under + 12), false);
  R.defenderStep(resting, [{ x: 900, y: t.y + 100, vy: -300, r: 7 }], 0.5, 960);
  assert.equal(resting.x, 480, 'it stays put while it reboots');
  assert.equal(resting.rest, t.rest - 0.5);
  R.defenderStep(resting, [], t.rest, 960);
  assert.equal(resting.rest, 0);
  assert.equal(R.defenderBlocks(resting, ball(480, under + 5, -400), under + 12), true, 'and then it is back');
  assert.ok(t.rest >= 1.5, 'long enough for a return trip to the paddle and back');
  // an angled shot beats it: the ball crosses more ground sideways than the defender can cover
  assert.ok(t.speed < T.CFG.BALL_SPD * Math.sin(Math.PI / 3), 'slower than a sixty-degree shot travels sideways');
});

test('INFINITE SERVER: the wall drops a row on a timer until it is low enough', () => {
  const t = R.ARENA_TUNING.descend, s = { t: 0 };
  let drops = 0, warned = false;
  for (let i = 0; i < 60 * 43; i++) {
    const tick = R.descendTick(s, 1 / 60);
    if (tick.drop) drops++;
    if (tick.warn > 0) warned = true;
  }
  assert.equal(drops, 3, 'every fourteen seconds');
  assert.ok(warned);
  assert.equal(t.step, T.CFG.BRICK_H + T.CFG.BRICK_GAP, 'a drop is exactly one row');
  const paddleY = T.CFG.PADDLE_Y;
  assert.equal(R.descendRoom(200, paddleY), true);
  assert.equal(R.descendRoom(paddleY - t.gap - t.step, paddleY), true, 'room for exactly one more');
  assert.equal(R.descendRoom(paddleY - t.gap - t.step + 1, paddleY), false);
  // from the tallest wall there is (nine rows), it can only ever come this close
  const tallest = T.CFG.BRICK_TOP + 9 * t.step;
  let low = tallest;
  while (R.descendRoom(low, paddleY)) low += t.step;
  assert.ok(paddleY - low >= t.gap, `the wall always stops at least ${t.gap} pixels above the paddle`);
});

test('BROKEN SIMULATION drifts both ways, and DATA TUNNEL wraps', () => {
  const t = R.ARENA_TUNING.drift;
  let min = 0, max = 0;
  for (let time = 0; time < 30; time += 0.05) { const a = R.driftAccel(time); min = Math.min(min, a); max = Math.max(max, a); }
  assert.ok(max > t.accel * 0.99 && min < -t.accel * 0.99, 'it pulls as hard one way as the other');
  assert.equal(R.driftAccel(0), 0, 'a sector starts with no pull');
  assert.ok(2 * Math.PI / t.rate > 8, 'a full swing takes long enough to read');

  assert.equal(R.wrapX(400, 7, 960), 400);
  assert.equal(R.wrapX(-3, 7, 960), -3, 'still partly on the field: no wrap yet');
  assert.equal(R.wrapX(-8, 7, 960), 966, 'gone off the left, back in just outside the right');
  assert.equal(R.wrapX(968, 7, 960), -6);
  assert.equal(R.wrapX(R.wrapX(-8, 7, 960), 7, 960), 966, 'and it does not wrap straight back');
  // beside the paddle the walls are solid: a ball that wrapped there could not be reached by anyone
  const line = R.wrapLine(T.CFG.PADDLE_Y);
  assert.equal(line, T.CFG.PADDLE_Y - R.ARENA_TUNING.wrap.solid);
  const crossing = 960 / T.CFG.PADDLE_SPD;                               // seconds for the paddle to cross the field
  const fall = R.ARENA_TUNING.wrap.solid / (T.CFG.BALL_MAX * Math.cos(Math.PI / 3));   // the least time a ball takes from the line to the paddle
  assert.ok(line > T.CFG.BRICK_TOP + 9 * 30, 'the whole wall of bricks is in the open part');
  assert.ok(fall > 0.6, `a ball that wraps at the last moment still gives ${fall.toFixed(2)}s to move (the paddle crosses the field in ${crossing.toFixed(2)}s)`);
});

test('where a falling ball will land, for the AI at the paddle', () => {
  const ball = (x, y, vx, vy) => ({ x, y, vx, vy, r: 7 });
  assert.equal(R.landingX(ball(400, 300, 0, 300), 600, 960), 400, 'straight down');
  assert.equal(R.landingX(ball(400, 300, 100, 300), 600, 960), 500);
  // off the right wall: 300 down at 300/s is one second, 700 across; the wall for the ball's centre is at 953
  assert.equal(R.landingX(ball(600, 300, 700, 300), 600, 960), 953 - (1300 - 953));
  assert.equal(R.landingX(ball(100, 300, -300, 300), 600, 960), 7 + (7 - -200), 'and off the left wall');
  // DATA TUNNEL: above the line it wraps, below the line it bounces
  const line = 430;
  assert.equal(R.landingX(ball(400, 300, 100, 300), 600, 960, line), 500, 'a ball nowhere near the sides lands the same');
  // 130 down to the line takes 0.433s and carries it 303 across, out the right side and back in the left
  const wrapped = R.landingX(ball(900, 300, 700, 300), 600, 960, line);
  const atLine = ((900 + 700 * (130 / 300) + 7) % 974) - 7;
  assert.ok(Math.abs(wrapped - (atLine + 700 * (170 / 300))) < 1e-6, `comes back in on the left and carries on (${wrapped})`);
  assert.ok(wrapped < 700, 'so it lands on the other side from where a bounce would put it');
  assert.equal(R.landingX(ball(900, 500, 300, 300), 600, 960, line), 953 - (1000 - 953), 'already below the line: the wall is solid');
  for (let i = 0; i < 200; i++) {
    const b = ball(7 + (i * 53) % 946, 100 + (i * 37) % 400, (i % 2 ? 1 : -1) * (50 + (i * 71) % 700), 120 + (i * 29) % 600);
    for (const l of [null, line]) { const x = R.landingX(b, 600, 960, l); assert.ok(x >= 7 - 1e-6 && x <= 953 + 1e-6, `on the field (${x})`); }
  }
});

test('the Glitch meter overloads once, then has to fall back before it can again', () => {
  assert.equal(R.overloadFires(99.5, 100, true), true);
  assert.equal(R.overloadFires(99.5, 100, false), false, 'not while it is still spent');
  assert.equal(R.overloadFires(100, 100, true), false, 'sitting at full is not reaching full');
  assert.equal(R.overloadFires(60, 61, true), false);
  assert.equal(R.overloadRearms(79.9), true);
  assert.equal(R.overloadRearms(80), false);
  assert.ok(R.OVERLOAD.rearm >= 75, 'it re-arms without the meter having to leave the x3 band');
  // a meter that hovers near full, as it does in deep sectors: a brick every half second (+1.1) against a drain of 0.55 a second
  let glitch = 90, armed = true, overloads = 0;
  for (let step = 0; step < 240; step++) {                               // two minutes
    const before = glitch;
    glitch = Math.min(100, glitch + 1.1);
    if (R.overloadFires(before, glitch, armed)) { overloads++; armed = false; }
    glitch = Math.max(0, glitch - 0.55 * 0.5);
    if (R.overloadRearms(glitch)) armed = true;
  }
  assert.equal(overloads, 1, 'one overload, not one every few seconds');
});

test('the codex lists everything in the game', () => {
  const sections = R.codexSections();
  assert.deepEqual(plain(sections.map((s) => s.id)), ['brick', 'power', 'enemy', 'boss', 'arena', 'event', 'mood']);
  const by = Object.fromEntries(sections.map((s) => [s.id, s.entries]));
  const keys = sections.flatMap((s) => s.entries.map((e) => e.key));
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  for (const s of sections) for (const e of s.entries) {
    assert.ok(e.key.startsWith(s.id + ':'));
    assert.ok(e.name && typeof e.line === 'string' && e.line.length >= 6, `${e.key} has a name and a line`);
  }
  // bricks and power-ups: one entry for each the game has
  assert.deepEqual(plain(by.brick.map((e) => e.id)).sort(), Object.keys(T.BRICKS).sort());
  assert.deepEqual(plain(by.power.map((e) => e.id)), plain(T.POWERUP_KEYS));
  for (const k of T.POWERUP_KEYS) assert.ok(T.POWERUPS[k].desc, `${k} says what it does`);
  assert.ok(by.power.find((e) => e.id === 'fire').line.endsWith('Lasts 10 seconds.'));
  assert.ok(!by.power.find((e) => e.id === 'emp').line.includes('Lasts'), 'an instant power-up has no duration');
  // enemies and bosses: the ones js/entities.js defines
  const entities = read('js/entities.js');
  const kinds = [...entities.matchAll(/this\.kind = '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(plain(by.enemy.map((e) => e.id)).sort(), kinds.sort());
  const bosses = [...entities.matchAll(/super\('([A-Z ]+)'/g)].map((m) => m[1]);
  assert.equal(bosses.length, 6);
  assert.deepEqual(plain(by.boss.map((e) => e.id)).sort(), bosses.sort());
  // arenas, glitches, moods
  assert.deepEqual(plain(by.arena.map((e) => e.id)), plain(T.ARENAS.map((a) => a.name)));
  assert.deepEqual(plain(by.event.map((e) => e.id)), plain(T.EVENTS.map((e) => e.id)));
  assert.equal(by.mood.length, 9);
  const game = read('js/game.js');
  for (const e of by.mood) assert.ok(game.includes(`'${e.id}'`), `the game can show the ${e.id} mood`);
  for (const kind of ['brick', 'power', 'enemy', 'boss', 'arena', 'event', 'mood']) assert.ok(game.includes(`this.meet('${kind}'`), `the game unlocks ${kind} entries`);

  assert.equal(R.codexEntry('brick:heavy').name, 'HEAVY BRICK');
  assert.equal(R.codexEntry('arena:wrap').name, 'DATA TUNNEL');
  assert.equal(R.codexEntry('brick:nope'), null);
  const count = R.codexCount({ 'brick:heavy': true, 'brick:normal': true, 'power:fire': true, 'nonsense:1': true });
  assert.equal(count.seen, 3, 'unknown keys in a save are not counted');
  assert.equal(count.total, keys.length);
  assert.deepEqual(plain(count.sections.brick), { seen: 2, total: 16 });
  assert.equal(R.codexCount(undefined).seen, 0);
});

test('the guided first sector: one line at a time, each until you have done it', () => {
  const t = R.tutorNew();
  const e = { moved: 0, returns: 0, bricks: 0, bestCombo: 0, falling: 0, powerups: 0, cleared: false };
  const at = (dt = 1 / 60) => { const step = R.tutorTick(t, e, dt); return step ? step.id : null; };
  assert.equal(at(), 'move', 'it starts with how to move');
  for (let i = 0; i < 600; i++) at();
  assert.equal(at(), 'move', 'and waits for as long as it takes');
  e.moved = 200;
  assert.equal(at(), 'aim');
  e.returns = 2;
  assert.equal(at(1), 'aim', 'two returns, but it has only been up a second');
  assert.equal(at(5), 'combo', 'now it has had time to be read');
  // a power-up starts falling: that is the thing to talk about
  e.falling = 1; e.bricks = 4;
  assert.equal(at(), 'combo', 'the line on screen finishes first');
  e.bestCombo = 3;
  assert.equal(at(6), 'power');
  e.falling = 0; e.powerups = 1;
  // caught it: nothing else is due yet (four bricks), so the reminder shows
  assert.equal(at(), 'clear');
  assert.deepEqual(plain(R.tutorProgress(t)), { done: 4, total: 6 });
  e.bricks = 5;
  assert.equal(at(), 'glitch', 'the reminder steps aside as soon as there is something to teach');
  assert.equal(at(8), 'glitch');
  assert.equal(at(2), 'clear', 'nine seconds, then on');
  e.bricks = 10;
  assert.equal(at(), 'ball');
  assert.equal(at(10), 'clear');
  assert.deepEqual(plain(R.tutorProgress(t)), { done: 6, total: 6 });
  e.cleared = true;
  assert.equal(at(), null, 'nothing more to say once the sector is clear');

  // a capsule that was missed does not hold the lesson up
  const t2 = R.tutorNew(), e2 = { moved: 500, returns: 9, bricks: 9, bestCombo: 5, falling: 1, powerups: 0, cleared: false };
  const seen = [];
  for (let i = 0; i < 60 * 40; i++) {
    if (i === 60 * 12) e2.falling = 0;              // it fell past the paddle
    const step = R.tutorTick(t2, e2, 1 / 60);
    if (step && seen[seen.length - 1] !== step.id) seen.push(step.id);
  }
  assert.ok(seen.includes('power') && seen.includes('glitch'), seen.join());
  assert.ok(t2.done.power);

  // every line fits the panel, and the touch wording exists where the keys differ
  for (const step of R.TUTOR_STEPS) assert.ok(step.text.length < 190, step.id);
  assert.ok(R.TUTOR_STEPS.find((s) => s.id === 'move').touch.includes('Drag'));
});

test('the first sector\'s wall is plain, with one certain power-up', () => {
  for (const cols of [8, 12, 20]) {
    const cells = plain(R.tutorialLayout(cols));
    assert.equal(cells.length, cols * 3 - 2, 'three rows with the top corners left open');
    assert.equal(cells.filter((c) => c.type === 'heavy').length, 2);
    assert.ok(cells.every((c) => c.type === 'normal' || c.type === 'heavy'));
    assert.ok(!cells.some((c) => c.r === 0 && (c.c === 0 || c.c === cols - 1)));
  }
  assert.ok(T.POWERUPS[R.TUTORIAL.drop], 'the certain drop is a real power-up');
  assert.ok(R.TUTORIAL.dropAfter >= 2 && R.TUTORIAL.dropAfter < 8, 'early, but not the very first brick');
});

test('the run recap: best combo, favourite power-up and what ended it', () => {
  assert.equal(R.favouritePower({}), null);
  assert.equal(R.favouritePower(undefined), null);
  assert.deepEqual(plain(R.favouritePower({ wide: 1, fire: 3, laser: 2 })), { kind: 'fire', n: 3 });
  assert.equal(R.favouritePower({ fire: 3, laser: 3 }).kind, 'laser', 'a tie goes to the first in the catalog');
  assert.equal(R.favouritePower({ nonsense: 99, wide: 1 }).kind, 'wide');

  assert.equal(R.toughestSector([]), null);
  assert.equal(R.toughestSector([{ sector: 2, arena: 'NEON GRID' }, { sector: 3, arena: 'QUANTUM REACTOR' }]), null, 'one life each is not a pattern');
  assert.deepEqual(plain(R.toughestSector([{ sector: 2, arena: 'NEON GRID' }, { sector: 6, arena: 'DIGITAL CATHEDRAL' }, { sector: 6, arena: 'DIGITAL CATHEDRAL' }])),
    { sector: 6, arena: 'DIGITAL CATHEDRAL', n: 2 });

  const life = (over) => Object.assign({ sector: 7, arena: 'CORRUPTED BIOS', rule: 'badSector', event: null, stunnedBy: null, gap: 90, speed: 0.5 }, over);
  const cause = (over, run = {}) => R.deathCause(Object.assign({ mode: 'classic', won: false, lives: [life({ sector: 2 }), life(over)] }, run));
  assert.equal(cause({ stunnedBy: 'a TURRET' }), 'A shot from a TURRET stunned your paddle and the ball got past, in sector 07, CORRUPTED BIOS.');
  assert.equal(cause({ event: 'lagSpike' }), 'The ball got past during LAG SPIKE, in sector 07, CORRUPTED BIOS.');
  assert.equal(cause({ stunnedBy: 'a DRONE', event: 'lagSpike' }).startsWith('A shot from a DRONE'), true, 'a stun explains it better than the weather');
  assert.equal(cause({ gap: 11.6 }), 'A near miss: the ball passed 12 pixels from the end of the paddle, in sector 07, CORRUPTED BIOS.');
  assert.equal(cause({ speed: 0.9 }), 'The ball was close to top speed when it got past, in sector 07, CORRUPTED BIOS.');
  assert.equal(cause({}), 'The ball got past in sector 07, CORRUPTED BIOS, where the rule is BAD SECTOR.');
  assert.equal(cause({ sector: 1, arena: 'GLITCH ARENA', rule: 'standard' }), 'The ball got past in sector 01, GLITCH ARENA.');
  assert.equal(cause({}, { mode: 'puzzle' }), 'You ran out of balls in sector 07, CORRUPTED BIOS.');
  assert.equal(cause({}, { won: true }), 'Nothing. You cleared it.');
  assert.equal(R.deathCause({ mode: 'classic', won: false, lives: [] }), 'The run was abandoned.');

  const rows = plain(R.runRecap({
    mode: 'classic', won: false, maxCombo: 14, comboSector: 3, powers: { fire: 3 }, newEntries: 5,
    lives: [life({ sector: 6, arena: 'DIGITAL CATHEDRAL' }), life({ sector: 6, arena: 'DIGITAL CATHEDRAL', event: 'overclock' })],
  }));
  assert.deepEqual(rows.map((r) => r.id), ['combo', 'power', 'cause', 'tough', 'codex']);
  assert.equal(rows[0].text, 'x14 in sector 03');
  assert.equal(rows[1].text, 'FIRE BALL, caught 3 times');
  assert.equal(rows[1].power, 'fire');
  assert.equal(rows[2].label, 'WHAT ENDED IT');
  assert.equal(rows[3].text, 'sector 06, DIGITAL CATHEDRAL: 2 lives lost');
  assert.equal(rows[4].text, '5 entries');

  // a short, bad run still reads sensibly
  const bare = plain(R.runRecap({ mode: 'hardcore', won: false, maxCombo: 0, comboSector: 0, powers: {}, newEntries: 0, lives: [life({ sector: 1, arena: 'GLITCH ARENA', rule: 'standard' })] }));
  assert.deepEqual(bare.map((r) => r.id), ['combo', 'power', 'cause']);
  assert.equal(bare[0].text, 'None. Every brick was a single.');
  assert.equal(bare[1].text, 'None caught.');
  assert.equal(bare[1].power, null);
  assert.equal(plain(R.runRecap({ mode: 'classic', won: true, maxCombo: 3, comboSector: 1, powers: { wide: 1 }, newEntries: 1, lives: [] }))[1].text, 'WIDE PADDLE, caught once');
});

test('the page loads every script, each after what it needs', () => {
  const html = read('index.html');
  const order = [...html.matchAll(/<script src="([^"?]+)(\?[^"]*)?"><\/script>/g)].map((m) => m[1]);
  const at = (name) => { const i = order.indexOf(name); assert.ok(i >= 0, `${name} is loaded`); return i; };
  for (const file of readdirSync(new URL('../breakpoint/js/', import.meta.url))) at('js/' + file);
  assert.ok(at('js/config.js') < at('js/rules.js'), 'the rules read the tables');
  assert.ok(at('js/rules.js') < at('js/entities.js'));
  assert.ok(at('js/icons.js') < at('js/entities.js'), 'capsules draw icons');
  assert.ok(at('js/wallet.js') < at('js/entities.js'), 'bricks and the paddle ask what is worn');
  assert.ok(at('js/entities.js') < at('js/arenas.js'), 'the new hazards join the ones already there');
  assert.ok(at('js/arenas.js') < at('js/game.js'));
  assert.ok(at('js/backdrops.js') < at('js/game.js'));
  // shared with the arcade, from the folder above
  assert.ok(at('../glitchpong-cosmetics.js') < at('js/wallet.js'));
  assert.ok(at('../glitchcade-breakpoint-prizes.js') < at('js/wallet.js'));
  for (const shared of ['glitchpong-cosmetics.js', 'glitchcade-breakpoint-prizes.js', 'glitchcade-power.js']) {
    assert.ok(existsSync(new URL('../' + shared, import.meta.url)), `${shared} exists`);
  }
  // the two pages ask for the same version of the shared files, so the browser fetches each once
  const arcade = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const shared of ['glitchpong-cosmetics.js', 'glitchcade-breakpoint-prizes.js']) {
    const here = html.match(new RegExp(shared.replace('.', '\\.') + '(\\?v=[\\w-]+)'))[1];
    assert.ok(arcade.includes(shared + here), `${shared}${here} on both pages`);
  }
});
