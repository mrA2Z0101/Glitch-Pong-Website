// ═══════════════════════════════════════════════════════════════════════════
// GLITCHCADE AUDIO — 3D sound for the arcade floor
// Scene soundtracks plus Glitch Pong's SFX; everything else (room hum, neon
// buzz, footsteps, cabinet bleeps, glitch bursts) is synthesised on the fly.
//
//   master ─┬─ indoor bus ─ lowpass (muffles the arcade when you're outside)
//           ├─ outdoor bus (street, neon sign)
//           └─ self bus (your footsteps, UI)
// ═══════════════════════════════════════════════════════════════════════════

const SFX_FILES = {
  hover: 'Button Hover',
  pulse: 'Glitch Pulse',
  start: 'Game Start',
  teleport: 'Teleport Sound',
  paddle: 'Paddle Hit Sound',
  wall: 'Wall Bounce Sound',
  score: 'Score Sound',
  dash: 'Dash Activation',
  juke: 'Juke Sound'
};

// Beat maps measured offline from the audio files (onset folding over the
// whole song). bpm/offset give the beat grid in seconds of song time; down is
// which beat of the grid starts a bar. PRIZETRON's own songs are measured to
// a few ms and carry a drift curve (ms at evenly spaced points in the song)
// for the take that speeds up near the end. The Construct tracks have less
// regular rhythm sections, so `lock` lets live kick detection nudge the grid.
const GROOVE_POINTS = [3.73, 11.2, 18.66, 26.13, 33.59, 41.06, 48.52, 55.99, 63.45, 70.92, 78.38, 85.85, 93.32, 100.78, 108.25, 115.71];
const CONSTRUCT_BEATS = [
  { bpm: 86.923, offset: 0.2786, down: 0, lock: 0.18 },   // measured 173.85, danced half-time
  { bpm: 140.224, offset: 0.0825, down: 3, lock: 0.18 },
  { bpm: 100.004, offset: 0.0219, down: 0, lock: 0.18 },
  { bpm: 135.988, offset: 0.1448, down: 1, lock: 0.18 },
  { bpm: 100.998, offset: 0.065, down: 0, lock: 0.12 },
  { bpm: 133.408, offset: 0.2881, down: 2, lock: 0.18 }
];

// PRIZETRON's two takes lead the jukebox; keep the original Construct selections.
const PLAYLIST = [
  { src: 'sounds/music/prizetrons-groove-1.mp3', title: "PRIZETRON'S GROOVE 01",
    beat: { bpm: 112.044, offset: 0.2984, down: 1, lock: 0,
            drift: [GROOVE_POINTS, [-6, 0, 0, 0, 6, 11, 11, 6, 0, 0, -22, -45, -61, -100, -134, -167]] } },
  { src: 'sounds/music/prizetrons-groove-2.mp3', title: "PRIZETRON'S GROOVE 02",
    beat: { bpm: 112.502, offset: 0.3028, down: 2, lock: 0 } },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    src: `sounds/music/construct_music${n}.mp3`,
    title: `THE CONSTRUCT ${String(n).padStart(2, '0')}`,
    beat: CONSTRUCT_BEATS[n - 1]
  })),
  // Records sold at the prize counter (TRACK_PACKS in glitchcade-state.js).
  // They have no beat map, so PRIZETRON dances to his own count over them.
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ src: `sounds/music/matrix_music${n}.mp3`, title: `MATRIX MIXTAPE ${String(n).padStart(2, '0')}`, pack: 'matrix' })),
  ...[1, 2, 3, 4, 5].map((n) => ({ src: `sounds/music/blackhole_nebula${n}.mp3`, title: `BLACK HOLE NEBULA ${String(n).padStart(2, '0')}`, pack: 'nebula' })),
  ...[1, 2, 3, 4].map((n) => ({ src: `sounds/music/in_game_music${n}.mp3`, title: `CLASSIC ARENA ${String(n).padStart(2, '0')}`, pack: 'arena' }))
];

