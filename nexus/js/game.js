// ═══════════════════════════════════════════════════════════════════════════
// BLACK-HOLE NEXUS — the page: drawing, sound, controls, menus, and the two voices.
//
// js/rules.js decides everything that happens in a run and hands back a list
// of events; this file turns the run into a picture and the events into
// sound, sparks, coins and things NULL says. Nothing in here changes the
// rules, so what the tests measure is what you play.
// ═══════════════════════════════════════════════════════════════════════════
import {
  TUNE, TAU, createRun, step, botInput, heatMultiplier, gapRadius, lagTarget, shiftLands, runRecap, recordRun
} from './rules.js';
import { NULL_LINES, BALL_LINES, EXIT_FLICKER, AWAY_TITLE, pick } from './voice.js';
import { Wallet, Save, Cabinet, Look, otherCabinets } from './wallet.js';
import { createAudio } from './audio.js';
import { roundRect, light, tube, glass, comet, sparks, brackets, createBloom, seeded } from './neon.js';

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
const C = { cyan: '#71efff', pink: '#ff58d9', purple: '#9a5dff', amber: '#ffd27a', red: '#ff4d6d', text: '#eef7ff', void: '#03040a' };
// the bricks are Breakpoint's, the paddles are Glitch Pong's
const BRICKS = ['#ff4d6d', '#ff9a00', '#ffd27a', '#50fa7b', '#71efff', '#4d7cff', '#9a5dff', '#ff58d9'];
const PADDLES = ['#1fd0ff', '#ff3b5c'];
const POWER_LOOK = { shield: { c: C.cyan, ch: 'F', name: 'FIREWALL' }, spread: { c: C.pink, ch: 'S', name: 'SPREAD SHOT' }, freeze: { c: '#cfe8ff', ch: 'T', name: 'TIME FREEZE' } };

// ── the Eye's sprites: Glitch Pong's, and Breakpoint's blink ──
const eyeImg = {};
for (const [k, src] of Object.entries({
  neutral: '../assets/boss_eye_neutral.png', left: '../assets/boss_eye_left.png', right: '../assets/boss_eye_right.png',
  blink: '../breakpoint/assets/straight_eye_blink.png'
})) { const im = new Image(); im.src = src; eyeImg[k] = im; }
const ready = (im) => im && im.complete && im.naturalWidth > 0;

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT — one design size per orientation, scaled to the window
// ═══════════════════════════════════════════════════════════════════════════
let LW = 960, LH = 640, cx = 480, cy = 320, ratio = 1, glowK = 1;
const dark = document.createElement('canvas');
const dctx = dark.getContext('2d');

function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vh > vw * 1.08;
  document.body.classList.toggle('portrait', portrait);
  LW = portrait ? 640 : 960;
  LH = portrait ? 820 : 704;
  // the well sits at the top; the strip under it is NULL's, so its line never covers the game
  cx = LW / 2; cy = portrait ? 330 : 322;
  wrap.style.width = (LW + 20) + 'px';
  canvas.style.aspectRatio = `${LW} / ${LH}`;
  wrap.style.transform = 'none';
  const scale = Math.min(vw / wrap.offsetWidth, vh / wrap.offsetHeight, IS_TOUCH ? 3 : 1.7) * 0.985;
  wrap.style.transform = `scale(${scale})`;
  const dpr = Math.min(window.devicePixelRatio || 1, Power.saving ? 1 : 2);
  ratio = Math.max(0.5, Math.min(3, scale * dpr));
  canvas.width = Math.round(LW * ratio);
  canvas.height = Math.round(LH * ratio);
  dark.width = Math.round(LW / 2); dark.height = Math.round(LH / 2);
  glowK = Power.saving ? 0.3 : IS_TOUCH ? 0.7 : 1;
  document.body.classList.toggle('saver', Power.saving);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);
Power.onChange(() => { layout(); refreshSettings(); });

const glow = (color, blur) => { ctx.shadowColor = color; ctx.shadowBlur = blur * glowK; };
const noGlow = () => { ctx.shadowBlur = 0; };
const px = (th, r) => cx + Math.cos(th) * r;
const py = (th, r) => cy + Math.sin(th) * r;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════
const STEP = 1 / 120;
let mode = 'menu';                 // menu | play | pause | over
let run = null;                    // your run
let attract = createRun();         // the bot's, behind the menu
let view = attract;                // the one being drawn
const input = { left: false, right: false, thrust: false, fire: false, kind: IS_TOUCH ? 'touch' : 'key' };
let botHold = { left: false, right: false, thrust: false, fire: false }, botTick = 0;
let acc = 0, last = performance.now(), clock = 0;
let crashedThisRun = false, pausedAt = 0, pauseNagged = false, awayAt = 0, autoPaused = false, menuT = 0, menuSaid = 0;
let settingsFrom = 'scrMenu';

function newFx() {
  return {
    parts: [], floats: [], trail: [], ghost: null, shake: 0, glitch: 0, flash: 0, panic: 0,
    banner: null, stolen: 0, mine: 0, bubble: null, count: 0, eyeFlash: 0, deflect: 0
  };
}
let fx = newFx();
// dust drifting down the well
const dust = Array.from({ length: 90 }, () => ({ th: Math.random() * TAU, r: 50 + Math.random() * 250, sp: 4 + Math.random() * 14 }));

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO VOICES
// ═══════════════════════════════════════════════════════════════════════════
// What the game knows right now: NULL's lines are picked and filled from this.
function context(extra) {
  const s = run;
  const w = Wallet.get();
  return Object.assign({
    runs: save.runs, next: save.runs + 1,
    ballsLost: save.ballsLost + (s && mode !== 'over' ? s.stats.ballsLost : 0),
    ballsEaten: save.ballsEaten + (s && mode !== 'over' ? s.stats.ballsEaten : 0),
    best: save.best, coins: w.coins, hour: new Date().getHours(),
    input: input.kind, cabinet: Cabinet.active,
    sector: s ? s.sector : 1, quota: s ? s.quota : 0, score: s ? Math.floor(s.score) : 0,
    balls: s ? s.balls : 0, chain: s ? s.chain : 0, away: 0
  }, otherCabinets(), extra);
}

const Null = {
  el: $('nullLine'), text: $('nullText'),
  line: '', shown: 0, hold: 0, next: null, used: new Set(),
  // force: say it now, over whatever is on the line. chance: say it only sometimes.
  say(event, extra, o = {}) {
    if (!save.talk && event !== 'talkOff') return;
    if (o.chance !== undefined && Math.random() > o.chance) return;
    const line = pick(NULL_LINES, event, context(extra), Math.random, this.used);
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

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS — what the rules said happened, turned into everything you notice
// ═══════════════════════════════════════════════════════════════════════════
function burst(x, y, color, n, speed = 140, life = 0.6) {
  if (Power.saving) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: 2 + Math.random() * 3 });
  }
  // anything big enough goes off with a ring of light
  if (n >= 10) fx.parts.push({ x, y, vx: 0, vy: 0, life: life * 0.7, max: life * 0.7, color, size: 0, ring: 12 + speed * 0.16 });
}
function float(x, y, text, color, size = 18) { fx.floats.push({ x, y, text, color, size, life: 0.9 }); }
function banner(title, sub, line, dur) { fx.banner = { title, sub, line, t: dur, dur }; }

