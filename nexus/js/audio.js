// ═══════════════════════════════════════════════════════════════════════════
// BLACK-HOLE NEXUS — sound
//
// Music is streamed, one recording at a time, from the files the other two
// cabinets already ship: Glitch Pong's Black-Hole Nexus playlist and
// Breakpoint's Event Horizon, with DO NOT BLINK for THE EYE. Sound effects
// are synthesized. The countdown voice is Glitch Pong's.
// ═══════════════════════════════════════════════════════════════════════════

const MUSIC = {
  nexus: [
    '../sounds/music/blackhole_nebula1.mp3', '../breakpoint/sounds/music/event-horizon-1.mp3',
    '../sounds/music/blackhole_nebula2.mp3', '../sounds/music/blackhole_nebula3.mp3',
    '../breakpoint/sounds/music/event-horizon-2.mp3', '../sounds/music/blackhole_nebula4.mp3',
    '../sounds/music/blackhole_nebula5.mp3'
  ],
  eye: ['../breakpoint/sounds/music/do-not-blink-1.mp3', '../breakpoint/sounds/music/do-not-blink-2.mp3']
};
const CLIPS = { 3: '../sounds/sfx/3.mp3', 2: '../sounds/sfx/2.mp3', 1: '../sounds/sfx/1.mp3', GO: '../sounds/sfx/GO.mp3' };

export function createAudio() {
  let ctx = null, master = null, musicGain = null, sfxGain = null, filter = null;
  let el = null, theme = null, wanted = null, take = {}, volume = 0.7, muted = false;
  const clips = {};
  const failed = new Set();

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 18000;
    filter.connect(musicGain); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    el = new Audio();
    el.preload = 'none';
    el.preservesPitch = false;
    try { ctx.createMediaElementSource(el).connect(filter); } catch (e) {}
    el.addEventListener('ended', () => { if (theme) { take[theme] = (take[theme] || 0) + 1; load(); } });
    el.addEventListener('error', () => { if (el.error && theme) { failed.add(el.src); take[theme] = (take[theme] || 0) + 1; if (failed.size < 12) load(); } });
    for (const [k, url] of Object.entries(CLIPS)) {
      fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
        .then((buf) => ctx.decodeAudioData(buf)).then((b) => { clips[k] = b; }).catch(() => {});
    }
    if (wanted) music(wanted);
  }

  function load() {
    if (!el || !theme) return;
    const list = MUSIC[theme];
    el.src = list[(take[theme] || 0) % list.length];
    el.play().catch(() => {});
  }
  // 'nexus', 'eye', or null for silence
  function music(key) {
    wanted = key;
    if (!ctx) return;
    if (key === theme) { if (key && el.paused) el.play().catch(() => {}); return; }
    theme = key;
    if (!key) { el.pause(); return; }
    load();
  }
  function pauseMusic(on) {
    if (!el || !theme) return;
    if (on) el.pause(); else el.play().catch(() => {});
  }
  // The recording bends with the game: slower and duller as the hole breathes
  // in or time is frozen, a little faster at Critical Heat.
  function bend(rate, cutoff) {
    if (!el || !ctx) return;
    try { el.playbackRate = rate; } catch (e) {}
    filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.2);
  }

  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.when || 0);
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1200;
    g.gain.value = o.vol || 0.2;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  const SFX = {
    click: () => tone(520, 0.05, { vol: 0.1 }),
    // a bit: higher the deeper you took it, and higher again as the rally builds
    bit: (band = 1, chain = 0) => tone(420 * band * Math.pow(1.03, Math.min(chain, 20)), 0.09, { type: 'triangle', vol: 0.16, to: 640 * band }),
    core: () => { tone(660, 0.1, { type: 'triangle', vol: 0.18 }); tone(990, 0.16, { type: 'triangle', vol: 0.16, when: 0.07 }); },
    graze: () => noise(0.08, { freq: 3800, vol: 0.12 }),
    power: () => { tone(330, 0.08, { vol: 0.14 }); tone(495, 0.08, { vol: 0.14, when: 0.07 }); tone(660, 0.14, { vol: 0.14, when: 0.14 }); },
    shield: () => { noise(0.25, { freq: 900, vol: 0.25 }); tone(220, 0.25, { to: 90, vol: 0.18 }); },
    lost: () => { noise(0.5, { freq: 500, vol: 0.35, type: 'lowpass' }); tone(300, 0.6, { to: 40, type: 'sawtooth', vol: 0.22 }); },
    eaten: () => { tone(520, 0.9, { to: 30, type: 'sine', vol: 0.3 }); noise(0.9, { freq: 200, vol: 0.2, type: 'lowpass' }); },
    loyal: () => { tone(200, 0.12, { vol: 0.2 }); tone(800, 0.25, { type: 'triangle', vol: 0.2, when: 0.08 }); },
    warn: () => { tone(180, 0.12, { vol: 0.14 }); tone(180, 0.12, { vol: 0.14, when: 0.2 }); },
    surge: () => tone(90, 1.2, { to: 45, type: 'sawtooth', vol: 0.22 }),
    snap: () => { noise(0.12, { freq: 2400, vol: 0.2 }); tone(900, 0.1, { to: 200, vol: 0.14 }); },
    theft: () => { for (let i = 0; i < 4; i++) tone(1200 - i * 180, 0.07, { vol: 0.12, when: i * 0.06 }); },
    clear: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.18, when: i * 0.09 })); },
    eyeHit: () => { noise(0.3, { freq: 1500, vol: 0.3 }); tone(140, 0.35, { to: 60, type: 'sawtooth', vol: 0.25 }); },
    deflect: () => tone(1400, 0.12, { to: 2200, vol: 0.12 }),
    blink: () => tone(110, 0.2, { type: 'sine', vol: 0.2 }),
    over: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.16, when: i * 0.22 })); },
    crash: () => { noise(0.5, { freq: 300, vol: 0.4, type: 'lowpass' }); tone(60, 0.8, { type: 'square', vol: 0.2 }); },
    // NULL's terminal: one tick per few letters
    type: () => tone(1700 + Math.random() * 300, 0.012, { vol: 0.02 })
  };

  return {
    init,
    get ready() { return !!ctx; },
    sfx(name, ...args) { if (ctx && SFX[name]) SFX[name](...args); },
    countdown(key) {
      if (!ctx) return;
      const b = clips[key];
      if (b) {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        g.gain.value = 0.85; src.buffer = b; src.connect(g); g.connect(sfxGain); src.start();
      } else if (key === 'GO') { tone(660, 0.12, { vol: 0.2 }); tone(990, 0.3, { vol: 0.2, when: 0.1 }); }
      else tone(440, 0.14, { vol: 0.2 });
    },
    music, pauseMusic, bend,
    setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; }
  };
}
