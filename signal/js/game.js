// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL LOST — the page: drawing, sound, controls, menus, and the two voices.
//
// js/rules.js decides everything that happens in a run and hands back a list
// of events; this file turns the run into a picture and the events into
// sound, sparks, coins and things the static says. Nothing in here changes
// the rules, so what the tests measure is what you play.
// ═══════════════════════════════════════════════════════════════════════════
import {
  TUNE, W, H, DIRS, CHASERS, WALL, DOOR, PAD_SIDES, mazeSpec,
  createRun, step, botInput, continueRun, heatMultiplier, pos, xy, idx, runRecap, recordRun
} from './rules.js';
import { STATIC_LINES, BALL_LINES, EXIT_FLICKER, AWAY_TITLE, pick } from './voice.js';
import { Wallet, Save, Cabinet, Look, otherCabinets } from './wallet.js';
import { createAudio } from './audio.js';
import { TAU, roundRect, light, tube, glass, comet, sparks, brackets, createBloom, seeded } from './neon.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const wrap = $('wrap');
const stage = $('stage');
const IS_TOUCH = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
document.body.classList.toggle('touch', IS_TOUCH);

// glitchcade-power.js is shared with the arcade; the stub keeps this page
// working when it is opened on its own without it.
const Power = window.GlitchPower || {
  saving: false, state: 'off', batterySaver: false, setBatterySaver() { return false; }, onChange() {},
  createPacer: () => ({ due: () => true, reset() {} }), fpsFor: () => Infinity
};
const audio = createAudio();
const save = Save.data;
if (Save.fresh && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) save.fx = false;
const fxFull = () => save.fx;

// ── colours (the Glitch Pong set) ──
const C = { cyan: '#71efff', pink: '#ff58d9', purple: '#9a5dff', amber: '#ffd27a', red: '#ff4d6d', green: '#50fa7b', text: '#eef7ff', void: '#03040a' };
// each maze is one of Glitch Pong's arenas, and its walls take that arena's colour
const WALLS = {
  standard: C.cyan, overflow: C.green, panic: '#ff7a8a', coolant: '#cfe8ff', portal: C.purple,
  leak: C.amber, echo: C.pink, defrag: C.green, train: '#ff9a3d', lair: C.purple
};
const TS = 27;                        // a tile, in pixels at the design size

// ── the Eye's sprites: Glitch Pong's ──
const eyeImg = {};
for (const [k, src] of Object.entries({
  neutral: '../assets/boss_eye_neutral.png', left: '../assets/boss_eye_left.png', right: '../assets/boss_eye_right.png'
})) { const im = new Image(); im.src = src; eyeImg[k] = im; }
const ready = (im) => im && im.complete && im.naturalWidth > 0;

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT — one design size per orientation, scaled to the window
// ═══════════════════════════════════════════════════════════════════════════
let LW = 960, LH = 704, cx = 480, cy = 322, ox = 0, oy = 0, ratio = 1, glowK = 1;
const dark = document.createElement('canvas');
const dctx = dark.getContext('2d');
const walls = document.createElement('canvas');      // the maze's walls, drawn once and kept
const wctx = walls.getContext('2d');
let wallsFor = '';

function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vh > vw * 1.08;
  document.body.classList.toggle('portrait', portrait);
  LW = portrait ? 640 : 960;
  LH = portrait ? 820 : 704;
  // the maze sits at the top; the strip under it is the static's, so its line never covers the game
  cx = LW / 2; cy = portrait ? 330 : 322;
  ox = cx - (W * TS) / 2; oy = cy - (H * TS) / 2;
  wrap.style.width = (LW + 20) + 'px';
  canvas.style.aspectRatio = `${LW} / ${LH}`;
  wrap.style.transform = 'none';
  // touch: a pad to steer with. A phone held upright has height to spare, so the
  // screen grows downward and the controls sit under the maze, not on it.
  const padOn = IS_TOUCH && save.pad !== 'off';
  if (portrait && padOn) {
    const chrome = wrap.offsetHeight - canvas.offsetHeight;
    LH = Math.max(900, Math.min(1010, Math.floor(wrap.offsetWidth * vh / vw) - chrome));
    canvas.style.aspectRatio = `${LW} / ${LH}`;
  }
  let padSize = portrait ? Math.max(170, Math.min(250, LH - cy - (H * TS) / 2 - 116)) : 178, padX = 14, padY = 14;
  for (const side of PAD_SIDES) document.body.classList.toggle('pad-' + side, IS_TOUCH && save.pad === side);
  const scale = Math.min(vw / wrap.offsetWidth, vh / wrap.offsetHeight, IS_TOUCH ? 3 : 1.7) * 0.985;
  wrap.style.transform = `scale(${scale})`;
  if (IS_TOUCH && !portrait) {
    // On its side a phone shows the cabinet small, with empty glass either side of it.
    // The controls are sized for a thumb, not for the cabinet, and go out into that space.
    const r = stage.getBoundingClientRect(), real = Math.max(104, Math.min(168, vh * 0.4));
    padSize = real / scale;
    if (r.left >= real + 12) { padX = ((r.left - real) / 2 - r.left) / scale; padY = (r.bottom - (vh - 10)) / scale; }
    else padX = (8 - r.left) / scale;
  }
  stage.style.setProperty('--pad', padSize + 'px');
  stage.style.setProperty('--dash', (padOn ? Math.round(padSize * 0.74) : portrait ? 112 : Math.round(padSize * 0.9)) + 'px');
  stage.style.setProperty('--pad-x', padX + 'px');
  stage.style.setProperty('--pad-y', padY + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, Power.saving ? 1 : 2);
  ratio = Math.max(0.5, Math.min(3, scale * dpr));
  canvas.width = Math.round(LW * ratio);
  canvas.height = Math.round(LH * ratio);
  dark.width = Math.round(LW / 2); dark.height = Math.round(LH / 2);
  glowK = Power.saving ? 0.3 : IS_TOUCH ? 0.7 : 1;
  wallsFor = '';
  document.body.classList.toggle('saver', Power.saving);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);
Power.onChange(() => { layout(); refreshSettings(); });

const glow = (color, blur) => { ctx.shadowColor = color; ctx.shadowBlur = blur * glowK; };
const noGlow = () => { ctx.shadowBlur = 0; };
const tx = (x) => ox + (x + 0.5) * TS;
const ty = (y) => oy + (y + 0.5) * TS;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════
const STEP = 1 / 120;
let mode = 'menu';                 // menu | play | pause | won | over
let run = null;                    // your run
let attract = createRun();         // the bot's, behind the menu
let view = attract;                // the one being drawn
const input = { dir: -1, dash: false, kind: IS_TOUCH ? 'touch' : 'key' };
let botHold = { dir: -1, dash: false }, botTick = 0;
let acc = 0, last = performance.now(), clock = 0;
let noSignalThisRun = false, wallSaid = false, pausedAt = 0, pauseNagged = false, awayAt = 0, autoPaused = false, menuT = 0, menuSaid = 0;
let settingsFrom = 'scrMenu';

function newFx() {
  return { parts: [], floats: [], trail: [], shake: 0, glitch: 0, flash: 0, panic: 0, banner: null, jam: 0, ours: 0, bubble: null, count: 0 };
}
let fx = newFx();

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO VOICES
// ═══════════════════════════════════════════════════════════════════════════
// What the game knows right now: the static's lines are picked and filled from this.
function context(extra) {
  const s = run;
  const live = s && mode !== 'over';
  return Object.assign({
    runs: save.runs, next: save.runs + 1,
    caughtBy: save.caughtBy + (live ? s.stats.caughtBy : 0),
    catches: save.catches + (live ? s.stats.catches : 0),
    best: save.best, restored: save.restored, coins: Wallet.get().coins, hour: new Date().getHours(),
    input: input.kind, cabinet: Cabinet.active,
    maze: s ? s.n : 1, balls: s ? s.balls : 0, away: 0, name: ''
  }, otherCabinets(), extra);
}

const Static = {
  el: $('nullLine'), text: $('nullText'),
  line: '', shown: 0, hold: 0, next: null, used: new Set(),
  // force: say it now, over whatever is on the line. chance: say it only sometimes.
  say(event, extra, o = {}) {
    if (!save.talk && event !== 'talkOff') return;
    if (o.chance !== undefined && Math.random() > o.chance) return;
    const line = pick(STATIC_LINES, event, context(extra), Math.random, this.used);
    if (!line) return;
    if (o.force || !this.line) this.start(line);
    else this.next = line;            // one line waits; anything more is dropped
  },
  start(line) {
    this.line = line; this.shown = 0; this.next = null;
    this.hold = 2.4 + line.length * 0.035;
    this.el.classList.add('on');
  },
  clear() { this.line = ''; this.next = null; this.el.classList.remove('on'); },
  update(dt) {
    if (!this.line) return;
    if (this.shown < this.line.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.line.length, this.shown + dt * 46);
      if (Math.floor(this.shown / 3) !== Math.floor(before / 3)) audio.sfx('type');
      this.text.textContent = this.line.slice(0, Math.floor(this.shown));
      return;
    }
    this.hold -= dt;
    if (this.hold <= 0) {
      if (this.next) this.start(this.next);
      else this.clear();
    }
  }
};

