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
function draw() {
  const s = view, b = s.ball, t = clock;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; noGlow();
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, LW, LH);
  ctx.save();
  if (fx.shake > 0 && fxFull()) ctx.translate((Math.random() - 0.5) * fx.shake * 14, (Math.random() - 0.5) * fx.shake * 14);

  drawWell(s, t);
  drawHole(s, t);
  if (s.eye) drawEye(s, t);
  drawObjects(s, t);
  drawWarnings(s, t);
  drawBall(s, t);
  drawParts();
  if (s.rule.id === 'panic' && s.phase === 'play') drawDark(s);
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
  // the screen behind the round window: the same grid the other cabinets sit on
  ctx.strokeStyle = 'rgba(154,93,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = cx % 32; x <= LW; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, LH); }
  for (let y = cy % 32; y <= LH; y += 32) { ctx.moveTo(0, y); ctx.lineTo(LW, y); }
  ctx.stroke();
  // the well
  const g = ctx.createRadialGradient(cx, cy, TUNE.R_HOLE, cx, cy, TUNE.R_OUT);
  g.addColorStop(0, '#120836'); g.addColorStop(0.5, '#080920'); g.addColorStop(1, '#04050e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, TUNE.R_OUT + 3, 0, TAU); ctx.fill();
  // rings and spokes, turning slowly
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(113,239,255,0.06)';
  for (const r of [88, 170, 250]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(154,93,255,0.09)';
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = t * 0.03 + (i / 12) * TAU;
    ctx.moveTo(px(a, s.holeR + 10), py(a, s.holeR + 10)); ctx.lineTo(px(a, TUNE.R_OUT), py(a, TUNE.R_OUT));
  }
  ctx.stroke();
  // the two lines inside which a kill is worth more
  ctx.setLineDash([3, 9]);
  ctx.font = '15px VT323, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const [r, col, label] of [[TUNE.BAND_MID, C.cyan, 'x2'], [TUNE.BAND_IN, C.pink, 'x3']]) {
    ctx.strokeStyle = rgba(col, 0.22);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(col, 0.55);
    ctx.fillText(label, px(-0.5, r - 16), py(-0.5, r - 16));
  }
  ctx.setLineDash([]);
  // dust falling in
  ctx.fillStyle = 'rgba(200,190,255,0.35)';
  for (const d of dust) { if (d.r < TUNE.R_OUT) ctx.fillRect(px(d.th, d.r), py(d.th, d.r), 1.5, 1.5); }
  // the glass
  const hot = s.critical && Math.floor(t * 8) % 2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(hot ? C.pink : C.cyan, 0.6);
  glow(hot ? C.pink : C.cyan, 12);
  ctx.beginPath(); ctx.arc(cx, cy, TUNE.R_OUT + 3, 0, TAU); ctx.stroke();
  noGlow();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(113,239,255,0.14)';
  ctx.beginPath(); ctx.arc(cx, cy, TUNE.R_OUT + 10, 0, TAU); ctx.stroke();
}

function drawHole(s, t) {
  const R = s.holeR;
  const surge = s.surge.state;
  // the light it bends round itself
  const g = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 2.5);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.16, 'rgba(0,0,0,1)');
  g.addColorStop(0.24, 'rgba(154,93,255,0.6)'); g.addColorStop(0.4, 'rgba(255,88,217,0.2)'); g.addColorStop(1, 'rgba(154,93,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R * 2.5, 0, TAU); ctx.fill();
  // what it is eating, going round
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const r = R + 4 + i * 3.4, a = t * (1.9 - i * 0.22) + i * 1.3;
    ctx.strokeStyle = rgba(i % 2 ? C.pink : C.cyan, 0.5 - i * 0.06);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, a, a + 1.1 + i * 0.25); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // breathing in
  if (surge !== 'idle') {
    const on = surge === 'on';
    for (let i = 0; i < 3; i++) {
      const k = ((t * (on ? 1.4 : 0.8) + i / 3) % 1);
      ctx.strokeStyle = rgba(C.pink, (on ? 0.5 : 0.28) * k);
      ctx.lineWidth = on ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R + (1 - k) * (on ? 190 : 120), 0, TAU); ctx.stroke();
    }
  }
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  // the horizon: past this line the ball is NULL's
  const leak = s.leak > 0;
  ctx.strokeStyle = leak ? C.amber : surge === 'on' ? C.pink : '#f3e9ff';
  glow(leak ? C.amber : C.purple, 16);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  noGlow();
}

