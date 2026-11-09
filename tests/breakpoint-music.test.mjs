import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const config = await readFile(new URL('../breakpoint/js/config.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../breakpoint/js/audio.js', import.meta.url), 'utf8');

function harness({ blocked = '', stereo = true } = {}) {
  const clock = { ms: 0, get currentTime() { return this.ms / 1000; } };
  const tasks = new Map(), media = [], contexts = [];
  let nextId = 1;
  const later = (fn, ms = 0) => {
    const id = nextId++; tasks.set(id, { fn, at: clock.ms + ms }); return id;
  };
  class Param {
    initial = 0; events = [];
    get value() {
      let value = this.initial, time = 0;
      for (const e of this.events) {
        if (e.at > clock.currentTime) {
          return e.ramp ? value + (e.value - value) * Math.max(0, (clock.currentTime - time) / (e.at - time)) : value;
        }
        value = e.value; time = e.at;
      }
      return value;
    }
    set value(v) { this.initial = v; }
    cancelScheduledValues(at) { this.events = this.events.filter(e => e.at < at); }
    cancelAndHoldAtTime(at) { const v = this.value; this.cancelScheduledValues(at); this.setValueAtTime(v, at); }
    setValueAtTime(value, at) { this.events.push({ value, at }); }
    linearRampToValueAtTime(value, at) { this.events.push({ value, at, ramp: true }); }
    exponentialRampToValueAtTime(value, at) { this.linearRampToValueAtTime(value, at); }
  }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param();
    pan = new Param(); delayTime = new Param(); connections = [];
    constructor() { this.gain.value = 1; }
    connect(dest) { this.connections.push(dest); return dest; }
    start() {}
    stop() {}
  }
  class Context {
    state = 'running'; sampleRate = 48000; destination = new Node(); gains = []; oscillators = 0;
    constructor() { contexts.push(this); if (!stereo) this.createStereoPanner = undefined; }
    get currentTime() { return clock.currentTime; }
    createGain() { const n = new Node(); this.gains.push(n); return n; }
    createDynamicsCompressor() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createDelay() { return new Node(); }
    createStereoPanner() { return new Node(); }
    createMediaElementSource() { return new Node(); }
    createOscillator() { this.oscillators++; return new Node(); }
    createBufferSource() { return new Node(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { return Promise.resolve(); }
  }
  class Media {
    paused = true; currentTime = 0; duration = 120; listeners = {}; loads = 0;
    constructor() { media.push(this); }
    set src(value) {
      this.url = value; this.loads++; this.currentTime = 0; this.ended = false; this.error = null;
      later(() => {
        if (this.url !== value) return;
        if (blocked && value.includes(blocked)) {
          this.error = { code: 4 }; this.listeners.error();
        } else this.onloadedmetadata?.();
      }, 1);
    }
    get src() { return this.url; }
    play() { this.paused = false; return new Promise(resolve => later(resolve, 2)); }
    pause() { this.paused = true; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
  }
  const sandbox = {
    window: { AudioContext: Context }, Audio: Media,
    fetch: async () => ({ ok: false }), setTimeout: later, clearTimeout: id => tasks.delete(id),
  };
  vm.runInNewContext(config + '\n' + source + '\nglobalThis.audio = AudioSys;', sandbox);
  const audio = sandbox.audio;
  audio.init(); audio.startMusic(0);
  return {
    audio, media, contexts, tasks,
    async advance(ms) {
      const end = clock.ms + ms;
      for (let i = 0; i < 10000; i++) {
        const next = [...tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        tasks.delete(next[0]); clock.ms = next[1].at; next[1].fn();
        await Promise.resolve(); await Promise.resolve();
      }
      clock.ms = end;
      await Promise.resolve(); await Promise.resolve();
    },
  };
}

test('all ten glitch events select a theme and audible processing', async () => {
  const h = harness(); await h.advance(400);
  const cases = [
    ['systemError', 'infection-protocol', 0.96], ['packetLoss', 'ghosts-in-the-memory', 1],
    ['timeFreeze', 'event-horizon', 0.55], ['memoryLeak', 'ghosts-in-the-memory', 0.93],
    ['kernelPanic', 'infection-protocol', 0.72], ['dataSurge', 'sector-zero', 1.12],
    ['firewallOn', 'infection-protocol', 0.98], ['lagSpike', 'event-horizon', 0.72],
    ['overclock', 'sector-zero', 1.22], ['quantumShift', 'event-horizon', 1.04],
  ];
  for (const [id, file, rate] of cases) {
    h.audio.setEvent(id); await h.advance(500);
    assert.ok(h.media[0].src.includes(file), id);
    assert.equal(h.audio.musicState.event, id);
    assert.equal(h.media[0].playbackRate, rate, id);
  }
  assert.equal(h.media.length, 1, 'theme changes must not create overlapping players');
});

test('an event fades out the arena song and restores its playback position', async () => {
  const h = harness(); await h.advance(400);
  h.media[0].currentTime = 31;
  h.audio.setEvent('memoryLeak'); await h.advance(100);
  assert.ok(h.media[0].src.includes('sector-zero'), 'keep the old source until it has faded out');
  await h.advance(400);
  assert.ok(h.media[0].src.includes('ghosts-in-the-memory'));
  assert.equal(h.audio.musicState.echo, 0.22);
  h.media[0].currentTime = 12;
  h.audio.setEvent(null); await h.advance(500);
  assert.ok(h.media[0].src.includes('sector-zero'));
  assert.equal(h.media[0].currentTime, 31);
  assert.equal(h.audio.musicState.rate, 1);
  assert.equal(h.audio.musicState.echo, 0);
  assert.equal(h.audio.musicState.pan, 0);
});

test('replaced and short glitches cannot leave a stale theme switch behind', async () => {
  const h = harness(); await h.advance(400);
  h.audio.setEvent('memoryLeak'); await h.advance(60);
  h.audio.setEvent('overclock'); await h.advance(500);
  assert.ok(h.media[0].src.includes('sector-zero'));
  h.audio.setEvent('kernelPanic'); await h.advance(40);
  h.audio.setEvent('quantumShift'); await h.advance(500);
  assert.ok(h.media[0].src.includes('event-horizon'));
  h.audio.setEvent(null); await h.advance(500);
  assert.ok(h.media[0].src.includes('sector-zero'));
  assert.equal(h.audio.musicState.event, null);
});

test('THE EYE keeps its song but responds to glitches, and the next sector resets processing', async () => {
  const h = harness(); await h.advance(400);
  h.audio.startMusic(9, true); await h.advance(500);
  const loads = h.media[0].loads;
  h.audio.setEvent('overclock'); await h.advance(400);
  assert.ok(h.media[0].src.includes('do-not-blink'));
  assert.equal(h.media[0].loads, loads);
  assert.equal(h.media[0].playbackRate, 1.22);
  h.audio.startMusic(3, false); await h.advance(500);
  assert.ok(h.media[0].src.includes('ghosts-in-the-memory'));
  assert.equal(h.audio.musicState.rate, 1);
  assert.equal(h.audio.musicState.event, null);
});

test('the corruption meter affects recordings and returns to a clean mix', async () => {
  const h = harness(); await h.advance(400);
  h.audio.setGlitch(1); await h.advance(300);
  assert.equal(h.audio.musicState.cutoff, 7000);
  assert.notEqual(h.audio.musicState.rate, 1);
  h.audio.setGlitch(0); await h.advance(300);
  assert.equal(h.audio.musicState.cutoff, 18000);
  assert.equal(h.audio.musicState.rate, 1);
  assert.equal(h.audio.musicState.pulse, 1);
});

test('stop cancels pending themes and effects and a new run starts clean', async () => {
  const h = harness(); await h.advance(400);
  h.audio.setEvent('memoryLeak'); await h.advance(30);
  h.audio.stopMusic(); await h.advance(1000);
  assert.equal(h.tasks.size, 0);
  assert.equal(h.media[0].paused, true);
  assert.equal(h.audio.musicState.theme, null);
  assert.equal(h.audio.musicState.rate, 1);
  h.audio.startMusic(0); await h.advance(400);
  assert.ok(h.media[0].src.includes('sector-zero'));
  assert.equal(h.media[0].currentTime, 0);
});

test('failed event recordings use the synth and recover to the arena recording', async () => {
  const h = harness({ blocked: 'ghosts-in-the-memory' }); await h.advance(400);
  h.audio.setEvent('memoryLeak'); await h.advance(500);
  assert.ok(h.contexts[0].oscillators > 0);
  h.audio.setEvent(null); await h.advance(500);
  assert.ok(h.media[0].src.includes('sector-zero'));
  assert.equal(h.media[0].paused, false);
  h.audio.stopMusic(); await h.advance(500);
  assert.equal(h.tasks.size, 0);
});

test('effects work without stereo panning and leave the SFX bus and volume controls intact', async () => {
  const h = harness({ stereo: false }); await h.advance(400);
  h.audio.setEvent('timeFreeze'); await h.advance(500);
  assert.equal(h.audio.musicState.rate, 0.55);
  assert.equal(h.audio.musicState.pan, 0);
  assert.equal(h.contexts[0].gains[2].gain.value, 0.9);
  h.audio.setVolume(0.3);
  assert.equal(h.contexts[0].gains[0].gain.value, 0.3);
  h.audio.setMuted(true);
  assert.equal(h.contexts[0].gains[0].gain.value, 0);
});