// the ball's lines: small, lower case, next to it
const ballUsed = new Set();
function ballSay(event, chance = 1) {
  if (!save.moods || view !== run || Math.random() > chance) return;
  const line = pick(BALL_LINES, event, {}, Math.random, ballUsed);
  if (line) fx.bubble = { text: line, t: 2.6 };
}
const nameOf = (id) => { const c = CHASERS.find((k) => k.id === id); return c ? c.name : ''; };

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS — what the rules said happened, turned into everything you notice
// ═══════════════════════════════════════════════════════════════════════════
function burst(x, y, color, n, speed = 140, life = 0.6) {
  if (Power.saving) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: 2 + Math.random() * 3 });
  }
  // anything big enough goes off with a ring of light
  if (n >= 10) fx.parts.push({ x, y, vx: 0, vy: 0, life: life * 0.7, max: life * 0.7, color, size: 0, ring: 12 + speed * 0.16 });
}
function float(x, y, text, color, size = 18) { fx.floats.push({ x, y, text, color, size, life: 0.9 }); }
function banner(title, sub, line, dur, legend) { fx.banner = { title, sub, line, t: dur, dur, legend }; }
const pad2 = (n) => String(n).padStart(2, '0');

function handle(s, live) {
  for (const e of s.events) onEvent(s, e, live);
  s.events.length = 0;
}

function onEvent(s, e, live) {
  const x = e.x !== undefined ? tx(e.x) : cx, y = e.y !== undefined ? ty(e.y) : cy;
  const snd = (name, ...a) => { if (live) audio.sfx(name, ...a); };
  switch (e.type) {
    case 'maze': {
      fx.count = 0; fx.trail = [];
      // the first maze shows how each of the four hunts
      banner(`MAZE ${pad2(e.n)}`, s.maze.name, mazeLine(s), TUNE.INTRO, e.n === 1);
      if (!live) break;
      audio.music(e.rule);
      if (e.n === 1) { Static.say('runStart', null, { force: true }); ballSay('runStart', 0.7); }
      else Static.say('maze_' + e.rule, null, { force: true });
      if (fxFull() && save.talk && ((e.n === 3 && !save.noSignalSeen) || (e.n > 3 && !noSignalThisRun && Math.random() < 0.06))) startNoSignal();
      break;
    }
    case 'go': if (live) audio.countdown('GO'); break;
    case 'packet':
      snd('packet', e.chain);
      if (live && e.chain === 40) ballSay('showoff', 0.7);
      break;
    case 'override':
      snd('override');
      fx.flash = 0.12; fx.panic = 0.6;
      if (live) { Static.say('override', null, { chance: 0.5 }); ballSay('override', 0.5); }
      break;
    case 'catch': {
      const c = CHASERS.find((k) => k.id === e.id);
      snd('catch', s.caught);
      burst(x, y, c.color, 22, 200, 0.6);
      float(x, y - 12, (e.grudge ? 'GRUDGE +' : '+') + e.pts, e.grudge ? C.amber : C.text, 22);
      if (live) {
        if (e.grudge) { Static.say('catchGrudge', null, { force: true }); ballSay('catchGrudge'); }
        else Static.say('catch', { name: c.name }, { chance: 0.35 });
      }
      break;
    }
    case 'closeCall':
      snd('close');
      float(x, y - 14, 'CLOSE +' + e.pts, C.amber, 15);
      if (live) Static.say('closeCall', null, { chance: 0.08 });
      break;
    case 'dash': snd('dash'); break;
    case 'release':
      snd('release');
      if (live) Static.say('release', { name: nameOf(e.id) }, { chance: 0.12 });
      break;
    case 'ballLost': {
      snd('lost');
      burst(x, y, Look.hex, 34, 240, 0.9);
      fx.shake = 0.6; fx.glitch = 0.5; fx.flash = 0.3; fx.trail = [];
      if (!live) break;
      if (e.cause === 'static' && save.talk) fx.ours = 2;
      if (e.balls > 0) {
        if (e.cause === 'static') Static.say('caught', { name: nameOf(e.by) }, { force: true });
        else Static.say(e.cause === 'echo' ? 'ballEcho' : e.cause === 'gaze' ? 'ballGaze' : 'ballTrain', null, { force: true });
      }
      break;
    }
    case 'respawn': fx.trail = []; if (live) ballSay('respawn', 0.7); break;
    case 'loyal':
      snd('loyal');
      burst(x, y, C.text, 20, 220);
      float(x, y - 16, 'LOYAL', C.text, 22);
      fx.shake = 0.3;
      if (live) { ballSay('loyal'); Static.say('loyal', null, { force: true }); }
      break;
    case 'heatCritical':
      float(cx, cy - 150, 'CRITICAL HEAT', C.pink, 34);
      fx.glitch = 0.4;
      if (live) { audio.sfx('warn'); if (save.talk) fx.jam = 2.5; Static.say('heatCritical'); ballSay('critical', 0.4); }
      break;
    case 'eyeArrive':
      snd('eye');
      float(cx, cy - 150, 'THE EYE', C.purple, 40);
      fx.glitch = 0.5; fx.shake = 0.3;
      if (live) { audio.music('eye'); Static.say('eyeArrive', null, { force: true }); ballSay('eye', 0.6); }
      break;
    case 'eyeSurvived':
      snd('clear');
      float(cx, cy - 150, 'IT HAS GONE  +' + e.pts, C.cyan, 28);
      if (live) { audio.music(s.maze.rule); Static.say('eyeSurvived', null, { force: true }); ballSay('eyeSurvived', 0.6); }
      break;
    case 'lineWarn': snd('warn'); break;
    case 'lineFire':
      snd(e.cause === 'train' ? 'train' : 'fire');
      fx.shake = Math.max(fx.shake, 0.3);
      break;
    case 'wallWarn': snd('warn'); break;
    case 'wallMove':
      snd('wall');
      wallsFor = '';
      if (live && !wallSaid) { wallSaid = true; Static.say('wallMove'); }
      break;
    case 'mazeClear':
      snd('clear');
      banner(`MAZE ${pad2(e.n)} CLEAR`, `+${e.coins} ◎ COINS`, e.extra ? `CLEAR BONUS +${e.bonus}   ·   +1 BALL` : `CLEAR BONUS +${e.bonus}`, TUNE.CLEAR);
      if (!live) break;
      Wallet.award(e.coins);
      save.coins += e.coins;
      Save.write();
      if (e.extra) { audio.sfx('extra'); Static.say('extraBall', null, { chance: 0.7 }); }
      else if (!e.lair) Static.say('mazeClear', null, { chance: 0.6 });
      ballSay('mazeClear', 0.4);
      break;
    case 'restored': if (live) won(); break;
    case 'gameOver': if (live) endRun(); break;
    default: break;
  }
}
// what the banner says under the maze's name
const mazeLine = (s) => mazeSpec(s.n).line;

