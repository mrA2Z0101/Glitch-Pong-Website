import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test } from 'node:test';

const source = await readFile(new URL('../glitchcade-audio.js', import.meta.url), 'utf8');
const { createArcadeAudio } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originals = Object.fromEntries(['window', 'Audio', 'fetch', 'localStorage'].map(k => [k, globalThis[k]]));
let contexts, media;

class Param {
  initial = 0;
  events = [];
  constructor(clock) { this.clock = clock; }
  get value() {
    let value = this.initial, time = 0;
    for (const e of this.events) {
      if (e.time > this.clock.currentTime) {
        if (e.type === 'linear') {
          const progress = (this.clock.currentTime - time) / (e.time - time);
          return value + (e.value - value) * Math.max(0, progress);
        }
        break;
      }
      value = e.value; time = e.time;
    }
    return value;
  }
  set value(v) { this.initial = v; }
  cancelScheduledValues(t) { this.events = this.events.filter(e => e.time < t); }
  cancelAndHoldAtTime(t) {
    const value = this.value;
    const pending = this.events.some(e => e.time >= t);
    this.cancelScheduledValues(t);
    if (pending) this.setValueAtTime(value, t);
  }
  setValueAtTime(value, time) { this.events.push({ type: 'set', value, time }); }
  linearRampToValueAtTime(value, time) { this.events.push({ type: 'linear', value, time }); }
  exponentialRampToValueAtTime(value, time) { this.linearRampToValueAtTime(value, time); }
  setTargetAtTime(value, time) { this.setValueAtTime(value, time); }
}
class Node {
  constructor(clock) {
    this.gain = new Param(clock);
    this.frequency = new Param(clock);
    this.Q = new Param(clock);
  }
  connect(dest) { return dest; }
  start() {}
  stop() {}
}
class Context {
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = new Node(this);
  gains = [];
  listener = { setPosition() {}, setOrientation() {} };
  constructor() { contexts.push(this); }
  createGain() { const n = new Node(this); this.gains.push(n); return n; }
  createOscillator() { return new Node(this); }
  createBiquadFilter() { return new Node(this); }
  createBufferSource() { return new Node(this); }
  createMediaElementSource() { return new Node(this); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createPanner() { return Object.assign(new Node(this), { setPosition() {} }); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
class Media {
  paused = true;
  listeners = {};
  loads = 0;
  plays = 0;
  constructor() { media.push(this); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  load() { this.loads++; this.error = null; }
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.listeners.ended(); }
}
const pos = (x, z) => ({ x, y: 1.7, z });
const world = {
  signPos: pos(0, 0), doorPos: pos(0, 0), robotPos: pos(0, -30),
  gpScreen: pos(-6, -26), jukeboxPos: pos(9, -2), soonCabinets: [],
};
const camera = { position: pos(0, 10), getWorldDirection: () => ({ x: 0, y: 0, z: -1 }) };
const streetElement = () => media.find(el => el.src?.includes('neon-on-wet-asphalt'));
function advance(seconds) { contexts[0].currentTime += seconds; }
function move(audio, x, z, inside = 1) {
  camera.position = pos(x, z);
  audio.update(1 / 60, camera, {}, inside);
}
function assertSingleSong(audio) {
  const { street, floor, groove } = audio.musicMix;
  assert.ok([street, floor, groove].filter(v => v > 0.00001).length <= 1,
    `competing music: ${JSON.stringify(audio.musicMix)}`);
}

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
  move(audio, 0, 10, 0);
  advance(1.2);
  assert.ok(contexts[0].gains[0].gain.value > 0, 'master must not remain silent');
  assert.equal(media.length, 3);
  assert.ok(media.every(el => !el.paused));
  assert.match(streetElement().src, /neon-on-wet-asphalt-1\.mp3$/);
  assert.equal(audio.musicMix.street, 1);
});

test('menu music loops and respects mute/unmute', () => {
  const audio = createArcadeAudio({ isTouch: true });
  audio.unlock(world);
  for (const el of media) el.end();
  assert.match(streetElement().src, /neon-on-wet-asphalt-2\.mp3$/);
  assert.ok(media.every(el => !el.paused), 'second takes must play on the menu');
  audio.toggleMute();
  advance(0.5);
  assert.equal(contexts[0].gains[0].gain.value, 0);
  assert.ok(media.every(el => el.paused));
  audio.toggleMute();
  advance(0.5);
  assert.ok(contexts[0].gains[0].gain.value > 0);
  assert.ok(media.every(el => !el.paused));
});

test('street music returns outside after entering the arcade', () => {
  const audio = createArcadeAudio({ isTouch: false });
  audio.unlock(world);
  audio.setMode('explore');
  move(audio, 0, -15);
  advance(2);
  assert.equal(audio.musicMix.street, 0);
  assert.equal(audio.musicMix.floor, 1);
  move(audio, 0, 10, 0);
  advance(2);
  assert.equal(audio.musicMix.floor, 0);
  assert.equal(audio.musicMix.street, 1);
  assert.equal(streetElement().paused, false);
});

test('an early gesture starts the opening track before the world exists', () => {
  const audio = createArcadeAudio({ isTouch: true });
  assert.equal(contexts.length, 0, 'preloading must not create an autoplay context');
  assert.equal(media.length, 1, 'warm only the opening track');
  const opening = streetElement();
  assert.equal(opening.preload, 'auto');
  assert.equal(opening.loads, 1);
  assert.equal(opening.plays, 0, 'loading must not play sound before a gesture');
  audio.setMode('intro');
  audio.unlock(null);
  assert.ok(media.every(el => !el.paused));
  assert.equal(audio.musicMix.street, 1, 'opening playback must not wait for a zone fade');
  assert.equal(audio.musicMix.floor, 0);
  assert.equal(audio.musicMix.groove, 0);
  advance(0.1);
  assert.ok(contexts[0].gains[0].gain.value > 0, 'the first click must produce output promptly');
  opening.currentTime = 14;
  audio.unlock(world);
  assert.equal(streetElement(), opening, 'attach the world to the same prewarmed player');
  assert.equal(opening.currentTime, 14, 'world readiness must not restart the song');
  assert.equal(media.length, 3);
  assert.equal(contexts.length, 1);
  const count = contexts[0].gains.length;
  audio.unlock(world);
  assert.equal(contexts[0].gains.length, count, 'world emitters must only attach once');
});

test('an early gesture respects saved mute and the sound button can start playback', () => {
  globalThis.localStorage.getItem = () => '1';
  const audio = createArcadeAudio({ isTouch: false });
  audio.unlock(null);
  assert.ok(media.every(el => el.paused));
  assert.equal(contexts[0].gains[0].gain.value, 0);
  audio.toggleMute();
  advance(0.5);
  assert.ok(media.every(el => !el.paused));
  assert.equal(audio.musicMix.street, 1);
});

test('the first real gesture retries a failed opening-track preload', () => {
  const audio = createArcadeAudio({ isTouch: false });
  const opening = streetElement();
  opening.error = { code: 2 };
  audio.unlock(null);
  assert.equal(opening.loads, 2);
  assert.equal(opening.error, null);
  assert.equal(opening.paused, false);
  assert.equal(opening.plays, 1);
});

for (const [zone, position] of [['floor', pos(0, -15)], ['groove', pos(0, -28)]]) {
  test(`first playback selects ${zone} immediately when the tour is already indoors`, () => {
    const audio = createArcadeAudio({ isTouch: false });
    audio.unlock(world, { position, inside: 1 });
    assert.equal(audio.musicMix.zone, zone);
    assert.equal(audio.musicMix[zone], 1);
    assertSingleSong(audio);
  });
}

test('cabinet handoff silences arcade songs and returning resumes them', () => {
  const audio = createArcadeAudio({ isTouch: false });
  audio.unlock(world);
  audio.setMode('playing');
  assert.ok(media.every(el => el.paused));
  assert.equal(contexts[0].gains[0].gain.value, 0);
  audio.setMode('paused'); // also clears the delayed suspend
  advance(0.5);
  assert.ok(media.every(el => !el.paused));
  assert.ok(contexts[0].gains[0].gain.value > 0);
});

test('the arcade theme and local speakers never play over each other during a fade', () => {
  const audio = createArcadeAudio({ isTouch: false });
  audio.unlock(world);
  move(audio, 0, -15);
  advance(2);
  // At the front of the counter, the speaker is two metres away.
  move(audio, 0, -28);
  assert.equal(audio.musicMix.zone, 'groove');
  assert.equal(audio.musicMix.floor, 1, 'outgoing song must fade, not cut');
  advance(0.3);
  assert.ok(audio.musicMix.floor > 0 && audio.musicMix.floor < 1);
  assert.equal(audio.musicMix.groove, 0);
  for (let i = 0; i < 80; i++) { advance(0.025); assertSingleSong(audio); }
  assert.equal(audio.musicMix.floor, 0);
  assert.equal(audio.musicMix.groove, 1);
  move(audio, 0, -15);
  for (let i = 0; i < 80; i++) { advance(0.025); assertSingleSong(audio); }
  assert.equal(audio.musicMix.groove, 0, 'local speakers must not bleed into the room');
  assert.equal(audio.musicMix.floor, 1);
});

test('zone boundaries stay steady and rapid direction changes cancel stale fades', () => {
  const audio = createArcadeAudio({ isTouch: true });
  audio.unlock(world);
  move(audio, 0, 10, 0); advance(2);
  move(audio, 0, 0, 0.5);
  assert.equal(audio.musicMix.zone, 'street');
  move(audio, 0, -15, 1); advance(2);
  move(audio, 0, 0, 0.5);
  assert.equal(audio.musicMix.zone, 'floor');
  move(audio, 0, -24.6); advance(2); // 5.4 m from PRIZETRON
  assert.equal(audio.musicMix.zone, 'groove');
  move(audio, 0, -24.3); // 5.7 m: still inside the leave threshold
  assert.equal(audio.musicMix.zone, 'groove');
  move(audio, 0, -15); advance(2);
  move(audio, 0, -24.3);
  assert.equal(audio.musicMix.zone, 'floor');
  move(audio, 0, -28); advance(0.3);
  move(audio, 0, -15); advance(0.2);
  move(audio, 0, -28); advance(0.2);
  move(audio, 0, 10, 0);
  for (let i = 0; i < 120; i++) { advance(0.025); assertSingleSong(audio); }
  assert.deepEqual(audio.musicMix, { zone: 'street', street: 1, floor: 0, groove: 0 });
});

test('browsers without cancelAndHoldAtTime still cancel an interrupted fade', () => {
  const hold = Param.prototype.cancelAndHoldAtTime;
  Param.prototype.cancelAndHoldAtTime = undefined;
  try {
    const audio = createArcadeAudio({ isTouch: true });
    audio.unlock(world);
    move(audio, 0, -15); advance(2);
    move(audio, 0, -28); advance(0.3);
    const level = audio.musicMix.floor;
    move(audio, 0, -15);
    assert.equal(audio.musicMix.floor, level, 'reversing must hold the current level');
    for (let i = 0; i < 80; i++) { advance(0.025); assertSingleSong(audio); }
    assert.equal(audio.musicMix.floor, 1);
    assert.equal(audio.musicMix.groove, 0);
  } finally {
    Param.prototype.cancelAndHoldAtTime = hold;
  }
});
