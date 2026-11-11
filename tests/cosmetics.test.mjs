import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../glitchpong-cosmetics.js', import.meta.url), 'utf8');

// glitchpong-cosmetics.js is a classic browser script; run it in a sandbox
// with a fake localStorage and hand back its GlitchCosmetics global.
function load(store = {}) {
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const sandbox = { localStorage, window: {}, Math, JSON, Object, Array, Number, String };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.G = GlitchCosmetics;`, sandbox);
  return { G: sandbox.G, store };
}

// A 2D context that accepts every call, so renderers can run headless.
function fakeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

let G;
beforeEach(() => { ({ G } = load()); });

test('every slot has a free default and unique ids', () => {
  for (const slot of G.SLOTS) {
    const items = G.CATALOG[slot];
    assert.equal(items[0].id, 'default', `${slot} starts with its default`);
    assert.equal(items[0].unlock.type, 'free');
    assert.equal(new Set(items.map((i) => i.id)).size, items.length, `${slot} ids are unique`);
    for (const it of items) assert.match(`${slot}-${it.id}`, /^[a-z0-9_-]{1,40}$/i, 'ids survive the save filter');
  }
});

test('unlock rules cover levels, arena wins, boss survivals and stats', () => {
  const data = { level: 1, arenaStats: {}, bossSurvivals: 0, dashUses: 0, wins: 0, longestRally: 0 };
  const p = (slot, id) => G.progressFor(G.find(slot, id), data);
  assert.equal(p('paddle', 'scanline').unlocked, false);
  data.level = 3;
  assert.equal(p('paddle', 'scanline').unlocked, true);
  assert.equal(p('paddle', 'matrixrain').label, 'WIN MATCH IN MATRIX MAINFRAME');
  data.arenaStats.matrix = { wins: 1 };
  assert.equal(p('paddle', 'matrixrain').unlocked, true);
  assert.equal(p('dash', 'ghostclones').label, 'DASH 50 TIMES');
  data.dashUses = 49;
  assert.equal(p('dash', 'ghostclones').current, 49);
  assert.equal(p('dash', 'ghostclones').unlocked, false);
  data.dashUses = 50;
  assert.equal(p('dash', 'ghostclones').unlocked, true);
  data.bossSurvivals = 3;
  assert.equal(p('paddle', 'watcher').unlocked, true);
  assert.equal(p('teleport', 'datashred').unlocked, false);
});

test('new unlocks are announced once and use filter-safe keys', () => {
  const data = { level: 2, cosmeticsUnlocked: ['default'] };
  const first = Array.from(G.syncUnlocks(data), (x) => `${x.slot}-${x.item.id}`).sort();
  assert.deepEqual(first, ['ball-pixelcube', 'hit-shockring', 'trail-pixeldust']);
  assert.equal(G.syncUnlocks(data).length, 0);
  assert.ok(data.cosmeticsUnlocked.every((k) => k === 'default' || /^[a-z]+-[a-z0-9]+$/.test(k)));
});

test('equipping is per side, refuses locked items and falls back after a reset', () => {
  const { G: g, store } = load();
  const data = { level: 12 };
  assert.equal(g.equip('blue', 'ball', 'vinyl', data), true);
  assert.equal(g.equip('blue', 'ball', 'eightball', data), false, 'level 16 item is locked');
  assert.equal(g.getEquipped('blue', 'ball', data), 'vinyl');
  assert.equal(g.getEquipped('red', 'ball', data), 'default');
  assert.equal(g.getEquipped('blue', 'ball', { level: 1 }), 'default', 'locked again after a reset');
  // persisted and reloaded in a fresh module
  const again = load(store).G;
  assert.equal(again.getEquipped('blue', 'ball', data), 'vinyl');
  // corrupt storage never throws
  store.glitchPong_cosmetics_v1 = '{bad json';
  assert.doesNotThrow(() => load(store));
});

test('every catalog item renders without throwing', () => {
  const ctx = fakeCtx();
  const trail = Array.from({ length: 12 }, (_, i) => ({ x: 200 - i * 10, y: 100 + Math.sin(i) * 8 }));
  const dash = [{ x: 20, y: 50, life: 8 }, { x: 20, y: 70, life: 12 }, { x: 20, y: 90, life: 16 }];
  const base = { rgb: '0,217,255', hex: '#00d9ff', t: 1.5, heat: 0.6, quality: 1, ballY: 80, hitFlash: 0.95, hits: 22, cracks: 7 };
  // every item is drawn twice: plain, then with its gold mastery trim
  for (const gilded of [false, true]) {
    const o = { ...base, gilded };
    for (const it of G.PADDLE_SKINS) G.drawPaddleSkin(ctx, it.id, 10, 10, 22, 140, o);
    for (const it of G.BALL_TRAILS) G.drawBallTrail(ctx, it.id, trail, { ...o, r: 10, charge: 2, speed: 11, rally: 14 });
    for (const it of G.BALL_SKINS) G.drawBallSkin(ctx, it.id, 100, 100, 10, { ...o, vx: 3, vy: -2, face: 5, final: gilded });
    for (const it of G.DASH_EFFECTS) G.drawDash(ctx, it.id, dash, { ...o, w: 22, h: 140, curY: 30 });
    for (const it of G.NET_STYLES) {
      assert.equal(G.drawNet(ctx, it.id, { ...o, x: 400, h: 500, rgbL: '0,217,255', rgbR: '255,79,216' }), it.id !== 'default', `net:${it.id}`);
    }
    for (const it of G.SCORE_DISPLAYS) {
      for (const value of [0, 7, 12, 250, -3, NaN]) {
        assert.equal(G.drawScoreboard(ctx, it.id, value, { ...o, x: 200, y: 90, size: 80, flash: 0.5 }), it.id !== 'default', `board:${it.id}`);
      }
    }
    for (const it of G.COUNTDOWN_STYLES) {
      for (const key of ['3', '2', '1', 'GO']) {
        assert.equal(G.drawCountdown(ctx, it.id, key, 0.4, { w: 800, h: 500, t: 2 }), it.id !== 'default', `countdown:${it.id}`);
      }
    }
    for (const it of G.NAMEPLATES) {
      for (const align of ['left', 'right', 'center']) {
        const box = G.drawNameplate(ctx, it.id, 100, 20, { ...o, name: 'Player 1', title: 'GLITCH LORD', align });
        assert.ok(box.w > 0 && box.h > 0, `plate:${it.id} reports its size`);
      }
    }
  }
  for (const set of G.SETS) {
    for (const side of [-1, 1]) assert.equal(G.drawSetBonus(ctx, set.id, { side, w: 800, h: 500, t: 3, rgb: base.rgb, ballX: 300, ballY: 200 }), true, `set:${set.id}`);
  }
  assert.equal(G.drawSetBonus(ctx, 'nope', {}), false);
  const fx = G.createFX();
  for (const slot of ['hit', 'score', 'teleport', 'victory']) {
    for (const it of G.CATALOG[slot].slice(1)) {
      const spawned = fx.spawn(slot, it.id, 50, 50, { rgb: '255,79,216', rgb2: '0,217,255', to: { x: 120, y: 80 }, w: 800, h: 500, ph: 140, rally: 17, gilded: true });
      assert.equal(spawned, true, `${slot}:${it.id} has an effect`);
    }
  }
  for (let i = 0; i < 160; i++) fx.draw(ctx, 1 / 60);
  assert.equal(fx.count, 0, 'every effect finishes within about two and a half seconds');
  assert.equal(fx.spawn('hit', 'default', 0, 0), false, 'the default adds no effect');
});

test('shared slots hold one item for both sides', () => {
  const data = { level: 50 };
  assert.equal(G.SLOT_INFO.net.shared, true);
  assert.equal(G.equip('red', 'net', 'laser', data), true);
  assert.equal(G.getEquipped('blue', 'net', data), 'laser');
  assert.equal(G.getEquipped('red', 'net', data), 'laser');
  assert.equal(G.equip('blue', 'board', 'nixie', data), true, 'score displays are still per side');
  assert.equal(G.getEquipped('red', 'board', data), 'default');
});

test('coin items are bought once, with a wallet that can refuse', () => {
  const { G: g, store } = load();
  const data = { level: 1, cosmeticsUnlocked: ['default'] };
  let coins = 50;
  const wallet = { spend(n) { if (coins < n) return null; coins -= n; return { coins }; } };
  g.setContext(() => ({ coins }));
  const paint = g.find('trail', 'wetpaint');
  assert.equal(paint.unlock.type, 'coins');
  assert.equal(g.progressFor(paint, data).unlocked, false);
  assert.equal(g.progressFor(paint, data).label, 'BUY FOR 40 COINS');
  assert.equal(g.equip('blue', 'trail', 'wetpaint', data), false, 'not wearable until it is paid for');
  assert.equal(g.buy('trail', 'pixeldust', wallet, data), 'invalid', 'level items are not for sale');
  assert.equal(g.buy('plate', 'gold', wallet, data), 'poor');
  assert.equal(coins, 50, 'a refused purchase costs nothing');
  assert.equal(g.buy('trail', 'wetpaint', wallet, data), 'ok');
  assert.equal(coins, 10);
  assert.equal(g.buy('trail', 'wetpaint', wallet, data), 'owned');
  assert.equal(coins, 10, 'never charged twice');
  assert.equal(g.equip('blue', 'trail', 'wetpaint', data), true);
  assert.ok(data.cosmeticsUnlocked.includes('trail-wetpaint'));
  assert.equal(g.syncUnlocks(data).some((x) => x.item.id === 'wetpaint'), false, 'a purchase is not announced again as an unlock');
  // the purchase survives a reload, and every coin item is in the counter's list
  assert.equal(load(store).G.isUnlocked('trail', 'wetpaint', {}), true);
  const forSale = g.coinItems();
  assert.ok(forSale.length >= 8);
  const costs = Array.from(forSale, (x) => x.cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b), 'cheapest first');
  assert.equal(forSale.filter((x) => x.owned).length, 1);
});

test('achievements and outside stats unlock items through the context', () => {
  const data = { level: 1 };
  const p = (slot, id) => G.progressFor(G.find(slot, id), data);
  assert.equal(p('title', 'netrunner').unlocked, false);
  assert.equal(p('paddle', 'shopkeeper').unlocked, false);
  assert.equal(G.find('paddle', 'shopkeeper').secret, true);
  G.setContext(() => ({ stats: { onlineWins: 3, coinsEarned: 149, breakpointSectors: 10 }, achievements: { prizes_all: 1700000000000 } }));
  assert.equal(p('title', 'netrunner').unlocked, true);
  assert.equal(p('plate', 'holo').unlocked, true);
  assert.equal(p('title', 'lanlegend').current, 3);
  assert.equal(p('ball', 'token').unlocked, false, '149 of 150 coins earned');
  assert.equal(p('paddle', 'brickwork').unlocked, true);
  assert.equal(p('paddle', 'shopkeeper').unlocked, true);
  // a context that throws is treated as empty rather than breaking the Store
  G.setContext(() => { throw new Error('storage unavailable'); });
  assert.equal(p('title', 'netrunner').unlocked, false);
});

test('mastery: 25 wins with an item equipped earns a gold trim that can be switched off', () => {
  const { G: g, store } = load();
  const data = { level: 50 };
  g.equip('blue', 'paddle', 'scanline', data);
  g.equip('blue', 'sound', 'chiptune', data);
  assert.equal(g.isGilded('blue', 'paddle', data), false);
  let fresh = [];
  for (let i = 0; i < g.MASTERY_WINS; i++) fresh = g.recordWin('blue', data);
  assert.deepEqual(Array.from(fresh, (x) => `${x.slot}-${x.item.id}`), ['paddle-scanline'], 'announced on the win that reaches it');
  assert.deepEqual({ ...g.masteryFor('paddle', 'scanline') }, { wins: 25, target: 25, mastered: true, trim: true });
  assert.equal(g.isGilded('blue', 'paddle', data), true);
  assert.equal(g.isGilded('red', 'paddle', data), false, 'the other side is wearing the default');
  assert.equal(g.masteryFor('sound', 'chiptune').wins, 0, 'sound packs have nothing to gild');
  assert.equal(g.masteryFor('paddle', 'default').mastered, false, 'the default cannot be mastered');
  assert.equal(g.recordWin('blue', data).length, 0, 'only announced once');
  assert.equal(g.masteredCount(), 1);
  g.setTrim('paddle', 'scanline', false);
  assert.equal(g.isGilded('blue', 'paddle', data), false);
  assert.equal(g.masteryFor('paddle', 'scanline').mastered, true, 'still mastered with the trim off');
  const again = load(store).G;
  assert.equal(again.masteryFor('paddle', 'scanline').trim, false, 'the switch is saved');
  again.setTrim('paddle', 'scanline', true);
  assert.equal(again.isGilded('blue', 'paddle', data), true);
});

test('a full set on one side is active; every set piece exists', () => {
  const data = { level: 50, bossSurvivals: 9, arenaStats: { blackhole: { wins: 20 } } };
  for (const set of G.SETS) {
    for (const [slot, id] of Object.entries(set.pieces)) {
      assert.ok(G.find(slot, id), `${set.id}: ${slot}-${id} is in the catalog`);
      assert.notEqual(G.SLOT_INFO[slot].shared, true, 'a set never needs a shared slot');
    }
  }
  assert.equal(G.activeSet('blue', data), null);
  const eye = G.setStatus('blue', data).find((s) => s.set.id === 'eye');
  assert.equal(eye.ready, true);
  assert.equal(eye.active, false);
  assert.equal(G.equipSet('blue', 'eye', data), true);
  assert.equal(G.activeSet('blue', data).id, 'eye');
  assert.equal(G.activeSet('red', data), null);
  G.equip('blue', 'ball', 'default', data);
  assert.equal(G.activeSet('blue', data), null, 'one piece missing breaks the set');
  assert.equal(G.equipSet('blue', 'eye', { level: 1 }), false, 'locked pieces cannot be equipped as a set');
  assert.equal(G.equipSet('blue', 'nope', data), false);
});

test('shuffle rolls unlocked items per match and leaves the saved loadout alone', () => {
  const data = { level: 6 };
  G.equip('blue', 'paddle', 'scanline', data);
  G.setShuffle('blue', true);
  const picks = [];
  // a deterministic "random" that walks through each pool
  let n = 0;
  for (let i = 0; i < 12; i++) {
    G.rollShuffle(data, () => ((n++ * 0.37) % 1));
    const id = G.getEquipped('blue', 'paddle', data);
    assert.equal(G.isUnlocked('paddle', id, data), true, `${id} is unlocked`);
    picks.push(id);
    assert.equal(G.getEquipped('blue', 'title', data), 'default', 'titles are never shuffled');
    assert.equal(G.getEquipped('red', 'paddle', data), 'default', 'the other side has shuffle off');
  }
  assert.ok(new Set(picks).size > 1, 'the pick changes from match to match');
  assert.equal(G.getSaved('blue', 'paddle', data), 'scanline', 'the Store still shows what was equipped');
  G.setShuffle('blue', false);
  assert.equal(G.getEquipped('blue', 'paddle', data), 'scanline');
  // a pick that is locked again (after a reset) falls back to the saved item
  G.setShuffle('blue', true);
  G.rollShuffle({ level: 50 }, () => 0.99);
  assert.equal(G.getEquipped('blue', 'paddle', { level: 1 }), 'default');
});

test('a saved record is rebuilt from known values only', () => {
  const clean = G.sanitize({
    equipped: { blue: { paddle: 'scanline', ball: '<img>', net: 'tape', nope: 'x' }, red: { paddle: 42, net: 'laser' }, green: {} },
    seen: ['paddle-scanline', 5, '<b>', 'paddle-scanline'],
    owned: ['trail-wetpaint', 'trail-doesnotexist', 'bogus'],
    mastery: { 'paddle-scanline': 9999, 'paddle-nope': 3, 'ball-vinyl': -4, 'trail-comet': '7' },
    plain: ['paddle-scanline', {}],
    shuffle: { blue: 'yes', red: 0 },
    extra: 'dropped'
  });
  assert.deepEqual(Object.keys(clean).sort(), ['equipped', 'mastery', 'owned', 'plain', 'seen', 'shuffle']);
  assert.equal(clean.equipped.blue.paddle, 'scanline');
  assert.equal(clean.equipped.blue.ball, 'default');
  assert.equal(clean.equipped.red.paddle, 'default');
  assert.equal(clean.equipped.red.net, 'tape', 'a shared slot follows the left side');
  assert.deepEqual(Object.keys(clean.equipped).sort(), ['blue', 'red']);
  assert.deepEqual([...clean.seen], ['paddle-scanline']);
  assert.deepEqual([...clean.owned], ['trail-wetpaint']);
  assert.deepEqual({ ...clean.mastery }, { 'paddle-scanline': 25, 'trail-comet': 7 });
  assert.deepEqual({ ...clean.shuffle }, { blue: true, red: false });
  for (const junk of [null, 7, 'x', []]) assert.equal(G.sanitize(junk).equipped.blue.paddle, 'default');
});

test('a player card is two catalog ids, and unknown ids are ignored', () => {
  const data = { level: 50 };
  G.equip('blue', 'title', 'runner', data);
  G.equip('blue', 'plate', 'neon', data);
  assert.deepEqual({ ...G.card('blue', data) }, { title: 'runner', plate: 'neon' });
  assert.deepEqual({ ...G.card('blue', { level: 1 }) }, { title: 'default', plate: 'default' }, 'locked items are not shown off');
  assert.deepEqual({ ...G.cleanCard({ title: '<script>', plate: 'gold', name: 'x' }) }, { title: 'default', plate: 'gold' });
  assert.deepEqual({ ...G.cleanCard(null) }, { title: 'default', plate: 'default' });
  assert.equal(G.titleText('runner'), 'GLITCH RUNNER');
  assert.equal(G.titleText('default'), '');
  assert.equal(G.titleText('<b>'), '');
});

test('sound packs synthesise a hit and a score; the default leaves the recording alone', () => {
  // A Web Audio context that accepts every call and counts what was started.
  let started = 0;
  const node = () => new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'start') return () => { started++; };
      if (prop === 'getChannelData') return () => new Float32Array(16);
      if (prop === 'gain' || prop === 'frequency') return node();
      return () => node();
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
  const ac = { currentTime: 1, sampleRate: 8000, destination: {}, createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node, createBuffer: node };
  assert.equal(G.playSound(ac, 'default', 'hit'), false);
  assert.equal(G.playSound(null, 'chiptune', 'hit'), false);
  assert.equal(G.playSound(ac, 'chiptune', 'explode'), false);
  for (const it of G.SOUND_PACKS.slice(1)) {
    for (const kind of ['hit', 'score']) {
      for (const n of [0, 1]) {
        const before = started;
        assert.equal(G.playSound(ac, it.id, kind, { charge: 3, n }), true, `${it.id} ${kind}`);
        assert.ok(started > before, `${it.id} ${kind} starts at least one voice`);
      }
    }
  }
  // a context that throws is reported, not propagated
  assert.equal(G.playSound({ get currentTime() { throw new Error('closed'); }, createGain() { throw new Error('closed'); } }, 'sonar', 'hit'), false);
});