// ── the NO SIGNAL screen that isn't one: the static stops the game to see what you do ──
const noSignal = { t: 0, said: false };
function startNoSignal() {
  noSignal.t = 3.4; noSignal.said = false; noSignalThisRun = true;
  $('crashMore').textContent = '* SEARCHING FOR A CHANNEL...';
  $('crashMore').className = '';
  $('crash').classList.add('on');
  audio.sfx('nosignal');
  audio.pauseMusic(true);
  Static.clear();
}
function updateNoSignal(dt) {
  noSignal.t -= dt;
  if (noSignal.t < 1.9 && !noSignal.said) {
    noSignal.said = true;
    $('crashMore').textContent = 'STATIC> ' + pick(STATIC_LINES, 'noSignal');
    $('crashMore').className = 'confess';
  }
  if (noSignal.t <= 0) {
    noSignal.t = 0;
    $('crash').classList.remove('on');
    audio.pauseMusic(false);
    fx.glitch = 0.6;
    save.noSignalSeen = true; Save.write();
    Static.say('maze_' + run.maze.rule, null, { force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNS
// ═══════════════════════════════════════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('on', el.id === id));
  document.body.classList.toggle('attract', view === attract);
  $('btnPauseHud').classList.toggle('on', mode === 'play');
  document.body.classList.toggle('playing', mode === 'play');     // the touch button
}
function release() { input.dash = false; }

// `opts` is for the console: Signal.startRun({ maze: 10, seed: 1 }) starts at THE EYE'S LAIR
function startRun(opts = {}) {
  audio.init();
  save.runs++; Save.write();
  run = createRun(Object.assign({ moods: save.moods }, opts));
  view = run; fx = newFx(); acc = 0; noSignalThisRun = false; wallSaid = false; input.dir = -1; release();
  mode = 'play';
  show(null);
  handle(run, true);
}

function chips(list) {
  return list.map(([k, v, hl]) => `<div class="sc${hl ? ' hl' : ''}"><i>${k}</i><b>${v}</b></div>`).join('');
}
const clockOf = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

// the tenth maze is clear: the game has been beaten. The run can go on, or stop here.
function won() {
  mode = 'won'; release();
  save.restored++; Save.write();
  const r = runRecap(run);
  Cabinet.report('run', { score: r.score, maze: r.maze, restored: true });
  audio.sfx('restored');
  $('wScore').textContent = r.score.toLocaleString('en-US');
  $('wStats').innerHTML = chips([['Static caught', r.catches], ['Eyes survived', r.eyes], ['Close calls', r.closeCalls], ['Time', clockOf(r.time)], ['Coins', '◎ ' + r.coins, true]]);
  show('scrWon');
  Static.say('restored', null, { force: true });
  ballSay('restored');
  refreshMenu();
}

function endRun() {
  const s = run;
  mode = 'over';
  const fresh = recordRun(save, s);
  Save.write();
  const r = runRecap(s);
  Cabinet.report('run', { score: r.score, maze: r.maze, restored: r.restored });
  if (!r.restored) audio.sfx('over');
  audio.bend(0.85, 900);
  $('oEyebrow').textContent = `Maze ${pad2(r.maze)} // ${s.maze.name}`;
  $('oTitle').textContent = r.restored && s.balls > 0 ? 'SIGNAL RESTORED' : fresh.best && r.score > 0 ? 'NEW HIGH SCORE' : 'GAME OVER';
  $('oScore').textContent = r.score.toLocaleString('en-US');
  $('oStats').innerHTML = chips([['Mazes', r.mazes], ['Static caught', r.catches], ['Eyes survived', r.eyes], ['Close calls', r.closeCalls], ['Time', clockOf(r.time)], ['Coins', '◎ ' + r.coins, true]]);
  $('oCause').innerHTML = r.cause && s.balls <= 0 ? `LAST BALL: <b>${r.cause}</b>` : '';
  show('scrOver');
  Static.say(fresh.best && r.score > 0 ? 'newBest' : 'gameOver', null, { force: true });
  ballSay('gameOver');
  refreshMenu();
}

function toMenu() {
  mode = 'menu';
  attract = createRun();
  view = attract; fx = newFx(); run = null; wallsFor = '';
  audio.bend(1, 18000);
  audio.music('menu');
  menuT = 0; menuSaid = 1;
  refreshMenu();
  show('scrMenu');
}

function pause(auto = false) {
  if (mode !== 'play' || noSignal.t > 0) return;
  mode = 'pause'; release();
  pausedAt = performance.now(); pauseNagged = false; autoPaused = auto;
  $('pSector').textContent = pad2(run.n);
  audio.bend(1, 900);
  show('scrPause');
  if (!auto) Static.say('pause', null, { force: true });
}
function resume() {
  if (mode !== 'pause') return;
  mode = 'play'; acc = 0; last = performance.now();
  audio.bend(1, 18000);
  show(null);
  Static.say('resume', null, { chance: 0.5, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════════════
let bent = '';
function update(dt) {
  clock += dt;
  if (noSignal.t > 0) updateNoSignal(dt);
  else if (mode === 'play') {
    acc += dt;
    while (acc >= STEP && mode === 'play') {
      step(run, input, STEP);
      input.dash = false;              // one press, one dash
      acc -= STEP;
      if (run.events.length) handle(run, true);
      if (noSignal.t > 0) break;
    }
    if (mode === 'play') {
      // the 3-2-1 before a maze
      const n = run.phase === 'intro' && run.phaseT <= 2.4 ? Math.ceil(run.phaseT / 0.8) : 0;
      if (n !== fx.count) { fx.count = n; if (n > 0) audio.countdown(String(n)); }
      const running = run.chasers.some((c) => c.fright > 0);
      const key = running ? 'r' : run.critical ? 'c' : '';
      if (key !== bent) { bent = key; audio.bend(key === 'c' ? 1.05 : 1, key === 'r' ? 2200 : 18000); }
    }
  } else if (mode === 'menu') {
    // one of the static plays the ball behind the menu
    acc += dt;
    while (acc >= STEP) {
      if (botTick++ % 6 === 0) botHold = botInput(attract, 0.6);
      step(attract, botHold, STEP);
      acc -= STEP;
      if (attract.events.length) handle(attract, false);
      if (attract.phase === 'won') continueRun(attract);
    }
    if (attract.phase === 'over') { attract = createRun(); view = attract; fx = newFx(); wallsFor = ''; }
    menuT += dt;
    if (menuSaid === 1 && menuT > 14) { menuSaid = 2; Static.say('attract'); }
    else if (menuSaid === 2 && menuT > 50) { menuSaid = 3; Static.say('idleMenu'); }
  } else if (mode === 'pause' && !pauseNagged && performance.now() - pausedAt > 25000) {
    pauseNagged = true;
    Static.say('pauseLong');
  }

  // things that only exist on the screen
  const s = view;
  if ((mode === 'play' || mode === 'menu') && s.phase === 'play' && noSignal.t <= 0) {
    const p = pos(s.ball);
    const at = { x: tx(p.x), y: ty(p.y) };
    const prev = fx.trail[0];
    if (prev && Math.hypot(prev.x - at.x, prev.y - at.y) > TS * 3) fx.trail = [];     // through a tunnel or a portal
    fx.trail.unshift(at);
    const len = s.dash > 0 ? 30 : s.ball.showoff ? 24 : 14;
    if (fx.trail.length > len) fx.trail.length = len;
  }
  if (mode !== 'pause') {
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i];
      p.life -= dt;
      if (p.life <= 0) { fx.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.97; p.vy *= 0.97;
    }
    for (let i = fx.floats.length - 1; i >= 0; i--) {
      const f = fx.floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) fx.floats.splice(i, 1);
    }
    for (const k of ['shake', 'glitch', 'flash', 'panic', 'jam', 'ours']) fx[k] = Math.max(0, fx[k] - dt);
    if (fx.banner) { fx.banner.t -= dt; if (fx.banner.t <= 0) fx.banner = null; }
    if (fx.bubble) { fx.bubble.t -= dt; if (fx.bubble.t <= 0) fx.bubble = null; }
  }
  Static.update(dt);
  hud();
}

// ═══════════════════════════════════════════════════════════════════════════
// HUD (the page around the canvas)
// ═══════════════════════════════════════════════════════════════════════════
const cache = {};
function set(id, text) { if (cache[id] !== text) { cache[id] = text; $(id).textContent = text; } }
const NOISE = '#%&@$?';             // the same width as a digit, so the readout does not jump about
function hud() {
  const s = view, m = s.maze, mine = view === run;
  set('vScore', String(Math.floor(s.score)).padStart(6, '0'));
  set('vChain', String(s.chain));
  set('vMult', 'x' + heatMultiplier(s.heat));
  set('vSector', pad2(s.n));
  set('vRule', m.name);
  // at Critical Heat the static gets into the counter. It still counts; it just can't be read.
  const left = m.packets.size + m.overrides.size;
  let signal = `${m.total - left}/${m.total}`;
  if (fx.jam > 0 && mine) signal = signal.replace(/\d/g, () => NOISE[Math.floor(Math.random() * NOISE.length)]);
  set('vBits', signal);
  $('hBits').classList.toggle('stolen', fx.jam > 0 && mine);
  set('vBalls', '●'.repeat(Math.max(0, s.balls)) + '○'.repeat(Math.max(0, TUNE.BALLS - s.balls)));
  // it relabels the counter for a moment when it takes one
  set('lBalls', fx.ours > 0 && mine ? 'Ours +1' : 'Balls');
  $('hLives').classList.toggle('mine', fx.ours > 0 && mine);
  const heat = Math.round(s.heat);
  if (cache.heat !== heat) { cache.heat = heat; $('heatFill').style.width = heat + '%'; $('heatLab').classList.toggle('hot', heat >= TUNE.CRITICAL); }
  const dash = Math.round(100 * (1 - s.dashCool / TUNE.DASH_COOL));
  if (cache.dash !== dash) {
    cache.dash = dash;
    $('bitsFill').style.width = dash + '%';
    $('dashLab').classList.toggle('ready', dash >= 100);
    const btn = document.querySelector('#pad [data-k="dash"]');
    if (btn) btn.classList.toggle('ready', dash >= 100);
  }
  // the pad shows which way the ball has been told to go, however it was told
  const want = mine && mode === 'play' ? s.ball.want : -1;
  if (cache.want !== want) { cache.want = want; for (const a of padArrows) a.classList.toggle('on', Number(a.dataset.d) === want); }
  const boss = !!s.eye && mine && s.phase === 'play';
  if (cache.boss !== boss) { cache.boss = boss; $('bossBar').classList.toggle('on', boss); }
  if (boss) {
    const w = s.eye.lair ? 100 : Math.round(100 * (s.eye.shots + (s.line ? 1 : 0)) / TUNE.EYE_SHOTS);
    if (cache.bossW !== w) { cache.bossW = w; $('bossHpFill').style.width = Math.min(100, w) + '%'; }
  }
}
function refreshCoins() { set('vCoins', String(Wallet.get().coins)); set('mCoins', String(Wallet.get().coins)); }
function refreshMenu() {
  set('mBest', save.best.toLocaleString('en-US'));
  set('mSector', save.restored ? `RESTORED x${save.restored}` : save.bestMaze ? 'MAZE ' + pad2(save.bestMaze) : '—');
  refreshCoins();
}
window.addEventListener('glitchcade:wallet', refreshCoins);
window.addEventListener('storage', (e) => { if (!e.key || e.key === Wallet.KEY) refreshCoins(); });

// ═══════════════════════════════════════════════════════════════════════════
// DRAWING
// ═══════════════════════════════════════════════════════════════════════════
// The picture is built the way Glitch Pong and Breakpoint build theirs: a
// painted backdrop kept on its own sheet, glass and neon over it, and a bloom
// pass that lets the bright things spill light. The rules are not touched.
const still = document.createElement('canvas');
const bloom = createBloom();
let stillFor = '';
const motes = Array.from({ length: 28 }, (_, i) => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.012, vy: -0.004 - Math.random() * 0.012, r: 5 + Math.random() * 12, k: i }));

// what each of Glitch Pong's arenas leaves on the wall behind its maze
const ACCENT = {
  // the court the first game was played on
  standard(c, col) {
    c.strokeStyle = rgba(col, 0.1); c.lineWidth = 1.5;
    c.setLineDash([10, 12]); c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, LH); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(cx, cy, 330, 0, TAU); c.stroke();
    c.beginPath(); c.arc(cx, cy, 420, 0, TAU); c.stroke();
  },
  // a stack that has run off the top of the screen
  overflow(c, col, rnd) {
    c.font = '11px "Share Tech Mono", monospace'; c.textAlign = 'center';
    for (let x = 14; x < LW; x += 22) {
      const top = rnd() * LH, n = 6 + Math.floor(rnd() * 16);
      for (let j = 0; j < n; j++) { c.fillStyle = rgba(col, 0.03 + 0.14 * (j / n)); c.fillText((rnd() * 16 | 0).toString(16).toUpperCase(), x, (top + j * 13) % LH); }
    }
  },
  // the emergency lighting
  panic(c, col) {
    for (const y of [0, LH - 26]) for (let x = -40; x < LW + 40; x += 34) {
      c.fillStyle = rgba(col, 0.07);
      c.beginPath(); c.moveTo(x, y + 26); c.lineTo(x + 16, y + 26); c.lineTo(x + 34, y); c.lineTo(x + 18, y); c.fill();
    }
  },
  // frost creeping in from the corners
  coolant(c, col, rnd) {
    c.strokeStyle = rgba(col, 0.09); c.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const x = rnd() * LW, y = rnd() * LH, r = 5 + rnd() * 16;
      c.beginPath();
      for (let k = 0; k < 3; k++) { const a = rnd() * 0.3 + k * Math.PI / 3; c.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      c.stroke();
    }
  },
  // the two ends of the shift, one each side
  portal(c) {
    for (const [x, col] of [[ox - 70, C.cyan], [ox + W * TS + 70, C.pink]]) for (let i = 0; i < 7; i++) {
      c.strokeStyle = rgba(col, 0.16 - i * 0.02); c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(x, cy, 26 + i * 22, 60 + i * 44, 0, 0, TAU); c.stroke();
    }
  },
  // memory running down the glass
  leak(c, col, rnd) {
    for (let i = 0; i < 44; i++) {
      const x = rnd() * LW, y = rnd() * LH * 0.8, l = 40 + rnd() * 170;
      const g = c.createLinearGradient(0, y, 0, y + l);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, 0.16));
      c.fillStyle = g; c.fillRect(x, y, 1.5, l);
      c.fillStyle = rgba(col, 0.22); c.beginPath(); c.arc(x + 0.75, y + l, 2, 0, TAU); c.fill();
    }
  },
  // rings going out, and coming back
  echo(c, col) {
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = rgba(i % 2 ? C.cyan : col, 0.13 - i * 0.01); c.lineWidth = 1.5;
      c.beginPath(); c.arc(cx, cy, 300 + i * 46, 0, TAU); c.stroke();
    }
  },
  // the disc, a block at a time
  defrag(c, col, rnd) {
    for (let y = 10; y < LH; y += 15) for (let x = 10; x < LW; x += 21) {
      const v = rnd();
      if (v < 0.5) continue;
      c.fillStyle = rgba(v > 0.93 ? C.amber : col, v > 0.8 ? 0.11 : 0.04);
      c.fillRect(x, y, 17, 11);
    }
  },
  // the line the train keeps to
  train(c, col) {
    const y = ty(10);
    for (const dy of [-TS / 2 - 3, TS / 2 + 3]) { c.strokeStyle = rgba(col, 0.25); c.lineWidth = 2; c.beginPath(); c.moveTo(0, y + dy); c.lineTo(LW, y + dy); c.stroke(); }
    c.strokeStyle = rgba(col, 0.12); c.lineWidth = 3;
    c.beginPath(); for (let x = 6; x < LW; x += 20) { c.moveTo(x, y - TS / 2 - 3); c.lineTo(x, y + TS / 2 + 3); } c.stroke();
  },
  // it has been watching the whole time
  lair(c, col) {
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = rgba(i % 2 ? C.pink : col, 0.16 - i * 0.02); c.lineWidth = 2;
      c.beginPath(); c.ellipse(cx, cy, 380 + i * 50, 150 + i * 44, 0, 0, TAU); c.stroke();
    }
  }
};