// Piecewise-linear lookup in a [times, ms] drift curve, returned in seconds.
function driftAt(drift, t) {
  if (!drift) return 0;
  const [xs, ys] = drift;
  if (t <= xs[0]) return ys[0] / 1000;
  for (let i = 1; i < xs.length; i++) {
    if (t <= xs[i]) {
      const k = (t - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return (ys[i - 1] + (ys[i] - ys[i - 1]) * k) / 1000;
    }
  }
  return ys[ys.length - 1] / 1000;
}

const MUTE_KEY = 'glitchcade_muted';
const MUSIC_LEVELS = { street: 0.45, floor: 0.4, groove: 0.55 };
// Pentatonic note sets so every offline cabinet bleeps in its own key.
const SCALES = [[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 7, 8], [0, 4, 5, 7, 11]];

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
}
function writeMuted(v) {
  try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch (e) {}
}

export function createArcadeAudio({ isTouch }) {
  let ctx = null;
  let master, indoorIn, indoorFilter, outdoorIn, selfBus;
  let noiseBuffer = null;
  const buffers = {};
  let muted = readMuted();
  let hidden = false;           // the page is in the background: be silent and let the engine rest
  let mode = 'intro';           // intro | explore | paused | launching | playing
  let suspendTimer = null;
  const emitters = [];          // positional loops that need panners
  let signEmitter = null;
  let robotEmitter = null;
  let gpEmitter = null;
  let jukebox = null;
  let trackIndex = 0;
  const ownedPacks = new Set();   // record packs bought at the counter
  const trackLocked = (i) => !!PLAYLIST[i].pack && !ownedPacks.has(PLAYLIST[i].pack);
  let musicEl = null;
  let floorMusic = null, streetMusic = null, prizePos = null;
  let musicZone = null;
  const sceneMusic = [];
  let worldAttached = false;

  // Warm the opening song while the arcade art loads. Loading never plays it;
  // the first user gesture still owns AudioContext creation and play().
  const openingStreet = new Audio();
  openingStreet.preload = 'auto';
  openingStreet.src = 'sounds/music/neon-on-wet-asphalt-1.mp3';
  try { openingStreet.load(); } catch (e) {}

  // Start fetching the small SFX files right away; decode once we have a context.
  const rawSfx = {};
  Object.entries(SFX_FILES).forEach(([key, name]) => {
    rawSfx[key] = fetch(encodeURI(`sounds/sfx/${name}.mp3`)).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  });

  function now() { return ctx.currentTime; }

  function ramp(param, value, time = 0.3) {
    if (!ctx) return;
    param.cancelScheduledValues(now());
    param.setValueAtTime(param.value, now());
    param.linearRampToValueAtTime(value, now() + time);
  }

  function makePanner(pos, { ref = 1.5, rolloff = 1.2, max = 60 } = {}) {
    const p = ctx.createPanner();
    p.panningModel = isTouch ? 'equalpower' : 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = max;
    setPannerPos(p, pos);
    return p;
  }

  function setPannerPos(p, pos) {
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
  }

  function noiseSource(loop = true) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = loop;
    return src;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    indoorIn = ctx.createGain();
    indoorFilter = ctx.createBiquadFilter();
    indoorFilter.type = 'lowpass';
    indoorFilter.frequency.value = 700;
    indoorIn.connect(indoorFilter).connect(master);

    outdoorIn = ctx.createGain();
    outdoorIn.connect(master);

    selfBus = ctx.createGain();
    selfBus.connect(master);

    // 2 s of white noise, shared by every noisy thing
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // ── arcade room tone: low rumble + mains hum from all the machines ──
    const rumble = noiseSource();
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.frequency.value = 160;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.08;
    rumble.connect(rumbleLp).connect(rumbleGain).connect(indoorIn);
    rumble.start();
    [[60, 0.012], [120, 0.007], [180, 0.003]].forEach(([f, g]) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(indoorIn);
      o.start();
    });

    // ── night street: distant city wash with a slow swell ──
    const city = noiseSource();
    const cityLp = ctx.createBiquadFilter();
    cityLp.type = 'lowpass';
    cityLp.frequency.value = 420;
    const cityGain = ctx.createGain();
    cityGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(cityGain.gain);
    city.connect(cityLp).connect(cityGain).connect(outdoorIn);
    city.start();
    lfo.start();
  }

  async function decodeSfx() {
    await Promise.all(Object.entries(rawSfx).map(async ([key, p]) => {
      const raw = await p;
      if (!raw) return;
      try {
        buffers[key] = await new Promise((res, rej) => ctx.decodeAudioData(raw.slice(0), res, rej));
      } catch (e) {}
    }));
  }

  // ── Positional emitters ────────────────────────────────────────────────
  function buzzEmitter(pos) {
    // Neon tube buzz: rough 100 Hz saw through a resonant band-pass.
    const out = ctx.createGain();
    out.gain.value = 0.05;
    const panner = makePanner(pos, { ref: 3, rolloff: 1 });
    out.connect(panner).connect(outdoorIn);
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 100;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 2.5;
    saw.connect(bp).connect(out);
    saw.start();
    return { out, panner };
  }

  function curtainEmitter(pos) {
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const panner = makePanner(pos, { ref: 0.8, rolloff: 2.2 });
    src.connect(bp).connect(g).connect(panner).connect(master);
    src.start(0, Math.random() * 1.5);
    return { gain: g };
  }

  // A cabinet that's still compiling: faint static plus the odd attract bleep.
  function cabinetEmitter(cab, index) {
    const panner = makePanner(cab.screenCenter, { ref: 1.2, rolloff: 1.4 });
    panner.connect(indoorIn);
    // The static hiss is a quiet, always-running noise chain per machine. Phones skip it;
    // the occasional bleep still plays.
    if (!isTouch) {
      const hiss = noiseSource();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5200;
      bp.Q.value = 0.7;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.012;
      hiss.connect(bp).connect(hissGain).connect(panner);
      hiss.start(0, Math.random() * 1.8);
    }
    const em = {
      panner,
      scale: SCALES[index % SCALES.length],
      root: 220 * Math.pow(2, (index % 5) / 12),
      next: 2 + Math.random() * 8
    };
    emitters.push(em);
    return em;
  }

  // The prize-counter hologram: a soft shimmering hum around the projector.
  function hologramEmitter(pos) {
    const panner = makePanner(pos, { ref: 1.5, rolloff: 1.6 });
    panner.connect(indoorIn);
    const o = ctx.createOscillator();
    o.frequency.value = 220;
    const o2 = ctx.createOscillator();
    o2.frequency.value = 331;
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.006;
    const g = ctx.createGain();
    g.gain.value = 0.014;
    trem.connect(tremGain).connect(g.gain);
    o.connect(g);
    o2.connect(g);
    g.connect(panner);
    [o, o2, trem].forEach((n) => n.start());
    return { panner };
  }

  function bleep(em) {
    const t0 = now() + 0.02;
    const notes = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      o.type = Math.random() < 0.7 ? 'square' : 'triangle';
      const step = em.scale[Math.floor(Math.random() * em.scale.length)] + (Math.random() < 0.3 ? 12 : 0);
      o.frequency.value = em.root * Math.pow(2, step / 12);
      const g = ctx.createGain();
      const t = t0 + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.08);
      o.connect(g).connect(em.panner);
      o.start(t);
      o.stop(t + 0.09);
    }
  }

  // ── One-shots ──────────────────────────────────────────────────────────
  function play(key, { volume = 0.5, rate = 1, at = null, bus = 'self', ref = 1.5, rolloff = 1.2 } = {}) {
    if (!ctx || !buffers[key]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[key];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    const dest = bus === 'indoor' ? indoorIn : bus === 'outdoor' ? outdoorIn : selfBus;
    if (at) src.connect(g).connect(makePanner(at, { ref, rolloff })).connect(dest);
    else src.connect(g).connect(dest);
    src.start();
  }

  function noiseBurst({ dur = 0.06, type = 'lowpass', freq = 600, q = 0.7, volume = 0.2, dest = selfBus, at = null, delay = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const src = noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    let chain = src.connect(f).connect(g);
    if (at) chain = chain.connect(makePanner(at, { ref: 2, rolloff: 1 }));
    chain.connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  function tone({ type = 'sine', from = 200, to = from, dur = 0.15, volume = 0.15, dest = selfBus, delay = 0 }) {
    if (!ctx) return;
    const t = now() + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ── Jukebox (streams the soundtrack through a positional panner) ──────────
  function setupJukebox(pos = { x: 0, y: 1.7, z: 0 }, counterPos = pos) {
    musicEl = new Audio();
    musicEl.preload = 'none';
    musicEl.addEventListener('ended', () => api.nextTrack(false));
    const src = ctx.createMediaElementSource(musicEl);
    const g = ctx.createGain();
    g.gain.value = 0;
    const panner = makePanner(pos, { ref: 1.5, rolloff: 2 });
    src.connect(g).connect(panner).connect(indoorIn);
    // The same song comes from the prize counter's speakers, in sync.
    prizePos = counterPos;
    const counterPanner = makePanner(counterPos, { ref: 2, rolloff: 2 });
    g.connect(counterPanner).connect(indoorIn);
    // Tap the song before its volume/zone gain so PRIZETRON hears the kick
    // drum at the same strength wherever the player is standing.
    let analyser = null;
    if (typeof ctx.createAnalyser === 'function') {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
    }
    jukebox = { panner, counterPanner, gain: g, pos, analyser, bins: analyser ? new Uint8Array(analyser.frequencyBinCount) : null };
    loadTrack();
  }

  function setupSceneMusic(stem, dest, initialGain, readyElement = null) {
    const el = readyElement || new Audio();
    if (!readyElement) el.preload = 'none';
    const gain = ctx.createGain();
    gain.gain.value = initialGain;
    ctx.createMediaElementSource(el).connect(gain).connect(dest);
    let take = 1;
    if (!readyElement) el.src = `sounds/music/${stem}-${take}.mp3`;
    el.addEventListener('ended', () => {
      take = take === 1 ? 2 : 1;
      el.src = `sounds/music/${stem}-${take}.mp3`;
      if (!muted && ['intro', 'explore', 'paused'].includes(mode)) el.play().catch(() => {});
    });
    const stream = { el, gain };
    sceneMusic.push(stream);
    return stream;
  }

  function loadTrack() {
    musicEl.src = encodeURI(PLAYLIST[trackIndex].src);
  }

  function playMusic() {
    // Start during the title-menu gesture too: Safari needs play() inside it.
    if (!musicEl || muted || hidden || mode === 'playing') return;
    for (const el of [musicEl, ...sceneMusic.map(s => s.el)]) {
      if (el.paused) {
        // A failed speculative preload must not poison the first real click.
        if (el.error) { try { el.load(); } catch (e) {} }
        el.play().catch(() => {});
      }
    }
  }

  // ── Beat clock: where the jukebox song is in its beat grid ────────────────
  const beatState = { track: -1, corr: 0, prevBass: 0, fluxAvg: 0, lastOnset: -9, peak: 0.08, level: 0, lastT: 0 };

  function beatClock() {
    if (!musicEl || !jukebox) return null;
    const entry = PLAYLIST[trackIndex];
    const info = entry.beat;
    if (!info) return null;
    const period = 60 / info.bpm;
    const latency = ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
    const t = Math.max(0, (Number(musicEl.currentTime) || 0) - latency);
    // A new track, or a jump back (loop/seek), restarts the live correction.
    if (beatState.track !== trackIndex || t < beatState.lastT - 1) {
      Object.assign(beatState, { track: trackIndex, corr: 0, prevBass: 0, fluxAvg: 0, lastOnset: -9, level: 0 });
    }
    beatState.lastT = t;
    const playing = !musicEl.paused && !musicEl.ended && (musicEl.readyState === undefined || musicEl.readyState >= 2);
    const drift = driftAt(info.drift, t);
    let kick = false;
    if (playing && jukebox.analyser) {
      jukebox.analyser.getByteFrequencyData(jukebox.bins);
      const binHz = ctx.sampleRate / jukebox.analyser.fftSize;
      const hi = Math.max(2, Math.round(160 / binHz));
      let sum = 0;
      for (let i = 1; i <= hi; i++) sum += jukebox.bins[i];
      const bass = sum / (hi * 255);
      beatState.peak = Math.max(beatState.peak * 0.998, bass, 0.08);
      beatState.level += (bass / beatState.peak - beatState.level) * 0.35;
      const flux = Math.max(0, bass - beatState.prevBass);
      beatState.prevBass = bass;
      if (flux > beatState.fluxAvg * 2.4 + 0.035 && t - beatState.lastOnset > period * 0.5) {
        beatState.lastOnset = t;
        kick = true;
        if (info.lock) {
          const pos = (t - info.offset - drift - beatState.corr) / period;
          const err = (pos - Math.round(pos)) * period;
          if (Math.abs(err) < period * 0.3) {
            beatState.corr = Math.max(-period / 2, Math.min(period / 2, beatState.corr + err * info.lock));
          }
        }
      }
      beatState.fluxAvg = beatState.fluxAvg * 0.9 + flux * 0.1;
    } else if (!playing) {
      beatState.level *= 0.9;
    }
    return {
      playing,
      title: entry.title,
      bpm: info.bpm,
      time: t,
      beat: (t - info.offset - drift - beatState.corr) / period,   // beats since the grid's first beat
      down: info.down || 0,                                        // grid beat index (mod 4) that starts a bar
      level: Math.max(0, Math.min(1.5, beatState.level)),         // live bass energy, ~1 at a kick
      kick,
      correctionMs: Math.round(beatState.corr * 1000)
    };
  }

  function musicGains() {
    return { street: streetMusic.gain.gain, floor: floorMusic.gain.gain, groove: jukebox.gain.gain };
  }

  function changeMusicZone(zone, immediate = false) {
    if (zone === musicZone) return;
    musicZone = zone;
    const gains = musicGains();
    const t = now();
    const fadeOut = 0.65, fadeIn = 1.1;
    const outgoing = Object.entries(gains).some(([key, gain]) => key !== zone && gain.value > 0);
    for (const [key, gain] of Object.entries(gains)) {
      // Hold the current level when someone turns around during a fade, and
      // cancel the previous incoming song's scheduled fade-in as well.
      const current = gain.value;
      if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(t);
      else gain.cancelScheduledValues(t);
      // Anchor even a settled gain: otherwise a new linear ramp can start at
      // an older automation event and immediately jump partway down the fade.
      gain.setValueAtTime(current, t);
      if (immediate) {
        gain.setValueAtTime(key === zone ? MUSIC_LEVELS[key] : 0, t);
      } else if (key !== zone) {
        gain.linearRampToValueAtTime(0, t + fadeOut);
      } else {
        // These tracks have different beats: finish fading the old one to
        // exactly zero before bringing in the new one. No distant music bleed.
        const start = outgoing ? t + fadeOut + 0.05 : t;
        gain.setValueAtTime(outgoing ? 0 : current, start);
        gain.linearRampToValueAtTime(MUSIC_LEVELS[key], start + fadeIn);
      }
    }
  }

  function updateMusicZone(position, inside, immediate = false) {
    if (!floorMusic || !streetMusic || !jukebox) return;
    // Separate enter/leave thresholds keep doorways and speaker-zone edges
    // from repeatedly switching songs when the player lingers there.
    const indoors = inside > (musicZone === 'street' || !musicZone ? 0.65 : 0.25);
    const distance = pos => Math.hypot(position.x - pos.x, position.z - pos.z);
    const speakerDistance = Math.min(distance(jukebox.pos), distance(prizePos));
    const nearSpeakers = speakerDistance < (musicZone === 'groove' ? 6.75 : 5.5);
    changeMusicZone(!indoors ? 'street' : nearSpeakers ? 'groove' : 'floor', immediate);
  }

  function attachWorld(world) {
    if (!world || worldAttached) return;
    signEmitter = buzzEmitter(world.signPos);
    signEmitter.pos = world.signPos;
    curtainEmitter(world.doorPos);
    robotEmitter = hologramEmitter(world.robotPos);
    world.soonCabinets.forEach((cab, i) => cabinetEmitter(cab, i));
    gpEmitter = { pos: world.gpScreen };
    jukebox.pos = world.jukeboxPos;
    prizePos = world.robotPos;
    setPannerPos(jukebox.panner, jukebox.pos);
    setPannerPos(jukebox.counterPanner, prizePos);
    worldAttached = true;
  }

  // ── Mixing per mode ────────────────────────────────────────────────────
  function applyMode() {
    if (!ctx) return;
    clearTimeout(suspendTimer);
    const asleep = mode === 'playing' || hidden || muted;   // nothing to hear: stop the engine, not just the volume
    const level = muted || hidden ? 0 : { intro: 0.7, explore: 1, paused: 0.3, launching: 0.6, playing: 0 }[mode];
    ramp(master.gain, level, mode === 'playing' ? 0.25 : 0.4);
    if (mode === 'launching') {
      // the room drains away as you lean into the screen
      ramp(indoorIn.gain, 0.15, 0.7);
      ramp(outdoorIn.gain, 0.1, 0.7);
    }
    if (asleep) {
      if (musicEl) musicEl.pause();
      sceneMusic.forEach(s => s.el.pause());
      // Glitch Pong has its own audio, and a muted or backgrounded page has no audience:
      // every oscillator and noise source keeps running (and costing power) until the
      // context is suspended. The short delay lets the fade finish first.
      suspendTimer = setTimeout(() => ctx.suspend().catch(() => {}), 400);
    } else if (['intro', 'explore', 'paused'].includes(mode)) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      playMusic();
    }
  }

  const api = {
    onTrack: null,              // called with the new title when the jukebox changes track
    get muted() { return muted; },
    get ready() { return !!ctx; },
    get trackTitle() { return PLAYLIST[trackIndex].title; },
    // The jukebox song's beat position, for PRIZETRON's dance (null before audio starts).
    beatClock,
    // debugging / tests
    get contextState() { return ctx ? ctx.state : 'none'; },
    get musicPlaying() { return !!musicEl && !musicEl.paused; },
    get musicMix() {
      if (!floorMusic || !streetMusic || !jukebox) return null;
      return { zone: musicZone, ...Object.fromEntries(Object.entries(musicGains()).map(
        ([key, gain]) => [key, gain.value / MUSIC_LEVELS[key]]
      )) };
    },
    level() {
      if (!ctx) return 0;
      if (!api._analyser) {
        api._analyser = ctx.createAnalyser();
        api._analyser.fftSize = 2048;
        master.connect(api._analyser);
      }
      const buf = new Float32Array(api._analyser.fftSize);
      api._analyser.getFloatTimeDomainData(buf);
      return Math.sqrt(buf.reduce((a, v) => a + v * v, 0) / buf.length);
    },

    // Call from inside a user gesture (click / tap / key).
    unlock(world, location = null) {
      let created = false;
      if (!ctx) {
        try {
          // 'balanced' lets a phone's audio hardware wake less often. Footsteps and
          // bleeps land a few milliseconds later; nobody is playing rhythm on them.
          const Ctx = window.AudioContext || window.webkitAudioContext;
          ctx = isTouch ? new Ctx({ latencyHint: 'balanced' }) : new Ctx();
        } catch (e) {
          return;
        }
        buildGraph();
        decodeSfx();
        setupJukebox();
        floorMusic = setupSceneMusic('arcade-main', indoorIn, 0);
        streetMusic = setupSceneMusic('neon-on-wet-asphalt', outdoorIn, 0, openingStreet);
        created = true;
      }
      attachWorld(world);
      if (created) {
        // First playback should not wait for a scene transition fade, or for
        // world geometry. Later zone changes retain their normal smooth fades.
        if (location && worldAttached) updateMusicZone(location.position, location.inside, true);
        else changeMusicZone('street', true);
        // setMode('intro') often ran before the first gesture created ctx.
        // Apply it now so the new master isn't left at buildGraph's zero gain.
        applyMode();
      }
      if (ctx.state === 'suspended' && !muted && !hidden) ctx.resume().catch(() => {});
      // Also retries after a browser blocks playback until a gesture.
      playMusic();
    },

    // The page went to the background or came back (document.hidden).
    setHidden(h) {
      hidden = !!h;
      applyMode();
    },
    get hidden() { return hidden; },

    setMode(next) {
      mode = next;
      applyMode();
    },

    toggleMute() {
      muted = !muted;
      writeMuted(muted);
      applyMode();
      return muted;
    },

    // The floor's own sound effects (air hockey, ROM fragments, the Eye).
    tone, noise: noiseBurst, sfx: play,
    get indoorBus() { return indoorIn; },

    // ── Jukebox catalogue ──
    get trackIndex() { return trackIndex; },
    tracks() {
      return PLAYLIST.map((t, index) => ({ index, title: t.title, pack: t.pack || null, locked: trackLocked(index) }));
    },
    setOwnedPacks(ids) {
      ownedPacks.clear();
      (ids || []).forEach((id) => ownedPacks.add(id));
    },
    // Put a specific record on. Returns its title, or null if it's locked.
    selectTrack(index, announce = true) {
      if (!PLAYLIST[index] || trackLocked(index)) return null;
      if (!musicEl) { trackIndex = index; return PLAYLIST[index].title; }
      trackIndex = index;
      loadTrack();
      if (api.onTrack) api.onTrack(PLAYLIST[trackIndex].title);
      if (['intro', 'explore', 'paused'].includes(mode)) playMusic();
      if (announce) {
        play('juke', { volume: 0.4, at: jukebox && jukebox.pos, bus: 'indoor' });
        noiseBurst({ dur: 0.18, type: 'bandpass', freq: 2400, volume: 0.15, dest: selfBus });
      }
      return PLAYLIST[trackIndex].title;
    },

    nextTrack(announce = true) {
      if (!musicEl) return null;
      // skip records the player hasn't bought
      for (let n = 0; n < PLAYLIST.length; n++) {
        trackIndex = (trackIndex + 1) % PLAYLIST.length;
        if (!trackLocked(trackIndex)) break;
      }
      loadTrack();
      if (api.onTrack) api.onTrack(PLAYLIST[trackIndex].title);
      if (['intro', 'explore', 'paused'].includes(mode)) playMusic();
      if (announce) {
        play('juke', { volume: 0.4, at: jukebox && jukebox.pos, bus: 'indoor' });
        noiseBurst({ dur: 0.18, type: 'bandpass', freq: 2400, volume: 0.15, dest: selfBus });
      }
      return PLAYLIST[trackIndex].title;
    },

    // Per-frame: move the listener with the camera, crossfade inside/outside.
    // `forward` is the camera's world direction (a reused vector from the caller).
    update(dt, camera, forward, inside) {
      if (!ctx || ctx.state !== 'running') return;
      const L = ctx.listener;
      const p = camera.position;
      const f = camera.getWorldDirection(forward);
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else {
        L.setPosition(p.x, p.y, p.z);
        L.setOrientation(f.x, f.y, f.z, 0, 1, 0);
      }
      if (mode === 'explore' || mode === 'paused' || mode === 'intro') {
        // Outside, the arcade is a muffled thump through the walls.
        indoorFilter.frequency.setTargetAtTime(500 + inside * 17500, now(), 0.25);
        indoorIn.gain.setTargetAtTime(0.4 + inside * 0.6, now(), 0.25);
        outdoorIn.gain.setTargetAtTime(1 - inside * 0.8, now(), 0.25);
        updateMusicZone(p, inside);
      }
      if (mode !== 'explore') return;
      for (const em of emitters) {
        em.next -= dt;
        if (em.next <= 0) {
          bleep(em);
          em.next = 5 + Math.random() * 9;
        }
      }
    },

    // ── Hooks the world calls ──
    footstep(surface) {
      const s = {
        carpet: { type: 'lowpass', freq: 420, volume: 0.22, dur: 0.07 },
        stage: { type: 'bandpass', freq: 1700, q: 2.5, volume: 0.16, dur: 0.09 },
        sidewalk: { type: 'bandpass', freq: 1300, q: 0.9, volume: 0.13, dur: 0.06 },
        asphalt: { type: 'bandpass', freq: 900, q: 0.8, volume: 0.12, dur: 0.07 }
      }[surface] || {};
      noiseBurst({ ...s, freq: s.freq * (0.9 + Math.random() * 0.2) });
      if (surface === 'stage') tone({ type: 'triangle', from: 320, to: 300, dur: 0.06, volume: 0.03 });
    },
    jump() {
      noiseBurst({ dur: 0.16, type: 'highpass', freq: 1800, volume: 0.06 });
    },
    land(hard) {
      tone({ from: 120, to: 50, dur: 0.14, volume: hard ? 0.3 : 0.18 });
      noiseBurst({ dur: 0.08, type: 'lowpass', freq: 500, volume: hard ? 0.25 : 0.15 });
    },
    hover() { play('hover', { volume: 0.22 }); },
    comingSoon(at) {
      play('pulse', { volume: 0.45 });
      tone({ type: 'square', from: 420, to: 140, dur: 0.25, volume: 0.05, dest: selfBus });
      if (at) noiseBurst({ dur: 0.3, type: 'bandpass', freq: 4000, volume: 0.25, at, dest: indoorIn });
    },
    launch() { play('start', { volume: 0.5 }); },
    welcomeBack() {
      tone({ type: 'square', from: 180, to: 720, dur: 0.22, volume: 0.05 });
      tone({ type: 'square', from: 360, to: 1440, dur: 0.22, volume: 0.03, delay: 0.06 });
    },
    enter() {
      // boot-up chirp when you first step in
      [0, 0.08, 0.16].forEach((d, i) => tone({ type: 'square', from: 330 * (i + 1), to: 330 * (i + 1), dur: 0.07, volume: 0.04, delay: d }));
    },
    doorway(at) { play('teleport', { volume: 0.35, at, bus: 'self', ref: 2 }); },
    glitch(small) {
      // bit-crunchy burst: chopped noise + a falling square
      for (let i = 0; i < (small ? 3 : 6); i++) {
        noiseBurst({ dur: 0.03, type: 'bandpass', freq: 600 + Math.random() * 5000, q: 3, volume: small ? 0.1 : 0.16, delay: i * 0.035 });
      }
      tone({ type: 'square', from: 900, to: 90, dur: small ? 0.15 : 0.28, volume: small ? 0.03 : 0.05 });
    },
    signFlicker() {
      if (!signEmitter) return;
      // tube stutters: a crackle and a hiccup in the buzz
      noiseBurst({ dur: 0.05, type: 'highpass', freq: 3000, volume: 0.08, at: signEmitter.pos, dest: outdoorIn });
      const g = signEmitter.out.gain;
      g.cancelScheduledValues(now());
      g.setValueAtTime(0, now());
      g.setValueAtTime(0.05, now() + 0.06 + Math.random() * 0.08);
    },
    eyeShot(at) { play('dash', { volume: 0.4, at, bus: 'indoor', ref: 2 }); },
    // classic two-note coin "ba-ding"
    coin() {
      tone({ type: 'square', from: 988, to: 988, dur: 0.08, volume: 0.07 });
      tone({ type: 'square', from: 1319, to: 1319, dur: 0.32, volume: 0.07, delay: 0.08 });
    },
    // prize fanfare: rising arpeggio + the game's score sting
    redeem() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', from: f, to: f, dur: 0.12, volume: 0.05, delay: i * 0.08 }));
      tone({ type: 'triangle', from: 1047, to: 1047, dur: 0.5, volume: 0.06, delay: 0.32 });
      play('score', { volume: 0.35 });
    },
    deny() {
      tone({ type: 'sawtooth', from: 140, to: 110, dur: 0.18, volume: 0.06 });
      tone({ type: 'sawtooth', from: 140, to: 100, dur: 0.22, volume: 0.06, delay: 0.2 });
    },
    // robot "speech": a burst of formant-ish square chirps from the hologram
    robotTalk(syllables = 8) {
      if (!ctx || !robotEmitter || mode !== 'explore') return;
      for (let i = 0; i < syllables; i++) {
        const t = now() + i * 0.075;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(260 + Math.random() * 420, t);
        o.frequency.exponentialRampToValueAtTime(200 + Math.random() * 300, t + 0.06);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900 + Math.random() * 1400;
        bp.Q.value = 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.065);
        o.connect(bp).connect(g).connect(robotEmitter.panner);
        o.start(t);
        o.stop(t + 0.07);
      }
    },
    eyeHit() { play('pulse', { volume: 0.35, rate: 1.3 }); },
    attract(event) {
      if (!gpEmitter || mode !== 'explore') return;
      const key = event === 'paddle' ? 'paddle' : event === 'wall' ? 'wall' : 'score';
      play(key, { volume: event === 'score' ? 0.3 : 0.18, at: gpEmitter.pos, bus: 'indoor', ref: 1.4, rolloff: 1.3 });
    }
  };

  return api;
}