function handle(s, live) {
  for (const e of s.events) onEvent(s, e, live);
  s.events.length = 0;
}

function onEvent(s, e, live) {
  const x = e.x !== undefined ? cx + e.x : cx, y = e.y !== undefined ? cy + e.y : cy;
  const snd = (name, ...a) => { if (live) audio.sfx(name, ...a); };
  switch (e.type) {
    case 'sector': {
      fx.count = 0;
      banner(`SECTOR ${String(e.sector).padStart(2, '0')}`, s.rule.name, s.rule.line, TUNE.INTRO);
      if (!live) break;
      audio.music(s.eye ? 'eye' : 'nexus');
      if (e.sector === 1) { Null.say('runStart', null, { force: true }); ballSay('runStart', 0.7); }
      else Null.say('rule_' + e.rule, null, { force: true });
      if (s.eye) ballSay('eye');
      if (fxFull() && save.talk && !s.eye && ((e.sector === 3 && !save.crashSeen) || (e.sector > 3 && !crashedThisRun && Math.random() < 0.06))) startCrash();
      break;
    }
    case 'go': if (live) audio.countdown('GO'); break;
    case 'shot': snd('shot'); break;
    case 'break': {
      snd('break', e.size, e.chain);
      burst(x, y, e.glyph ? C.red : e.size === 1 ? C.cyan : C.text, e.size === 3 ? 18 : e.size === 2 ? 12 : 8, 80 + e.size * 40, 0.45);
      float(x, y - 10, '+' + e.pts, e.band === 3 ? C.pink : e.band === 2 ? C.cyan : C.text, e.band === 3 ? 22 : 17);
      fx.panic = 0.4;
      if (e.size === 3) fx.shake = Math.max(fx.shake, 0.12);
      if (live && e.chain === 12) Null.say('rally');
      if (live && e.chain === 6) ballSay('showoff', 0.6);
      break;
    }
    case 'graze':
      snd('graze');
      burst(x, y, C.amber, 5, 90, 0.3);
      float(x, y - 12, 'CLOSE +' + e.pts, C.amber, 15);
      if (live) Null.say('graze', null, { chance: 0.1 });
      break;
    case 'power':
      snd('power');
      burst(x, y, POWER_LOOK[e.power].c, 14);
      float(x, y - 14, POWER_LOOK[e.power].name, POWER_LOOK[e.power].c, 20);
      break;
    case 'shieldBreak':
      snd('shield');
      burst(cx + s.ball.x, cy + s.ball.y, C.cyan, 24, 200);
      fx.flash = 0.25; fx.shake = 0.3;
      if (live) Null.say('shieldBreak', null, { chance: 0.4 });
      break;
    case 'ballLost': {
      const eaten = e.cause === 'eaten';
      snd(eaten ? 'eaten' : 'lost');
      burst(x, y, Look.hex, 34, 240, 0.9);
      if (eaten) for (const p of fx.parts.slice(-34)) p.suck = true;
      fx.shake = 0.6; fx.glitch = 0.5; fx.flash = 0.3;
      fx.ghost = { pts: fx.trail.slice(0, 28), t: TUNE.MOURN };   // MOURNING: its last path fades out
      fx.trail = [];
      if (!live) break;
      if (eaten && save.talk) fx.mine = 2;
      if (e.balls > 0) {
        Null.say(eaten ? 'ballEaten' : e.cause === 'gaze' ? 'ballGaze' : e.cause === 'score' ? 'ballScore' : 'ballDebris', null, { force: true });
        ballSay('respawn', 0.7);
      }
      break;
    }
    case 'loyal':
      snd('loyal');
      burst(x, y, C.text, 20, 220);
      float(x, y - 16, 'LOYAL', C.text, 22);
      fx.shake = 0.3;
      if (live) { ballSay('loyal'); Null.say('loyal', null, { force: true }); }
      break;
    case 'wrap':
      // off one side, back on the other: the trail must not be drawn across the screen
      fx.trail = [];
      if (live && e.first) { Null.say('wrap', null, { chance: 0.7 }); ballSay('wrap', 0.5); }
      break;
    case 'idle': if (live) Null.say('idle'); break;
    case 'heatCritical':
      float(cx, cy - 120, 'CRITICAL HEAT', C.pink, 34);
      fx.glitch = 0.4;
      if (live) { audio.sfx('warn'); Null.say('heatCritical'); ballSay('critical', 0.4); }
      break;
    case 'hudTheft':
      snd('theft');
      fx.stolen = 3.2; fx.glitch = 0.3;
      if (live) Null.say('hudTheft', null, { force: true });
      break;
    case 'surgeWarn':
      snd('warn');
      if (live) Null.say('surgeWarn', null, { chance: 0.5 });
      break;
    case 'surge': snd('surge'); fx.shake = 0.25; break;
    case 'lagWarn': case 'shiftWarn': snd('warn'); break;
    case 'lagSnap':
      snd('snap'); fx.glitch = 0.35; fx.trail = [];
      if (live) ballSay('lag', 0.35);
      break;
    case 'shiftJump':
      snd('snap'); fx.glitch = 0.3;
      if (live) ballSay('shift', 0.35);
      break;
    case 'debrisEaten':
      for (let i = 0; i < 5; i++) fx.parts.push({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: 0, vy: 0, life: 0.5, max: 0.5, color: C.purple, size: 3, suck: true });
      break;
    case 'eyeBlinkWarn': case 'eyeShut': snd('blink'); break;
    case 'eyeHit': {
      // every shot that lands is a tick; every twelfth is a blow
      burst(cx, cy, C.pink, 5, 220, 0.4);
      fx.eyeFlash = Math.max(fx.eyeFlash, 0.12);
      if (e.hp > 0 && e.hp % 12 === 0) {
        snd('eyeHit');
        burst(cx, cy, C.pink, 30, 300, 0.8);
        fx.shake = 0.45; fx.eyeFlash = 0.5; fx.glitch = 0.25;
        float(cx, cy - 76, 'IT FELT THAT', C.pink, 26);
        if (live) { Null.say('eyeHit', null, { chance: 0.7 }); ballSay('eyeHit', 0.6); }
      } else snd('eyeTick');
      break;
    }
    case 'eyeDeflect':
      snd('deflect');
      if (fx.deflect <= 0) { fx.deflect = 1.4; float(cx, cy - 76, 'SHUT', C.amber, 22); if (live) Null.say('eyeDeflect', null, { chance: 0.3 }); }
      break;
    case 'eyeDefeated':
      burst(cx, cy, C.pink, 70, 380, 1.2); burst(cx, cy, C.cyan, 50, 300, 1.2);
      fx.shake = 0.9; fx.flash = 0.5;
      if (live) Null.say('eyeDefeated', null, { force: true });
      break;
    case 'sectorClear':
      snd('clear');
      banner(`SECTOR ${String(e.sector).padStart(2, '0')} SALVAGED`, `+${e.coins} ◎ COINS`, `CLEAR BONUS +${e.bonus}`, TUNE.CLEAR);
      if (!live) break;
      Wallet.award(e.coins);
      save.coins += e.coins;
      Save.write();
      audio.music('nexus');
      if (!e.eye) { Null.say('sectorClear', null, { chance: 0.6 }); ballSay('sectorClear', 0.4); }
      break;
    case 'gameOver': if (live) endRun(); break;
    default: break;
  }
}