// the wall behind the maze: painted once for each maze and each window size
function paintBackdrop(s) {
  const q = Power.saving ? 1 : Math.min(1.5, Math.max(1, ratio)), rule = s.maze.rule;
  const key = `${LW}x${LH}:${q}:${rule}`;
  if (key === stillFor) return;
  stillFor = key;
  still.width = Math.round(LW * q); still.height = Math.round(LH * q);
  const c = still.getContext('2d');
  c.setTransform(q, 0, 0, q, 0, 0);
  const col = WALLS[rule] || C.cyan, rnd = seeded(41 + rule.length * 977 + rule.charCodeAt(0) * 13);
  c.fillStyle = C.void; c.fillRect(0, 0, LW, LH);
  const neb = (x, y, R, tint, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, rgba(tint, a)); g.addColorStop(0.5, rgba(tint, a * 0.35)); g.addColorStop(1, rgba(tint, 0));
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
  };
  neb(cx, cy, 640, '#241a6e', 0.5);
  neb(LW * 0.04, LH * 0.2, 380, col, 0.16);
  neb(LW * 0.96, LH * 0.78, 400, C.pink, 0.12);
  neb(LW * 0.92, LH * 0.06, 300, C.purple, 0.14);
  for (let i = 0; i < 150; i++) {
    const x = rnd() * LW, y = rnd() * LH, z = rnd();
    c.fillStyle = `rgba(${200 + z * 55 | 0},${210 + z * 45 | 0},255,${0.08 + z * z * 0.5})`;
    c.beginPath(); c.arc(x, y, 0.35 + z * 0.9, 0, TAU); c.fill();
  }
  // the grid the other cabinets sit on
  c.strokeStyle = rgba(col, 0.055); c.lineWidth = 1;
  c.beginPath();
  for (let x = ox % 54; x <= LW; x += 54) { c.moveTo(x, 0); c.lineTo(x, LH); }
  for (let y = oy % 54; y <= LH; y += 54) { c.moveTo(0, y); c.lineTo(LW, y); }
  c.stroke();
  (ACCENT[rule] || ACCENT.standard)(c, col, rnd);
  c.textAlign = 'left';
  // light coming up off the floor, as in Breakpoint
  const fg = c.createLinearGradient(0, LH - 150, 0, LH);
  fg.addColorStop(0, rgba(col, 0)); fg.addColorStop(1, rgba(col, 0.15));
  c.fillStyle = fg; c.fillRect(0, LH - 150, LW, 150);
  // the corners fall off into the dark
  const v = c.createRadialGradient(cx, cy, 300, cx, cy, Math.hypot(LW, LH) * 0.62);
  v.addColorStop(0, 'rgba(1,1,6,0)'); v.addColorStop(1, 'rgba(1,1,6,0.74)');
  c.fillStyle = v; c.fillRect(0, 0, LW, LH);
  brackets(c, 12, 12, LW - 24, LH - 24, col, 26, 0.4);
  // the maze's own floor: darker, so a packet is never lost against the wall behind
  roundRect(c, ox - 5, oy - 5, W * TS + 10, H * TS + 10, 8);
  c.fillStyle = 'rgba(3,4,12,0.72)'; c.fill();
  c.strokeStyle = rgba(col, 0.16); c.lineWidth = 1; c.stroke();
}

