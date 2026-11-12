import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// The prizes only Breakpoint can wear (glitchcade-breakpoint-prizes.js): brick
// styles and break effects, sold for coins at the Glitchcade's prize counter.
// The file keeps its record in localStorage, which both the arcade page and the
// Breakpoint page read, so a small stand-in for localStorage is installed here.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const P = createRequire(import.meta.url)('../glitchcade-breakpoint-prizes.js');
const fresh = () => store.clear();
// a wallet with this many coins, as the arcade's is: spend returns falsy when short
const wallet = (coins) => ({ coins, spend(n) { if (n > this.coins) return null; this.coins -= n; return { coins: this.coins }; } });
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the catalog: two slots, each with a free default and three prizes', () => {
  assert.deepEqual(Object.keys(P.SLOTS), ['bricks', 'burst']);
  for (const slot of Object.keys(P.SLOTS)) {
    const items = P.CATALOG.filter((p) => p.slot === slot);
    assert.equal(items.length, 4);
    assert.equal(items[0].id, 'default');
    assert.equal(items[0].cost, 0);
    for (const item of items.slice(1)) assert.ok(item.cost >= 20 && item.cost <= 100, `${item.name} costs ${item.cost}: in the range of the counter's other prizes`);
    assert.ok(P.SLOTS[slot].noun.includes('BREAKPOINT'), 'the rack says which cabinet it is for');
  }
  const keys = P.CATALOG.map((p) => p.slot + '-' + p.id);
  assert.equal(new Set(keys).size, keys.length);
  for (const p of P.CATALOG) {
    assert.ok(/^[a-z0-9]+$/.test(p.id), 'ids survive the save filter');
    assert.ok(p.name && p.desc);
  }
  assert.equal(P.find('bricks', 'pixel').name, '8-BIT BRICKS');
  assert.equal(P.find('bricks', 'nope'), null);
  assert.equal(P.find('nope', 'default'), null);
});

test('buying: coins leave the wallet once, and only when there are enough', () => {
  fresh();
  assert.deepEqual(P.forSale().map((p) => p.cost), [20, 25, 35, 45, 60, 80], 'cheapest first');
  assert.ok(P.forSale().every((p) => !p.owned));

  const poor = wallet(24);
  assert.equal(P.buy('bricks', 'pixel', poor), 'poor');
  assert.equal(poor.coins, 24, 'nothing is taken when it is not enough');
  assert.equal(P.owns('bricks', 'pixel'), false);

  const w = wallet(100);
  assert.equal(P.buy('bricks', 'pixel', w), 'ok');
  assert.equal(w.coins, 75);
  assert.equal(P.owns('bricks', 'pixel'), true);
  assert.equal(P.buy('bricks', 'pixel', w), 'owned');
  assert.equal(w.coins, 75, 'never charged twice');
  assert.equal(P.buy('bricks', 'default', w), 'invalid', 'the default is not for sale');
  assert.equal(P.buy('bricks', 'nope', w), 'invalid');
  assert.equal(P.buy('burst', 'coins', null), 'poor');
  assert.equal(P.buy('burst', 'coins', {}), 'poor', 'something that is not a wallet buys nothing');
  assert.equal(w.coins, 75);
  assert.equal(P.forSale().find((p) => p.item.id === 'pixel').owned, true);
  assert.equal(P.forSale().filter((p) => p.owned).length, 1);
});

test('wearing: only what you own, and it is remembered', () => {
  fresh();
  assert.equal(P.equipped('bricks'), 'default');
  assert.equal(P.equip('bricks', 'glass'), false, 'not owned');
  assert.equal(P.equipped('bricks'), 'default');
  P.buy('bricks', 'glass', wallet(500));
  P.buy('bricks', 'bullion', wallet(500));
  assert.equal(P.equip('bricks', 'glass'), true);
  assert.equal(P.equipped('bricks'), 'glass');
  assert.equal(P.equipped('burst'), 'default', 'the other slot is untouched');
  assert.equal(P.equip('nope', 'glass'), false);
  assert.equal(P.equip('bricks', 'nope'), false);
  assert.equal(P.equip('bricks', 'default'), true, 'you can always go back to the standard look');

  assert.deepEqual(P.wardrobe('bricks').map((p) => p.id), ['default', 'glass', 'bullion']);
  assert.deepEqual(P.wardrobe('burst').map((p) => p.id), ['default']);
  assert.equal(P.cycle('bricks').id, 'glass');
  assert.equal(P.cycle('bricks').id, 'bullion');
  assert.equal(P.cycle('bricks').id, 'default', 'round to the start');
  assert.equal(P.cycle('burst').id, 'default', 'with one item it stays put');

  // the other page reads the same record
  const saved = JSON.parse(store.get(P.KEY));
  assert.deepEqual(saved.owned.sort(), ['bricks-bullion', 'bricks-glass']);
});

test('a damaged or hand-edited record is cleaned, not trusted', () => {
  const clean = P.sanitize({
    owned: ['bricks-pixel', 'bricks-pixel', 'bricks-default', 'bricks-nope', 'nope-pixel', 42, 'burst-coins', '__proto__'],
    equipped: { bricks: 'bullion', burst: 'coins', extra: 'x' },
    coins: 9999,
  });
  assert.deepEqual(clean, { owned: ['bricks-pixel', 'burst-coins'], equipped: { bricks: 'default', burst: 'coins' } },
    'unknown and duplicate items go, and something worn but not owned falls back to the default');
  for (const junk of [null, undefined, 7, 'x', [], { owned: 'all' }]) {
    assert.deepEqual(P.sanitize(junk), { owned: [], equipped: { bricks: 'default', burst: 'default' } });
  }
  fresh();
  store.set(P.KEY, '{not json');
  assert.equal(P.equipped('bricks'), 'default');
  assert.equal(P.forSale().length, 6);
  store.set(P.KEY, JSON.stringify({ owned: [], equipped: { bricks: 'bullion' } }));
  assert.equal(P.equipped('bricks'), 'default', 'a record that claims to wear what it does not own');
});

test('the arcade sells them and Breakpoint draws them', () => {
  const index = src('index.html'), worker = src('service-worker.js'), floor = src('glitchcade-floor.js'), site = src('glitchpong-site.js');
  const tag = index.match(/<script src="(glitchcade-breakpoint-prizes\.js[^"]*)"/);
  assert.ok(tag, 'the arcade page loads the file');
  assert.ok(index.indexOf(tag[0]) < index.indexOf('<script type="module" src="glitchcade.js'), 'before the arcade itself');
  assert.ok(worker.includes(`"./${tag[1]}"`), 'and the offline cache has the same address');
  assert.ok(floor.includes('GlitchBreakpointPrizes') && floor.includes('.buy(slot, item.id, Wallet)'), 'PRIZETRON\'s rack sells them from the wallet');
  assert.ok(site.includes('glitchcade_breakpoint_prizes_v1'), 'save export carries what you bought');
  assert.equal(P.KEY, 'glitchcade_breakpoint_prizes_v1');

  // every brick style and break effect in the catalog has drawing code in Breakpoint
  const entities = src('breakpoint/js/entities.js'), game = src('breakpoint/js/game.js');
  for (const p of P.CATALOG.filter((x) => x.slot === 'bricks' && x.id !== 'default')) assert.ok(entities.includes(`style === '${p.id}'`), `${p.name} is drawn`);
  for (const p of P.CATALOG.filter((x) => x.slot === 'burst' && x.id !== 'default')) assert.ok(game.includes(`case '${p.id}':`), `${p.name} is drawn`);
});