// ── the crash that isn't one: NULL stops the game to see what you do ──
const crash = { t: 0, said: false };
function startCrash() {
  crash.t = 3.6; crash.said = false; crashedThisRun = true;
  $('crashMore').textContent = '* PRESS ANY BUTTON TO LOSE ALL UNSAVED PROGRESS.';
  $('crashMore').className = '';
  $('crash').classList.add('on');
  audio.sfx('crash');
  audio.pauseMusic(true);
  Null.clear();
}
function updateCrash(dt) {
  crash.t -= dt;
  if (crash.t < 1.9 && !crash.said) {
    crash.said = true;
    $('crashMore').textContent = 'NULL> ' + pick(NULL_LINES, 'crash');
    $('crashMore').className = 'confess';
  }
  if (crash.t <= 0) {
    crash.t = 0;
    $('crash').classList.remove('on');
    audio.pauseMusic(false);
    fx.glitch = 0.6;
    save.crashSeen = true; Save.write();
    Null.say('rule_' + run.rule.id, null, { force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNS
// ═══════════════════════════════════════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('on', el.id === id));
  document.body.classList.toggle('attract', view === attract);
  $('btnPauseHud').classList.toggle('on', mode === 'play');
  document.body.classList.toggle('playing', mode === 'play');     // the touch buttons
}

// `opts` is for the console: Nexus.startRun({ sector: 5, seed: 1 }) starts at THE EYE
function startRun(opts = {}) {
  audio.init();
  save.runs++; Save.write();
  run = createRun(Object.assign({ moods: save.moods }, opts));
  view = run; fx = newFx(); acc = 0; crashedThisRun = false; release();
  mode = 'play';
  show(null);
  handle(run, true);
}

function endRun() {
  const s = run;
  mode = 'over';
  const fresh = recordRun(save, s);
  Save.write();
  const r = runRecap(s);
  Cabinet.report('run', { score: r.score, sector: r.sector });
  audio.sfx('over');
  audio.bend(0.85, 900);
  $('oEyebrow').textContent = `Sector ${String(r.sector).padStart(2, '0')} // ${s.rule.name}`;
  $('oTitle').textContent = fresh.best && r.score > 0 ? 'NEW HIGH SCORE' : 'GAME OVER';
  $('oScore').textContent = r.score.toLocaleString('en-US');
  const chips = [
    ['Sectors', r.sectors], ['Pieces broken', r.broken], ['Best rally', r.bestChain], ['Close calls', r.grazes], ['Time', `${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}`],
    ['Coins', '◎ ' + r.coins, true]
  ];
  $('oStats').innerHTML = chips.map(([k, v, hl]) => `<div class="sc${hl ? ' hl' : ''}"><i>${k}</i><b>${v}</b></div>`).join('');
  $('oCause').innerHTML = r.cause ? `LAST BALL: <b>${r.cause}</b>` : '';
  show('scrOver');
  Null.say(fresh.best && r.score > 0 ? 'newBest' : 'gameOver', null, { force: true });
  ballSay('gameOver');
  refreshMenu();
}

function toMenu() {
  mode = 'menu';
  attract = createRun();
  view = attract; fx = newFx(); run = null;
  audio.bend(1, 18000);
  audio.music('nexus');
  menuT = 0; menuSaid = 1;
  refreshMenu();
  show('scrMenu');
}

function pause(auto = false) {
  if (mode !== 'play' || crash.t > 0) return;
  mode = 'pause'; release();
  pausedAt = performance.now(); pauseNagged = false; autoPaused = auto;
  $('pSector').textContent = String(run.sector).padStart(2, '0');
  audio.bend(1, 900);
  show('scrPause');
  if (!auto) Null.say('pause', null, { force: true });
}
function resume() {
  if (mode !== 'pause') return;
  mode = 'play'; acc = 0; last = performance.now();
  audio.bend(1, 18000);
  show(null);
  Null.say('resume', null, { chance: 0.5, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════════════
let bent = '';
function update(dt) {
  clock += dt;
  if (crash.t > 0) updateCrash(dt);
  else if (mode === 'play') {
    acc += dt;
    while (acc >= STEP && mode === 'play') {
      step(run, input, STEP);
      acc -= STEP;
      if (run.events.length) handle(run, true);
      if (crash.t > 0) break;
    }
    if (mode === 'play') {
      // the 3-2-1 before a sector
      const n = run.phase === 'intro' && run.phaseT <= 2.4 ? Math.ceil(run.phaseT / 0.8) : 0;
      if (n !== fx.count) { fx.count = n; if (n > 0) audio.countdown(String(n)); }
      const key = run.freeze > 0 ? 'f' : run.surge.state === 'on' ? 's' : run.critical ? 'c' : '';
      if (key !== bent) { bent = key; audio.bend(key === 'f' ? 0.6 : key === 's' ? 0.86 : key === 'c' ? 1.05 : 1, key === 'f' ? 1400 : key === 's' ? 2600 : 18000); }
    }
  } else if (mode === 'menu') {
    // NULL plays itself behind the menu
    acc += dt;
    while (acc >= STEP) {
      if (botTick++ % 4 === 0) botHold = botInput(attract, 0.7);
      step(attract, botHold, STEP);
      acc -= STEP;
      if (attract.events.length) handle(attract, false);
    }
    if (attract.phase === 'over') { attract = createRun(); view = attract; fx = newFx(); }
    menuT += dt;
    if (menuSaid === 1 && menuT > 14) { menuSaid = 2; Null.say('attract'); }
    else if (menuSaid === 2 && menuT > 50) { menuSaid = 3; Null.say('idleMenu'); }
  } else if (mode === 'pause' && !pauseNagged && performance.now() - pausedAt > 25000) {
    pauseNagged = true;
    Null.say('pauseLong');
  }

  // things that only exist on the screen
  const moving = mode === 'play' || mode === 'menu';
  const s = view;
  if (moving && s.phase !== 'over' && crash.t <= 0) {
    const b = s.ball;
    fx.trail.unshift({ x: cx + b.x, y: cy + b.y });
    const len = b.showoff ? 28 : 16;
    if (fx.trail.length > len) fx.trail.length = len;
  }
  if (mode !== 'pause') {
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i];
      p.life -= dt;
      if (p.life <= 0) { fx.parts.splice(i, 1); continue; }
      if (p.suck) { p.vx += (cx - p.x) * 6 * dt; p.vy += (cy - p.y) * 6 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.97; p.vy *= 0.97;
    }
    for (let i = fx.floats.length - 1; i >= 0; i--) {
      const f = fx.floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) fx.floats.splice(i, 1);
    }
    for (const d of dust) {
      d.r -= d.sp * dt * (1 + s.heat / 50);
      d.th += (30 / Math.max(40, d.r)) * dt;      // it swirls as it falls
      if (d.r < s.holeR) { d.r = TUNE.R_OUT + Math.random() * 30; d.th = Math.random() * TAU; }
    }
    for (const k of ['shake', 'glitch', 'flash', 'panic', 'stolen', 'mine', 'eyeFlash', 'deflect']) fx[k] = Math.max(0, fx[k] - dt);
    if (fx.banner) { fx.banner.t -= dt; if (fx.banner.t <= 0) fx.banner = null; }
    if (fx.ghost) { fx.ghost.t -= dt; if (fx.ghost.t <= 0) fx.ghost = null; }
    if (fx.bubble) { fx.bubble.t -= dt; if (fx.bubble.t <= 0) fx.bubble = null; }
  }
  Null.update(dt);
  hud();
}

// ═══════════════════════════════════════════════════════════════════════════
// HUD (the page around the canvas)
// ═══════════════════════════════════════════════════════════════════════════
const cache = {};
function set(id, text) { if (cache[id] !== text) { cache[id] = text; $(id).textContent = text; } }
function hud() {
  const s = view;
  let score = String(Math.floor(s.score)).padStart(6, '0');
  // NULL has some of the digits: the readout shows the holes
  if (fx.stolen > 0 && view === run) score = score.slice(0, 2) + (Math.floor(clock * 12) % 2 ? '____' : '    ');
  set('vScore', score);
  $('hScore').classList.toggle('stolen', fx.stolen > 0 && view === run);
  set('vChain', String(s.chain));
  const m = heatMultiplier(s.heat);
  set('vMult', 'x' + m);
  set('vSector', String(s.sector).padStart(2, '0'));
  set('vRule', s.rule.name);
  set('vBits', s.eye ? `EYE ${Math.max(0, s.eye.hp)}/${s.eye.maxHp}` : `${Math.min(s.bits, s.quota)}/${s.quota}`);
  set('vBalls', '●'.repeat(Math.max(0, s.balls)) + '○'.repeat(Math.max(0, TUNE.BALLS - s.balls)));
  // it relabels the counter for a moment when it takes one
  set('lBalls', fx.mine > 0 && view === run ? 'Mine +1' : 'Balls');
  $('hLives').classList.toggle('mine', fx.mine > 0 && view === run);
  const heat = Math.round(s.heat);
  if (cache.heat !== heat) { cache.heat = heat; $('heatFill').style.width = heat + '%'; $('heatLab').classList.toggle('hot', heat >= TUNE.CRITICAL); }
  const prog = s.eye ? Math.round(100 * (1 - Math.max(0, s.eye.hp) / s.eye.maxHp)) : Math.round(100 * Math.min(1, s.bits / s.quota));
  if (cache.prog !== prog) { cache.prog = prog; $('bitsFill').style.width = prog + '%'; }
  const tags = (s.shield ? 'F|' : '') + (s.spread > 0 ? 'S' + Math.ceil(s.spread) + '|' : '') + (s.freeze > 0 ? 'T' + Math.ceil(s.freeze) : '');
  if (cache.tags !== tags) {
    cache.tags = tags;
    $('puList').innerHTML =
      (s.shield ? `<span class="puTag" style="color:${C.cyan}">FIREWALL</span>` : '') +
      (s.spread > 0 ? `<span class="puTag" style="color:${C.pink}">SPREAD ${Math.ceil(s.spread)}</span>` : '') +
      (s.freeze > 0 ? `<span class="puTag" style="color:#cfe8ff">FREEZE ${Math.ceil(s.freeze)}</span>` : '');
  }
  const boss = !!s.eye && view === run && s.phase !== 'clear';
  if (cache.boss !== boss) { cache.boss = boss; $('bossBar').classList.toggle('on', boss); }
  if (boss) { const w = Math.round(100 * Math.max(0, s.eye.hp) / s.eye.maxHp); if (cache.bossW !== w) { cache.bossW = w; $('bossHpFill').style.width = w + '%'; } }
}
function refreshCoins() { set('vCoins', String(Wallet.get().coins)); set('mCoins', String(Wallet.get().coins)); }
function refreshMenu() {
  set('mBest', save.best.toLocaleString('en-US'));
  set('mSector', save.bestSector ? 'SECTOR ' + String(save.bestSector).padStart(2, '0') : '—');
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
const TINT = { standard: C.purple, leak: C.amber, panic: C.red, lag: C.cyan, shift: C.pink, overclock: '#ff9a3d', eye: C.pink };

// deep space behind the well: painted once for each sector and each window size
function paintBackdrop(s) {
  const q = Power.saving ? 1 : Math.min(1.5, Math.max(1, ratio));
  const key = `${LW}x${LH}:${q}:${s.rule.id}`;
  if (key === stillFor) return;
  stillFor = key;
  still.width = Math.round(LW * q); still.height = Math.round(LH * q);
  const c = still.getContext('2d');
  c.setTransform(q, 0, 0, q, 0, 0);
  const tint = TINT[s.rule.id] || C.purple, rnd = seeded(97 + s.rule.id.length * 131 + s.rule.id.charCodeAt(0));
  c.fillStyle = C.void; c.fillRect(0, 0, LW, LH);
  const neb = (x, y, R, col, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.5, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
  };
  neb(cx, cy, 620, '#3a1a8c', 0.5);
  neb(LW * 0.08, LH * 0.16, 400, tint, 0.16);
  neb(LW * 0.94, LH * 0.84, 440, C.pink, 0.12);
  neb(LW * 0.9, LH * 0.08, 320, C.cyan, 0.08);
  neb(LW * 0.1, LH * 0.92, 300, '#4d7cff', 0.1);
  // stars, a few of them bright enough to bloom
  for (let i = 0; i < 260; i++) {
    const x = rnd() * LW, y = rnd() * LH, z = rnd();
    c.fillStyle = `rgba(${200 + z * 55 | 0},${205 + z * 50 | 0},255,${0.1 + z * z * 0.7})`;
    c.beginPath(); c.arc(x, y, 0.35 + z * 1.05, 0, TAU); c.fill();
    if (z > 0.965) light(c, x, y, 7, '#cfd8ff', 0.5);
  }
  // the grid the other cabinets sit on, falling away from the middle
  c.strokeStyle = rgba(tint, 0.05); c.lineWidth = 1;
  c.beginPath();
  for (let x = cx % 48; x <= LW; x += 48) { c.moveTo(x, 0); c.lineTo(x, LH); }
  for (let y = cy % 48; y <= LH; y += 48) { c.moveTo(0, y); c.lineTo(LW, y); }
  c.stroke();
  // the corners fall off into the dark
  const v = c.createRadialGradient(cx, cy, TUNE.R_OUT * 0.9, cx, cy, Math.hypot(LW, LH) * 0.62);
  v.addColorStop(0, 'rgba(1,1,6,0)'); v.addColorStop(1, 'rgba(1,1,6,0.78)');
  c.fillStyle = v; c.fillRect(0, 0, LW, LH);
  brackets(c, 12, 12, LW - 24, LH - 24, tint, 26, 0.4);
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

  drawWell(s, t);
  drawHole(s, t);
  if (s.eye) drawEye(s, t);
  drawObjects(s, t);
  drawWarnings(s, t);
  drawBall(s, t);
  sparks(ctx, fx.parts);
  // everything bright spills a little light, as it does in the other two cabinets
  if (rich) bloom.apply(ctx, canvas, LW, LH, IS_TOUCH ? 0.8 : 1);
  if (s.rule.id === 'panic' && s.phase === 'play') drawDark(s);
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

function drawWell(s, t) {
  const tint = TINT[s.rule.id] || C.purple, R = TUNE.R_OUT, hot = s.critical && Math.floor(t * 8) % 2;
  // Glitch Pong's spiral of wire, turning behind everything
  ctx.strokeStyle = rgba(C.purple, 0.2); ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 0; k < 13; k++) {
    const r0 = 150 + k * 58, ph = t * 0.035 + k * 0.7;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU, r = r0 * (1 + 0.045 * Math.sin(a * 2 + ph) + 0.02 * Math.sin(a * 5 - ph * 2));
      const x = cx + Math.cos(a + ph * 0.3) * r + Math.cos(ph) * 14, y = cy + Math.sin(a + ph * 0.3) * r + Math.sin(ph) * 14;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
  // outside the glass is not the game: it sits a little further back
  ctx.fillStyle = 'rgba(2,2,9,0.42)';
  ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.arc(cx, cy, R + 3, 0, TAU, true); ctx.fill();
  // the well itself: space pulled tight toward the middle
  const g = ctx.createRadialGradient(cx, cy, s.holeR, cx, cy, R);
  g.addColorStop(0, 'rgba(58,22,128,0.5)'); g.addColorStop(0.45, 'rgba(20,12,60,0.3)'); g.addColorStop(1, 'rgba(6,8,24,0.12)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, TAU); ctx.clip();
  // rings that crowd together as they fall in
  const flow = (t * 0.05 * (1 + s.heat / 80)) % 1;
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const k = ((i + 1 - flow) / 9), r = s.holeR + (R - s.holeR) * Math.pow(k, 1.7);
    ctx.strokeStyle = rgba(C.cyan, 0.035 + 0.1 * (1 - k));
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  }
  // spokes, twisted the way the hole twists everything
  ctx.strokeStyle = rgba(C.purple, 0.16);
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a0 = t * 0.03 + (i / 18) * TAU;
    for (let j = 0; j <= 14; j++) {
      const k = j / 14, r = R - (R - s.holeR - 8) * k, a = a0 + 1.5 * k * k;
      if (j) ctx.lineTo(px(a, r), py(a, r)); else ctx.moveTo(px(a, r), py(a, r));
    }
  }
  ctx.stroke();
  // dust falling in, each grain a short streak
  ctx.strokeStyle = 'rgba(210,200,255,0.3)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const d of dust) {
    if (d.r >= R) continue;
    const l = 1.5 + d.sp * 0.22 + (R - d.r) * 0.012;
    ctx.moveTo(px(d.th, d.r), py(d.th, d.r)); ctx.lineTo(px(d.th - 0.012, d.r + l), py(d.th - 0.012, d.r + l));
  }
  ctx.stroke(); ctx.lineCap = 'butt';
  ctx.restore();
  // the two lines inside which a kill is worth more
  ctx.setLineDash([2, 10]);
  ctx.font = '700 10px Orbitron, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const [r, col, label] of [[TUNE.BAND_MID, C.cyan, 'x2'], [TUNE.BAND_IN, C.pink, 'x3']]) {
    ctx.strokeStyle = rgba(col, 0.3); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(col, 0.7);
    ctx.fillText(label, px(-0.5, r - 16), py(-0.5, r - 16));
  }
  ctx.setLineDash([]);
  // the glass: a tube of light, and the bezel of an instrument round it
  const edge = hot ? C.pink : tint === C.purple ? C.cyan : tint;
  ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, TAU);
  tube(ctx, edge, 2.4, 0.95);
  ctx.strokeStyle = rgba(edge, 0.3); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU, l = i % 6 ? 4 : 9;
    ctx.moveTo(px(a, R + 10), py(a, R + 10)); ctx.lineTo(px(a, R + 10 + l), py(a, R + 10 + l));
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(edge, 0.55); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = -t * 0.12 + (i / 3) * TAU;
    ctx.beginPath(); ctx.arc(cx, cy, R + 23, a, a + 0.5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawHole(s, t) {
  const R = s.holeR, surge = s.surge.state, leak = s.leak > 0;
  const col = leak ? C.amber : surge === 'on' ? C.pink : '#b45cff';
  ctx.save();
  // the ring of light it bends round itself: Glitch Pong's
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 3);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.06, rgba(col, 0.62)); g.addColorStop(0.2, rgba(col, 0.3));
  g.addColorStop(0.45, rgba(C.pink, 0.08)); g.addColorStop(1, rgba(C.purple, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R * 3, 0, TAU); ctx.fill();
  // what it is eating, going round
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const r = R + 5 + i * 4.2, a = t * (2.1 - i * 0.2) + i * 1.3;
    ctx.strokeStyle = rgba(i % 2 ? C.pink : C.cyan, 0.45 - i * 0.045);
    ctx.lineWidth = 2.6 - i * 0.2;
    ctx.beginPath(); ctx.arc(cx, cy, r, a, a + 0.9 + i * 0.28); ctx.stroke();
  }
  // breathing in
  if (surge !== 'idle') {
    const on = surge === 'on';
    for (let i = 0; i < 3; i++) {
      const k = ((t * (on ? 1.4 : 0.8) + i / 3) % 1);
      ctx.strokeStyle = rgba(C.pink, (on ? 0.6 : 0.32) * k);
      ctx.lineWidth = on ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R + (1 - k) * (on ? 190 : 120), 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  // inside it: the spokes of Glitch Pong's nexus, barely there
  if (!s.eye) {
    ctx.strokeStyle = rgba(col, 0.22); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = -t * 0.25 + (i / 11) * TAU + Math.sin(i * 3.7) * 0.2;
      ctx.moveTo(px(a, R * 0.3), py(a, R * 0.3)); ctx.lineTo(px(a + 0.25, R * 0.92), py(a + 0.25, R * 0.92));
    }
    ctx.stroke(); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, TAU); ctx.stroke();
  }
  // the horizon: past this line the ball is NULL's
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  tube(ctx, col, 2, 1);
}

function drawEye(s, t) {
  const e = s.eye, b = s.ball;
  const looking = e.lid !== 'shut';
  // its gaze: a bar of light with a gap in it
  for (let i = 0; i < e.beams; i++) {
    const gap = gapRadius(e, i), H = TUNE.BEAM_HALF;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(e.gazeTh + i * Math.PI);
    const a = s.holeR + 6, g0 = gap - e.gapHalf, g1 = gap + e.gapHalf, z = TUNE.R_OUT;
    if (looking) {
      const flick = e.lid === 'warn' ? (Math.floor(t * 16) % 2 ? 0.35 : 0.8) : 1;
      ctx.globalAlpha = flick;
      const beam = ctx.createLinearGradient(0, -H, 0, H);
      beam.addColorStop(0, rgba(C.pink, 0.3)); beam.addColorStop(0.5, rgba(C.pink, 0.85)); beam.addColorStop(1, rgba(C.pink, 0.3));
      for (const [x0, x1] of [[a, g0], [g1, z]]) {
        if (x1 <= x0) continue;
        ctx.fillStyle = beam; ctx.fillRect(x0, -H, x1 - x0, H * 2);
        ctx.fillStyle = rgba(C.pink, 0.95); ctx.fillRect(x0, -H, x1 - x0, 1.2); ctx.fillRect(x0, H - 1.2, x1 - x0, 1.2);
        ctx.fillStyle = '#fff'; ctx.fillRect(x0, -1.8, x1 - x0, 3.6);
      }
      // the gap, marked so it can be read at a glance
      ctx.beginPath();
      for (const x of [g0, g1]) { ctx.moveTo(x, -17); ctx.lineTo(x, 17); }
      tube(ctx, C.cyan, 2, 1);
    } else {
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = rgba(C.pink, 0.26); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(g0, 0); ctx.moveTo(g1, 0); ctx.lineTo(z, 0); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  // the Eye itself, looking out of the hole toward the ball
  const side = b.x / (Math.hypot(b.x, b.y) || 1);
  const im = e.lid === 'shut' ? eyeImg.blink : side < -0.35 ? eyeImg.left : side > 0.35 ? eyeImg.right : eyeImg.neutral;
  const S = 226 + Math.sin(t * 2) * 4;
  ctx.save();
  light(ctx, cx, cy, S * 0.8, C.purple, 0.45);
  if (ready(im)) {
    if (fx.eyeFlash > 0 && fxFull()) { ctx.globalAlpha = 0.6; ctx.drawImage(im, cx - S / 2 - 8, cy - S / 2, S, S); ctx.drawImage(im, cx - S / 2 + 8, cy - S / 2, S, S); ctx.globalAlpha = 1; }
    ctx.drawImage(im, cx - S / 2, cy - S / 2, S, S);
  } else {
    // no sprite (opened without the arcade's assets): a drawn one
    ctx.beginPath(); ctx.ellipse(cx, cy, 66, e.lid === 'shut' ? 4 : 30, 0, 0, TAU);
    tube(ctx, C.purple, 3, 1);
    if (e.lid !== 'shut') { ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(cx + side * 18, cy, 12, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function drawObjects(s, t) {
  for (const o of s.objs) {
    const forming = o.age < o.warm;
    ctx.save();
    ctx.translate(cx + o.x, cy + o.y);
    // still materialising: a flickering outline that can't be touched yet
    ctx.globalAlpha = forming && o.warm > 0.3 ? 0.25 + 0.4 * (o.age / o.warm) * (Math.floor(t * 18) % 2 ? 1 : 0.5) : 1;
    if (o.kind === 'power') {
      const L = POWER_LOOK[o.power];
      if (o.life < 3 && Math.floor(t * 10) % 2) ctx.globalAlpha = 0.35;      // about to go
      light(ctx, 0, 0, 30, L.c, 0.55);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = t + (i / 6) * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 13, Math.sin(a) * 13); }
      ctx.closePath();
      ctx.fillStyle = rgba(L.c, 0.2); ctx.fill();
      tube(ctx, L.c, 1.8, 1);
      ctx.strokeStyle = rgba(L.c, 0.6); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 18, -t * 2, -t * 2 + 1.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 18, -t * 2 + Math.PI, -t * 2 + Math.PI + 1.6); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(L.ch, 0, 1);
    } else drawDebris(o, t, forming);
    ctx.restore();
  }
  // the ball's shots: bolts of its own colour
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineWidth = 3.2;
  for (const sh of s.shots) {
    const v = Math.hypot(sh.vx, sh.vy) || 1, x = cx + sh.x, y = cy + sh.y, ex = x - (sh.vx / v) * 20, ey = y - (sh.vy / v) * 20;
    const g = ctx.createLinearGradient(x, y, ex, ey);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, Look.hex); g.addColorStop(1, rgba(Look.hex, 0));
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    light(ctx, x, y, 10, Look.hex, 0.8);
  }
  ctx.restore();
}

// one of Breakpoint's bricks: a pane of holographic glass
function brick(x, y, w, h, col, lit) {
  glass(ctx, x, y, w, h, col, { fill: lit ? 0.3 : 0.1, edge: lit ? 1 : 0.55 });
}

// What the other cabinets threw away, drawn so you can tell where it came
// from. Three sizes: a chunk of wall, a couple of bricks, one brick.
function drawDebris(o, t, forming) {
  const R = o.rad, lit = !forming;
  if (o.look !== 'glyph') ctx.rotate(o.rot);
  if (o.look === 'brick') {
    const a = BRICKS[o.tint % BRICKS.length], b = BRICKS[(o.tint + 1) % BRICKS.length];
    if (lit) light(ctx, 0, 0, R * 2.1, a, 0.3);
    if (o.size === 3) {
      // a piece of Breakpoint's wall: three courses, staggered
      for (const [x, y, c] of [[-11, -15, a], [11, -15, b], [-22, 0, b], [0, 0, a], [22, 0, b], [-11, 15, a], [11, 15, b]]) brick(x, y, 20, 12, c, lit);
    } else if (o.size === 2) {
      brick(-5, -7, 22, 12, a, lit); brick(5, 7, 22, 12, b, lit);
    } else {
      brick(0, 0, 19, 11, a, lit);
      // cracked through
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-3, -5.5); ctx.lineTo(1, -0.5); ctx.lineTo(-1.5, 1.5); ctx.lineTo(0.5, 5.5); ctx.stroke();
    }
  } else if (o.look === 'paddle') {
    // one of Glitch Pong's paddles — a bar of solid light — then half of one, then a splinter
    const col = PADDLES[o.tint % 2], w = o.size === 3 ? 58 : o.size === 2 ? 34 : 19, h = o.size === 3 ? 13 : o.size === 2 ? 11 : 8;
    if (lit) light(ctx, 0, 0, w * 0.85, col, 0.5);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 3, -h / 2); ctx.lineTo(w / 2 - (o.size < 3 ? 1 : 3), -h / 2);
    if (o.size < 3) { ctx.lineTo(w / 2 - 6, -h / 6); ctx.lineTo(w / 2 - 1, h / 6); ctx.lineTo(w / 2 - 7, h / 2); }   // where it snapped
    else { ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 3); ctx.lineTo(w / 2, h / 2 - 3); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 3, h / 2); }
    ctx.lineTo(-w / 2 + 3, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 3);
    ctx.lineTo(-w / 2, -h / 2 + 3); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 3, -h / 2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, col); g.addColorStop(1, rgba(col, lit ? 0.7 : 0.3));
    ctx.fillStyle = lit ? g : rgba(col, 0.25); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', lit ? 0.8 : 0.4); ctx.lineWidth = 1; ctx.stroke();
  } else if (o.look === 'glyph') {
    // a digit that used to be in your score
    if (lit) light(ctx, 0, 0, 30, C.red, 0.5);
    ctx.font = '34px VT323, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.cyan; ctx.fillText(o.ch, -2, 1);
    ctx.fillStyle = C.pink; ctx.fillText(o.ch, 2, 1);
    ctx.fillStyle = '#fff'; ctx.fillText(o.ch, 0, 1);
    ctx.strokeStyle = rgba(C.red, 0.7); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, R + 1, t * 2, t * 2 + 4.6); ctx.stroke();
  } else {
    // static: a pane of dead channel, snow sliding across it
    const z = R * 1.62, f = Math.floor(t * 14);
    if (lit) light(ctx, 0, 0, R * 2, '#cfd8ff', 0.28);
    roundRect(ctx, -z / 2, -z / 2, z, z, 4);
    ctx.fillStyle = 'rgba(200,215,255,0.1)'; ctx.fill();
    ctx.save(); ctx.clip();
    for (let j = 0, rows = Math.ceil(z / 3.2); j < rows; j++) {
      const v = (Math.sin(o.id * 12.9 + j * 7.1 + f * 1.7) + 1) / 2, u = (Math.sin(o.id * 3.1 + j * 4.7 + f * 2.9) + 1) / 2;
      ctx.fillStyle = `rgba(228,236,255,${0.1 + v * 0.62})`;
      ctx.fillRect(-z / 2 + u * z * 0.7 - 2, -z / 2 + j * 3.2 + 0.6, z * (0.12 + v * 0.55), 1.7);
    }
    ctx.restore();
    roundRect(ctx, -z / 2, -z / 2, z, z, 4);
    ctx.strokeStyle = `rgba(228,236,255,${lit ? 0.9 : 0.45})`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-z / 2 + 5, -z / 2 + 2); ctx.lineTo(z / 2 - 5, -z / 2 + 2); ctx.stroke();
  }
}