function draw() {
  const s = view, t = clock;
  const rich = fxFull() && !Power.saving && !bloomOff;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; noGlow();
  paintBackdrop(s);
  ctx.drawImage(still, 0, 0, LW, LH);
  ctx.save();
  if (fx.shake > 0 && fxFull()) ctx.translate((Math.random() - 0.5) * fx.shake * 14, (Math.random() - 0.5) * fx.shake * 14);

  if (fxFull() && !Power.saving) drawMotes(s, t);
  drawWalls(s);
  drawPackets(s, t);
  drawHazards(s, t);
  // everything that moves is cut off at the maze's edge, so a tunnel swallows it
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, W * TS, H * TS); ctx.clip();
  const lightsOut = s.maze.rule === 'panic' && s.phase === 'play';
  if (!lightsOut) drawChasers(s, t, 1);
  if (s.echo && s.phase === 'play') drawEcho(s, t);
  drawBall(s, t);
  sparks(ctx, fx.parts);
  ctx.restore();
  // everything bright spills a little light, as it does in the other two cabinets
  if (rich) bloom.apply(ctx, canvas, LW, LH, IS_TOUCH ? 0.7 : 0.85);
  if (lightsOut) {
    drawDark(s);
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, W * TS, H * TS); ctx.clip();
    drawChasers(s, t, 0.5);          // static glows: you can see it coming, a little
    ctx.restore();
    drawHazards(s, t);
  }
  if (s.eye) drawEye(s, t);
  drawBubble(s);
  drawFloats();
  ctx.restore();
  drawBanner(s, t);

  if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, fx.flash) * (fxFull() ? 0.5 : 0.15)})`; ctx.fillRect(0, 0, LW, LH); }
  // tearing: slices of the picture pulled sideways
  const tear = fxFull() && (fx.glitch > 0 || (s.critical && Math.random() < 0.04));
  if (tear) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const n = fx.glitch > 0 ? 6 : 2;
    for (let i = 0; i < n; i++) {
      const y = Math.floor(Math.random() * canvas.height), h = Math.floor((6 + Math.random() * 30) * ratio);
      const dx = Math.round((Math.random() - 0.5) * 70 * ratio);
      ctx.drawImage(canvas, 0, y, canvas.width, h, dx, y, canvas.width, h);
    }
  }
}

// motes of light drifting up the wall behind the maze
function drawMotes(s, t) {
  const col = WALLS[s.maze.rule] || C.cyan;
  for (const m of motes) {
    const x = (((m.x + m.vx * t) % 1) + 1) % 1 * LW, y = (((m.y + m.vy * t) % 1) + 1) % 1 * LH;
    if (x > ox - 8 && x < ox + W * TS + 8 && y > oy - 8 && y < oy + H * TS + 8) continue;     // never over the maze
    light(ctx, x, y, m.r, m.k % 3 ? col : C.pink, 0.2 + 0.12 * Math.sin(t * 0.8 + m.k));
  }
}

// The walls are drawn once for each maze (and again when one moves) and kept:
// panes of glass with a tube of neon round them, the corners turned.
function drawWalls(s) {
  const m = s.maze, key = `${s.n}:${ratio}:${m.grid.reduce((a, v, i) => (a + v * (i % 97 + 1)) % 1000003, 0)}`;
  if (key !== wallsFor) {
    wallsFor = key;
    walls.width = Math.round(W * TS * ratio); walls.height = Math.round(H * TS * ratio);
    wctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    wctx.globalCompositeOperation = 'source-over';
    wctx.clearRect(0, 0, W * TS, H * TS);
    const col = WALLS[m.rule] || C.cyan, k = 4, r = 6, h = TS / 2;
    const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || m.grid[idx(x, y)] === WALL;
    // the glass: every wall tile, cut back from the corridors beside it
    wctx.fillStyle = rgba(col, 0.15);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(x, y)) wctx.fillRect(x * TS, y * TS, TS, TS);
    wctx.globalCompositeOperation = 'destination-out';
    wctx.fillStyle = '#000';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y)) wctx.fillRect(x * TS - k, y * TS - k, TS + k * 2, TS + k * 2);
    // lines of scan across the glass, the way a hologram has them
    wctx.globalCompositeOperation = 'source-atop';
    wctx.fillStyle = rgba(col, 0.1);
    for (let y = 1; y < H * TS; y += 3) wctx.fillRect(0, y, W * TS, 1);
    wctx.globalCompositeOperation = 'source-over';
    // the tube: walked corner by corner, so every turn is a curve
    wctx.beginPath();
    for (let vy = 0; vy <= H; vy++) for (let vx = 0; vx <= W; vx++) {
      const nw = solid(vx - 1, vy - 1), ne = solid(vx, vy - 1), sw = solid(vx - 1, vy), se = solid(vx, vy);
      const edgeX = vx === 0 || vx === W, edgeY = vy === 0 || vy === H;
      // a face runs along each half-edge that has wall on one side and corridor on the other
      const N = !edgeX && nw !== ne, S = !edgeX && sw !== se, Wf = !edgeY && nw !== sw, E = !edgeY && ne !== se;
      if (!(N || S || Wf || E)) continue;
      const X = vx * TS, Y = vy * TS;
      // each face sits a little inside the wall it belongs to
      const nx = nw ? -k : k, sx = sw ? -k : k, wy = nw ? -k : k, ey = ne ? -k : k;
      const turn = (vert, horiz, dx, dy) => {
        // from the end of the vertical face, round the corner, to the end of the horizontal one
        const px = X + dx, py = Y + dy;
        wctx.moveTo(px, Y + vert * h); wctx.lineTo(px, py + vert * r);
        wctx.quadraticCurveTo(px, py, px + horiz * r, py);
        wctx.lineTo(X + horiz * h, py);
      };
      const n = N + S + Wf + E;
      if (n === 4) {
        if (nw) { turn(-1, -1, -k, -k); turn(1, 1, k, k); } else { turn(-1, 1, k, -k); turn(1, -1, -k, k); }
      } else if (N && S) { wctx.moveTo(X + nx, Y - h); wctx.lineTo(X + nx, Y + h); }
      else if (Wf && E) { wctx.moveTo(X - h, Y + wy); wctx.lineTo(X + h, Y + wy); }
      else if (N && E) turn(-1, 1, nx, ey);
      else if (N && Wf) turn(-1, -1, nx, wy);
      else if (S && E) turn(1, 1, sx, ey);
      else if (S && Wf) turn(1, -1, sx, wy);
      else if (N) { wctx.moveTo(X + nx, Y - h); wctx.lineTo(X + nx, Y); }
      else if (S) { wctx.moveTo(X + sx, Y + h); wctx.lineTo(X + sx, Y); }
      else if (Wf) { wctx.moveTo(X - h, Y + wy); wctx.lineTo(X, Y + wy); }
      else if (E) { wctx.moveTo(X + h, Y + ey); wctx.lineTo(X, Y + ey); }
    }
    tube(wctx, col, 2, 1);
    // the pen's door
    for (let i = 0; i < W * H; i++) if (m.grid[i] === DOOR) {
      const c = xy(i);
      wctx.beginPath(); wctx.moveTo(c.x * TS + 1, c.y * TS + h); wctx.lineTo(c.x * TS + TS - 1, c.y * TS + h);
      tube(wctx, C.pink, 2.6, 1);
    }
  }
  ctx.drawImage(walls, ox, oy, W * TS, H * TS);
}

function drawPackets(s, t) {
  const m = s.maze;
  // packets: points of light, all in one stroke of the brush
  ctx.fillStyle = '#eaffff';
  ctx.beginPath();
  for (const i of m.packets) { const c = xy(i), x = tx(c.x), y = ty(c.y); ctx.moveTo(x + 2.3, y); ctx.arc(x, y, 2.3, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = rgba(C.cyan, 0.16);
  ctx.beginPath();
  for (const i of m.packets) { const c = xy(i), x = tx(c.x), y = ty(c.y); ctx.moveTo(x + 5, y); ctx.arc(x, y, 5, 0, TAU); }
  ctx.fill();
  // overrides: the big ones
  for (const i of m.overrides) {
    const c = xy(i), z = 6.5 + Math.sin(t * 6) * 1.5, x = tx(c.x), y = ty(c.y);
    light(ctx, x, y, 22 + Math.sin(t * 6) * 4, C.amber, 0.75);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(Math.PI / 4 + t * 0.6);
    roundRect(ctx, -z, -z, z * 2, z * 2, 2.5);
    ctx.fillStyle = rgba(C.amber, 0.4); ctx.fill();
    tube(ctx, C.amber, 1.6, 1);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
  }
  // QUANTUM SHIFT's two doors
  if (m.portals) m.portals.forEach((i, k) => {
    const c = xy(i), col = k ? C.pink : C.cyan;
    light(ctx, tx(c.x), ty(c.y), 22, col, 0.55);
    for (let r = 0; r < 2; r++) {
      const a = t * (r ? -2.2 : 2.6);
      ctx.beginPath(); ctx.arc(tx(c.x), ty(c.y), 6 + r * 4, a, a + 4.4);
      tube(ctx, col, 1.6, 1);
    }
  });
}

// What is about to happen, drawn on the maze: THE EYE's gaze, the train, a wall on the move.
function drawHazards(s, t) {
  const l = s.line;
  if (l) {
    const firing = l.state === 'fire';
    const col = l.cause === 'train' ? '#ff9a3d' : C.pink;
    for (const i of l.cells) {
      const c = xy(i), x = tx(c.x), y = ty(c.y);
      roundRect(ctx, x - TS / 2 + 3, y - TS / 2 + 3, TS - 6, TS - 6, 4);
      if (firing) {
        ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
        light(ctx, x, y, TS * 1.3, col, 0.7);
      } else {
        const on = Math.floor(t * 10) % 2;
        ctx.fillStyle = rgba(col, on ? 0.3 : 0.1); ctx.fill();
        ctx.strokeStyle = rgba(col, on ? 0.9 : 0.4); ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    if (l.cause === 'train' && firing) {
      // the train itself, crossing while it lasts
      const k = 1 - l.t / l.fire, y = ty(s.maze.tunnel);
      const x = ox - 6 * TS + k * (W + 6) * TS, w = 6 * TS;
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, W * TS, H * TS); ctx.clip();
      roundRect(ctx, x, y - 10, w, 20, 7);
      const g = ctx.createLinearGradient(0, y - 10, 0, y + 10);
      g.addColorStop(0, '#ffe2c2'); g.addColorStop(0.35, '#ff9a3d'); g.addColorStop(1, '#b3501a');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(20,8,2,0.7)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + i * 24, y - 4, 15, 6);
      light(ctx, x + w, y, 30, '#ffe2c2', 0.9);
      ctx.restore();
    }
  }
  const w = s.wall;
  if (w) {
    const on = Math.floor(t * 8) % 2;
    if (w.shut >= 0) {
      const c = xy(w.shut), x = tx(c.x), y = ty(c.y);
      roundRect(ctx, x - TS / 2 + 2, y - TS / 2 + 2, TS - 4, TS - 4, 4);
      ctx.fillStyle = rgba(C.amber, on ? 0.2 : 0.06); ctx.fill();
      tube(ctx, C.amber, 1.6, on ? 1 : 0.45);
      ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6);
      tube(ctx, C.amber, 1.6, on ? 1 : 0.45);
    }
    if (w.open >= 0) {
      const c = xy(w.open);
      ctx.setLineDash([4, 4]);
      roundRect(ctx, tx(c.x) - TS / 2 + 2, ty(c.y) - TS / 2 + 2, TS - 4, TS - 4, 4);
      ctx.strokeStyle = rgba(C.green, on ? 1 : 0.4); ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// The four: panes of live static, each in its own colour, with a visor of white on the side it is heading.
function drawChasers(s, t, alpha) {
  const f = Math.floor(t * 16);
  for (const c of s.chasers) {
    const def = CHASERS[c.k], p = pos(c);
    let x = tx(p.x), y = ty(p.y);
    if (c.state === 'pen') y += Math.sin(t * 5 + c.k) * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (c.state === 'home') {
      // caught: a spark on its way back to the box
      light(ctx, x, y, 12, def.color, 0.9);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 2.5, y - 1, 1.6, 0, TAU); ctx.arc(x + 2.5, y + 1, 1.6, 0, TAU); ctx.fill();
      ctx.restore();
      continue;
    }
    const running = c.fright > 0;
    const ending = running && c.fright < 1.6 && Math.floor(t * 9) % 2;
    const col = running ? (ending ? '#ffffff' : '#7f8fd8') : def.color;
    const z = 21, jit = running && fxFull() ? (Math.random() - 0.5) * 2 : 0;
    x += jit;
    if (!running) light(ctx, x, y, 25, col, 0.55);
    roundRect(ctx, x - z / 2, y - z / 2, z, z, 6);
    ctx.fillStyle = rgba(col, running ? 0.12 : 0.24); ctx.fill();
    // the snow inside it
    ctx.save(); ctx.clip();
    for (let j = 0; j < 7; j++) {
      const v = (Math.sin(c.k * 31.7 + j * 7.1 + f * 1.7) + 1) / 2, u = (Math.sin(c.k * 9.3 + j * 4.7 + f * 2.9) + 1) / 2;
      ctx.fillStyle = rgba(v > 0.82 ? '#ffffff' : col, 0.2 + v * 0.7);
      ctx.fillRect(x - z / 2 + u * z * 0.7 - 2, y - z / 2 + j * 3 + 0.8, z * (0.15 + v * 0.55), 1.7);
    }
    ctx.restore();
    roundRect(ctx, x - z / 2, y - z / 2, z, z, 6);
    if (running) { ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    else {
      tube(ctx, col, 1.7, 1);
      // a slice of it out of place, now and then
      if (fxFull() && (f + c.k * 5) % 13 === 0) {
        const sy = y - 6 + ((f * 7 + c.k * 3) % 12);
        ctx.fillStyle = rgba(C.cyan, 0.8); ctx.fillRect(x - z / 2 - 5, sy, z, 1.6);
        ctx.fillStyle = rgba(C.pink, 0.8); ctx.fillRect(x - z / 2 + 5, sy + 2.4, z, 1.6);
      }
      if (c.dir >= 0) {
        const d = DIRS[c.dir], vx = x + d.x * 6.5, vy = y + d.y * 6.5;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(vx - d.y * 5, vy - d.x * 5); ctx.lineTo(vx + d.y * 5, vy + d.x * 5); ctx.stroke();
        ctx.lineCap = 'butt';
        light(ctx, vx, vy, 9, '#ffffff', 0.7);
      }
    }
    // it misjudged the junction, the way a person does
    if (c.lapse > 0 && !running) {
      ctx.font = '700 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = def.color; ctx.fillText('?', x, y - 12);
    }
    ctx.restore();
  }
}

function drawEcho(s, t) {
  const x = tx(s.echo.x), y = ty(s.echo.y);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 10);
  light(ctx, x, y, 20, Look.hex, 0.4);
  ctx.fillStyle = rgba(Look.hex, 0.2);
  ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = Look.hex; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBall(s, t) {
  const b = s.ball;
  if (s.phase === 'over' || s.phase === 'reset') return;
  const p = pos(b), x = tx(p.x), y = ty(p.y), R = 8;
  if (b.inv > 0 && s.phase === 'play' && Math.floor(t * 14) % 2) return;       // a new ball blinks
  const dim = b.mourn > 0 ? 0.5 + 0.5 * (1 - b.mourn / 3.5) : 1;
  const d = b.dir >= 0 ? DIRS[b.dir] : { x: 0, y: 0 };
  const v = TUNE.SPEED * TS * (s.dash > 0 ? TUNE.DASH_MULT : 1);
  const trailSkin = Look.get('trail'), ballSkin = Look.get('ball');
  const look = (trailSkin !== 'default' || ballSkin !== 'default') && {
    rgb: Look.rgb, hex: Look.hex, t, heat: s.heat / 100, quality: glowK < 0.5 ? 0.5 : 1,
    vx: d.x * v / 60, vy: d.y * v / 60, r: R, charge: 2, speed: v / 60, rally: s.chain
  };
  const dashing = s.dash > 0;
  ctx.save();
  if (trailSkin !== 'default') { ctx.globalAlpha = dim; Look.draw.trail(ctx, fx.trail, look); }
  else comet(ctx, fx.trail, R * (dashing ? 1.15 : 0.95), dashing ? C.amber : Look.hex, (dashing ? 1 : b.showoff ? 0.9 : 0.65) * dim);
  ctx.globalAlpha = dim;
  if (ballSkin !== 'default') Look.draw.ball(ctx, x, y, R + 1, look);
  else {
    light(ctx, x, y, R * (b.showoff || dashing ? 5 : 3.6), dashing ? C.amber : Look.hex, 0.8);
    const g = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, Look.hex); g.addColorStop(1, rgba(Look.hex, 0.8));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // touch: the turn it has been told to take and has not reached yet, so a swipe is seen to have landed
  if (view === run && input.kind === 'touch' && s.phase === 'play' && b.want >= 0 && b.want !== b.dir) {
    const w = DIRS[b.want], bx = x + w.x * 14, by = y + w.y * 14;
    ctx.beginPath();
    ctx.moveTo(bx - w.y * 5, by - w.x * 5); ctx.lineTo(bx + w.x * 6, by + w.y * 6); ctx.lineTo(bx + w.y * 5, by + w.x * 5);
    tube(ctx, C.amber, 1.8, 0.95);
  }
  ctx.restore();
}

// what the ball has to say
function drawBubble(s) {
  if (!fx.bubble || view !== run || s.phase === 'over' || s.phase === 'reset') return;
  const p = pos(s.ball), x = tx(p.x), y = ty(p.y);
  ctx.font = '15px "Share Tech Mono", monospace';
  ctx.textAlign = x > cx ? 'right' : 'left'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = Math.min(1, fx.bubble.t * 2);
  const bx = x + (x > cx ? -16 : 16), by = y - 20;
  const tw = ctx.measureText(fx.bubble.text).width;
  roundRect(ctx, x > cx ? bx - tw - 7 : bx - 7, by - 11, tw + 14, 22, 4);
  ctx.fillStyle = 'rgba(3,4,10,0.82)'; ctx.fill();
  ctx.strokeStyle = rgba(Look.hex, 0.5); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = Look.hex;
  ctx.fillText(fx.bubble.text, bx, by);
  ctx.globalAlpha = 1;
}

// KERNEL PANIC: the ball lights what is near it; an override lights the maze for a moment
function drawDark(s) {
  const p = pos(s.ball), k = dark.width / LW;
  const lit = Math.min(1, fx.panic / 0.6);
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = `rgba(1,1,6,${0.94 * (1 - lit * 0.85)})`;
  dctx.fillRect((ox - 6) * k, (oy - 6) * k, (W * TS + 12) * k, (H * TS + 12) * k);
  dctx.globalCompositeOperation = 'destination-out';
  const x = tx(p.x) * k, y = ty(p.y) * k, R = TS * 4.6 * k;
  const g = dctx.createRadialGradient(x, y, R * 0.3, x, y, R);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = g;
  dctx.beginPath(); dctx.arc(x, y, R, 0, TAU); dctx.fill();
  ctx.drawImage(dark, 0, 0, LW, LH);
  // the overrides still glint in the dark
  for (const i of s.maze.overrides) { const c = xy(i); light(ctx, tx(c.x), ty(c.y), 9, C.amber, 0.6); }
}

// THE EYE, over the pen, looking toward the ball
function drawEye(s, t) {
  const p = pos(s.ball), side = (p.x - 10) / 10;
  const im = side < -0.3 ? eyeImg.left : side > 0.3 ? eyeImg.right : eyeImg.neutral;
  const S = 190 + Math.sin(t * 2) * 4, x = tx(10), y = ty(10);
  ctx.save();
  ctx.globalAlpha = s.line && s.line.cause === 'gaze' && s.line.state === 'warn' && Math.floor(t * 12) % 2 ? 0.75 : 0.95;
  light(ctx, x, y, S * 0.75, C.purple, 0.5);
  if (ready(im)) ctx.drawImage(im, x - S / 2, y - S / 2, S, S);
  else {
    ctx.beginPath(); ctx.ellipse(x, y, 44, 20, 0, 0, TAU);
    tube(ctx, C.purple, 3, 1);
    ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(x + side * 14, y, 8, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawFloats() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.2);
    ctx.font = `700 ${Math.round(f.size * 0.62)}px Orbitron, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(f.text, f.x + 1, f.y + 1.5);
    glow(f.color, 10);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    noGlow();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(f.text, f.x, f.y);      // a hot core, so it reads over the glow
  }
  ctx.globalAlpha = 1;
}