function drawEye(s, t) {
  const e = s.eye, b = s.ball;
  const looking = e.lid !== 'shut';
  // its gaze: a bar of light with a gap in it
  for (let i = 0; i < e.beams; i++) {
    const gap = gapRadius(e, i);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(e.gazeTh + i * Math.PI);
    const a = s.holeR + 6, g0 = gap - e.gapHalf, g1 = gap + e.gapHalf, z = TUNE.R_OUT;
    if (looking) {
      const flick = e.lid === 'warn' ? (Math.floor(t * 16) % 2 ? 0.35 : 0.8) : 1;
      ctx.globalAlpha = flick;
      glow(C.pink, 22);
      ctx.fillStyle = rgba(C.pink, 0.75);
      if (g0 > a) ctx.fillRect(a, -TUNE.BEAM_HALF, g0 - a, TUNE.BEAM_HALF * 2);
      if (z > g1) ctx.fillRect(g1, -TUNE.BEAM_HALF, z - g1, TUNE.BEAM_HALF * 2);
      noGlow();
      ctx.fillStyle = '#fff';
      if (g0 > a) ctx.fillRect(a, -2, g0 - a, 4);
      if (z > g1) ctx.fillRect(g1, -2, z - g1, 4);
      // the gap, marked so it can be read at a glance
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const x of [g0, g1]) { ctx.moveTo(x, -17); ctx.lineTo(x, 17); }
      ctx.stroke();
    } else {
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = rgba(C.pink, 0.22); ctx.lineWidth = 1.5;
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
  if (ready(im)) {
    if (fx.eyeFlash > 0 && fxFull()) { ctx.globalAlpha = 0.6; ctx.drawImage(im, cx - S / 2 - 8, cy - S / 2, S, S); ctx.drawImage(im, cx - S / 2 + 8, cy - S / 2, S, S); ctx.globalAlpha = 1; }
    glow(C.purple, 26);
    ctx.drawImage(im, cx - S / 2, cy - S / 2, S, S);
  } else {
    // no sprite (opened without the arcade's assets): a drawn one
    ctx.strokeStyle = C.purple; ctx.lineWidth = 3; glow(C.purple, 20);
    ctx.beginPath(); ctx.ellipse(cx, cy, 66, e.lid === 'shut' ? 4 : 30, 0, 0, TAU); ctx.stroke();
    if (e.lid !== 'shut') { ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(cx + side * 18, cy, 12, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  noGlow();
}

function drawObjects(s, t) {
  for (const o of s.objs) {
    const forming = o.age < o.warm;
    ctx.save();
    ctx.translate(cx + o.x, cy + o.y);
    // still materialising: a flickering outline that can't be touched yet
    ctx.globalAlpha = forming && o.warm > 0.3 ? 0.2 + 0.35 * (o.age / o.warm) * (Math.floor(t * 18) % 2 ? 1 : 0.5) : 1;
    if (o.kind === 'power') {
      const L = POWER_LOOK[o.power];
      if (o.life < 3 && Math.floor(t * 10) % 2) ctx.globalAlpha = 0.35;      // about to go
      glow(L.c, 16);
      ctx.strokeStyle = L.c; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = t + (i / 6) * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 13, Math.sin(a) * 13); }
      ctx.closePath(); ctx.stroke();
      noGlow();
      ctx.fillStyle = L.c; ctx.font = '700 13px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(L.ch, 0, 1);
    } else drawDebris(o, t, forming);
    ctx.restore();
  }
  // the ball's shots: a streak of its own colour
  ctx.lineCap = 'round'; ctx.lineWidth = 3;
  glow(Look.hex, 10);
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  for (const sh of s.shots) {
    const v = Math.hypot(sh.vx, sh.vy) || 1;
    ctx.moveTo(cx + sh.x, cy + sh.y);
    ctx.lineTo(cx + sh.x - (sh.vx / v) * 9, cy + sh.y - (sh.vy / v) * 9);
  }
  ctx.stroke();
  noGlow(); ctx.lineCap = 'butt';
}

function brick(x, y, w, h, col, lit) {
  if (lit) glow(col, 9);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  noGlow();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - w / 2, y + h / 2 - 2.5, w, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - w / 2, y - h / 2, w, 2);
}

// What the other cabinets threw away, drawn so you can tell where it came
// from. Three sizes: a chunk of wall, a couple of bricks, one brick.
function drawDebris(o, t, forming) {
  const R = o.rad, lit = !forming;
  if (o.look !== 'glyph') ctx.rotate(o.rot);
  if (o.look === 'brick') {
    const a = BRICKS[o.tint % BRICKS.length], b = BRICKS[(o.tint + 1) % BRICKS.length];
    if (o.size === 3) {
      // a piece of Breakpoint's wall: three courses, staggered
      for (const [x, y, c] of [[-11, -15, a], [11, -15, b], [-22, 0, b], [0, 0, a], [22, 0, b], [-11, 15, a], [11, 15, b]]) brick(x, y, 20, 12, c, lit);
    } else if (o.size === 2) {
      brick(-5, -7, 22, 12, a, lit); brick(5, 7, 22, 12, b, lit);
    } else {
      brick(0, 0, 19, 11, a, lit);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-3, -5.5); ctx.lineTo(1, 0); ctx.lineTo(-1, 5.5); ctx.stroke();
    }
  } else if (o.look === 'paddle') {
    // one of Glitch Pong's paddles, then half of one, then a splinter
    const col = PADDLES[o.tint % 2], w = o.size === 3 ? 58 : o.size === 2 ? 34 : 19, h = o.size === 3 ? 13 : o.size === 2 ? 11 : 8;
    if (lit) glow(col, 12);
    ctx.fillStyle = col;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    noGlow();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 2);
    if (o.size < 3) { ctx.fillStyle = C.void; ctx.beginPath(); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(w / 2 - 6, 0); ctx.lineTo(w / 2, h / 2); ctx.fill(); }
  } else if (o.look === 'glyph') {
    // a digit that used to be in your score
    ctx.font = '34px VT323, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.cyan; ctx.fillText(o.ch, -2, 1);
    ctx.fillStyle = C.pink; ctx.fillText(o.ch, 2, 1);
    if (lit) glow(C.red, 12);
    ctx.fillStyle = '#fff'; ctx.fillText(o.ch, 0, 1);
    noGlow();
  } else {
    // static: a block of dead channel
    const n = o.size + 2, z = (R * 1.6) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = (Math.sin(o.id * 12.9 + i * 7.1 + j * 3.3 + Math.floor(t * 14) * 1.7) + 1) / 2;
      ctx.fillStyle = `rgba(${200 + v * 55},${200 + v * 55},${220 + v * 35},${0.25 + v * 0.7})`;
      ctx.fillRect(-R * 0.8 + i * z, -R * 0.8 + j * z, z - 0.5, z - 0.5);
    }
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
    ctx.strokeStyle = rgba(Look.hex, 0.35 * (fx.ghost.t / TUNE.MOURN));
    ctx.lineWidth = 2; ctx.setLineDash([2, 5]);
    ctx.beginPath();
    fx.ghost.pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (s.phase === 'over') return;
  const x = cx + b.x, y = cy + b.y;
  if (b.inv > 0 && s.phase === 'play' && Math.floor(t * 14) % 2) return;       // a new ball blinks
  const dim = b.mourn > 0 ? 0.5 + 0.5 * (1 - b.mourn / TUNE.MOURN) : 1;
  const trailSkin = Look.get('trail'), ballSkin = Look.get('ball');
  const look = (trailSkin !== 'default' || ballSkin !== 'default') && {
    rgb: Look.rgb, hex: Look.hex, t, heat: s.heat / 100, quality: glowK < 0.5 ? 0.5 : 1,
    vx: b.vx / 60, vy: b.vy / 60, r: TUNE.BALL_R, charge: 2, speed: Math.hypot(b.vx, b.vy) / 60, rally: s.chain
  };
  const hx = Math.cos(b.a), hy = Math.sin(b.a);
  const thrusting = s.phase === 'play' && (view === run ? input.thrust : botHold.thrust);
  ctx.save();
  if (trailSkin !== 'default') { ctx.globalAlpha = dim; Look.draw.trail(ctx, fx.trail, look); }
  else for (let i = fx.trail.length - 1; i > 0; i--) {
    const p = fx.trail[i], a = 1 - i / fx.trail.length;
    ctx.globalAlpha = a * (b.showoff ? 0.6 : 0.3) * dim;
    ctx.fillStyle = Look.hex;
    const z = TUNE.BALL_R * 2 * a;
    ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
  }
  ctx.globalAlpha = dim;
  // the thrust: a flame out of the back
  if (thrusting) {
    const k = 11 + Math.random() * 8;
    ctx.fillStyle = rgba(C.amber, 0.85);
    ctx.beginPath();
    ctx.moveTo(x - hx * 5 - hy * 4, y - hy * 5 + hx * 4); ctx.lineTo(x - hx * (6 + k), y - hy * (6 + k)); ctx.lineTo(x - hx * 5 + hy * 4, y - hy * 5 - hx * 4);
    ctx.fill();
  }
  if (ballSkin !== 'default') Look.draw.ball(ctx, x, y, TUNE.BALL_R + 1, look);
  else {
    glow(Look.hex, b.showoff ? 30 : 18);
    ctx.fillStyle = Look.hex;
    ctx.beginPath(); ctx.arc(x, y, TUNE.BALL_R, 0, TAU); ctx.fill();
    noGlow();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - 2, y - 2, TUNE.BALL_R * 0.4, 0, TAU); ctx.fill();
  }
  // which way it is facing: a white chevron ahead of it
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  glow(Look.hex, 8);
  ctx.beginPath();
  ctx.moveTo(x + hx * 10 - hy * 5, y + hy * 10 + hx * 5); ctx.lineTo(x + hx * 17, y + hy * 17); ctx.lineTo(x + hx * 10 + hy * 5, y + hy * 10 - hx * 5);
  ctx.stroke();
  noGlow();
  ctx.globalAlpha = 1;
  if (s.shield) {
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; glow(C.cyan, 12);
    ctx.beginPath(); ctx.arc(x, y, TUNE.BALL_R + 13 + Math.sin(t * 8), 0, TAU); ctx.stroke(); noGlow();
  }
  ctx.restore();
  // what the ball has to say
  if (fx.bubble && view === run) {
    ctx.font = '15px "Share Tech Mono", monospace';
    ctx.textAlign = x > cx ? 'right' : 'left'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.min(1, fx.bubble.t * 2);
    const tx = x + (x > cx ? -20 : 20), ty = y - 24;
    const tw = ctx.measureText(fx.bubble.text).width;
    ctx.fillStyle = 'rgba(3,4,10,0.75)';
    ctx.fillRect(x > cx ? tx - tw - 5 : tx - 5, ty - 10, tw + 10, 20);
    ctx.fillStyle = Look.hex;
    ctx.fillText(fx.bubble.text, tx, ty);
    ctx.globalAlpha = 1;
  }
}