function drawWarnings(s, t) {
  const b = s.ball;
  // LAG SPIKE: where it is about to put you back
  if (s.rule.id === 'lag' && s.lag.state === 'warn') {
    const past = lagTarget(s);
    if (past) ghostBall(cx + past.x, cy + past.y, cx + b.x, cy + b.y, 'LAG', t);
  }
  // QUANTUM SHIFT: where each piece is about to be
  if (s.rule.id === 'shift' && s.shift.state === 'warn') {
    ctx.save();
    ctx.globalAlpha = Math.floor(t * 12) % 2 ? 0.9 : 0.4;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    for (const o of s.objs) {
      if (!shiftLands(s, o)) continue;
      ctx.beginPath(); ctx.arc(cx - o.x, cy - o.y, o.rad, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
function ghostBall(x, y, fromX, fromY, label, t) {
  ctx.save();
  ctx.globalAlpha = Math.floor(t * 12) % 2 ? 0.9 : 0.45;
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(x, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, TUNE.BALL_R + 4, 0, TAU); ctx.stroke();
  ctx.fillStyle = C.amber; ctx.font = '700 9px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(label, x, y - 13);
  ctx.restore();
}

function drawBall(s, t) {
  const b = s.ball;
  // MOURNING: the path the last ball took, fading
  if (fx.ghost && fx.ghost.pts.length > 1) {
    ctx.strokeStyle = rgba(Look.hex, 0.4 * (fx.ghost.t / TUNE.MOURN));
    ctx.lineWidth = 2; ctx.setLineDash([2, 5]);
    ctx.beginPath();
    fx.ghost.pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (s.phase === 'over') return;
  const x = cx + b.x, y = cy + b.y, R = TUNE.BALL_R;
  if (b.inv > 0 && s.phase === 'play' && Math.floor(t * 14) % 2) return;       // a new ball blinks
  const dim = b.mourn > 0 ? 0.5 + 0.5 * (1 - b.mourn / TUNE.MOURN) : 1;
  const trailSkin = Look.get('trail'), ballSkin = Look.get('ball');
  const look = (trailSkin !== 'default' || ballSkin !== 'default') && {
    rgb: Look.rgb, hex: Look.hex, t, heat: s.heat / 100, quality: glowK < 0.5 ? 0.5 : 1,
    vx: b.vx / 60, vy: b.vy / 60, r: R, charge: 2, speed: Math.hypot(b.vx, b.vy) / 60, rally: s.chain
  };
  const hx = Math.cos(b.a), hy = Math.sin(b.a);
  const thrusting = s.phase === 'play' && (view === run ? input.thrust : botHold.thrust);
  ctx.save();
  if (trailSkin !== 'default') { ctx.globalAlpha = dim; Look.draw.trail(ctx, fx.trail, look); }
  else comet(ctx, fx.trail, R * 0.95, Look.hex, (b.showoff ? 1 : 0.7) * dim);
  ctx.globalAlpha = dim;
  // the thrust: a flame out of the back
  if (thrusting) {
    const k = 13 + Math.random() * 9, bx = x - hx * 5, by = y - hy * 5, ex = x - hx * (6 + k), ey = y - hy * (6 + k);
    const g = ctx.createLinearGradient(bx, by, ex, ey);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, C.amber); g.addColorStop(1, rgba(C.pink, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(bx - hy * 4.5, by + hx * 4.5); ctx.lineTo(ex, ey); ctx.lineTo(bx + hy * 4.5, by - hx * 4.5); ctx.fill();
    light(ctx, bx - hx * 4, by - hy * 4, 13, C.amber, 0.7);
    ctx.restore();
  }
  if (ballSkin !== 'default') Look.draw.ball(ctx, x, y, R + 1, look);
  else {
    light(ctx, x, y, R * (b.showoff ? 5.5 : 4), Look.hex, 0.8);
    const g = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, Look.hex); g.addColorStop(1, rgba(Look.hex, 0.8));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // which way it is facing: a chevron ahead of it
  ctx.beginPath();
  ctx.moveTo(x + hx * 10 - hy * 5, y + hy * 10 + hx * 5); ctx.lineTo(x + hx * 17, y + hy * 17); ctx.lineTo(x + hx * 10 + hy * 5, y + hy * 10 - hx * 5);
  tube(ctx, Look.hex, 1.8, dim);
  ctx.globalAlpha = 1;
  if (s.shield) {
    const r = R + 13 + Math.sin(t * 8);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = rgba(C.cyan, 0.07); ctx.fill();
    tube(ctx, C.cyan, 1.8, 1);
  }
  ctx.restore();
}

// what the ball has to say
function drawBubble(s) {
  if (!fx.bubble || view !== run || s.phase === 'over') return;
  const x = cx + s.ball.x, y = cy + s.ball.y;
  ctx.font = '15px "Share Tech Mono", monospace';
  ctx.textAlign = x > cx ? 'right' : 'left'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = Math.min(1, fx.bubble.t * 2);
  const tx = x + (x > cx ? -20 : 20), ty = y - 24;
  const tw = ctx.measureText(fx.bubble.text).width;
  roundRect(ctx, x > cx ? tx - tw - 7 : tx - 7, ty - 11, tw + 14, 22, 4);
  ctx.fillStyle = 'rgba(3,4,10,0.78)'; ctx.fill();
  ctx.strokeStyle = rgba(Look.hex, 0.5); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = Look.hex;
  ctx.fillText(fx.bubble.text, tx, ty);
  ctx.globalAlpha = 1;
}

// KERNEL PANIC: the ball and its shots carry a little light; a hit lights the screen for a moment
function drawDark(s) {
  const b = s.ball, k = dark.width / LW;
  const lit = Math.min(1, fx.panic / 0.4);
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = `rgba(1,1,6,${0.93 * (1 - lit * 0.85)})`;
  dctx.fillRect(0, 0, dark.width, dark.height);
  dctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, R) => {
    const g = dctx.createRadialGradient(x, y, R * 0.25, x, y, R);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath(); dctx.arc(x, y, R, 0, TAU); dctx.fill();
  };
  hole((cx + b.x) * k, (cy + b.y) * k, 150 * k);
  // each shot carries a little light with it
  for (const sh of s.shots) hole((cx + sh.x) * k, (cy + sh.y) * k, 46 * k);
  ctx.drawImage(dark, 0, 0, LW, LH);
  // what still shows in the dark: the horizon and the edge of the screen
  ctx.beginPath(); ctx.arc(cx, cy, s.holeR, 0, TAU);
  tube(ctx, '#b45cff', 1.6, 0.6);
  ctx.beginPath(); ctx.arc(cx, cy, TUNE.R_OUT + 3, 0, TAU);
  tube(ctx, C.red, 1.6, 0.45);
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
    const y = cy - 200, tint = TINT[s.rule.id] || C.purple;
    // a pane of dark glass, framed the way the menus are
    roundRect(ctx, cx - 250, y - 32, 500, 96, 6);
    ctx.fillStyle = 'rgba(4,5,14,0.8)'; ctx.fill();
    ctx.strokeStyle = rgba(tint, 0.55); ctx.lineWidth = 1; ctx.stroke();
    brackets(ctx, cx - 256, y - 38, 512, 108, tint, 14, 0.9);
    ctx.font = '900 30px Orbitron, "Arial Black", sans-serif';
    chroma(bn.title, cx, y - 6, 2.5, C.text);
    ctx.font = '700 15px Orbitron, sans-serif';
    ctx.fillStyle = C.amber; ctx.fillText(bn.sub, cx, y + 24);
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(238,247,255,0.8)'; ctx.fillText(bn.line, cx, y + 47);
    ctx.globalAlpha = 1;
  }
  // 3 · 2 · 1 over the hole
  if (view === run && s.phase === 'intro' && s.phaseT <= 2.4 && crash.t <= 0) {
    const n = Math.ceil(s.phaseT / 0.8), k = (s.phaseT % 0.8) / 0.8;
    ctx.font = `900 ${Math.round(74 + k * 40)}px Orbitron, "Arial Black", sans-serif`;
    ctx.globalAlpha = 0.35 + k * 0.65;
    chroma(String(n), cx, cy + 4, 4, '#fff');
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
  $('setTalk').textContent = 'NULL: ' + (save.talk ? 'Talks' : 'Silent');
  $('setTalk').classList.toggle('ghostc', !save.talk);
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
$('btnHow').onclick = () => { click(); show('scrHow'); };
$('btnRecord').onclick = () => {
  click();
  const m = Math.floor(save.seconds / 60);
  const rows = [
    ['Runs', save.runs], ['Balls lost', save.ballsLost], ['Past the horizon', save.ballsEaten], ['Sectors salvaged', save.sectors],
    ['Eyes shut', save.eyes], ['Best rally', save.bestChain], ['Coins paid', '◎ ' + save.coins], ['Time in orbit', m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`]
  ];
  $('recordList').innerHTML = rows.map(([k, v]) => `<div class="sc"><i>${k}</i><b>${v}</b></div>`).join('');
  $('recordNote').innerHTML = save.ballsEaten
    ? `<b>${save.ballsEaten}</b> OF THOSE BALLS WENT PAST THE HORIZON. IT SAYS THEY ARE FINE.`
    : 'NOTHING OF YOURS IS PAST THE HORIZON YET. IT IS PATIENT.';
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
  if (was > 0 && save.vol === 0) Null.say('muted', null, { force: true });
};
$('setFx').onclick = () => { click(); save.fx = !save.fx; Save.write(); refreshSettings(); if (!save.fx) Null.say('fxOff', null, { force: true }); };
$('setMoods').onclick = () => { click(); save.moods = !save.moods; Save.write(); refreshSettings(); if (!save.moods) Null.say('moodsOff', null, { force: true }); if (run) run.moods = save.moods; };
$('setTalk').onclick = () => {
  click();
  save.talk = !save.talk; Save.write(); refreshSettings();
  if (!save.talk) { Null.say('talkOff', null, { force: true }); Null.next = null; } else Null.say('resume', null, { force: true });
};
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
  Null.say('erased', null, { force: true });
};

// EXIT TO ARCADE: only inside the cabinet. NULL would rather you didn't.
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
    Null.say('exit', null, { force: true });
    setTimeout(() => Cabinet.exit(), save.talk ? 900 : 0);
  };
}

// ── input: turn, thrust, fire ──
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'thrust', KeyW: 'thrust', Space: 'fire' };
function release() { input.left = input.right = input.thrust = input.fire = false; }
window.addEventListener('keydown', (e) => {
  const k = KEYS[e.code];
  if (e.repeat) { if (k) e.preventDefault(); return; }
  audio.init();
  if (k) {
    if (mode !== 'play' && e.target && e.target.tagName === 'BUTTON' && e.code === 'Space') return;   // let a focused button take it
    e.preventDefault();
    input.kind = 'key';
    if (mode === 'play') input[k] = true;
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
    else if (mode === 'menu' && $('scrMenu').classList.contains('on')) $('btnPlay').click();
  }
});
window.addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) input[k] = false; });
// touch: four buttons in the corners, each held like a key
document.querySelectorAll('#pad button').forEach((btn) => {
  const k = btn.dataset.k;
  const set = (on) => (e) => {
    e.preventDefault();
    audio.init();
    input.kind = 'touch';
    input[k] = on && mode === 'play';
    btn.classList.toggle('held', input[k]);
    if (on && btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (err) {} }
  };
  btn.addEventListener('pointerdown', set(true));
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, set(false));
});
stage.addEventListener('pointerdown', (e) => { audio.init(); if (e.pointerType === 'mouse') input.kind = 'mouse'; });
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
      Null.say('away', { away: Math.round((performance.now() - awayAt) / 1000) }, { force: true });
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
audio.music('nexus');                // starts with the first key or click
refreshSettings();
refreshMenu();
handle(attract, false);
show('scrMenu');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
setTimeout(() => { Null.say(save.runs ? 'boot' : 'bootFirst'); menuSaid = 1; menuT = 0; }, 900);
requestAnimationFrame(frame);

// for the console and the tests that drive the page
window.Nexus = {
  get run() { return run; }, get mode() { return mode; }, get view() { return view; }, get fx() { return fx; },
  get bloomOff() { return bloomOff; }, set bloomOff(v) { bloomOff = !!v; slowT = 0; },
  Null, save, startRun, endRun, pause, resume, toMenu, startCrash, input
};