function chroma(text, x, y, off, fill) {
  ctx.fillStyle = C.cyan; ctx.fillText(text, x - off, y);
  ctx.fillStyle = C.pink; ctx.fillText(text, x + off, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

function drawBanner(s, t) {
  const bn = fx.banner;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (bn && (view === run || s.phase !== 'play')) {
    const a = Math.min(1, bn.t * 3, (bn.dur - bn.t) * 5);
    ctx.globalAlpha = Math.max(0, a);
    const y = cy - 200, tall = bn.legend ? 198 : 96, tint = WALLS[s.maze.rule] || C.cyan;
    // a pane of dark glass, framed the way the menus are
    roundRect(ctx, cx - 262, y - 32, 524, tall, 6);
    ctx.fillStyle = 'rgba(4,5,14,0.9)'; ctx.fill();
    ctx.strokeStyle = rgba(tint, 0.55); ctx.lineWidth = 1; ctx.stroke();
    brackets(ctx, cx - 268, y - 38, 536, tall + 12, tint, 14, 0.9);
    ctx.font = '900 30px Orbitron, "Arial Black", sans-serif';
    chroma(bn.title, cx, y - 6, 2.5, C.text);
    ctx.font = '700 15px Orbitron, sans-serif';
    ctx.fillStyle = C.amber; ctx.fillText(bn.sub, cx, y + 24);
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(238,247,255,0.8)'; ctx.fillText(bn.line, cx, y + 47);
    if (bn.legend) {
      // the static tells you how each of the four hunts
      CHASERS.forEach((c, i) => {
        const ly = y + 78 + i * 22;
        ctx.textAlign = 'left';
        glass(ctx, cx - 225, ly, 14, 14, c.color, { r: 4, fill: 0.35 });
        ctx.fillStyle = c.color;
        ctx.font = '700 12px Orbitron, sans-serif'; ctx.fillText(c.name, cx - 210, ly);
        ctx.font = '13px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(238,247,255,0.85)'; ctx.fillText(c.how, cx - 140, ly);
      });
      ctx.textAlign = 'center';
    }
    ctx.globalAlpha = 1;
  }
  // 3 · 2 · 1 over the pen
  if (view === run && s.phase === 'intro' && s.phaseT <= 2.4 && noSignal.t <= 0) {
    const n = Math.ceil(s.phaseT / 0.8), k = (s.phaseT % 0.8) / 0.8;
    ctx.font = `900 ${Math.round(70 + k * 36)}px Orbitron, "Arial Black", sans-serif`;
    ctx.globalAlpha = 0.35 + k * 0.65;
    chroma(String(n), cx, ty(13) + 4, 4, '#fff');
    ctx.globalAlpha = 1;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MENUS AND SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function refreshSettings() {
  $('setVol').value = save.vol;
  $('setFx').textContent = 'Screen FX: ' + (save.fx ? 'Full' : 'Reduced');
  $('setFx').classList.toggle('ghostc', !save.fx);
  $('setMoods').textContent = 'Ball moods: ' + (save.moods ? 'On' : 'Off');
  $('setTalk').textContent = 'Static: ' + (save.talk ? 'Talks' : 'Silent');
  $('setTalk').classList.toggle('ghostc', !save.talk);
  $('setPad').textContent = 'Touch pad: ' + (save.pad === 'off' ? 'Off · swipe only' : save.pad === 'right' ? 'Right' : 'Left');
  $('setPad').classList.toggle('ghostc', save.pad === 'off');
  $('setSaver').textContent = 'Battery saver: ' + (Power.state === 'on' ? 'On' : Power.state === 'auto' ? 'Auto · low battery' : 'Off');
  $('setSaver').classList.toggle('ghostc', Power.saving);
  const skins = Look.available;
  for (const id of ['setSkin', 'setTrail']) { $(id).style.display = skins ? '' : 'none'; $(id).nextElementSibling.style.display = skins ? '' : 'none'; }
  if (skins) {
    $('setSkin').textContent = 'Ball skin: ' + Look.name('ball');
    $('setTrail').textContent = 'Ball trail: ' + Look.name('trail');
  }
  document.body.classList.toggle('reduced-fx', !save.fx);
}
function click() { audio.init(); audio.sfx('click'); }

$('btnPlay').onclick = () => { click(); startRun(); };
$('btnRetry').onclick = () => { click(); audio.bend(1, 18000); startRun(); };
$('btnOverMenu').onclick = () => { click(); toMenu(); };
$('btnKeepGoing').onclick = () => {
  click();
  continueRun(run);
  mode = 'play'; acc = 0; last = performance.now();
  show(null);
  handle(run, true);
  Static.say('keepGoing', null, { force: true });
};
$('btnWonMenu').onclick = () => { click(); endRun(); };
$('btnHow').onclick = () => { click(); show('scrHow'); };
$('btnRecord').onclick = () => {
  click();
  const m = Math.floor(save.seconds / 60);
  $('recordList').innerHTML = chips([
    ['Runs', save.runs], ['Caught by the static', save.caughtBy], ['Static you caught', save.catches], ['Mazes cleared', save.mazes],
    ['Eyes survived', save.eyes], ['Signal restored', save.restored], ['Coins paid', '◎ ' + save.coins], ['Time on air', m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`]
  ]);
  $('recordNote').innerHTML = save.caughtBy > save.catches
    ? `IT HAS CAUGHT YOU <b>${save.caughtBy}</b> TIMES TO YOUR <b>${save.catches}</b>. IT BRINGS THIS UP.`
    : save.catches ? `YOU HAVE CAUGHT IT <b>${save.catches}</b> TIMES TO ITS <b>${save.caughtBy}</b>. IT DOES NOT BRING THIS UP.` : 'NOBODY HAS CAUGHT ANYBODY YET.';
  show('scrRecord');
};
function openSettings(from) { click(); settingsFrom = from; Look.refresh(); refreshSettings(); show('scrSettings'); }
$('btnSettings').onclick = () => openSettings('scrMenu');
$('btnPauseSettings').onclick = () => openSettings('scrPause');
document.querySelectorAll('.screen .back').forEach((b) => {
  b.onclick = () => { click(); show(b.closest('.screen').id === 'scrSettings' ? settingsFrom : 'scrMenu'); };
});
$('btnResume').onclick = () => { click(); resume(); };
$('btnQuit').onclick = () => { click(); run.stats.cause = ''; endRun(); };
$('btnPauseHud').onclick = () => { click(); pause(); };

$('setVol').oninput = (e) => {
  const was = save.vol;
  save.vol = Number(e.target.value); Save.write();
  audio.init(); audio.setVolume(save.vol / 100);
  if (was > 0 && save.vol === 0) Static.say('muted', null, { force: true });
};
$('setFx').onclick = () => { click(); save.fx = !save.fx; Save.write(); refreshSettings(); if (!save.fx) Static.say('fxOff', null, { force: true }); };
$('setMoods').onclick = () => { click(); save.moods = !save.moods; Save.write(); refreshSettings(); if (!save.moods) Static.say('moodsOff', null, { force: true }); if (run) run.moods = save.moods; };
$('setTalk').onclick = () => {
  click();
  save.talk = !save.talk; Save.write(); refreshSettings();
  if (!save.talk) { Static.say('talkOff', null, { force: true }); Static.next = null; } else Static.say('resume', null, { force: true });
};
$('setPad').onclick = () => { click(); save.pad = PAD_SIDES[(PAD_SIDES.indexOf(save.pad) + 1) % PAD_SIDES.length]; Save.write(); layout(); refreshSettings(); };
$('setSaver').onclick = () => { click(); Power.setBatterySaver(!Power.batterySaver); layout(); refreshSettings(); };
$('setSkin').onclick = () => { click(); Look.cycle('ball'); refreshSettings(); };
$('setTrail').onclick = () => { click(); Look.cycle('trail'); refreshSettings(); };
let resetArmed = 0;
$('setReset').onclick = () => {
  click();
  if (performance.now() - resetArmed > 4000) { resetArmed = performance.now(); $('setReset').textContent = 'Sure? Press again'; return; }
  resetArmed = 0;
  const keep = { vol: save.vol, fx: save.fx, moods: save.moods, talk: save.talk };
  Save.reset(); Object.assign(save, Save.data, keep); Save.data = save; Save.write();
  $('setReset').textContent = 'Erase what it keeps';
  refreshMenu();
  Static.say('erased', null, { force: true });
};

// EXIT TO ARCADE: only inside the cabinet. The static would rather you didn't.
if (Cabinet.active) {
  const exit = $('btnExit');
  exit.style.display = '';
  let flick = 0;
  exit.addEventListener('pointerenter', () => {
    if (!save.talk || !save.fx) return;
    exit.textContent = EXIT_FLICKER[flick++ % EXIT_FLICKER.length];
    setTimeout(() => { exit.textContent = 'Exit to arcade'; }, 420);
  });
  exit.onclick = () => {
    click();
    Static.say('exit', null, { force: true });
    setTimeout(() => Cabinet.exit(), save.talk ? 900 : 0);
  };
}

// ── input: a direction and a dash ──
const KEYS = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 };
window.addEventListener('keydown', (e) => {
  const d = KEYS[e.code];
  if (e.repeat) { if (d !== undefined || e.code === 'Space') e.preventDefault(); return; }
  audio.init();
  if (d !== undefined) {
    e.preventDefault();
    input.kind = 'key';
    if (mode === 'play') input.dir = d;
    return;
  }
  if (e.code === 'Space') {
    if (mode !== 'play' && e.target && e.target.tagName === 'BUTTON') return;      // let a focused button take it
    e.preventDefault();
    input.kind = 'key';
    if (mode === 'play') input.dash = true;
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'play') pause();
    else if (mode === 'pause') { if ($('scrSettings').classList.contains('on')) show('scrPause'); else resume(); }
    else if (mode === 'menu') {
      if (!$('scrMenu').classList.contains('on')) show('scrMenu');
      else if (e.code === 'Escape' && Cabinet.active) Cabinet.exit();
    }
    return;
  }
  if (e.code === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) {
    if (mode === 'over') $('btnRetry').click();
    else if (mode === 'won') $('btnKeepGoing').click();
    else if (mode === 'menu' && $('scrMenu').classList.contains('on')) $('btnPlay').click();
  }
});
// touch, two ways, and both work at once.
// A direction is a turn the ball takes when it can; there is nothing to hold.
function steer(d) {
  input.kind = 'touch';
  if (mode !== 'play' || d === input.dir) return;
  input.dir = d;
  // a tick in the hand, where the phone can do it, so a turn is felt without looking down
  if (save.fx && navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* not allowed here */ } }
}
// which of the four a drag means. `cur` is the way already chosen: leaving it takes a
// clear move toward another, so a thumb resting on a diagonal does not flicker between two.
function dragDir(dx, dy, cur) {
  const ax = Math.abs(dx), ay = Math.abs(dy), k = 1.35;
  const across = cur === 0 || cur === 2 ? ax * k > ay : cur === 1 || cur === 3 ? ax > ay * k : ax > ay;
  return across ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
}
// 1. the pad: touch it and slide. The way from its middle to the thumb is the way the ball goes.
const dpad = $('dpad'), padArrows = [...dpad.querySelectorAll('i')];
let padId = null;
function padAt(e) {
  const r = dpad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  if (Math.hypot(dx, dy) < r.width * 0.09) return;          // the very middle means nothing
  steer(dragDir(dx, dy, input.dir));
}
dpad.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.init();
  padId = e.pointerId;
  try { dpad.setPointerCapture(e.pointerId); } catch (err) { /* an old browser: the thumb must stay on the pad */ }
  dpad.classList.add('held');
  padAt(e);
});
dpad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) padAt(e); });
for (const ev of ['pointerup', 'pointercancel']) dpad.addEventListener(ev, (e) => { if (e.pointerId === padId) { padId = null; dpad.classList.remove('held'); } });
// 2. a swipe, anywhere on the screen that is not a button. One drag can make several turns.
let swipe = null;
window.addEventListener('pointerdown', (e) => {
  audio.init();
  if (e.pointerType === 'mouse') { input.kind = 'mouse'; return; }
  if (e.target.closest && e.target.closest('button, input, #dpad')) return;
  input.kind = 'touch';
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (!swipe || e.pointerId !== swipe.id || mode !== 'play') return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  // a short flick is enough: about a thirtieth of the screen's shorter side
  if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(10, Math.min(18, Math.min(window.innerWidth, window.innerHeight) * 0.034))) return;
  steer(dragDir(dx, dy, -1));
  swipe.x = e.clientX; swipe.y = e.clientY;          // carry on from here
});
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, (e) => { if (swipe && e.pointerId === swipe.id) swipe = null; });
const dashBtn = document.querySelector('#pad [data-k="dash"]');
dashBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.init();
  input.kind = 'touch';
  if (mode === 'play') input.dash = true;
  dashBtn.classList.add('held');
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) dashBtn.addEventListener(ev, () => dashBtn.classList.remove('held'));
window.addEventListener('blur', release);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// ── looking away: it pauses for you, renames the tab, and counts ──
const TITLE = document.title;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    awayAt = performance.now();
    if (save.talk) document.title = AWAY_TITLE;
    if (mode === 'play') pause(true);
    audio.pauseMusic(true);
  } else {
    document.title = TITLE;
    audio.pauseMusic(false);
    last = performance.now();
    if (autoPaused && mode === 'pause') {
      autoPaused = false;
      Static.say('away', { away: Math.round((performance.now() - awayAt) / 1000) }, { force: true });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// THE LOOP
// ═══════════════════════════════════════════════════════════════════════════
const pacer = Power.createPacer();
function wantFps() {
  if (mode === 'pause') return Power.saving ? 5 : 12;
  const m = mode === 'play' ? 'active' : mode === 'menu' ? 'calm' : 'idle';
  return Power.fpsFor({ touch: IS_TOUCH, saving: Power.saving, mode: m });
}
// A machine that cannot keep up loses the bloom, not the frame rate: if the
// picture stays under about forty frames a second while it is asking for
// sixty, the bloom pass is dropped until the page is opened again.
let bloomOff = false, slowT = 0;
function watchSpeed(dt) {
  if (bloomOff || !fxFull() || Power.saving || (mode !== 'play' && mode !== 'menu') || wantFps() < 50) { slowT = 0; return; }
  slowT = dt > 1 / 42 ? slowT + dt : Math.max(0, slowT - dt * 2);
  if (slowT > 2.5) bloomOff = true;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!pacer.due(now, wantFps())) return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  watchSpeed(dt);
  update(dt);
  draw();
}

// ── boot ──
layout();
audio.setVolume(save.vol / 100);
audio.music('menu');                 // starts with the first key or click
refreshSettings();
refreshMenu();
handle(attract, false);
show('scrMenu');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
setTimeout(() => { Static.say(save.runs ? 'boot' : 'bootFirst'); menuSaid = 1; menuT = 0; }, 900);
requestAnimationFrame(frame);

// for the console and the tests that drive the page
window.Signal = {
  get run() { return run; }, get mode() { return mode; }, get view() { return view; }, get fx() { return fx; },
  get bloomOff() { return bloomOff; }, set bloomOff(v) { bloomOff = !!v; slowT = 0; },
  Static, save, startRun, endRun, pause, resume, toMenu, startNoSignal, won, input
};
