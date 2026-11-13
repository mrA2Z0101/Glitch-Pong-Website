// ============ BREAKPOINT — streamed soundtrack + procedural SFX ============
'use strict';

const AudioSys = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let volume = 0.7, started = false, muted = false;
  // Stream only the current song; decoding every two-minute track would use
  // hundreds of MB on phones. Both takes alternate when a song finishes.
  // Which recordings each theme plays is in js/config.js (MUSIC).
  const TRACKS = MUSIC;
  const trackUrl = (file) => (file.includes('/') ? file : 'sounds/music/' + file) + '.mp3';
  const takes = {};
  const positions = {};
  const EVENT_THEMES = {
    memoryLeak: 'memory', packetLoss: 'memory',
    systemError: 'virus', kernelPanic: 'virus', firewallOn: 'virus',
    timeFreeze: 'nexus', lagSpike: 'nexus', quantumShift: 'nexus',
    dataSurge: 'sector', overclock: 'sector',
  };
  const EVENT_FX = {
    systemError:  { rate: 0.96, cutoff: 3200, pulse: 0.18, pan: 0.3, hz: 7 },
    packetLoss:   { rate: 1, cutoff: 7000, pulse: 0.32 },
    timeFreeze:   { rate: 0.55, cutoff: 1400, echo: 0.12 },
    memoryLeak:   { rate: 0.93, cutoff: 4800, echo: 0.22, pan: 0.18, hz: 0.7 },
    kernelPanic:  { rate: 0.72, cutoff: 900, pulse: 0.12, pan: 0.35, hz: 11 },
    dataSurge:    { rate: 1.12, cutoff: 18000 },
    firewallOn:   { rate: 0.98, cutoff: 2200 },
    lagSpike:     { rate: 0.72, cutoff: 4000, pulse: 0.5 },
    overclock:    { rate: 1.22, cutoff: 18000 },
    quantumShift: { rate: 1.04, cutoff: 6500, pan: 0.65, hz: 9, echo: 0.12 },
  };
  let musicEl = null, musicKey = null, baseMusicKey = null, wantedMusicKey = null;
  let playRequest = 0, loadRequest = 0, swapVersion = 0;
  let swapTimer = null, fxTimer = null, musicEvent = null;
  let musicBus, musicFilter, musicPan, eventGain, fadeGain, echoGain;
  const paramTargets = new WeakMap();
  const failedTracks = new Set();

  // music scheduler state
  let mTimer = null, step = 0, arena = ARENAS[0], glitchAmt = 0;
  const MINOR = [0, 2, 3, 5, 7, 8, 10, 12];   // natural minor
  const ARP_PATTERNS = [
    [0, 3, 5, 7, 5, 3, 7, 12],
    [0, 7, 3, 7, 5, 7, 12, 7],
    [12, 7, 5, 3, 0, 3, 5, 7],
    [0, 5, 7, 12, 7, 5, 3, 2],
  ];
  let arpPat = ARP_PATTERNS[0];

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (started && !muted && musicEl.paused && !mTimer) playTrack();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    // Process both the recordings and synth fallback, leaving SFX/voice clear.
    musicBus = ctx.createGain();
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000; musicFilter.Q.value = 0.5;
    eventGain = ctx.createGain();
    fadeGain = ctx.createGain(); fadeGain.gain.value = 0;
    musicPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const spatial = musicPan || eventGain;
    musicBus.connect(musicFilter); musicFilter.connect(spatial);
    const echo = ctx.createDelay(0.5); echo.delayTime.value = 0.22;
    echoGain = ctx.createGain(); echoGain.gain.value = 0;
    musicFilter.connect(echo); echo.connect(echoGain); echoGain.connect(spatial);
    if (musicPan) musicPan.connect(eventGain);
    eventGain.connect(fadeGain); fadeGain.connect(musicGain);
    musicEl = new Audio();
    musicEl.preload = 'none';
    musicEl.preservesPitch = false;
    if ('webkitPreservesPitch' in musicEl) musicEl.webkitPreservesPitch = false;
    ctx.createMediaElementSource(musicEl).connect(musicBus);
    musicEl.addEventListener('ended', () => {
      if (!started) return;
      takes[musicKey] = ((takes[musicKey] || 0) + 1) % TRACKS[musicKey].length;
      delete positions[musicKey];
      if (!swapTimer) loadTrack();
    });
    musicEl.addEventListener('error', () => { if (musicEl.error) trackFailed(); });
    loadClips();
  }

  // ---- recorded clips: Glitch Pong's countdown voice ----
  // Loaded once the AudioContext exists. Opening index.html straight from disk
  // can't fetch them, so countdown() falls back to synth beeps.
  const CLIP_FILES = { '3': 'sounds/sfx/3.mp3', '2': 'sounds/sfx/2.mp3', '1': 'sounds/sfx/1.mp3', GO: 'sounds/sfx/GO.mp3' };
  const clips = {};
  function loadClips() {
    for (const [k, url] of Object.entries(CLIP_FILES)) {
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
        .then(buf => ctx.decodeAudioData(buf))
        .then(b => { clips[k] = b; })
        .catch(() => {});
    }
  }
  function countdown(key) {
    if (!ctx) return;
    const b = clips[key];
    if (b) {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      g.gain.value = 0.85;
      src.buffer = b; src.connect(g); g.connect(sfxGain);
      src.start();
      return;
    }
    if (key === 'GO') { tone(660, 0.12, { vol: 0.2 }); tone(990, 0.3, { vol: 0.2, when: 0.1 }); }
    else tone(440, 0.14, { vol: 0.2 });
  }
  function setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; }
  // silence everything (attract-mode demo) without disturbing the saved volume
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; }

  // ---- primitive voices ----
  function tone(freq, dur, { type = 'square', vol = 0.2, attack = 0.002, slide = 0, out = sfxGain, when = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.25, freq = 1200, q = 1, when = 0, out = sfxGain } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t);
  }

  // ---- sound effects ----
  const SFX = {
    paddle:  (p = 0.5) => tone(220 + p * 220, 0.08, { type: 'square', vol: 0.18 }),
    wall:    () => tone(160, 0.05, { type: 'square', vol: 0.10 }),
    brick:   (pitch = 0) => { tone(440 + pitch * 60, 0.09, { type: 'square', vol: 0.16 }); noise(0.05, { vol: 0.08, freq: 3000 }); },
    heavy:   () => { tone(180, 0.07, { type: 'sawtooth', vol: 0.18 }); noise(0.04, { vol: 0.1, freq: 900 }); },
    explode: () => { noise(0.35, { vol: 0.4, freq: 500, q: 0.6 }); tone(90, 0.3, { type: 'sawtooth', vol: 0.25, slide: -60 }); },
    laser:   () => tone(1400, 0.09, { type: 'sawtooth', vol: 0.12, slide: -900 }),
    powerup: () => { tone(523, 0.07, { vol: 0.14 }); tone(659, 0.07, { vol: 0.14, when: 0.06 }); tone(880, 0.12, { vol: 0.16, when: 0.12 }); },
    powerdn: () => { tone(400, 0.1, { vol: 0.12 }); tone(300, 0.14, { vol: 0.12, when: 0.08 }); },
    life:    () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { vol: 0.15, when: i * 0.07 })); },
    lose:    () => { tone(300, 0.5, { type: 'sawtooth', vol: 0.25, slide: -240 }); noise(0.4, { vol: 0.2, freq: 300, q: 0.7 }); },
    event:   () => { for (let i = 0; i < 7; i++) tone(rand(200, 1800), 0.04, { type: 'square', vol: 0.12, when: i * 0.035 }); },
    bosshit: () => { tone(110, 0.12, { type: 'sawtooth', vol: 0.25 }); noise(0.08, { vol: 0.15, freq: 700 }); },
    bossdie: () => { noise(0.8, { vol: 0.45, freq: 400, q: 0.5 }); [60, 90, 45].forEach((f, i) => tone(f, 0.5, { type: 'sawtooth', vol: 0.3, when: i * 0.12, slide: -20 })); },
    emp:     () => { tone(2000, 0.5, { type: 'sawtooth', vol: 0.2, slide: -1900 }); noise(0.5, { vol: 0.3, freq: 1000, q: 0.4 }); },
    freeze:  () => { [1200, 900, 700, 500].forEach((f, i) => tone(f, 0.15, { type: 'sine', vol: 0.12, when: i * 0.05 })); },
    teleport:() => { tone(600, 0.12, { type: 'sine', vol: 0.12, slide: 700 }); },
    click:   () => tone(700, 0.04, { type: 'square', vol: 0.08 }),
    achieve: () => { [659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.12, { vol: 0.13, when: i * 0.08 })); },
    enemyDie:() => { noise(0.15, { vol: 0.2, freq: 1500 }); tone(500, 0.1, { type: 'square', vol: 0.12, slide: -300 }); },
  };
  function sfx(name, arg) { if (ctx && SFX[name]) SFX[name](arg); }

  // ---- music loop (16th-note scheduler) ----
  function musicStep() {
    if (!ctx || !started) return;
    const beat = 60 / arena.tempo / 4; // 16th
    const root = arena.root;
    const s = step % 64;

    // kick on quarters
    if (s % 4 === 0) tone(120, 0.16, { type: 'sine', vol: 0.5, slide: -80, out: musicBus });
    // snare-ish noise on 2 & 4
    if (s % 8 === 4) noise(0.09, { vol: 0.12, freq: 2200, q: 0.8, out: musicBus });
    // bass: root/oct pattern, changes chord every 16 steps
    const chordDeg = [0, 0, 5, 3][Math.floor(s / 16)];
    const bassF = root * Math.pow(2, MINOR[chordDeg] / 12);
    if (s % 2 === 0) tone(bassF * (s % 8 === 6 ? 2 : 1), beat * 1.8, { type: 'sawtooth', vol: 0.14, out: musicBus });
    // arpeggio (2 octaves up)
    const deg = arpPat[s % 8];
    const arpF = root * 4 * Math.pow(2, (MINOR[chordDeg] + deg) / 12);
    const detune = glitchAmt > 0.5 && chance(0.3) ? rand(0.94, 1.07) : 1;
    tone(arpF * detune, beat * 0.9, { type: 'square', vol: 0.055, out: musicBus });
    // sparkle
    if (s % 16 === 14) tone(arpF * 2, beat * 2, { type: 'sine', vol: 0.05, out: musicBus });
    // glitch stutter
    if (glitchAmt > 0.7 && chance(0.06)) for (let i = 0; i < 3; i++) tone(rand(300, 2400), 0.03, { vol: 0.06, when: i * 0.03, out: musicBus });

    step++;
    mTimer = setTimeout(musicStep, beat * 1000);
  }
  function playTrack() {
    if (!started || muted) return;
    const request = ++playRequest;
    musicEl.play().then(() => {
      if (request !== playRequest || !started || swapTimer || musicKey !== wantedMusicKey) return;
      updateMusicFX();
      rampParam(fadeGain.gain, 1, 0.28);
    }).catch(error => {
      if (request !== playRequest || !started) return;
      // A later gesture retries autoplay restrictions; missing media falls back
      // to the original synth instead of leaving the game silent.
      if (error.name === 'NotSupportedError') trackFailed();
    });
  }
  function loadTrack() {
    playRequest++;
    const request = ++loadRequest;
    musicEl.pause();
    rampParam(fadeGain.gain, 0, 0);
    const file = TRACKS[musicKey][takes[musicKey] || 0];
    const position = positions[musicKey] || 0;
    musicEl.onloadedmetadata = () => {
      if (request !== loadRequest || !started) return;
      if (position > 0 && position < musicEl.duration - 0.1) musicEl.currentTime = position;
      updateMusicFX();
    };
    musicEl.src = trackUrl(file);
    playTrack();
  }
  function trackFailed() {
    if (!started || !musicKey || mTimer) return;
    const file = TRACKS[musicKey][takes[musicKey] || 0];
    failedTracks.add(file);
    const next = TRACKS[musicKey].findIndex(track => !failedTracks.has(track));
    if (next >= 0) { takes[musicKey] = next; delete positions[musicKey]; loadTrack(); return; }
    step = 0;
    rampParam(fadeGain.gain, 1, 0.2);
    musicStep();
  }

  function rampParam(param, value, duration = 0.04) {
    if (duration && paramTargets.get(param) === value) return;
    paramTargets.set(param, value);
    const t = ctx.currentTime, current = param.value;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else param.cancelScheduledValues(t);
    param.setValueAtTime(current, t);
    if (duration) param.linearRampToValueAtTime(value, t + duration);
    else param.setValueAtTime(value, t);
  }

  function updateMusicFX() {
    if (!ctx) return;
    const fx = EVENT_FX[musicEvent] || {};
    const t = ctx.currentTime;
    const warp = glitchAmt > 0.5 ? Math.sin(t * 7) * glitchAmt * 0.014 : 0;
    const rate = (fx.rate || 1) * (1 + warp);
    if (musicEl.defaultPlaybackRate !== rate) musicEl.defaultPlaybackRate = rate;
    if (musicEl.playbackRate !== rate) musicEl.playbackRate = rate;
    rampParam(musicFilter.frequency, Math.min(fx.cutoff || 18000, 18000 - glitchAmt * 11000), 0.1);
    rampParam(echoGain.gain, fx.echo || 0, 0.12);
    if (musicPan) rampParam(musicPan.pan, (fx.pan || 0) * Math.sin(t * (fx.hz || 1) * Math.PI * 2));
    // Short, smoothed dropouts follow packet/lag faults and high corruption.
    const pulse = fx.pulse || (glitchAmt > 0.7 ? 0.7 : 0);
    const lost = pulse && t % pulse < pulse * 0.25;
    rampParam(eventGain.gain, lost ? (fx.pulse ? 0.08 : 0.65) : 1, 0.015);
  }

  function fxStep() {
    if (!started) return;
    updateMusicFX();
    fxTimer = setTimeout(fxStep, 50);
  }

  function desiredTheme() {
    return baseMusicKey === 'eye' ? 'eye' : EVENT_THEMES[musicEvent] || baseMusicKey;
  }

  function changeTheme(key) {
    if (!started || key === wantedMusicKey) return;
    wantedMusicKey = key;
    const request = ++swapVersion;
    clearTimeout(swapTimer); swapTimer = null;
    if (key === musicKey) { rampParam(fadeGain.gain, 1, 0.2); return; }
    const swap = () => {
      swapTimer = null;
      if (!started || request !== swapVersion) return;
      if (musicKey && !mTimer && !musicEl.ended && Number.isFinite(musicEl.currentTime)) positions[musicKey] = musicEl.currentTime;
      if (mTimer) clearTimeout(mTimer);
      mTimer = null;
      musicKey = key;
      loadTrack();
    };
    if (!musicKey) swap();
    else {
      rampParam(fadeGain.gain, 0, 0.12);
      swapTimer = setTimeout(swap, 140);
    }
  }

  function startMusic(arenaIdx, eyeBoss = false) {
    if (!ctx || muted) return; // the menu's attract game stays silent
    arena = ARENAS[arenaIdx % ARENAS.length];
    arpPat = ARP_PATTERNS[arenaIdx % ARP_PATTERNS.length];
    baseMusicKey = eyeBoss ? 'eye' : TRACKS[arena.music] ? arena.music : 'sector';
    musicEvent = null;
    started = true;
    changeTheme(desiredTheme());
    if (!fxTimer) fxStep();
    else updateMusicFX();
  }
  function stopMusic() {
    started = false;
    playRequest++; loadRequest++; swapVersion++;
    if (mTimer) clearTimeout(mTimer);
    clearTimeout(fxTimer); clearTimeout(swapTimer);
    mTimer = fxTimer = swapTimer = null;
    if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; }
    musicKey = baseMusicKey = wantedMusicKey = musicEvent = null;
    glitchAmt = 0;
    for (const key of Object.keys(positions)) delete positions[key];
    if (ctx) { updateMusicFX(); rampParam(fadeGain.gain, 0, 0); }
  }
  // The page went to the background (or came back): stop the music and the audio
  // engine rather than keep them running for nobody.
  function setHidden(h) {
    if (!ctx) return;
    if (h) {
      if (musicEl) musicEl.pause();
      ctx.suspend().catch(() => {});
    } else {
      ctx.resume().catch(() => {});
      if (started && !muted && musicEl && musicEl.paused) musicEl.play().catch(() => {});
    }
  }
  function setGlitch(a) { glitchAmt = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0; }
  function setEvent(id) {
    musicEvent = EVENT_THEMES[id] ? id : null;
    if (!started) return;
    updateMusicFX();
    changeTheme(desiredTheme());
  }

  return { init, setVolume, setMuted, sfx, countdown, startMusic, stopMusic, setGlitch, setEvent, setHidden,
    get musicState() {
      return { theme: musicKey, desiredTheme: wantedMusicKey, event: musicEvent,
        rate: musicEl?.playbackRate || 1, cutoff: musicFilter?.frequency.value,
        pulse: eventGain?.gain.value, echo: echoGain?.gain.value, pan: musicPan?.pan.value || 0 };
    },
  };
})();
