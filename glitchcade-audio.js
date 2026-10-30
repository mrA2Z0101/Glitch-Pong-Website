// ═══════════════════════════════════════════════════════════════════════════
// GLITCHCADE AUDIO — 3D sound for the arcade floor
// Reuses Glitch Pong's own soundtrack and SFX; everything else (room hum, neon
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

// The jukebox plays the Construct arena soundtrack — the neon one.
const PLAYLIST = [1, 2, 3, 4, 5, 6].map((n) => ({
  src: `sounds/music/construct_music${n}.mp3`,
  title: `THE CONSTRUCT ${String(n).padStart(2, '0')}`
}));

const MUTE_KEY = 'glitchcade_muted';
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
  let mode = 'intro';           // intro | explore | paused | launching | playing
  let suspendTimer = null;
  const emitters = [];          // positional loops that need panners
  let signEmitter = null;
  let gpEmitter = null;
  let jukebox = null;
  let trackIndex = Math.floor(Math.random() * PLAYLIST.length);
  let musicEl = null;
  let musicStarted = false;

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
    const hiss = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 0.7;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.012;
    hiss.connect(bp).connect(hissGain).connect(panner);
    hiss.start(0, Math.random() * 1.8);
    const em = {
      panner,
      scale: SCALES[index % SCALES.length],
      root: 220 * Math.pow(2, (index % 5) / 12),
      next: 2 + Math.random() * 8
    };
    emitters.push(em);
    return em;
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
  function setupJukebox(pos) {
    musicEl = new Audio();
    musicEl.preload = 'auto';
    musicEl.addEventListener('ended', () => api.nextTrack(false));
    const src = ctx.createMediaElementSource(musicEl);
    const g = ctx.createGain();
    g.gain.value = 0.55;
    const panner = makePanner(pos, { ref: 5, rolloff: 0.7 });
    src.connect(g).connect(panner).connect(indoorIn);
    jukebox = { panner };
    loadTrack();
  }

  function loadTrack() {
    musicEl.src = encodeURI(PLAYLIST[trackIndex].src);
  }

  function playMusic() {
    if (!musicEl || muted) return;
    const p = musicEl.play();
    if (p && p.catch) p.catch(() => {});
    musicStarted = true;
  }

  // ── Mixing per mode ────────────────────────────────────────────────────
  function applyMode() {
    if (!ctx) return;
    clearTimeout(suspendTimer);
    const level = muted ? 0 : { intro: 0, explore: 1, paused: 0.3, launching: 0.6, playing: 0 }[mode];
    ramp(master.gain, level, mode === 'playing' ? 0.25 : 0.4);
    if (mode === 'launching') {
      // the room drains away as you lean into the screen
      ramp(indoorIn.gain, 0.15, 0.7);
      ramp(outdoorIn.gain, 0.1, 0.7);
    }
    if (mode === 'playing' || muted) {
      if (musicEl) musicEl.pause();
      // Glitch Pong has its own audio; put the arcade to sleep entirely.
      if (mode === 'playing') suspendTimer = setTimeout(() => ctx.suspend().catch(() => {}), 400);
    } else if (mode === 'explore' || mode === 'paused') {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (musicEl && musicEl.paused) playMusic();
    }
  }

  const api = {
    onTrack: null,              // called with the new title when the jukebox changes track
    get muted() { return muted; },
    get ready() { return !!ctx; },
    get trackTitle() { return PLAYLIST[trackIndex].title; },
    // debugging / tests
    get contextState() { return ctx ? ctx.state : 'none'; },
    get musicPlaying() { return !!musicEl && !musicEl.paused; },
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
    unlock(world) {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          return;
        }
        buildGraph();
        decodeSfx();
        if (world) {
          signEmitter = buzzEmitter(world.signPos);
          signEmitter.pos = world.signPos;
          curtainEmitter(world.doorPos);
          world.soonCabinets.forEach((cab, i) => cabinetEmitter(cab, i));
          gpEmitter = { pos: world.gpScreen };
          setupJukebox(world.jukeboxPos);
          jukebox.pos = world.jukeboxPos;
        }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!musicStarted) playMusic();
    },

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

    nextTrack(announce = true) {
      if (!musicEl) return null;
      trackIndex = (trackIndex + 1) % PLAYLIST.length;
      loadTrack();
      if (api.onTrack) api.onTrack(PLAYLIST[trackIndex].title);
      if (mode === 'explore' || mode === 'paused') playMusic();
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
    eyeHit() { play('pulse', { volume: 0.35, rate: 1.3 }); },
    attract(event) {
      if (!gpEmitter || mode !== 'explore') return;
      const key = event === 'paddle' ? 'paddle' : event === 'wall' ? 'wall' : 'score';
      play(key, { volume: event === 'score' ? 0.3 : 0.18, at: gpEmitter.pos, bus: 'indoor', ref: 1.4, rolloff: 1.3 });
    }
  };

  return api;
}