function drawParts() {
  for (const p of fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// KERNEL PANIC: the ball and its shots carry a little light; a hit lights the screen for a moment
function drawDark(s) {
  const b = s.ball, k = dark.width / LW;
  const lit = Math.min(1, fx.panic / 0.4);
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = `rgba(1,1,6,${0.9 * (1 - lit * 0.85)})`;
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
  ctx.strokeStyle = 'rgba(243,233,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, s.holeR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(C.cyan, 0.35);
  ctx.beginPath(); ctx.arc(cx, cy, TUNE.R_OUT + 3, 0, TAU); ctx.stroke();
}

function drawFloats() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.2);
    ctx.font = `${f.size}px VT323, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
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
    const y = cy - 200;
    ctx.fillStyle = 'rgba(3,4,10,0.72)';
    ctx.fillRect(cx - 250, y - 30, 500, 92);
    ctx.font = '900 30px Orbitron, "Arial Black", sans-serif';
    chroma(bn.title, cx, y - 6, 2.5, C.text);
    ctx.font = '28px VT323, monospace';
    ctx.fillStyle = C.amber; ctx.fillText(bn.sub, cx, y + 24);
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(238,247,255,0.8)'; ctx.fillText(bn.line, cx, y + 47);
    ctx.globalAlpha = 1;
  }
  // 3 · 2 · 1 over the hole
  if (view === run && s.phase === 'intro' && s.phaseT <= 2.4 && crash.t <= 0) {
    const n = Math.ceil(s.phaseT / 0.8), k = (s.phaseT % 0.8) / 0.8;
    ctx.font = `${Math.round(120 + k * 60)}px VT323, monospace`;
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
function frame(now) {
  requestAnimationFrame(frame);
  if (!pacer.due(now, wantFps())) return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
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
  Null, save, startRun, endRun, pause, resume, toMenu, startCrash, input
};
