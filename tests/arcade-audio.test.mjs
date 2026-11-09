import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test } from 'node:test';

const source = await readFile(new URL('../glitchcade-audio.js', import.meta.url), 'utf8');
const { createArcadeAudio } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originals = Object.fromEntries(['window', 'Audio', 'fetch', 'localStorage'].map(k => [k, globalThis[k]]));
let contexts, media;

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  connect(dest) { return dest; }
  start() {}
  stop() {}
}
class Context {
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = new Node();
  gains = [];
  listener = { setPosition() {}, setOrientation() {} };
  constructor() { contexts.push(this); }
  createGain() { const n = new Node(); this.gains.push(n); return n; }
  createOscillator() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return new Node(); }
  createMediaElementSource() { return new Node(); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createPanner() { return Object.assign(new Node(), { setPosition() {} }); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
class Media {
  paused = true;
  listeners = {};
  constructor() { media.push(this); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.listeners.ended(); }
}
const pos = (x, z) => ({ x, y: 1.7, z });
const world = {
  signPos: pos(0, 0), doorPos: pos(0, 0), robotPos: pos(0, -30),
  gpScreen: pos(-6, -26), jukeboxPos: pos(9, -2), soonCabinets: [],
};

beforeEach(() => {
  contexts = []; media = [];
  globalThis.window = { AudioContext: Context };
  globalThis.Audio = Media;
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.fetch = async () => ({ ok: false });
});
afterEach(() => {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

test('the first menu gesture makes the street soundtrack audible', () => {
  const audio = createArcadeAudio({ isTouch: false });
  audio.setMode('intro'); // the render loop ran before the gesture
  audio.unlock(world);
  assert.ok(contexts[0].gains[0].gain.value > 0, 'master must not remain silent');
  assert.equal(media.length, 3);
  assert.ok(media.every(el => !el.paused));
  assert.match(media[2].src, /neon-on-wet-asphalt-1\.mp3$/);
});

test('menu music loops and respects mute/unmute', () => {
  const audio = createArcadeAudio({ isTouch: true });
  audio.unlock(world);
  for (const el of media) el.end();
  assert.match(media[2].src, /neon-on-wet-asphalt-2\.mp3$/);
  assert.ok(media.every(el => !el.paused), 'second takes must play on the menu');
  audio.toggleMute();
  assert.equal(contexts[0].gains[0].gain.value, 0);
  assert.ok(media.every(el => el.paused));
  audio.toggleMute();
  assert.ok(contexts[0].gains[0].gain.value > 0);
  assert.ok(media.every(el => !el.paused));
});

test('street music returns outside after entering the arcade', () => {
  const audio = createArcadeAudio({ isTouch: false });
  audio.unlock(world);
  audio.setMode('explore');
  // Scene gains are the final two gains created during setup.
  const [floor, street] = contexts[0].gains.slice(-2);
  const camera = { position: pos(0, -15), getWorldDirection: () => ({ x: 0, y: 0, z: -1 }) };
  audio.update(1 / 60, camera, {}, 1);
  assert.equal(street.gain.value, 0);
  assert.ok(floor.gain.value > 0);
  camera.position = pos(0, 10);
  audio.update(1 / 60, camera, {}, 0);
  assert.equal(floor.gain.value, 0);
  assert.equal(street.gain.value, 0.45);
  assert.equal(media[2].paused, false);
});

test('cabinet handoff silences arcade songs and returning resumes them', () => {
  const audio = createArcadeAudio({ isTouch: false });
  audio.unlock(world);
  audio.setMode('playing');
  assert.ok(media.every(el => el.paused));
  assert.equal(contexts[0].gains[0].gain.value, 0);
  audio.setMode('paused'); // also clears the delayed suspend
  assert.ok(media.every(el => !el.paused));
  assert.ok(contexts[0].gains[0].gain.value > 0);
});
