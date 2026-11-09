// ============ BREAKPOINT — streamed soundtrack + procedural SFX ============
'use strict';

const AudioSys = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let volume = 0.7, started = false, muted = false;
  // Stream only the current song; decoding every two-minute track would use
  // hundreds of MB on phones. Both takes alternate when a song finishes.
  const TRACKS = {
    sector: ['sector-zero-1', 'sector-zero-2'],
    memory: ['ghosts-in-the-memory-1', 'ghosts-in-the-memory-2'],
    virus: ['infection-protocol-1', 'infection-protocol-2'],
    nexus: ['event-horizon-1', 'event-horizon-2'],
    eye: ['do-not-blink-1', 'do-not-blink-2'],
  };
  const takes = {};
  let musicEl = null, musicKey = null, playRequest = 0;
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
    musicEl = new Audio();
    musicEl.preload = 'none';
    ctx.createMediaElementSource(musicEl).connect(musicGain);
    musicEl.addEventListener('ended', () => {
      if (!started) return;
      takes[musicKey] = ((takes[musicKey] || 0) + 1) % TRACKS[musicKey].length;
      loadTrack();
    });
    musicEl.addEventListener('error', trackFailed);
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
    if (!ctx) return;
    const beat = 60 / arena.tempo / 4; // 16th
    const root = arena.root;
    const s = step % 64;

    // kick on quarters
    if (s % 4 === 0) tone(120, 0.16, { type: 'sine', vol: 0.5, slide: -80, out: musicGain });
    // snare-ish noise on 2 & 4
    if (s % 8 === 4) noise(0.09, { vol: 0.12, freq: 2200, q: 0.8, out: musicGain });
    // bass: root/oct pattern, changes chord every 16 steps
    const chordDeg = [0, 0, 5, 3][Math.floor(s / 16)];
    const bassF = root * Math.pow(2, MINOR[chordDeg] / 12);
    if (s % 2 === 0) tone(bassF * (s % 8 === 6 ? 2 : 1), beat * 1.8, { type: 'sawtooth', vol: 0.14, out: musicGain });
    // arpeggio (2 octaves up)
    const deg = arpPat[s % 8];
    const arpF = root * 4 * Math.pow(2, (MINOR[chordDeg] + deg) / 12);
    const detune = glitchAmt > 0.5 && chance(0.3) ? rand(0.94, 1.07) : 1;
    tone(arpF * detune, beat * 0.9, { type: 'square', vol: 0.055, out: musicGain });
    // sparkle
    if (s % 16 === 14) tone(arpF * 2, beat * 2, { type: 'sine', vol: 0.05, out: musicGain });
    // glitch stutter
    if (glitchAmt > 0.7 && chance(0.06)) for (let i = 0; i < 3; i++) tone(rand(300, 2400), 0.03, { vol: 0.06, when: i * 0.03, out: musicGain });

    step++;
    mTimer = setTimeout(musicStep, beat * 1000);
  }
  function playTrack() {
    if (!started || muted) return;
    const request = ++playRequest;
    musicEl.play().catch(error => {
      if (request !== playRequest || !started) return;
      // A later gesture retries autoplay restrictions; missing media falls back
      // to the original synth instead of leaving the game silent.
      if (error.name === 'NotSupportedError') trackFailed();
    });
  }
  function loadTrack() {
    playRequest++;
    musicEl.pause();
    const file = TRACKS[musicKey][takes[musicKey] || 0];
    musicEl.src = `sounds/music/${file}.mp3`;
    playTrack();
  }
  function trackFailed() {
    if (!started || !musicKey || mTimer) return;
    const file = TRACKS[musicKey][takes[musicKey] || 0];
    failedTracks.add(file);
    const next = TRACKS[musicKey].findIndex(track => !failedTracks.has(track));
    if (next >= 0) { takes[musicKey] = next; loadTrack(); return; }
    step = 0;
    musicStep();
  }
  function startMusic(arenaIdx, eyeBoss = false) {
    if (!ctx || muted) return; // the menu's attract game stays silent
    arena = ARENAS[arenaIdx % ARENAS.length];
    arpPat = ARP_PATTERNS[arenaIdx % ARP_PATTERNS.length];
    const key = eyeBoss ? 'eye'
      : ['MEMORY LEAK', 'DIGITAL CATHEDRAL'].includes(arena.name) ? 'memory'
      : ['VIRUS HIVE', 'CORRUPTED BIOS'].includes(arena.name) ? 'virus'
      : arena.name === 'BLACK HOLE NEXUS' ? 'nexus' : 'sector';
    if (started && musicKey === key) return; // don't restart on each sector
    stopMusic();
    started = true;
    musicKey = key;
    loadTrack();
  }
  function stopMusic() {
    started = false;
    playRequest++;
    if (mTimer) clearTimeout(mTimer);
    mTimer = null;
    if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; }
    musicKey = null;
  }
  function setGlitch(a) { glitchAmt = a; }

  return { init, setVolume, setMuted, sfx, countdown, startMusic, stopMusic, setGlitch };
})();
