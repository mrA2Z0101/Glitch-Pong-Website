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
  const base = { rgb: '0,217,255', hex: '#00d9ff', t: 1.5, heat: 0.6, quality: 1, ballY: 80, hitFlash: 0.5 };
  for (const it of G.PADDLE_SKINS) G.drawPaddleSkin(ctx, it.id, 10, 10, 22, 140, base);
  for (const it of G.BALL_TRAILS) G.drawBallTrail(ctx, it.id, trail, { ...base, r: 10, charge: 2 });
  for (const it of G.BALL_SKINS) G.drawBallSkin(ctx, it.id, 100, 100, 10, { ...base, vx: 3, vy: -2 });
  for (const it of G.DASH_EFFECTS) G.drawDash(ctx, it.id, dash, { ...base, w: 22, h: 140, curY: 30 });
  const fx = G.createFX();
  for (const slot of ['hit', 'score', 'teleport']) {
    for (const it of G.CATALOG[slot].slice(1)) {
      assert.equal(fx.spawn(slot, it.id, 50, 50, { rgb: '255,79,216', to: { x: 120, y: 80 }, w: 800, h: 500 }), true, `${slot}:${it.id} has an effect`);
    }
  }
  for (let i = 0; i < 120; i++) fx.draw(ctx, 1 / 60);
  assert.equal(fx.count, 0, 'every effect finishes within two seconds');
  assert.equal(fx.spawn('hit', 'default', 0, 0), false, 'the default adds no effect');
});
