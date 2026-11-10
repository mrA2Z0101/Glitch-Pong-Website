import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../glitchcade-power.js', import.meta.url), 'utf8');

// glitchcade-power.js is a classic script: run it in a sandbox with a fake
// localStorage and clock, and hand back its GlitchPower global.
function load(store = {}, nowRef = { t: 0 }) {
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const sandbox = { localStorage, performance: { now: () => nowRef.t }, JSON, Math, Date, Infinity };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { P: sandbox.GlitchPower, store, clock: nowRef };
}

// Feed a pacer a display of `hz` for `seconds` and count the frames it lets through.
function framesAt(hz, fps, seconds = 10, jitterMs = 0) {
  const { P } = load();
  const pacer = P.createPacer();
  const step = 1000 / hz;
  let drawn = 0;
  for (let i = 0; i < hz * seconds; i++) {
    const t = i * step + (i % 2 ? jitterMs : -jitterMs);
    if (pacer.due(t, fps)) drawn++;
  }
  return drawn / seconds;
}

test('a 60 fps cap leaves a 60 Hz display alone, even with jittery timestamps', () => {
  assert.ok(framesAt(60, 60) >= 59.9);
  assert.ok(framesAt(60, 60, 10, 1.2) >= 59);
});

test('a 60 fps cap halves a 120 Hz display and averages 60 on 90 Hz', () => {
  assert.ok(Math.abs(framesAt(120, 60) - 60) <= 1);
  assert.ok(Math.abs(framesAt(90, 60) - 60) <= 2, `90 Hz gave ${framesAt(90, 60)}`);
});

test('a 30 fps cap holds on every display', () => {
  for (const hz of [60, 90, 120, 144]) assert.ok(Math.abs(framesAt(hz, 30) - 30) <= 1.5, `${hz} Hz gave ${framesAt(hz, 30)}`);
});

test('an uncapped pacer draws every frame', () => {
  assert.equal(framesAt(144, Infinity), 144);
  assert.equal(framesAt(60, 0), 60);
});

test('a long stall draws one frame and does not bank a burst afterwards', () => {
  const { P } = load();
  const pacer = P.createPacer();
  assert.equal(pacer.due(0, 30), true);
  assert.equal(pacer.due(5000, 30), true);      // woke up after five seconds
  assert.equal(pacer.due(5008, 30), false);
  assert.equal(pacer.due(5017, 30), false);
  assert.equal(pacer.due(5034, 30), true);      // back on cadence, not a catch-up burst
});

test('the frame budget: phones calm down when nobody is moving, desktops are left alone', () => {
  const { P } = load();
  assert.equal(P.fpsFor({ touch: true, saving: false, mode: 'active' }), 60);
  assert.equal(P.fpsFor({ touch: true, saving: false, mode: 'calm' }), 30);
  assert.equal(P.fpsFor({ touch: true, saving: false, mode: 'idle' }), 30);
  assert.equal(P.fpsFor({ touch: false, saving: false, mode: 'active' }), Infinity);
  assert.equal(P.fpsFor({ touch: false, saving: false, mode: 'calm' }), Infinity);
  assert.equal(P.fpsFor({ touch: false, saving: false, mode: 'idle' }), 60);
});

test('saving is never busier than not saving, in any situation', () => {
  const { P } = load();
  for (const touch of [true, false]) for (const mode of ['idle', 'calm', 'active']) {
    const on = P.fpsFor({ touch, saving: true, mode });
    const off = P.fpsFor({ touch, saving: false, mode });
    assert.ok(on <= off, `${touch ? 'touch' : 'desktop'} ${mode}: ${on} vs ${off}`);
    assert.ok(on <= 30);
  }
});

test('the switch is stored under Glitch Pong\'s own key and read back', () => {
  const { P, store } = load();
  assert.equal(P.batterySaver, false);
  P.setBatterySaver(true);
  assert.deepEqual(JSON.parse(store.glitchPongPerformance), { batterySaver: true });
  assert.equal(P.batterySaver, true);
  assert.equal(P.state, 'on');
});

test('a setting Glitch Pong saved is picked up, but only re-read about once a second', () => {
  const { P, store, clock } = load({ glitchPongPerformance: JSON.stringify({ batterySaver: true }) });
  assert.equal(P.batterySaver, true);
  store.glitchPongPerformance = JSON.stringify({ batterySaver: false });   // Glitch Pong's button
  clock.t = 200;
  assert.equal(P.batterySaver, true, 'cached inside the window');
  clock.t = 1500;
  assert.equal(P.batterySaver, false);
});

test('a corrupt or missing record means off', () => {
  assert.equal(load({ glitchPongPerformance: '{nope' }).P.batterySaver, false);
  assert.equal(load({ glitchPongPerformance: 'null' }).P.batterySaver, false);
  assert.equal(load({ glitchPongPerformance: '"saver"' }).P.batterySaver, false);
});

test('low battery turns saving on by itself, and the switch still works alongside it', () => {
  const { P } = load();
  assert.equal(P.saving, false);
  P._setLowBattery(true);
  assert.equal(P.saving, true);
  assert.equal(P.state, 'auto');
  assert.equal(P.batterySaver, false, 'the player\'s own switch is untouched');
  P.setBatterySaver(true);
  assert.equal(P.state, 'on');
  P._setLowBattery(false);
  assert.equal(P.saving, true, 'the switch alone keeps it on');
});

test('listeners hear about changes in `saving`, once each', () => {
  const { P } = load();
  const seen = [];
  P.onChange((v) => seen.push(v));
  P.setBatterySaver(true);
  P.setBatterySaver(true);
  P._setLowBattery(true);                 // already saving: no news
  P.setBatterySaver(false);               // still saving, battery is low
  P._setLowBattery(false);
  assert.deepEqual(seen, [true, false]);
});
