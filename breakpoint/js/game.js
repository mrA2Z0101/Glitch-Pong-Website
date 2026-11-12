// ============ GLITCH BREAKOUT — core game ============
'use strict';

// ---------------- persistence / meta progression ----------------
const Meta = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem('gb_save')) || null; } catch (e) { this.data = null; }
    if (!this.data) this.data = { xp: 0, credits: 0, up: {}, ach: {}, best: {}, daily: {}, bossKills: {}, seen: {}, vol: 70 };
    for (const k of ['up', 'ach', 'best', 'daily', 'bossKills', 'seen']) if (!this.data[k]) this.data[k] = {};
  },
  save() { try { localStorage.setItem('gb_save', JSON.stringify(this.data)); } catch (e) {} },
  rank(id) { return this.data.up[id] || 0; },
  get level() { return Rules.levelFromXp(this.data.xp).level; },
  get levelProgress() { return Rules.levelFromXp(this.data.xp).progress; },
};

// ---------------- DOM ----------------
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const mainCtx = canvas.getContext('2d');
// touch screens (phones, tablets): touch-specific hints, buttons and sizing
const IS_TOUCH = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', IS_TOUCH);
const scene = document.createElement('canvas');
scene.width = CFG.W; scene.height = CFG.H;
const ctx = scene.getContext('2d');

// ---------------- power: frame pacing, glow size, battery saver ----------------
// glitchcade-power.js is shared with the arcade and Glitch Pong; the stub keeps this
// page working when it is opened on its own without it.
const Power = window.GlitchPower || {
  saving: false, state: 'off', batterySaver: false, setBatterySaver() { return false; }, onChange() {},
  createPacer: () => ({ due: () => true, reset() {} }), fpsFor: () => Infinity
};
// Every shadowBlur on the game canvas goes through this: phones draw their glows
// smaller, battery saver smaller still. Canvas shadows are the costliest thing
// a 2D canvas does.
let glowK = 1;
function updateGlowScale() {
  glowK = Power.saving ? 0.3 : IS_TOUCH ? 0.7 : 1;
  Glow.setScale(glowK);
  document.body.classList.toggle('saver', Power.saving);
}
const nativeShadowBlur = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
if (nativeShadowBlur && nativeShadowBlur.set) {
  Object.defineProperty(ctx, 'shadowBlur', {
    configurable: true,
    get() { return nativeShadowBlur.get.call(this); },
    set(v) { nativeShadowBlur.set.call(this, v * glowK); }
  });
}
updateGlowScale();
Power.onChange(() => { updateGlowScale(); refreshSaverBtn(); });

const SCREENS = ['scrMenu', 'scrModes', 'scrShop', 'scrAchv', 'scrHelp', 'scrSettings', 'scrPause', 'scrClear', 'scrOver'];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle('on', s === id);
}
function hideScreens() { showScreen(null); }

function toast(title, body) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>${title}</b>${body}`;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// Glitch Pong's 3-2-1-GO, played at the start of every sector. The paddle can
// line up during it; the ball launches itself as GO clears.
const COUNTDOWN = [
  { key: '3', dur: 0.57 },
  { key: '2', dur: 0.57 },
  { key: '1', dur: 0.57 },
  { key: 'GO', dur: 0.63 },
];
const COUNTDOWN_IMG = {};
for (const { key } of COUNTDOWN) {
  const img = new Image();
  img.src = 'assets/' + key + '.png';
  COUNTDOWN_IMG[key] = img;
}

// The ball is sentient (as in Glitch Pong), with moods of its own here:
//  BORED  — after this many paddle returns without breaking a brick it gets
//           restless and bends its own path toward the nearest brick
//  GRUDGE — it remembers THE EYE from the Pong arena and leans toward it
//  LOYAL  — on your last life it refuses to fall past a near miss, once a sector
//  RAMPAGE    — once it breaks through behind the wall it turns gold and runs
//               wild: a little faster, double score until it drops back out
//  PROTECTIVE — a shooter that hits your paddle gets an immediate missile lock;
//               continuous pursuit, a targeting reticle, and double enemy damage
//  RIVALRY    — in multi-ball the balls compete: the one with the most bricks
//               wears a crown (+50% brick score); the last one left gets a bonus
//  SHOW-OFF   — a hot combo goes to its head: longer, brighter trail and a little
//               faster, until it touches the paddle again
//  CURIOUS    — strange bricks it hasn't touched yet (teleport, quantum, clone)
//               pull it gently toward them
//  MOURNING   — after a lost life the next ball launches slower and dimmer for a
//               few seconds while the lost ball's last path fades out
const BORED_AFTER = 5;
const SHOWOFF_AT = 6;                                   // combo (bricks since the last paddle touch)
const CURIOUS_OF = new Set(['teleport', 'quantum', 'clone']);

function statChips(pairs) {
  return '<div class="statline">' + pairs.map(([label, val, hl]) =>
    `<span class="sc${hl ? ' hl' : ''}"><i>${label}</i><b>${val}</b></span>`).join('') + '</div>';
}

// Canvas text that breaks onto a second line when it is too wide (upright phones).
function wrapText(c, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (line && c.measureText(next).width > maxW) { c.fillText(line, x, y); y += lineH; line = w; }
    else line = next;
  }
  if (line) c.fillText(line, x, y);
}

function banner(text) {
  const el = $('evBanner');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth; // restart animation
  el.classList.add('show');
}

// ---------------- input ----------------
const input = { left: false, right: false, mouseX: CFG.W / 2, mouseActive: false, fire: false };
const keySeq = [];
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  // while the AI demo runs on the menu, capture only the DEV secret (and Esc to back out of submenus)
  if (game.attract) {
    if (k === 'escape' && !$('scrMenu').classList.contains('on')) { AudioSys.sfx('click'); goMenu(); return; }
    if (k === 'escape' && Cabinet.active) { AudioSys.sfx('click'); Cabinet.exit(); return; }
    keySeq.push(k); if (keySeq.length > 3) keySeq.shift();
    if (keySeq.join('') === 'dev') game.devRoom();
    return;
  }
  // between-sector / game-over screens: keyboard shortcuts (after a short guard so
  // a laser-fire Space pressed as the sector clears doesn't skip the summary)
  if (game.state === 'clear' && (k === ' ' || k === 'enter')) {
    e.preventDefault();
    if (performance.now() - game.screenAt > 600) game.nextLevel();
    return;
  }
  if (game.state === 'over' && k === 'enter') {
    e.preventDefault();   // a still-focused Retry button would otherwise start a second run
    if (performance.now() - game.screenAt > 600) game.startRun(game.mode);
    return;
  }
  if (game.state === 'over' && k === 'escape') { goMenu(); return; }
  // [T] hands the paddle to the AI or takes it back, in any mode
  if (k === 't' && (game.state === 'play' || game.state === 'serve')) { game.setAutoplay(!game.autoplay); return; }
  if (game.autoplay) {   // the AI is driving: only pause/restart stay live
    if (k === 'p' || k === 'escape') game.togglePause();
    if (k === 'r') game.onRestartKey();
    return;
  }
  // keyboard takes over from the mouse — otherwise the paddle snapped back to the
  // last mouse position the moment the arrow key was released
  if (k === 'arrowleft' || k === 'a') { input.left = true; input.mouseActive = false; }
  if (k === 'arrowright' || k === 'd') { input.right = true; input.mouseActive = false; }
  if (k === ' ') { e.preventDefault(); game.onFire(); }
  if (k === 'x') game.onAbility();
  if (k === 'p' || k === 'escape') game.togglePause();
  if (k === 'r') game.onRestartKey();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = false;
  if (k === 'arrowright' || k === 'd') input.right = false;
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  input.mouseX = (e.clientX - r.left) / r.width * CFG.W;
  input.mouseActive = true;
});
canvas.addEventListener('mousedown', () => { if (!game.attract && !game.autoplay) game.onFire(); });
// touch: drag to steer, tap to launch / fire, two-finger tap for the [X] ability
function touchToInput(t) {
  const r = canvas.getBoundingClientRect();
  input.mouseX = (t.clientX - r.left) / r.width * CFG.W;
  input.mouseActive = true;
}
canvas.addEventListener('touchstart', (e) => {
  if (game.attract || game.autoplay) return;
  e.preventDefault();
  touchToInput(e.touches[0]);
  if (e.touches.length >= 2) game.onAbility(); else game.onFire();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  if (game.attract || game.autoplay) return;
  e.preventDefault();
  touchToInput(e.touches[0]);
}, { passive: false });
// losing focus: drop held keys (their keyup never arrives, so the paddle kept sliding
// after alt-tab) and pause — but not AI autoplay, the point is to let it run
window.addEventListener('blur', () => {
  input.left = input.right = false;
  if (!game.attract && !game.autoplay && (game.state === 'play' || game.state === 'serve')) game.togglePause(true);
});

// ---------------- the game ----------------
const game = {
  meta: Meta,
  state: 'menu',      // menu | serve | play | pause | clear | over
  attract: false,     // AI plays itself behind the main menu (muted)
  autoplay: false,    // AI plays a real run for the player (full audio, real stakes)
  serveT: 0,
  mode: 'classic',
  level: 1, arena: ARENAS[0], arenaIdx: 0,
  time: 0, levelTime: 0,
  score: 0, combo: 0, maxCombo: 0, lives: 3, ballsLeft: 0,
  glitch: 0, corruption: 0, corruptT: 5,
  paddle: null, balls: [], bricks: [], powerups: [], projectiles: [], lasers: [], enemies: [], drones: [], hazards: [],
  boss: null,
  activeEvent: null, eventT: 0, nextEventT: 20,
  eventFlags: {},
  timers: {},          // timed powerup effects {mult, slow, warp, freezeP, shield}
  mods: {},            // daily modifiers
  rng: Math.random,
  wallInsetL: 0, wallInsetR: 0,
  abilityCd: 0, laserCd: 0,
  stats: null,
  prevState: 'play',
  surgeApplied: false,

  // ======== attract mode (AI demo behind the menu) ========
  startAttract() {
    applyLayout();               // back on the menu: catch up with any rotation during the run
    this.attract = true;
    document.body.classList.add('attract');   // hides the demo's score, lives and meters
    this.autoplay = false;
    $('aiBadge').classList.remove('on');
    AudioSys.setMuted(true);       // no sound while it plays on the menu
    AudioSys.init();
    this.mode = 'endless';
    this.mods = {};
    this.rng = Math.random;
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.lives = 3;
    this.glitch = 0; this.corruption = 0; this.time = 0;
    this.stats = { bricks: 0, bosses: 0, powerups: 0, timeStart: performance.now(), powers: {}, lives: [], comboSector: 0, newEntries: 0 };
    // open on a random sector so the demo showcases variety — including bosses / THE EYE
    this.level = 1 + Math.floor(Math.random() * 12);
    this.aiTargetX = CFG.W / 2;
    this.attractResetT = rand(22, 38);
    this.startLevel();
    showScreen('scrMenu');         // keep the menu overlaid on top of the demo
  },
  stopAttract() {
    this.attract = false;
    document.body.classList.remove('attract');
    AudioSys.setMuted(false);      // restore the player's volume for real play
  },
  // hand the paddle to / take it back from the machine mid-run
  setAutoplay(on, announce = true) {
    if (this.autoplay === on) return;
    this.autoplay = on;
    if (on) this.sectorAssisted = true;   // AI-played sectors don't pay Glitchcade coins
    $('aiBadge').classList.toggle('on', on);
    if (on) this.aiTargetX = this.paddle ? this.paddle.x : CFG.W / 2;
    else input.mouseActive = false;   // stop the AI's last target from steering the player
    if (!announce) return;
    if (on) { banner('AI ENGAGED'); toast('AI AUTOPLAY', 'The machine has the paddle. [T] to take over.'); }
    else { banner('MANUAL CONTROL'); toast('MANUAL CONTROL', 'You have the paddle. [T] to hand it back.'); }
    AudioSys.sfx('event');
  },
  aiEarnsProgress() { return !this.autoplay || !!Meta.data.aiRewards; },

  computeAiInput() {
    // find the ball we most need to save: lowest one heading downward
    let tgt = null, best = -1e9;
    for (const b of this.balls) {
      if (b.stuck) { tgt = b; break; }
      if (b.vy > 0 && b.y > best) { best = b.y; tgt = b; }
    }
    if (!tgt) { // nothing falling — hover under the highest ball / centre
      for (const b of this.balls) if (!tgt || b.y < tgt.y) tgt = b;
    }
    let target = tgt ? tgt.x : CFG.W / 2;
    if (tgt && tgt.vy > 0 && !tgt.stuck) {
      // predict where it crosses the paddle line (ignoring wall bounces — good enough)
      target = Rules.landingX(tgt, this.paddle.y, CFG.W, this.rule === 'wrap' ? Rules.wrapLine(CFG.PADDLE_Y) : null);
      // AIM: offset the contact point so the bounce is steered at a surviving brick.
      // The paddle maps rel=(ball.x-p.x)/(p.w/2) to angle=-90°+rel*1.05rad, so we can
      // invert that to pick where on the paddle the ball should land.
      const live = this.bricks.filter(b => b.alive && b.type !== 'barrier');
      if (live.length) {
        // bricks that actively work against a clear are worth hunting first, or the
        // board regenerates faster than the AI can purge it
        const THREAT = { clone: 900, healing: 800, generator: 500, virus: 260, quantum: 120 };
        let aim = null, bestScore = -Infinity;
        for (const b of live) {
          // favour threats, then the lowest bricks, then the ones nearest the intercept
          const s = (THREAT[b.type] || 0) + b.cym * 2 - Math.abs(b.cxm - target) * 0.6;
          if (s > bestScore) { bestScore = s; aim = b; }
        }
        const desired = Math.atan2(aim.cym - this.paddle.y, aim.cxm - target);
        const rel = clamp((desired + Math.PI / 2) / 1.05, -0.8, 0.8);
        target -= rel * (this.paddle.w / 2);
      }
    }
    // a touch of human imperfection so it isn't a perfect wall (tighter when playing for real)
    target += Math.sin(this.time * 2.3) * (this.autoplay ? 6 : 14);
    this.aiTargetX = lerp(this.aiTargetX ?? target, target, 0.35);
    this.aiInput = this.aiInput || { left: false, right: false, mouseActive: true, mouseX: 0, fire: false };
    this.aiInput.mouseX = clamp(this.aiTargetX, 0, CFG.W);
    this.aiInput.mouseActive = true;
    return this.aiInput;
  },

  // ======== the codex ========
  // The first time you meet something (a brick, a power-up, an enemy, a boss,
  // an arena's rule, a glitch, a mood of the ball) its codex entry unlocks and
  // a note says what it is. The menu demo and unrewarded AI runs unlock nothing.
  meet(kind, id) {
    if (this.attract || !this.aiEarnsProgress()) return;
    const key = kind + ':' + id;
    if (Meta.data.seen[key]) return;
    const entry = Rules.codexEntry(key);
    if (!entry) return;
    Meta.data.seen[key] = true;
    Meta.save();
    if (this.stats) this.stats.newEntries++;
    if (key === 'arena:standard') return;        // the plain court needs no explaining
    toast('CODEX // ' + entry.name, entry.line);
  },

  // ======== the guided first sector ========
  startTutorial() {
    this.tutor = {
      t: Rules.tutorNew(), step: null, lastX: null,
      e: { moved: 0, returns: 0, bricks: 0, bestCombo: 0, falling: 0, powerups: 0, cleared: false },
    };
  },
  endTutorial() {
    if (!this.tutor) return;
    this.tutor = null;
    Meta.data.tutorialDone = true;
    Meta.save();
    $('glitchLab').classList.remove('teach');
    $('btnSkipTut').style.display = 'none';
  },
  tickTutorial(rawDt) {
    const tu = this.tutor;
    if (tu.lastX !== null) tu.e.moved += Math.abs(this.paddle.x - tu.lastX);
    tu.lastX = this.paddle.x;
    tu.e.falling = this.powerups.length;
    tu.step = Rules.tutorTick(tu.t, tu.e, rawDt);
    $('glitchLab').classList.toggle('teach', !!tu.step && tu.step.id === 'glitch');
  },
  genTutorialLevel() {
    const cols = CFG.BRICK_COLS, bw = CFG.BRICK_W + CFG.BRICK_GAP;
    const ox = (CFG.W - cols * bw + CFG.BRICK_GAP) / 2;
    for (const cell of Rules.tutorialLayout(cols)) {
      this.bricks.push(new Brick(ox + cell.c * bw, CFG.BRICK_TOP + cell.r * (CFG.BRICK_H + CFG.BRICK_GAP), cell.type));
    }
  },
  renderTutorial() {
    const step = this.tutor && this.tutor.step;
    if (!step) return;
    const k = IS_TOUCH ? 1.4 : 1, w = Math.min(CFG.W - 40, 640), lineH = 20 * k;
    const text = IS_TOUCH && step.touch ? step.touch : step.text;
    ctx.save();
    ctx.font = `${Math.round(15 * k)}px "Share Tech Mono", monospace`;
    // how many lines it will take, to size the panel
    let lines = 1, line = '';
    for (const word of text.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > w - 36) { lines++; line = word; } else line = next;
    }
    const h = lines * lineH + 34 * k, x = (CFG.W - w) / 2, y = CFG.PADDLE_Y - 96 - h;
    ctx.fillStyle = 'rgba(3,4,10,.8)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COL.yellow; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = COL.yellow; ctx.fillRect(x, y, 4, h);
    const prog = Rules.tutorProgress(this.tutor.t);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = `700 ${Math.round(9 * k)}px Orbitron, monospace`;
    ctx.fillText(step.filler ? 'TUTORIAL' : `TUTORIAL ${Math.min(prog.total, prog.done + 1)} / ${prog.total}`, x + 18, y + 9 * k);
    ctx.fillStyle = COL.white; ctx.textAlign = 'center';
    ctx.font = `${Math.round(15 * k)}px "Share Tech Mono", monospace`;
    wrapText(ctx, text, CFG.W / 2, y + 24 * k, w - 36, lineH);
    ctx.restore();
  },

  // the name of a power-up and what it does, shown for a moment when you catch one
  renderPickup() {
    const p = this.pickup;
    if (!p) return;
    const d = POWERUPS[p.kind], k = IS_TOUCH ? 1.4 : 1;
    const fade = Math.min(1, p.t / 0.35, (p.life - p.t) / 0.12);
    const rise = (1 - Math.min(1, (p.life - p.t) / 0.18)) * 10;
    const y = CFG.PADDLE_Y - (this.tutor && this.tutor.step ? 250 : 150) + rise;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.font = `${Math.round(13 * k)}px "Share Tech Mono", monospace`;
    const maxDesc = CFG.W - 60 - 46 * k - 28;
    const dw = Math.min(maxDesc, ctx.measureText(d.desc).width);
    const descLines = Math.ceil(ctx.measureText(d.desc).width / maxDesc);
    ctx.font = `900 ${Math.round(20 * k)}px Orbitron, monospace`;
    const w = Math.max(ctx.measureText(d.name).width, dw) + 46 * k + 28, x = (CFG.W - w) / 2;
    ctx.fillStyle = 'rgba(3,4,10,.78)'; ctx.fillRect(x, y - 24 * k, w, (46 + 16 * descLines) * k);
    ctx.fillStyle = d.color; ctx.fillRect(x, y - 24 * k, w, 2);
    drawPowerIcon(ctx, p.kind, x + 14 + 17 * k, y + 6 * k, 34 * k, d.color);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = d.color; ctx.shadowBlur = 12;
    ctx.fillStyle = d.color;
    ctx.fillText(d.name, x + 28 + 34 * k, y + 2 * k);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COL.white;
    ctx.font = `${Math.round(13 * k)}px "Share Tech Mono", monospace`;
    wrapText(ctx, d.desc, x + 28 + 34 * k, y + 21 * k, maxDesc, 16 * k);
    ctx.restore();
  },

  // ======== run lifecycle ========
  get sentient() { return Meta.data.sentience !== false; },
  // the arena's one rule (see ARENA_RULES in js/rules.js)
  get rule() { return this.arena.rule; },
  // MEMORY LEAK: the paddle is this share of its full length
  get paddleScale() { return this.rule === 'leak' ? Rules.leakFactor(this.leakReturns || 0) : 1; },
  restorePaddle(say) {
    if (say && this.paddleScale < 0.999 && this.paddle) FX.text(this.paddle.x, this.paddle.y - 26, 'PADDLE RESTORED', COL.violet, 12);
    this.leakReturns = 0;
  },

  startRun(mode) {
    applyLayout();               // the phone may have been rotated on the menu
    this.stopAttract();
    AudioSys.init();
    this.mode = mode;
    this.autoplay = (mode === 'ai');
    $('aiBadge').classList.toggle('on', this.autoplay);
    this.mods = {};
    this.rng = Math.random;
    if (mode === 'daily') {
      const today = todayStr();
      this.rng = mulberry32(Rules.dailySeed(today));
      this.mods = {};
      for (const m of Rules.dailyMods(today)) this.mods[m.id] = true;
      const names = DAILY_MODS.filter(m => this.mods[m.id]).map(m => m.name);
      toast('DAILY GLITCH // ' + today, names.join(' · '));
    }
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.lives = Rules.startingLives(mode, Meta.rank('life_up'));
    this.glitch = Meta.rank('startmult') ? 25 : 0;
    this.overloadArmed = true;
    this.corruption = 0;
    this.time = 0;
    this.stats = { bricks: 0, bosses: 0, powerups: 0, timeStart: performance.now(), powers: {}, lives: [], comboSector: 0, newEntries: 0 };
    this.runCoins = 0;
    this.level = 1;
    // a first run in an ordinary mode starts with the guided sector
    this.tutor = null;
    $('btnSkipTut').style.display = 'none';
    if (!Meta.data.tutorialDone && !this.autoplay && !Cabinet.startMode && ['classic', 'endless', 'corrupt', 'hardcore', 'time'].includes(mode)) {
      this.startTutorial();
      $('btnSkipTut').style.display = '';
    }
    this.startLevel();
  },

  startLevel() {
    const lv = this.level;
    this.arenaIdx = Rules.arenaIndex(lv);
    this.arena = ARENAS[this.arenaIdx];
    this.bricks = []; this.powerups = []; this.projectiles = []; this.lasers = [];
    this.enemies = []; this.drones = []; this.balls = [];
    this.boss = null; this.bossClearT = 0; this.clearT = 0;
    this.timers = {}; this.eventFlags = {}; this.activeEvent = null;
    this.surgeApplied = false;   // a level ending mid-DATA SURGE used to strand this true, disabling the event for the rest of the run
    this.levelTime = 0;
    this.leakReturns = 0;
    this.sectorAssisted = this.autoplay;
    this.loyaltyUsed = false;
    this.paddleAttacker = null;
    this.ballsPrev = 0;
    this.ghost = null;
    this.mournNext = false;
    this.pickup = null;
    if (this.tutor && lv > 1) this.endTutorial();
    this.countdown = null;
    if (!this.attract) {
      this.countdown = { i: 0, t: 0 };
      AudioSys.countdown(COUNTDOWN[0].key);
    }
    this.corruptT = 5;
    this.nextEventT = rand(12, 20);
    this.enemySpawnT = rand(8, 14);
    this.paddle = new Paddle(this);
    FX.reset();

    if (Rules.isBossSector(this.mode, lv)) {
      // THE EYE — the entity from the Pong arena — claims every 10th sector
      // and the Boss Rush finale; the minibosses rotate through the rest.
      const { boss, tier } = Rules.bossFor(this.mode, lv);
      const BossCls = boss === 'eye' ? TheEye : BOSS_LIST[boss];
      this.boss = new BossCls(tier);
      this.genBossBricks();
      banner(this.boss instanceof TheEye ? 'THE EYE HAS FOUND YOU' : this.boss.name);
      AudioSys.sfx('event');
      if (this.boss instanceof TheEye) { FX.setRgb(1); FX.tear(0.8); FX.flash(COL.violet, 0.25); }
      $('bossBar').style.display = 'block';
      $('bossName').textContent = this.boss.name;
      this.meet('boss', this.boss.name);
    } else {
      $('bossBar').style.display = 'none';
      if (this.tutor) { this.genTutorialLevel(); this.nextEventT = 9999; }   // no glitch events during the lesson
      else if (this.mode === 'puzzle') this.genPuzzleLevel(lv);
      else this.genLevel(lv);
    }
    this.meet('arena', this.arena.rule);
    if (this.mode === 'puzzle') this.ballsLeft = 3 + Math.floor(lv / 3);
    this.hazards = [];
    if (this.arena.hazard && lv > 1) this.hazards.push(new HAZARDS[this.arena.hazard]());
    this.serve();
    this.updateArenaHud();
    hideScreens();
    this.state = 'serve';
    if (!this.attract) {
      AudioSys.setGlitch(Math.max(this.glitch / 100, this.corruption / 130));
      AudioSys.startMusic(this.arenaIdx, this.boss instanceof TheEye);
    }
  },

  genLevel(lv) {
    const cols = CFG.BRICK_COLS, bw = CFG.BRICK_W + CFG.BRICK_GAP;
    const ox = (CFG.W - cols * bw + CFG.BRICK_GAP) / 2;
    // which cells hold which bricks is decided in js/rules.js
    for (const cell of Rules.layoutSector(lv, cols, this.rng)) {
      this.bricks.push(new Brick(ox + cell.c * bw, CFG.BRICK_TOP + cell.r * (CFG.BRICK_H + CFG.BRICK_GAP), cell.type));
    }
  },

  genPuzzleLevel(lv) {
    const cols = CFG.BRICK_COLS, bw = CFG.BRICK_W + CFG.BRICK_GAP;
    const ox = (CFG.W - cols * bw + CFG.BRICK_GAP) / 2;
    // engineered layouts: heavy shells around explosive cores, shield clusters, etc.
    const layout = lv % 4;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < cols; c++) {
        let type = null;
        if (layout === 1) { // explosive chains behind heavy wall
          if (r === 3) type = 'heavy';
          else if (r < 3 && (c + r) % 2 === 0) type = 'explosive';
        } else if (layout === 2) { // shield fortress
          if (r <= 1 && c >= 3 && c <= cols - 4) type = 'shield';
          else if (r === 2 && (c === 2 || c === cols - 3)) type = 'generator';
          else if (r >= 3 && r <= 4 && c % 2 === 0) type = 'normal';
        } else if (layout === 3) { // teleport maze
          if ((r * cols + c) % 5 === 0) type = 'teleport';
          else if ((r + c) % 3 === 0) type = 'heavy';
        } else { // classic diamond: firewall core breached via explosive ring
          const d = Math.abs(c - cols / 2 + 0.5) + Math.abs(r - 2.5) * 1.4;
          if (d < 2) type = 'firewall';
          else if (d < 3.2) type = 'explosive';
          else if (d < 5.5) type = (r + c) % 2 ? 'normal' : 'heavy';
        }
        if (type) this.bricks.push(new Brick(ox + c * bw, CFG.BRICK_TOP + r * (CFG.BRICK_H + CFG.BRICK_GAP), type));
      }
    }
  },

  genBossBricks() {
    const cols = CFG.BRICK_COLS, bw = CFG.BRICK_W + CFG.BRICK_GAP;
    const ox = (CFG.W - cols * bw + CFG.BRICK_GAP) / 2;
    for (let c = 0; c < cols; c++) {
      if (c % 3 === 1) continue;
      this.bricks.push(new Brick(ox + c * bw, 300, chance(0.3) ? 'heavy' : 'normal'));
    }
  },

  serve() {
    const b = new Ball(this.paddle.x, this.paddle.y - 20, -Math.PI / 2, Rules.serveSpeed(this.level, this.mods.doubleSpeed));
    b.stuck = true; b.stuckDx = 0;
    if (this.mournNext) { b.mournPending = true; this.mournNext = false; }
    // mid DATA SURGE the new ball must be surged too, or endEvent's /1.55 leaves it crawling
    if (this.surgeApplied) b.setSpeed(b.speed * 1.55);
    this.balls = [b];
    if (Meta.rank('shield0') && !this.timers.shield) this.timers.shield = 8;
  },

  // ======== input actions ========
  onFire() {
    AudioSys.init();
    if (this.countdown) return;   // the ball waits for GO
    if (this.state === 'serve' || this.state === 'play') {
      if (this.launchStuckBalls()) return;
      if (this.paddle.hasLaser && this.laserCd <= 0) {
        this.laserCd = 0.34;
        this.lasers.push(new Laser(this.paddle.x - this.paddle.w / 2 + 3, this.paddle.y - 10));
        this.lasers.push(new Laser(this.paddle.x + this.paddle.w / 2 - 3, this.paddle.y - 10));
        AudioSys.sfx('laser');
      }
    }
  },
  launchStuckBalls() {
    let launched = false;
    for (const b of this.balls) {
      if (b.stuck) {
        b.stuck = false;
        // a magnet-caught ball launches like a paddle bounce from where it sits,
        // so the player can aim; a fresh serve (dead centre) keeps the random spread
        const rel = clamp(b.stuckDx / (this.paddle.w / 2), -1, 1);
        const a = Math.abs(rel) > 0.02 ? -Math.PI / 2 + rel * 1.05 : -Math.PI / 2 + rand(-0.35, 0.35);
        b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
        if (b.mournPending && this.sentient) {
          b.mournPending = false;
          b.mourn = 3.5;
          this.meet('mood', 'mourning');
          b.setSpeed(b.speed * 0.78);
          FX.text(b.x, b.y - 24, '...', '#9aa7c7', 14);
        }
        launched = true;
      }
    }
    if (launched) { this.state = 'play'; AudioSys.sfx('paddle', 0.5); }
    return launched;
  },

  tickCountdown(rawDt) {
    const cd = this.countdown;
    cd.t += rawDt;
    if (cd.t < COUNTDOWN[cd.i].dur) return;
    cd.t = 0;
    cd.i++;
    if (cd.i < COUNTDOWN.length) { AudioSys.countdown(COUNTDOWN[cd.i].key); return; }
    this.countdown = null;
    this.launchStuckBalls();
  },

  onAbility() {
    if (this.countdown) return;
    if (this.state !== 'play' && this.state !== 'serve') return;
    if (this.abilityCd > 0) return;
    if (Meta.rank('emp')) {
      this.abilityCd = 40;
      this.doEmp();
    } else if (Meta.rank('laser')) {
      this.abilityCd = 7;
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (this.state !== 'play' && this.state !== 'serve') return;
          this.lasers.push(new Laser(this.paddle.x - this.paddle.w / 2 + 3, this.paddle.y - 10));
          this.lasers.push(new Laser(this.paddle.x + this.paddle.w / 2 - 3, this.paddle.y - 10));
          AudioSys.sfx('laser');
        }, i * 120);
      }
    }
  },
  togglePause(force) {
    if (this.state === 'play' || this.state === 'serve') {
      this.prevState = this.state;
      this.state = 'pause';
      showScreen('scrPause');
    } else if (this.state === 'pause' && !force) {
      this.state = this.prevState;
      hideScreens();
    }
  },
  onRestartKey() {
    if (this.state === 'play' || this.state === 'serve' || this.state === 'pause') this.startRun(this.mode);
  },
  devRoom() {
    if (!Meta.data.ach.secret) {
      this.unlock('secret');
      Meta.data.credits += 500;
      Meta.save();
      toast('DEVELOPER ROOM', 'You found the backdoor. +500 credits.');
      refreshMenuStats();
    }
  },

  // ======== scoring / glitch meter ========
  get multiplier() { return Rules.scoreMultiplier(this.glitch, this.timers.mult > 0); },
  addScore(base, x, y) {
    const pts = Rules.points(base, this.combo, this.glitch, this.timers.mult > 0);
    this.score += pts;
    if (x !== undefined) FX.text(x, y, '+' + pts, COL.cyan, 12);
    if (this.score >= 10000) this.unlock('score10k');
    if (this.score >= 50000) this.unlock('score50k');
  },
  addGlitch(n) {
    const before = this.glitch;
    this.glitch = clamp(this.glitch + n, 0, 100);
    // an overload, once; the meter has to fall back before it can happen again
    if (Rules.overloadFires(before, this.glitch, this.overloadArmed !== false)) {
      this.overloadArmed = false;
      this.unlock('glitch100');
      banner('SYSTEM OVERLOAD');
      AudioSys.sfx('event');
      FX.flash(COL.magenta, 0.5); FX.shake(10); FX.setRgb(1); FX.tear(0.8);
      this.triggerEvent(); // free chaos
    }
  },

  // ======== brick logic ========
  generatorsAlive() { return this.bricks.some(b => b.alive && b.type === 'generator'); },

  damageBrick(b, dmg, src = {}) {
    if (!b.alive) return false;
    this.meet('brick', b.type);
    // some bricks shrug off some hits (see brickImmune in js/rules.js)
    const immune = Rules.brickImmune(b.type, (b.type === 'shield' || b.type === 'bosscore') && this.generatorsAlive(), src);
    if (immune) {
      const col = { SHIELDED: COL.violet, LOCKED: COL.red, FIREWALL: '#ff5500' }[immune];
      if (col) FX.text(b.cxm, b.cym, immune, col, 10);
      AudioSys.sfx('wall');
      return false;
    }
    // crit
    if (Meta.rank('crit') && chance(Meta.rank('crit') * 0.08)) { dmg *= 2; FX.text(b.cxm, b.cym - 10, 'CRIT', COL.yellow, 11); }
    b.hp -= dmg;
    b.flashT = 0.12;
    if (b.hp <= 0) { this.destroyBrick(b, src); return true; }
    AudioSys.sfx('heavy');
    FX.spawn(src.x ?? b.cxm, src.y ?? b.cym, BRICKS[b.type].color, 5, { spd: 120 });
    // teleport brick relocates when damaged but not destroyed
    if (b.type === 'teleport') {
      FX.spawn(b.cxm, b.cym, COL.orange, 10);
      b.x = rand(20, CFG.W - CFG.BRICK_W - 20);
      b.y = rand(CFG.BRICK_TOP, 380);
      AudioSys.sfx('teleport');
    }
    return false;
  },

  destroyBrick(b, src = {}) {
    b.alive = false;
    const def = BRICKS[b.type];
    this.combo++;
    if (this.combo > this.maxCombo) { this.maxCombo = this.combo; this.stats.comboSector = this.level; }
    if (this.combo >= 15) this.unlock('combo15');
    if (this.combo >= 30) this.unlock('combo30');
    this.stats.bricks++;
    if (this.tutor) { this.tutor.e.bricks++; this.tutor.e.bestCombo = Math.max(this.tutor.e.bestCombo, this.combo); }
    this.unlock('first');
    this.addScore(def.score, b.cxm, b.cym);
    this.addGlitch(1.1);
    AudioSys.sfx('brick', Math.min(this.combo, 12));
    this.burst(b.cxm, b.cym, def.color);
    FX.shake(1);

    switch (b.type) {
      case 'explosive':
        this.explode(b.cxm, b.cym, 90, 1);
        break;
      case 'virus': {
        // corrupt nearby bricks: mutate their behavior
        let n = 0;
        for (const o of this.bricks) {
          if (!o.alive || o === b || n >= 2) continue;          // was up to 3 at 70%: spread slower
          if (dist2(b.cxm, b.cym, o.cxm, o.cym) < 110 ** 2 && chance(0.5)) {
            o.corrupt = 1;
            o.morph(choice(['virus', 'moving', 'quantum', 'clone']));
            n++;
          }
        }
        if (n) FX.text(b.cxm, b.cym - 14, 'CORRUPTED', '#7dff5a', 10);
        break;
      }
      case 'generator':
        FX.flash(COL.yellow, 0.15);
        if (!this.generatorsAlive()) FX.text(CFG.W / 2, 200, 'SHIELDS DOWN', COL.yellow, 18);
        break;
      case 'bosscore':
        FX.flash(COL.red, 0.4); FX.shake(10);
        this.explode(b.cxm, b.cym, 140, 2);
        break;
    }

    // powerup drop
    let luck = Rules.dropChance(Meta.rank('luck'), this.glitch);
    let pool = Rules.dropPool(this.mode);
    // anti-softlock: if only firewall bricks remain, shower firewall-piercing drops
    if (Rules.onlyFirewallsLeft(this.bricks.filter(x => x.alive && x.type !== 'barrier').map(x => x.type))) {
      luck = 0.6;
      pool = Rules.BREACH_KIT;
    }
    if (this.tutor) {
      // the lesson has one certain drop, so there is something to catch
      if (this.tutor.e.bricks === Rules.TUTORIAL.dropAfter) this.powerups.push(new PowerUp(b.cxm, b.cym, Rules.TUTORIAL.drop));
    } else if (!src.noDrop && chance(luck)) {
      const kind = pool[Math.floor(Math.random() * pool.length)];
      this.powerups.push(new PowerUp(b.cxm, b.cym, kind));
    }
  },

  // What a brick does as it breaks: the effect you wear (a prize from the
  // Glitchcade's counter; see Prizes in js/wallet.js).
  burst(x, y, col) {
    switch (Prizes.burst) {
      case 'confetti':
        for (const c of [COL.cyan, COL.magenta, COL.yellow, COL.green, col]) FX.spawn(x, y, c, 4, { spd: 270, grav: 430, size: 4, life: 0.95, dir: -Math.PI / 2, spread: 2.6 });
        break;
      case 'shards':
        FX.spawn(x, y, '#dff6ff', 10, { spd: 150, grav: 640, size: 5, life: 0.85 });
        FX.spawn(x, y, col, 4, { spd: 120, grav: 640, size: 3, life: 0.7 });
        break;
      case 'coins':
        FX.spawn(x, y, '#ffd166', 9, { spd: 250, grav: 720, size: 6, life: 0.95, dir: -Math.PI / 2, spread: 1.5, square: false });
        FX.spawn(x, y, col, 4, { spd: 160 });
        break;
      default:
        FX.spawn(x, y, col, 14, { spd: 220 });
    }
  },

  explode(x, y, r, dmg) {
    AudioSys.sfx('explode');
    FX.spawn(x, y, COL.orange, 26, { spd: 340 });
    FX.spawn(x, y, COL.red, 16, { spd: 240 });
    FX.shake(6); FX.flash(COL.orange, 0.12);
    for (const o of this.bricks) {
      if (!o.alive) continue;
      if (dist2(x, y, o.cxm, o.cym) < r * r) this.damageBrick(o, dmg, { explosion: true, noDrop: chance(0.5) });
    }
    for (const e of this.enemies) {
      if (!e.dead && dist2(x, y, e.x, e.y) < r * r) this.damageEnemy(e, dmg);
    }
    if (this.boss && !this.boss.dead && this.boss.pointHit(x, y)) this.boss.hit(dmg, this, x, y);
  },

  tryCloneBrick(b) {
    const destructible = this.bricks.filter(x => x.alive).length;
    if (destructible > 130) return;
    const bw = CFG.BRICK_W + CFG.BRICK_GAP, bh = CFG.BRICK_H + CFG.BRICK_GAP;
    const spots = [[b.x - bw, b.y], [b.x + bw, b.y], [b.x, b.y - bh], [b.x, b.y + bh]];
    for (const [sx, sy] of spots.sort(() => Math.random() - 0.5)) {
      if (sx < 10 || sx + CFG.BRICK_W > CFG.W - 10 || sy < 40 || sy > 420) continue;
      const clash = this.bricks.some(o => o.alive && Math.abs(o.x - sx) < CFG.BRICK_W && Math.abs(o.y - sy) < CFG.BRICK_H);
      if (!clash) {
        const nb = new Brick(sx, sy, 'clone');
        nb.flashT = 0.3;
        this.bricks.push(nb);
        FX.spawn(sx + CFG.BRICK_W / 2, sy + CFG.BRICK_H / 2, '#7dff5a', 8, { spd: 90 });
        return nb;
      }
    }
  },

  healNearBrick(b) {
    for (const o of this.bricks) {
      if (!o.alive || o.hp >= o.maxHp || o.hp < 0 || o === b) continue;
      if (dist2(b.cxm, b.cym, o.cxm, o.cym) < 140 ** 2) {
        o.hp = Math.min(o.maxHp, o.hp + 1);
        o.flashT = 0.25;
        FX.spawn(o.cxm, o.cym, '#ff6ad5', 6, { spd: 70 });
        return;
      }
    }
  },

  // ======== enemies ========
  damageEnemy(e, dmg) {
    e.hp -= dmg; e.flash = 0.15;
    if (e.hp <= 0) {
      e.dead = true;
      AudioSys.sfx('enemyDie');
      FX.spawn(e.x, e.y, COL.red, 16, { spd: 220 });
      this.addScore(200, e.x, e.y);
      this.addGlitch(2);
    }
  },
  paddleHitByProjectile(shot) {
    if (shot?.src) this.lockProtectiveTarget(shot.src);
    if (this.timers.shield > 0) {
      AudioSys.sfx('wall');
      FX.spawn(this.paddle.x, this.paddle.y, COL.green, 10);
      return;
    }
    this.paddle.stun = 2.2;
    // for the recap: whose shot it was
    const by = shot && shot.src;
    this.stunBy = by ? (by.kind && ENEMY_INFO[by.kind] ? 'a ' + ENEMY_INFO[by.kind].name : by.name || null) : null;
    this.combo = 0;
    AudioSys.sfx('lose');
    FX.shake(6); FX.flash(COL.red, 0.2);
    FX.text(this.paddle.x, this.paddle.y - 24, 'STUNNED', COL.red, 12);
  },
  spawnEnemy() {
    const lv = this.level;
    if (this.enemies.filter(e => !e.dead).length >= Rules.enemyCap(lv, this.mods.tripleEnemy)) return;
    // drones from sector 3; the rest are held back to sector 6 with the virus and clone bricks
    const kinds = Rules.enemyKinds(lv);
    if (!kinds.length) return;
    const K = ENEMY_CLASSES[choice(kinds)];
    const e = K === Turret
      ? new Turret(chance(0.5) ? 30 : CFG.W - 30, rand(200, 320))
      : new K(rand(100, CFG.W - 100), rand(60, 160));
    this.enemies.push(e);
    this.meet('enemy', e.kind);
    FX.spawn(e.x, e.y, COL.red, 12);
  },

  // ======== powerups ========
  applyPowerup(kind, x, y) {
    this.stats.powerups++;
    this.restorePaddle(true);       // MEMORY LEAK: a power-up puts the paddle back to full length
    AudioSys.sfx('powerup');
    const d = POWERUPS[kind];
    if (kind !== 'random') {        // the randomizer names what it turned into
      this.stats.powers[kind] = (this.stats.powers[kind] || 0) + 1;
      this.meet('power', kind);
      if (!this.attract) this.pickup = { kind, t: 2.4, life: 2.4 };
      if (this.tutor) this.tutor.e.powerups++;
    } else this.meet('power', 'random');
    FX.spawn(x, y, d.color, 12, { spd: 140 });
    const liveBalls = this.balls.filter(b => !b.dead);
    const src = liveBalls[0] || new Ball(this.paddle.x, this.paddle.y - 20, -Math.PI / 2);
    switch (kind) {
      case 'triple': {
        const adds = [];
        for (const b of liveBalls.slice(0, 3)) {
          for (const da of [-0.5, 0.5]) {
            const a = Math.atan2(b.vy, b.vx) + da;
            const nb = new Ball(b.x, b.y, a, b.speed);
            nb.fire = b.fire; nb.pierce = b.pierce; nb.boom = b.boom;
            adds.push(nb);
          }
          if (adds.length >= 6) break;
        }
        this.balls.push(...adds);
        break;
      }
      case 'split': {
        const b = choice(liveBalls) || src;
        const a = Math.atan2(b.vy, b.vx);
        this.balls.push(new Ball(b.x, b.y, a + 0.7, b.speed), new Ball(b.x, b.y, a - 0.7, b.speed));
        break;
      }
      case 'laser': this.paddle.laserT += d.dur; break;
      case 'emp': this.doEmp(); break;
      case 'gravity': for (const b of this.balls) b.grav += d.dur; break;
      case 'fire': for (const b of this.balls) b.fire += d.dur; break;
      case 'freeze': this.timers.freezeP = (this.timers.freezeP || 0) + d.dur; break;
      case 'shield': this.timers.shield = (this.timers.shield || 0) + d.dur; break;
      case 'pulse':
        for (const b of this.balls) { b.pierce = Math.max(b.pierce, 2); b.setSpeed(b.speed * 1.25); }
        FX.flash(COL.white, 0.15); FX.shake(4);
        break;
      case 'magnet': this.paddle.magnetT += d.dur; break;
      case 'pierce': for (const b of this.balls) b.pierce += d.dur; break;
      case 'boom': for (const b of this.balls) b.boom += d.dur; break;
      case 'slow': this.timers.slow = (this.timers.slow || 0) + d.dur; break;
      case 'warp': this.timers.warp = (this.timers.warp || 0) + d.dur; break;
      case 'gbomb': {
        const targets = this.bricks.filter(b => b.alive && b.hp > 0);
        for (let i = 0; i < 8 && targets.length; i++) {
          const b = targets.splice(Math.floor(Math.random() * targets.length), 1)[0];
          this.damageBrick(b, 99, { emp: true, noDrop: true });
        }
        FX.tear(0.6); FX.setRgb(0.8);
        break;
      }
      case 'drone': this.drones.push(new AssistDrone()); break;
      case 'random': {
        const others = Rules.dropPool(this.mode).filter(k => k !== 'random');
        this.applyPowerup(choice(others), x, y);
        return;
      }
      case 'life':
        this.lives++;
        AudioSys.sfx('life');
        break;
      case 'mult': this.timers.mult = (this.timers.mult || 0) + d.dur; break;
      case 'wide': this.paddle.wideT += d.dur; break;
    }
    // stacked deck achievement — 3+ timed effects live
    let active = 0;
    for (const k of ['mult', 'slow', 'warp', 'freezeP', 'shield']) if (this.timers[k] > 0) active++;
    if (this.paddle.laserT > 0) active++;
    if (this.paddle.magnetT > 0) active++;
    if (this.paddle.wideT > 0) active++;
    for (const b of this.balls) { if (b.fire > 0 || b.pierce > 0 || b.boom > 0 || b.grav > 0) { active++; break; } }
    if (active >= 3) this.unlock('stack3');
  },

  doEmp() {
    AudioSys.sfx('emp');
    FX.flash(COL.yellow, 0.35); FX.shake(10); FX.setRgb(0.9); FX.tear(0.5);
    for (const b of [...this.bricks]) if (b.alive && b.type !== 'barrier') this.damageBrick(b, 1, { emp: true, noDrop: true });
    this.projectiles = [];
    for (const e of this.enemies) if (!e.dead) this.damageEnemy(e, 2);
    if (this.boss && !this.boss.dead) this.boss.hit(3, this);
  },

  // ======== glitch events ========
  triggerEvent() {
    // one event at a time: the one in progress is wound up properly first (a DATA
    // SURGE that was simply replaced used to leave the ball fast until the sector ended)
    if (this.activeEvent) this.endEvent();
    const ev = choice(EVENTS);
    this.activeEvent = ev;
    this.meet('event', ev.id);
    AudioSys.setEvent(ev.id);
    this.eventT = Math.min(ev.dur, EVENT_MAX_DUR);
    banner(ev.name);
    AudioSys.sfx('event');
    FX.setRgb(0.7); FX.tear(0.4);
    switch (ev.id) {
      case 'timeFreeze': this.eventFlags.timeFreeze = true; AudioSys.sfx('freeze'); break;
      case 'packetLoss': for (const b of this.balls) b.invisible = ev.dur; break;
      case 'kernelPanic': FX.flash('#fff', 0.8); FX.shake(14); break;
      case 'dataSurge':
        if (!this.surgeApplied) { this.surgeApplied = true; for (const b of this.balls) b.setSpeed(b.speed * 1.55); }
        break;
      case 'firewallOn': {
        for (let i = 0; i < randInt(3, 5); i++) {
          const b = new Brick(rand(60, CFG.W - 120), rand(300, 430), 'barrier');
          b.life = ev.dur;
          this.bricks.push(b);
        }
        break;
      }
      case 'quantumShift': {
        const movable = this.bricks.filter(b => b.alive && b.type !== 'rotating' && b.type !== 'barrier');
        const pos = movable.map(b => [b.x, b.y]);
        pos.sort(() => Math.random() - 0.5);
        movable.forEach((b, i) => { b.x = pos[i][0]; b.y = pos[i][1]; b.flashT = 0.3; });
        AudioSys.sfx('teleport');
        break;
      }
      case 'memoryLeak': this.leakT = 1.5; this.leaked = 0; break;
      case 'systemError': this.errT = 0.2; break;
    }
  },
  endEvent() {
    const ev = this.activeEvent;
    if (!ev) return;
    if (ev.id === 'timeFreeze') this.eventFlags.timeFreeze = false;
    if (ev.id === 'dataSurge' && this.surgeApplied) {
      this.surgeApplied = false;
      for (const b of this.balls) b.setSpeed(b.speed / 1.55);
    }
    this.activeEvent = null;
    AudioSys.setEvent(null);
  },

  // ======== life / level flow ========
  loseLife() {
    // the boss is already dead and the sector is about to clear: no penalty
    if (this.boss && this.boss.dead) { this.serve(); this.state = 'serve'; return; }
    this.combo = 0;
    // for the recap: what was going on when this ball got past
    const gone = this.lastLost, p = this.paddle;
    this.stats.lives.push({
      sector: this.level, arena: this.arena.name, rule: this.rule,
      event: this.activeEvent ? this.activeEvent.id : null,
      stunnedBy: p.stun > 0 ? this.stunBy || 'an enemy' : null,
      gap: gone ? Math.max(0, Math.abs(gone.x - p.x) - p.w / 2) : undefined,
      speed: gone ? gone.speed / CFG.BALL_MAX : 0,
    });
    this.restorePaddle(false);
    AudioSys.sfx('lose');
    FX.shake(10); FX.flash(COL.red, 0.3); FX.setRgb(0.8);
    if (this.attract) { this.serve(); this.state = 'serve'; return; } // demo never dies
    if (this.sentient && this.lastLostTrail?.length) {
      this.ghost = { pts: this.lastLostTrail, t: 2.6 };
      this.mournNext = true;
    }
    if (this.mode === 'puzzle') {
      this.ballsLeft--;
      if (this.ballsLeft <= 0) return this.endRun(false);
      FX.text(CFG.W / 2, 400, this.ballsLeft + ' BALLS LEFT', COL.red, 16);
      this.serve(); this.state = 'serve';
      return;
    }
    this.lives--;
    if (this.lives <= 0) return this.endRun(false);
    this.serve();
    this.state = 'serve';
  },

  levelCleared() {
    if (this.attract) { this.level++; this.startLevel(); showScreen('scrMenu'); return; }
    if (this.tutor) { this.tutor.e.cleared = true; this.endTutorial(); }
    this.state = 'clear';
    this.clearProtectiveTarget();
    AudioSys.setEvent(null);
    AudioSys.sfx('life');
    const clearBonus = Rules.clearBonus(this.level);
    let bonus = clearBonus;
    let timeBonus = 0;
    if (this.mode === 'time') {
      timeBonus = Rules.timeBonus(this.levelTime);
      bonus += timeBonus;
    }
    this.score += bonus;
    const coins = this.awardCoins();
    const modeDef = MODES[this.mode];
    const finished = this.level >= modeDef.levels;
    if (finished) return this.endRun(true);
    this.screenAt = performance.now();
    this.clearT = 0;
    $('clearTitle').textContent = `SECTOR ${String(this.level).padStart(2, '0')} PURGED`;
    $('clearStats').innerHTML =
      `<div class="clear-bonus">CLEAR BONUS +${clearBonus.toLocaleString()}` +
      `${timeBonus ? ` &nbsp;·&nbsp; TIME BONUS +${timeBonus.toLocaleString()}` : ''}</div>` +
      statChips([
        ['Score', this.score.toLocaleString(), true],
        ['Max Combo', this.maxCombo],
        ['Time', this.levelTime.toFixed(1) + 's'],
        ...(coins ? [['◎ Coins', '+' + coins]] : []),
      ]) +
      `<div class="stat">${this.autoplay ? 'AI continues automatically' : 'SPACE / ENTER to continue'}</div>`;
    showScreen('scrClear');
  },

  // Glitchcade coins for the sector just cleared, paid into the wallet Glitch Pong
  // shares. Boss sectors pay a Glitch Pong win's worth. Nothing for the menu demo
  // or for any sector the AI played part of.
  awardCoins() {
    if (this.attract || this.mode === 'ai' || this.sectorAssisted) return 0;
    const n = this.boss ? COINS.boss : COINS.sector;
    Wallet.award(n);
    SectorLog.add();
    this.runCoins += n;
    return n;
  },

  nextLevel() {
    this.level++;
    if (this.level >= 5) this.unlock('sector5');
    if (this.level >= 10) this.unlock('sector10');
    if (this.mode === 'hardcore' && this.level >= 3) this.unlock('hardcore3');
    this.startLevel();
  },

  onBossDeath(boss) {
    if (this.attract) {
      FX.shake(16); FX.flash('#fff', 0.6); FX.setRgb(1); FX.tear(1);
      FX.spawn(boss.x, boss.y, COL.red, 60, { spd: 420 });
      for (const b of this.bricks) if (b.alive) { b.alive = false; FX.spawn(b.cxm, b.cym, BRICKS[b.type].color, 4); }
      $('bossBar').style.display = 'none';
      this.bossClearT = 0.9;
      return;
    }
    this.stats.bosses++;
    this.unlock('boss1');
    if (boss instanceof TheEye) this.unlock('eyeboss');
    if (boss instanceof TheEye && this.aiEarnsProgress()) Cabinet.report('eye-defeated', { mode: this.mode });
    Meta.data.bossKills[boss.name] = true;
    if (Object.keys(Meta.data.bossKills).length >= 4) this.unlock('boss4');
    Meta.save();
    AudioSys.sfx('bossdie');
    FX.shake(16); FX.flash('#fff', 0.6); FX.setRgb(1); FX.tear(1);
    FX.spawn(boss.x, boss.y, COL.red, 60, { spd: 420 });
    this.addScore(2500, boss.x, boss.y);
    this.addGlitch(15);
    // clear leftover bricks as a reward
    for (const b of this.bricks) if (b.alive) { b.alive = false; FX.spawn(b.cxm, b.cym, BRICKS[b.type].color, 4); }
    $('bossBar').style.display = 'none';
    this.bossClearT = 0.9;
  },

  endRun(won) {
    this.state = 'over';
    this.endTutorial();
    this.clearProtectiveTarget();
    AudioSys.stopMusic();
    const secs = (performance.now() - this.stats.timeStart) / 1000;
    const earns = this.aiEarnsProgress();
    const rewards = Rules.runRewards(this.score, this.level, Meta.rank('xp_boost'));
    const xpGain = earns ? rewards.xp : 0;
    const crGain = earns ? rewards.credits : 0;
    const bestKey = this.mode;
    const prevBest = Meta.data.best[bestKey] || 0;
    const newBest = earns && this.score > 0 && this.score > prevBest;
    this.screenAt = performance.now();
    if (earns) Cabinet.report('run', { mode: this.mode, score: Math.floor(this.score), level: this.level, won: !!won });
    if (earns) {
      Meta.data.xp += xpGain;
      Meta.data.credits += crGain;
      if (!Meta.data.best[bestKey] || this.score > Meta.data.best[bestKey]) Meta.data.best[bestKey] = this.score;
      if (this.mode === 'daily') {
        const today = todayStr();
        const dd = Meta.data.daily;
        if (dd.date !== today || this.score > dd.score) Meta.data.daily = { date: today, score: this.score };
        this.unlock('daily1');
      }
      if (won && this.mode === 'classic') this.unlock('clearC');
      Meta.save();
    }
    $('overTitle').textContent = won ? 'SYSTEM RESTORED' : (this.mode === 'hardcore' ? 'FATAL EXCEPTION' : 'CONNECTION LOST');
    $('overScore').textContent = this.score.toLocaleString();
    $('overStats').innerHTML =
      statChips([
        ['Sector', this.level],
        ['Bricks', this.stats.bricks],
        ['Max Combo', this.maxCombo],
        ['Time', secs.toFixed(0) + 's'],
      ]) +
      (earns
        ? statChips([
            ['+ XP', xpGain.toLocaleString()],
            ['+ Credits', crGain.toLocaleString()],
            ...(this.runCoins ? [['◎ Coins', '+' + this.runCoins]] : []),
            [newBest ? 'New Best!' : 'Best', (Meta.data.best[bestKey] ?? this.score).toLocaleString(), true],
          ])
        : `<div class="clear-bonus">AI AUTOPLAY — NO PROGRESSION EARNED</div>`) +
      (newBest && prevBest ? `<div class="clear-bonus">NEW PERSONAL BEST — previous ${prevBest.toLocaleString()}</div>` : '') +
      '<div class="recap">' + Rules.runRecap({
        mode: this.mode, won: !!won, maxCombo: this.maxCombo, comboSector: this.stats.comboSector,
        powers: this.stats.powers, lives: this.stats.lives, newEntries: this.stats.newEntries,
      }).map((row) => `<div class="rc"><i>${row.label}</i><span>${row.power ? `<img src="${powerIconUrl(row.power)}" alt="">` : ''}${row.text}</span></div>`).join('') + '</div>';
    if (newBest) AudioSys.sfx('achieve');
    showScreen('scrOver');
    refreshMenuStats();
  },

  attractShuffle() {
    // jump to a fresh random sector so the demo keeps showing new arenas & bosses
    this.level = 1 + Math.floor(Math.random() * 12);
    this.startLevel();
    showScreen('scrMenu');
  },

  unlock(id) {
    if (this.attract) return;              // the menu demo earns nothing
    if (!this.aiEarnsProgress()) return;   // nor does AI autoplay unless enabled in Settings
    if (Meta.data.ach[id]) return;
    const a = ACHIEVEMENTS.find(a => a.id === id);
    if (!a) return;
    Meta.data.ach[id] = true;
    Meta.save();
    AudioSys.sfx('achieve');
    toast('ACHIEVEMENT // ' + a.name, a.desc);
  },

  // ======== update ========
  update(rawDt) {
    this.abilityCd = Math.max(0, this.abilityCd - rawDt);
    this.laserCd = Math.max(0, this.laserCd - rawDt);
    // AI autoplay is meant to be watched hands-free: roll on to the next sector by itself
    if (this.state === 'clear' && this.autoplay) {
      this.clearT += rawDt;
      if (this.clearT > 2.5) this.nextLevel();
      return;
    }
    if (this.state !== 'play' && this.state !== 'serve') return;

    // timescale
    let ts = 1;
    if (this.activeEvent?.id === 'lagSpike') ts *= 0.45;
    if (this.activeEvent?.id === 'overclock') ts *= 1.5;
    if (this.timers.slow > 0) ts *= 0.55;
    if (this.timers.warp > 0) ts *= 0.35;
    const dt = rawDt * ts;
    this.time += dt;
    this.levelTime += dt;

    // timers decay
    for (const k in this.timers) if (this.timers[k] > 0) this.timers[k] -= rawDt;
    if (this.timers.freezeP > 0) this.eventFlags.timeFreeze = true;
    else if (!this.activeEvent || this.activeEvent.id !== 'timeFreeze') this.eventFlags.timeFreeze = false;

    // moving walls daily mod
    if (this.mods.movingWalls) {
      this.wallInsetL = 40 + Math.sin(this.time * 0.5) * 40;
      this.wallInsetR = 40 + Math.cos(this.time * 0.43) * 40;
    } else { this.wallInsetL = this.wallInsetR = 0; }

    // the machine drives the paddle in the menu demo and in AI autoplay
    if (this.attract || this.autoplay) {
      this.paddle.update(dt, this.computeAiInput());
      // also release balls a magnet paddle caught mid-play — with the permanent
      // Magnetic Plating upgrade the AI used to hold the ball forever
      if (this.state === 'serve' || this.balls.some(b => b.stuck)) {
        this.serveT += rawDt;
        if (this.serveT > (this.autoplay ? 0.45 : 0.7)) { this.serveT = 0; this.onFire(); }
      }
      if (this.autoplay) {
        // use the paddle laser and the [X] ability whenever they are available
        if (this.paddle.hasLaser && this.laserCd <= 0) this.onFire();
        if (this.abilityCd <= 0 && chance(rawDt * 0.6)) this.onAbility();
      }
      if (this.attract) {
        this.attractResetT -= rawDt;
        if (this.attractResetT <= 0) { this.attractResetT = rand(22, 38); this.attractShuffle(); }
      }
    } else {
      this.paddle.update(dt, input);
    }
    if (this.pickup && (this.pickup.t -= rawDt) <= 0) this.pickup = null;
    if (this.tutor) this.tickTutorial(rawDt);

    // 3-2-1-GO: only the paddle moves; everything else waits for the launch
    if (this.countdown) {
      this.levelTime -= dt;           // Time Attack's clock starts at GO
      for (const b of this.balls) b.update(rawDt, this);
      FX.update(rawDt);
      this.tickCountdown(rawDt);
      return;
    }

    // ---- glitch events schedule ----
    if (this.activeEvent) {
      // drain on WALL-CLOCK time: draining on scaled time let slow-motion / lag-spike
      // stretch a 6s event past 15 real seconds
      this.eventT -= rawDt;
      if (this.activeEvent.id === 'memoryLeak') {
        // MEMORY LEAK drops green copies of random bricks. It used to drop one every
        // 1.2s (about 5 a leak), and each was a clone brick that then copied itself
        // too, so the board snowballed. Now: one every 2.5s, at most 3 a leak, and
        // the leaked copies don't copy themselves.
        this.leakT -= rawDt;
        if (this.leakT <= 0 && this.leaked < 3) {
          this.leakT = 2.5;
          const clones = this.bricks.filter(b => b.alive && b.type !== 'barrier');
          if (clones.length) {
            const nb = this.tryCloneBrick(choice(clones));
            if (nb) nb.leaked = true;
          }
          this.leaked++;
        }
      }
      if (this.activeEvent.id === 'systemError') {
        this.errT -= rawDt;
        if (this.errT <= 0) { this.errT = 0.25; FX.shift(rand(-26, 26), rand(-14, 14)); FX.setRgb(0.6); }
      }
      if (this.eventT <= 0) this.endEvent();
    } else if (this.state === 'play') {
      this.nextEventT -= dt;
      if (this.nextEventT <= 0) {
        const freq = this.mode === 'corrupt' ? 0.45 : 1;
        this.nextEventT = rand(13, 24) * freq * (1 - this.glitch / 250);
        this.triggerEvent();
      }
    }

    // ---- corruption ----
    if (this.state === 'play') {
      const damp = 1 - Meta.rank('damp') * 0.2;
      const rate = (this.mode === 'corrupt' ? 2.6 : 0.55) * (1 + this.glitch / 120) * damp;
      this.corruption = clamp(this.corruption + rate * dt, 0, 100);
      this.corruptT -= dt;
      if (this.corruptT <= 0) {
        this.corruptT = rand(4, 9) * (1 - this.corruption / 160);
        if (this.corruption > 25) this.corruptRandomBrick();
      }
      // ambient corruption visuals
      if (this.corruption > 20 && chance(dt * this.corruption / 90)) FX.setRgb(this.corruption / 220);
      if (this.corruption > 55 && chance(dt * 0.5)) FX.tear(0.25);
      this.glitch = Math.max(0, this.glitch - dt * 0.55);
      if (Rules.overloadRearms(this.glitch)) this.overloadArmed = true;
      AudioSys.setGlitch(Math.max(this.glitch / 100, this.corruption / 130));
    }

    // ---- anti-softlock: airdrop breaching powerups if only firewalls remain ----
    if (this.state === 'play' && !this.boss) {
      const aliveBricks = this.bricks.filter(x => x.alive && x.type !== 'barrier');
      if (aliveBricks.length && aliveBricks.every(x => x.type === 'firewall')) {
        this.rescueT = (this.rescueT ?? 4) - dt;
        if (this.rescueT <= 0 && !this.powerups.length) {
          this.rescueT = 8;
          this.powerups.push(new PowerUp(rand(100, CFG.W - 100), -10, choice(['fire', 'laser', 'boom'])));
          FX.text(CFG.W / 2, 240, 'BREACH KIT INBOUND', '#ff5500', 13);
        }
      } else this.rescueT = 4;
    }

    // ---- enemies spawn ----
    if (this.state === 'play' && this.level >= 3 && !this.boss) {
      this.enemySpawnT -= dt;
      if (this.enemySpawnT <= 0) {
        this.enemySpawnT = rand(11, 18) * (this.mods.tripleEnemy ? 0.4 : 1);
        this.spawnEnemy();
      }
    }

    // ---- entities ----
    for (const b of this.bricks) if (b.alive) b.update(dt, this);
    this.bricks = this.bricks.filter(b => b.alive); // destroyed bricks vanish at once (particle burst is the feedback)
    for (const h of this.hazards) h.update(dt, this);
    for (const e of this.enemies) if (!e.dead) e.update(dt, this);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const d of this.drones) d.update(dt, this);
    this.drones = this.drones.filter(d => !d.dead);
    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    for (const l of this.lasers) l.update(dt, this);
    this.lasers = this.lasers.filter(l => !l.dead);
    for (const p of this.powerups) p.update(dt, this);
    this.powerups = this.powerups.filter(p => !p.dead);
    if (this.boss && !this.boss.dead) this.boss.update(dt, this);

    // ---- balls ----
    for (const ball of this.balls) {
      // Sub-step fast balls so they never move more than ~5px between collision checks.
      // At max speed under OVERCLOCK a ball travels ~39px a frame — wider than the
      // paddle's 27px hit window — so it could tunnel straight through the paddle.
      const travel = Math.hypot(ball.vx, ball.vy) * dt;
      const steps = ball.stuck ? 1 : clamp(Math.ceil(travel / 5), 1, 10);
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        ball.update(sdt, this, s === steps - 1);
        if (ball.dead || ball.stuck) break;
        this.collidePaddle(ball);
        if (ball.stuck) break;   // magnet caught it
        this.ballLoyalty(ball);
        this.collideBricks(ball);
        this.ballRampage(ball);
        if (this.boss && !this.boss.dead) {
          const hpBefore = this.boss.hp;
          this.boss.collideBall(ball, this);
          if (this.boss.hp < hpBefore) {
            ball.dull = 0;   // landing hits on a boss isn't boring
            if (ball.protecting === this.boss) this.avenged(ball, this.boss);
          }
        }
        // ball vs enemies — bounce away from the enemy instead of flipping vy every
        // frame, which left the ball jittering inside tougher enemies like turrets
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (dist2(ball.x, ball.y, e.x, e.y) < (e.r + ball.r) ** 2) {
            this.damageEnemy(e, ball.protecting === e ? 4 : 2);
            if (ball.protecting === e) this.avenged(ball, e);
            if (!(ball.pierce > 0)) ball.vy = ball.y < e.y ? -Math.abs(ball.vy) : Math.abs(ball.vy);
          }
        }
        // firewall shield at the bottom
        if (this.timers.shield > 0 && ball.vy > 0 && ball.y > CFG.H - 14) {
          ball.vy = -Math.abs(ball.vy);
          ball.y = CFG.H - 14;
          AudioSys.sfx('wall');
          FX.spawn(ball.x, CFG.H - 10, COL.green, 8, { spd: 120, dir: -Math.PI / 2, spread: 1.5 });
        }
      }
    }
    const before = this.balls.length;
    const lost = this.balls.find(b => b.dead);
    if (lost) { this.lastLostTrail = lost.trail.slice(0, 14); this.lastLost = { x: lost.x, speed: lost.speed }; }
    this.balls = this.balls.filter(b => !b.dead);
    this.siblingRivalry();
    if (this.balls.length === 0 && before > 0 && this.state === 'play') this.loseLife();

    FX.update(rawDt);

    // ---- win check ----
    // A dead boss clears the sector after a short beat. This runs on game time
    // (it used to be a setTimeout that only fired if state was still 'play', so
    // pausing — or losing the ball — in that window soft-locked the level).
    if (this.boss && this.boss.dead && this.bossClearT > 0) {
      this.bossClearT -= rawDt;
      if (this.bossClearT <= 0) { this.levelCleared(); return; }
    }
    if (this.state === 'play') {
      if (this.boss) {
        // handled by onBossDeath + bossClearT above
      } else {
        const remaining = this.bricks.some(b => b.alive && b.type !== 'barrier');
        if (!remaining) this.levelCleared();
      }
    }
  },

  corruptRandomBrick() {
    const targets = this.bricks.filter(b => b.alive && b.type !== 'barrier' && b.type !== 'bosscore');
    if (!targets.length) return;
    const b = choice(targets);
    b.corrupt = 1;
    const roll = Math.random();
    if (roll < 0.35) b.morph(choice(['virus', 'quantum', 'moving', 'clone', 'invisible']));
    else if (roll < 0.5 && this.corruption > 60) { b.alive = false; FX.spawn(b.cxm, b.cym, COL.red, 8); } // dissolves
    else if (roll < 0.65 && this.corruption > 50) this.tryCloneBrick(b);
    else b.flashT = 0.3;
    FX.setRgb(0.4);
  },

  onWallHit(ball) {
    AudioSys.sfx('wall');
    FX.spawn(ball.x, ball.y, this.arena.accent, 3, { spd: 80 });
  },

  collidePaddle(ball) {
    const p = this.paddle;
    if (ball.vy <= 0) return;
    if (Math.abs(ball.x - p.x) > p.w / 2 + ball.r || Math.abs(ball.y - p.y) > p.h / 2 + ball.r) return;
    if (ball.y > p.y + p.h) return; // came from below
    if (p.magnetic && !ball.stuck) {
      ball.stuck = true;
      ball.stuckDx = clamp(ball.x - p.x, -p.w / 2, p.w / 2);
      AudioSys.sfx('paddle', 0.5);
      this.combo = 0;
      return;
    }
    if (ball.showoff) { ball.showoff = false; ball.setSpeed(ball.speed / 1.06); }   // SHOW-OFF: back to earth
    const rel = clamp((ball.x - p.x) / (p.w / 2), -1, 1);
    const angle = this.sentientSteer(ball, -Math.PI / 2 + rel * 1.05); // up to ±60°, then the ball's own say
    ball.setSpeed(Math.min(CFG.BALL_MAX, ball.speed * CFG.BALL_ACCEL));
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.y = p.y - p.h / 2 - ball.r - 1;
    this.combo = 0;
    if (this.tutor) this.tutor.e.returns++;
    // MEMORY LEAK: a ball that comes back having broken nothing costs the paddle some length.
    // (`dull` counts returns since its last brick and has just been raised for this one.)
    if (this.rule === 'leak' && ball.dull > 1) this.leakReturns = (this.leakReturns || 0) + 1;
    p.glow = 1;
    AudioSys.sfx('paddle', (rel + 1) / 2);
    FX.spawn(ball.x, p.y - p.h / 2, PaddleColor.hex, 6, { spd: 120, dir: -Math.PI / 2, spread: 1.6 });
  },

  // ======== the sentient ball ========
  clearProtectiveTarget() {
    this.paddleAttacker = null;
    for (const ball of this.balls) {
      ball.protecting = null;
      if (ball.mood === 'protective') ball.mood = null;
    }
  },

  protectiveTarget() {
    const foe = this.paddleAttacker;
    if (!this.sentient || this.attract || !foe || foe.dead ||
        (foe !== this.boss && !this.enemies.includes(foe))) {
      if (foe) this.clearProtectiveTarget();
      return null;
    }
    return foe;
  },

  lockProtectiveTarget(foe) {
    if (!foe || !this.sentient || this.attract || foe.dead ||
        !(foe instanceof Enemy || foe === this.boss) ||
        (foe !== this.boss && !this.enemies.includes(foe))) return;
    const changed = this.paddleAttacker !== foe;
    this.paddleAttacker = foe;
    for (const ball of this.balls) {
      if (ball.dead) continue;
      ball.protecting = foe;
      ball.mood = 'protective';
    }
    if (changed) {
      FX.text(CFG.W / 2, this.paddle.y - 58, 'RETALIATION — TARGET LOCKED', '#ff8a3d', 13);
      this.meet('mood', 'protective');
      AudioSys.sfx('click');
    }
  },

  steerProtectiveBall(ball, dt) {
    const foe = this.protectiveTarget();
    if (!foe) {
      ball.protecting = null;
      if (ball.mood === 'protective') ball.mood = null;
      return false;
    }
    ball.protecting = foe;
    ball.mood = 'protective';
    ball.homeOn(foe.aimPoint ? foe.aimPoint(ball) : foe, dt);
    return true;
  },

  // Called as the ball leaves the paddle with the angle the paddle gave it;
  // returns the angle the ball actually takes.
  sentientSteer(ball, angle) {
    ball.dull++;
    if (!this.sentient) { ball.mood = null; ball.protecting = null; return angle; }
    let mood = null, target = null, pull = 0;
    const boss = this.boss && !this.boss.dead ? this.boss : null;
    const foe = this.protectiveTarget();
    if (foe) {
      // Launch straight at the shooter; guidance continues between bounces.
      ball.mood = 'protective';
      ball.protecting = foe;
      const at = foe.aimPoint ? foe.aimPoint(ball) : foe;
      return Math.atan2(at.y - ball.y, at.x - ball.x);
    }
    if (boss instanceof TheEye) {
      // GRUDGE: it hasn't forgotten the Pong arena
      mood = 'grudge'; target = boss; pull = 0.16;
    } else if (ball.dull >= BORED_AFTER) {
      // BORED: no bricks for a while — it goes looking for one, more insistently the longer it waits
      target = this.nearestBrick(ball) || boss;
      if (target) { mood = 'bored'; pull = Math.min(0.34, 0.1 + (ball.dull - BORED_AFTER) * 0.04); }
    }
    if (!target) {
      // CURIOUS: a strange brick it hasn't touched yet
      target = this.nearestBrick(ball, (b) => CURIOUS_OF.has(b.type) && !ball.met.has(b));
      if (target) { mood = 'curious'; pull = 0.12; }
    }
    if (mood !== ball.mood && mood && !this.attract) {
      const say = { bored: ['BORED...', '#8d97ad'], grudge: ['GRUDGE', '#ff8fb8'], curious: ['?', '#eef7ff'] }[mood];
      FX.text(ball.x, ball.y - 26, say[0], say[1], 12);
      this.meet('mood', mood);
    }
    ball.mood = mood;
    if (mood !== 'protective') ball.protecting = null;
    if (!target) return angle;
    const tx = target.cxm ?? target.x, ty = target.cym ?? target.y;
    let d = Math.atan2(ty - ball.y, tx - ball.x) - angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));          // shortest way round
    return clamp(angle + clamp(d, -pull, pull), -Math.PI + 0.3, -0.3);
  },

  // PROTECTIVE pays off
  avenged(ball, e) {
    ball.dull = 0;
    this.clearProtectiveTarget();
    FX.text(e.x, e.y - 22, 'AVENGED', '#ff8a3d', 14);
    FX.spawn(e.x, e.y, '#ff8a3d', 18, { spd: 240 });
  },

  renderProtectiveTarget() {
    const target = this.protectiveTarget();
    if (!target) return;
    // the part of it the ball is steering at (one head of the hydra, not the space between them)
    const hunter = this.balls.find(b => b.protecting === target);
    const foe = target.aimPoint && hunter ? target.aimPoint(hunter) : target;
    const rx = (foe.rx || foe.r || 16) + 10, ry = (foe.ry || foe.r || 16) + 10;
    const col = '#ff8a3d';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.25;
    ctx.globalAlpha = 0.36;
    ctx.setLineDash([5, 7]); ctx.lineDashOffset = FX.reduced ? 0 : -this.time * 36;
    for (const ball of this.balls) {
      if (ball.dead || ball.stuck || ball.protecting !== target ||
          (ball.invisible > 0 && Math.floor(ball.invisible * 10) % 2 === 0)) continue;
      ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(foe.x, foe.y); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = FX.reduced ? 0 : 10;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = foe.x + sx * rx, y = foe.y + sy * ry;
      ctx.beginPath(); ctx.moveTo(x - sx * 8, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * 8); ctx.stroke();
    }
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.font = '700 10px Orbitron, monospace';
    ctx.fillText('TARGET LOCKED', clamp(foe.x, 80, CFG.W - 80), Math.max(16, foe.y - ry - 8));
    ctx.restore();
  },

  // RAMPAGE: near the ceiling with live bricks underneath it means it got behind
  // the wall. It ends once it drops back below the lowest brick.
  ballRampage(ball) {
    if (!this.sentient || this.attract) { if (ball.rampaging) this.endRampage(ball); return; }
    if (!ball.rampaging) {
      if (ball.y > 64) return;
      const behind = this.bricks.some(b => b.alive && b.type !== 'barrier' && b.y > ball.y && Math.abs(b.cxm - ball.x) < b.w);
      if (!behind) return;
      ball.rampaging = true;
      ball.rampage = 0;
      ball.setSpeed(ball.speed * 1.08);
      FX.text(ball.x, ball.y + 26, 'RAMPAGE!', '#ffd166', 15);
      this.meet('mood', 'rampage');
      AudioSys.sfx('event');
      return;
    }
    let lowest = 0;
    for (const b of this.bricks) if (b.alive && b.type !== 'barrier') lowest = Math.max(lowest, b.y + b.h);
    if (ball.y > lowest + 14) this.endRampage(ball);
  },
  endRampage(ball) {
    ball.rampaging = false;
    ball.setSpeed(ball.speed / 1.08);
    if (ball.rampage > 0 && !this.attract) FX.text(ball.x, ball.y - 20, 'RAMPAGE x' + ball.rampage, '#ffd166', 14);
    ball.rampage = 0;
  },

  // SIBLING RIVALRY: who's winning the multi-ball, if anyone
  rivalLeader() {
    if (!this.sentient || this.balls.length < 2) return null;
    let best = null, tie = false;
    for (const b of this.balls) {
      if (b.breaks <= 0) continue;
      if (!best || b.breaks > best.breaks) { best = b; tie = false; }
      else if (b.breaks === best.breaks) tie = true;
    }
    return tie ? null : best;
  },
  siblingRivalry() {
    const n = this.balls.length, prev = this.ballsPrev;
    this.ballsPrev = n;
    if (n > 1 && prev <= 1) {
      for (const b of this.balls) b.breaks = 0;   // a fresh multi-ball: everyone starts level
      if (this.sentient) this.meet('mood', 'rivalry');
    }
    if (n === 1 && prev > 1 && this.sentient && !this.attract) {
      const last = this.balls[0];
      if (last.breaks > 0) {
        const bonus = 150 * last.breaks;
        this.addScore(bonus);
        FX.text(last.x, last.y - 24, 'LAST BALL STANDING +' + bonus, '#ffd166', 13);
      }
    }
  },

  nearestBrick(ball, filter = null) {
    let best = null, bestD = Infinity;
    for (const b of this.bricks) {
      if (!b.alive || b.type === 'barrier') continue;
      if (filter && !filter(b)) continue;
      const d = dist2(ball.x, ball.y, b.cxm, b.cym);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  },

  // LOYAL: with no lives to spare, the ball won't slip past a near miss —
  // once per sector, and never in Hardcore ("no mercy").
  ballLoyalty(ball) {
    if (!this.sentient || this.attract || this.loyaltyUsed || this.mode === 'hardcore') return;
    const lastChance = this.mode === 'puzzle' ? this.ballsLeft <= 1 : this.lives <= 1;
    if (!lastChance || this.balls.filter(b => !b.dead).length > 1) return;
    const p = this.paddle;
    if (ball.vy <= 0 || ball.y < p.y + p.h / 2 + ball.r || ball.y > p.y + 40) return;
    if (Math.abs(ball.x - p.x) > p.w / 2 + 60) return;   // a real miss, not a near one
    this.loyaltyUsed = true;
    ball.vy = -Math.abs(ball.vy);
    ball.y = p.y - p.h / 2 - ball.r - 1;
    ball.vx += (p.x - ball.x) * 0.8;                    // drifts back over the paddle
    ball.setSpeed(ball.speed);
    banner('THE BALL REFUSED TO FALL');
    FX.text(ball.x, p.y - 30, 'LOYAL', COL.green, 14);
    this.meet('mood', 'loyal');
    FX.spawn(ball.x, p.y, COL.green, 14, { spd: 160, dir: -Math.PI / 2, spread: 1.4 });
    AudioSys.sfx('event');
  },

  collideBricks(ball) {
    for (const b of this.bricks) {
      if (!b.alive) continue;
      // circle-rect
      const cx = clamp(ball.x, b.x, b.x + b.w);
      const cy = clamp(ball.y, b.y, b.y + b.h);
      const dx = ball.x - cx, dy = ball.y - cy;
      if (dx * dx + dy * dy > ball.r * ball.r) continue;

      const src = { x: ball.x, y: ball.y, fire: ball.fire > 0 };
      let destroyed;
      if (ball.boom > 0) {
        destroyed = this.damageBrick(b, 1, src);
        this.explode(cx, cy, 70, 1);
      } else {
        destroyed = this.damageBrick(b, ball.fire > 0 ? 2 : 1, src);
      }

      ball.met.add(b);
      if (ball.mood === 'curious' && CURIOUS_OF.has(b.type)) ball.mood = null;
      if (destroyed) {
        ball.dull = 0;
        ball.breaks++;
        if (!ball.showoff && this.combo >= SHOWOFF_AT && this.sentient && !this.attract) {
          ball.showoff = true;
          ball.setSpeed(ball.speed * 1.06);
          FX.text(ball.x, ball.y - 24, 'SHOW-OFF', '#ff58d9', 13);
          this.meet('mood', 'showoff');
        }
        const base = BRICKS[b.type]?.score || 0;
        if (ball.rampaging) { ball.rampage++; this.addScore(base); }                     // RAMPAGE: double
        if (this.balls.length > 1 && this.rivalLeader() === ball) this.addScore(base * 0.5);   // the crown: +50%
      }
      const phasing = (ball.pierce > 0 || ball.fire > 0) && destroyed;
      if (!phasing) {
        // reflect on dominant axis
        const overL = ball.x + ball.r - b.x, overR = b.x + b.w + ball.r - ball.x;
        const overT = ball.y + ball.r - b.y, overB = b.y + b.h + ball.r - ball.y;
        const minX = Math.min(overL, overR), minY = Math.min(overT, overB);
        if (minX < minY) {
          ball.vx = overL < overR ? -Math.abs(ball.vx) : Math.abs(ball.vx);
          ball.x += overL < overR ? -minX : minX;
        } else {
          ball.vy = overT < overB ? -Math.abs(ball.vy) : Math.abs(ball.vy);
          ball.y += overT < overB ? -minY : minY;
        }
      }
      if (!(ball.pierce > 0 || ball.fire > 0)) break; // solid balls stop at first brick
    }
  },

  // ======== render ========
  render() {
    const a = this.arena;
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    // the arena's place (js/backdrops.js); its moving details rest in battery saver and reduced FX
    Backdrop.draw(ctx, a, CFG.W, CFG.H, this.time, !Power.saving && !FX.reduced);
    // moving walls
    if (this.wallInsetL > 1 || this.wallInsetR > 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,0,212,.12)';
      ctx.strokeStyle = COL.magenta; ctx.lineWidth = 2;
      ctx.shadowColor = COL.magenta; ctx.shadowBlur = 10;
      ctx.fillRect(0, 0, this.wallInsetL, CFG.H);
      ctx.fillRect(CFG.W - this.wallInsetR, 0, this.wallInsetR, CFG.H);
      ctx.beginPath(); ctx.moveTo(this.wallInsetL, 0); ctx.lineTo(this.wallInsetL, CFG.H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CFG.W - this.wallInsetR, 0); ctx.lineTo(CFG.W - this.wallInsetR, CFG.H); ctx.stroke();
      ctx.restore();
    }
    for (const h of this.hazards) h.render(ctx, this);
    for (const b of this.bricks) if (b.alive) b.render(ctx, this);
    for (const p of this.powerups) p.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    for (const d of this.drones) d.render(ctx);
    if (this.boss && !this.boss.dead) this.boss.render(ctx);
    for (const l of this.lasers) l.render(ctx);
    for (const p of this.projectiles) p.render(ctx);
    this.renderProtectiveTarget();
    // bottom shield
    if (this.timers.shield > 0) {
      ctx.save();
      ctx.shadowColor = COL.green; ctx.shadowBlur = 14;
      ctx.strokeStyle = COL.green; ctx.lineWidth = 3;
      ctx.globalAlpha = this.timers.shield < 3 ? 0.3 + 0.4 * Math.abs(Math.sin(this.time * 8)) : 0.85;
      ctx.beginPath(); ctx.moveTo(0, CFG.H - 8); ctx.lineTo(CFG.W, CFG.H - 8); ctx.stroke();
      ctx.restore();
    }
    if (this.ghost) this.renderGhost();
    for (const ball of this.balls) ball.render(ctx, this);
    for (const ball of this.balls) {
      if (ball.mood === 'curious' && !ball.stuck) {
        ctx.save();
        ctx.fillStyle = '#eef7ff'; ctx.globalAlpha = 0.85;
        ctx.font = '700 13px Orbitron'; ctx.textAlign = 'center';
        ctx.fillText('?', ball.x, ball.y - ball.r - 6);
        ctx.restore();
      }
    }
    const king = this.rivalLeader();
    if (king) this.renderCrown(king);
    if (this.paddle) this.paddle.render(ctx);
    // touch, upright: the strip under the paddle is where your thumb goes
    if (IS_TOUCH && !this.attract && this.state === 'serve' && CFG.H - CFG.PADDLE_Y > 80) {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = PaddleColor.hex;
      ctx.font = '700 13px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('◀   DRAG   ▶', CFG.W / 2, CFG.PADDLE_Y + 66);
      ctx.restore();
    }
    // serve hint
    if (this.state === 'serve' && !this.countdown) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 300);
      ctx.fillStyle = COL.white;
      ctx.font = '700 13px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(IS_TOUCH ? 'TAP TO LAUNCH' : 'SPACE / CLICK TO LAUNCH', CFG.W / 2, CFG.PADDLE_Y - 100);
      ctx.restore();
    }
    // corruption vignette
    if (this.corruption > 40) {
      ctx.save();
      ctx.globalAlpha = (this.corruption - 40) / 220;
      ctx.fillStyle = COL.red;
      for (let i = 0; i < 3; i++) ctx.fillRect(rand(0, CFG.W), rand(0, CFG.H), rand(20, 120), 2);
      ctx.restore();
    }
    FX.render(ctx);
    this.renderPickup();
    this.renderTutorial();
    if (this.countdown) this.renderCountdown();
    FX.composite(mainCtx, scene);
    this.renderHud();
  },

  // MOURNING: the lost ball's last path, fading out
  renderGhost() {
    const g = this.ghost;
    g.t -= 1 / 60;
    if (g.t <= 0) { this.ghost = null; return; }
    const fade = Math.min(1, g.t / 2.6);
    ctx.save();
    g.pts.forEach((p, i) => {
      const a = (1 - i / g.pts.length) * 0.35 * fade;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#9aa7c7';
      ctx.beginPath(); ctx.arc(p.x, p.y, CFG.BALL_R * (1 - i / (g.pts.length * 1.5)), 0, 7); ctx.fill();
    });
    ctx.restore();
  },

  renderCrown(ball) {
    const x = ball.x, y = ball.y - ball.r - 5;
    ctx.save();
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x - 8, y); ctx.lineTo(x - 8, y - 7); ctx.lineTo(x - 4, y - 3); ctx.lineTo(x, y - 9);
    ctx.lineTo(x + 4, y - 3); ctx.lineTo(x + 8, y - 7); ctx.lineTo(x + 8, y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  // Same art and easing as Glitch Pong's countdown
  renderCountdown() {
    const ph = COUNTDOWN[this.countdown.i];
    const k = clamp(this.countdown.t / ph.dur, 0, 1);
    const go = ph.key === 'GO';
    const alpha = go ? 1 - Math.max(0, (k - 0.45) / 0.55) : 1 - Math.max(0, (k - 0.72) / 0.28);
    const scale = go ? 0.84 + k * 0.26 : 0.72 + k * 0.2;
    const img = COUNTDOWN_IMG[ph.key];
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.shadowColor = go ? 'rgba(255,209,102,0.9)' : 'rgba(255,79,216,0.9)';
    ctx.shadowBlur = go ? 36 : 24;
    if (img.complete && img.naturalWidth) {
      const w = CFG.W * 0.78 * scale, h = w * img.naturalHeight / img.naturalWidth;
      ctx.drawImage(img, CFG.W / 2 - w / 2, CFG.H / 2 - h / 2, w, h);
    } else {
      ctx.font = `900 ${Math.round(120 * scale)}px Orbitron`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = go ? '#ffd166' : '#ff4fd8';
      ctx.fillText(ph.key, CFG.W / 2, CFG.H / 2);
    }
    ctx.restore();
    // what this arena does, while there is time to read it
    if (this.rule && this.rule !== 'standard') {
      const rule = Rules.arenaRule(this.arena), y = Math.min(CFG.H / 2 + 170, CFG.PADDLE_Y - 90);
      const k = IS_TOUCH ? 1.45 : 1;            // touch screens show the field scaled down
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(3,4,10,.78)';
      ctx.fillRect(0, y - 26 * k, CFG.W, 78 * k);
      ctx.fillStyle = this.arena.accent;
      ctx.font = `800 ${Math.round(15 * k)}px Orbitron, monospace`;
      ctx.fillText(rule.name, CFG.W / 2, y - 3);
      ctx.fillStyle = COL.white;
      ctx.font = `${Math.round(13 * k)}px "Share Tech Mono", monospace`;
      wrapText(ctx, rule.line, CFG.W / 2, y + 18 * k, CFG.W - 50, 17 * k);
      ctx.restore();
    }
  },

  renderGrid() {
    const a = this.arena;
    ctx.save();
    ctx.strokeStyle = a.grid;
    ctx.lineWidth = 1;
    const t = this.time * 18 % 48;
    ctx.beginPath();
    for (let x = -48 + t; x < CFG.W + 48; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, CFG.H); }
    for (let y = t; y < CFG.H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(CFG.W, y); }
    ctx.stroke();
    // horizon glow at bottom
    const gr = ctx.createLinearGradient(0, CFG.H - 90, 0, CFG.H);
    gr.addColorStop(0, 'transparent');
    gr.addColorStop(1, a.grid.replace(/[\d.]+\)$/, '.22)'));
    ctx.fillStyle = gr;
    ctx.fillRect(0, CFG.H - 90, CFG.W, 90);
    ctx.restore();
  },

  updateArenaHud() {
    $('hArena').innerHTML = this.attract ? '<b>BREAKPOINT</b>DEMO PLAY'
      : `<b>${this.arena.name}</b>SECTOR ${String(this.level).padStart(2, '0')}` +
        (this.rule && this.rule !== 'standard' ? ' · ' + Rules.arenaRule(this.arena).name : '');
  },

  renderHud() {
    // runs every frame: only touch the DOM when a value actually changed
    hudSet('hScore', this.score.toLocaleString());
    hudSet('hCombo', this.combo);
    hudSet('hMult', 'x' + this.multiplier);
    // the sector number is in the middle of the HUD; this is how much of it is left
    hudSet('hLevel', this.boss && !this.boss.dead ? 'BOSS' : this.bricks.reduce((n, b) => n + (b.alive && b.type !== 'barrier' ? 1 : 0), 0));
    hudSet('hLives', this.mode === 'puzzle' ? '◦' + this.ballsLeft : '♥'.repeat(Math.min(this.lives, 6)));
    hudStyle('xpFill', (Meta.levelProgress * 100).toFixed(1) + '%');
    hudStyle('glFill', this.glitch.toFixed(0) + '%');
    $('glitchLab').classList.toggle('hot', this.glitch >= 75);
    if (this.boss && !this.boss.dead) hudStyle('bossHpFill', (this.boss.hp / this.boss.maxHp * 100).toFixed(1) + '%');
    $('btnPauseHud').classList.toggle('on', !this.attract && (this.state === 'play' || this.state === 'serve'));
    // ability
    const ab = $('abil');
    const abBtn = $('btnAbility');
    const hasAbility = Meta.rank('emp') || Meta.rank('laser');
    abBtn.classList.toggle('on', !!hasAbility && !this.attract && (this.state === 'play' || this.state === 'serve'));
    if (hasAbility) {
      const label = Meta.rank('emp') ? 'EMP' : 'LZR';
      const txt = this.abilityCd > 0 ? String(Math.ceil(this.abilityCd)) : label;
      if (abBtn.textContent !== txt) abBtn.textContent = txt;
      abBtn.classList.toggle('ready', this.abilityCd <= 0);
    }
    if (Meta.rank('emp') || Meta.rank('laser')) {
      hudHtml(ab, this.abilityCd > 0 ? `[X] ${Math.ceil(this.abilityCd)}s` : `[X] <b>READY</b>`);
    } else hudHtml(ab, '');
    // powerup tags
    const tags = [];
    const push = (kind, t) => { if (t > 0) tags.push(`<span class="puTag" title="${POWERUPS[kind].name}" style="color:${POWERUPS[kind].color};border-color:${POWERUPS[kind].color}"><img src="${powerIconUrl(kind)}" alt="${POWERUPS[kind].name}">${Math.ceil(t)}</span>`); };
    push('mult', this.timers.mult); push('slow', this.timers.slow); push('warp', this.timers.warp);
    push('freeze', this.timers.freezeP); push('shield', this.timers.shield);
    if (this.paddle) { push('laser', this.paddle.laserT); push('magnet', this.paddle.magnetT); push('wide', this.paddle.wideT); }
    const b0 = this.balls[0];
    if (b0) { push('fire', b0.fire); push('pierce', b0.pierce); push('boom', b0.boom); push('gravity', b0.grav); }
    hudHtml($('puList'), tags.slice(0, 6).join(''));
  },
};

// HUD write cache (renderHud runs at 60fps; rewriting innerHTML every frame thrashes layout)
const _hud = new Map();
function hudSet(id, v) {
  const s = String(v);
  if (_hud.get(id) === s) return;
  _hud.set(id, s);
  $(id).querySelector('.hval').textContent = s;
}
function hudStyle(id, w) {
  const key = id + ':w';
  if (_hud.get(key) === w) return;
  _hud.set(key, w);
  $(id).style.width = w;
}
function hudHtml(el, html) {
  const key = el.id + ':h';
  if (_hud.get(key) === html) return;
  _hud.set(key, html);
  el.innerHTML = html;
}

// ---------------- menus ----------------
function refreshMenuStats() {
  $('mLvl').textContent = Meta.level;
  $('mXp').textContent = Meta.data.xp.toLocaleString();
  $('mCr').textContent = Meta.data.credits.toLocaleString();
  $('mCoins').textContent = Wallet.get().coins.toLocaleString();
}

function buildModeGrid() {
  const grid = $('modeGrid');
  grid.innerHTML = '';
  const today = todayStr();
  const ids = Object.keys(MODES);
  ids.forEach((id, i) => {
    const m = MODES[id];
    const card = document.createElement('div');
    // an odd card out at the end takes the full row instead of sitting alone on the left
    card.className = 'card mode' + (i === ids.length - 1 && ids.length % 2 ? ' wide' : '');
    let label = 'BEST', value = Meta.data.best[id] || 0, mods = '';
    if (id === 'daily') {
      mods = Rules.dailyMods(today).map(x => `<span class="modtag">${x.name}</span>`).join('');
      if (Meta.data.daily.date === today) { label = 'TODAY'; value = Meta.data.daily.score; }
    }
    const desc = IS_TOUCH ? m.desc.replace('Press [T] any time to take over.', 'Tap the AI badge any time to take over.') : m.desc;
    card.innerHTML = `<div class="mi">${modeIcon(id)}</div>` +
      `<div class="mt"><h3>${m.name}${mods}</h3><p>${desc}</p></div>` +
      `<div class="mb${value ? '' : ' none'}"><i>${label}</i><b>${value ? Math.floor(value).toLocaleString() : '—'}</b></div>`;
    card.onclick = () => { AudioSys.sfx('click'); game.startRun(id); };
    grid.appendChild(card);
  });
}

// The upgrade tree: three branches, each bought from the top down. A node is
// bright when you can afford it, shows what you are short by when you can't,
// and names the node it is waiting for while it is locked.
function buildShop() {
  const credits = Meta.data.credits;
  $('shopCr').textContent = credits.toLocaleString();
  const grid = $('shopGrid');
  grid.innerHTML = '';
  let affordable = 0;
  for (const branch of Rules.UPGRADE_TREE) {
    const col = document.createElement('div');
    col.className = 'branch';
    col.innerHTML = `<h4>${branch.name}</h4>`;
    for (const id of branch.nodes) {
      const u = UPGRADES.find(x => x.id === id);
      const st = Rules.upgradeState(id, Meta.data.up, credits);
      if (st.state === 'buy') affordable++;
      const node = document.createElement('div');
      node.className = 'node ' + st.state + (st.rank ? ' owned' : '');
      const pips = Array.from({ length: st.max }, (_, i) => i < st.rank ? '<b>■</b>' : '□').join('');
      const tag = st.state === 'max' ? (st.max > 1 ? 'MAX' : 'OWNED')
        : st.state === 'locked' ? 'NEEDS ' + UPGRADES.find(x => x.id === st.parent).name
        : st.state === 'buy' ? 'BUY ' + st.cost.toLocaleString() + ' CR'
        : st.cost.toLocaleString() + ' CR · ' + st.short.toLocaleString() + ' SHORT';
      node.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p><div class="ns"><span class="pips">${pips}</span><span class="tag">${tag}</span></div>`;
      node.onclick = () => {
        const bought = Rules.buyUpgrade(id, Meta.data.up, Meta.data.credits);
        if (!bought) { if (st.state !== 'max') AudioSys.sfx('powerdn'); return; }
        Meta.data.up = bought.ranks;
        Meta.data.credits = bought.credits;
        Meta.save();
        AudioSys.sfx('powerup');
        game.unlock('buy1');
        buildShop(); refreshMenuStats();
      };
      col.appendChild(node);
    }
    grid.appendChild(col);
  }
  $('shopHint').textContent = affordable ? `${affordable} YOU CAN AFFORD` : 'PLAY RUNS TO EARN CREDITS';
}

// ---------------- the codex ----------------
// Controls, then one tab per kind of thing in the game. An entry shows its
// picture, name and what it does once you have met it; before that it is a "???".
let codexTab = 'controls';
const ENEMY_CLASSES = { drone: DroneEnemy, virus: VirusOrb, repair: RepairBot, turret: Turret };
const THUMB_GAME = { mods: {}, time: 0, generatorsAlive: () => false };

function codexThumb(cv, e, known) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  if (!known) {
    c.fillStyle = 'rgba(122,154,184,.35)'; c.font = '900 22px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', w / 2, h / 2 + 1);
    return;
  }
  try {
    if (e.kind === 'brick') {
      const b = new Brick((w - CFG.BRICK_W) / 2, (h - CFG.BRICK_H) / 2, e.id);
      b.visT = -0.1;                                   // the invisible brick, caught while it shows
      b.render(c, THUMB_GAME);
    } else if (e.kind === 'power') {
      drawPowerIcon(c, e.id, w / 2, h / 2, 32);
    } else if (e.kind === 'enemy') {
      const en = new ENEMY_CLASSES[e.id](w / 2, h / 2);
      c.save(); c.translate(w / 2, h / 2); c.scale(1.25, 1.25); c.translate(-w / 2, -h / 2); en.render(c); c.restore();
    } else if (e.kind === 'boss') {
      const K = [...BOSS_LIST, TheEye].find((B) => new B(1).name === e.id);
      const boss = new K(1);
      // sized so each one's widest part fits the frame
      const k = e.id === 'MEMORY GUARDIAN' ? 0.24 : e.id === 'THE EYE' ? 0.3 : 0.4;
      boss.x = CFG.W / 2;
      if (boss.heads) boss.heads.forEach((head, i) => { head.x = CFG.W / 2 + (i - 1) * 62; head.y = boss.y; });   // the hydra's heads, drawn together
      c.save(); c.translate(w / 2, h / 2); c.scale(k, k); c.translate(-CFG.W / 2, -boss.y); boss.render(c); c.restore();
    } else if (e.kind === 'arena') {
      c.drawImage(Backdrop.thumb(ARENAS.find((a) => a.name === e.id), w, h), 0, 0);
    } else if (e.kind === 'event') {
      c.strokeStyle = c.fillStyle = COL.magenta; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w / 2 + 17, h - 9); c.lineTo(w / 2 - 17, h - 9); c.closePath(); c.stroke();
      c.font = '900 16px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('!', w / 2, h / 2 + 5);
    } else if (e.kind === 'mood') {
      const col = MOOD_INFO[e.id].color;
      for (let i = 5; i > 0; i--) { c.globalAlpha = 0.08 * (6 - i); c.fillStyle = col; c.fillRect(w / 2 - 4 - i * 5, h / 2 - 4 + i * 2, 9 - i, 9 - i); }
      c.globalAlpha = 1; c.shadowColor = col; c.shadowBlur = 12; c.fillStyle = col;
      c.beginPath(); c.arc(w / 2 + 6, h / 2 - 2, 8, 0, 7); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2 + 4, h / 2 - 4, 3, 0, 7); c.fill();
    }
  } catch (err) { /* a thumbnail that can't be drawn is left blank */ }
}

function buildCodex() {
  const sections = Rules.codexSections(), count = Rules.codexCount(Meta.data.seen);
  $('cxCount').innerHTML = `DISCOVERED <b>${count.seen}</b> / ${count.total}`;
  const tabs = $('cxTabs');
  tabs.innerHTML = '';
  const tabDefs = [{ id: 'controls', name: 'CONTROLS' }, ...sections];
  for (const t of tabDefs) {
    const b = document.createElement('button');
    b.className = 'small' + (t.id === codexTab ? ' ghostc' : '');
    const n = count.sections[t.id];
    b.textContent = t.name + (n ? ` ${n.seen}/${n.total}` : '');
    b.onclick = () => { AudioSys.sfx('click'); codexTab = t.id; buildCodex(); };
    tabs.appendChild(b);
  }
  const list = $('cxList');
  list.innerHTML = '';
  list.scrollTop = 0;
  if (codexTab === 'controls') {
    list.className = 'cxlist controls';
    const rows = IS_TOUCH
      ? [['DRAG', 'move the paddle'], ['TAP', 'launch the ball, fire the laser paddle'], ['ROUND BUTTON', 'your special ability, once you own one'],
         ['II', 'pause'], ['AI BADGE', 'take the paddle back from the AI']]
      : [['◀ ▶ / A D / MOUSE', 'move the paddle'], ['SPACE / CLICK', 'launch the ball, fire the laser paddle'], ['X', 'special ability (EMP or laser array), once you own one'],
         ['T', 'hand the paddle to the AI, or take it back'], ['P / ESC', 'pause'], ['R', 'restart the run']];
    list.innerHTML = '<div class="keys">' + rows.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('') + '</div>' +
      '<p>Break every brick to clear a sector. Every fifth sector is a boss. The <span style="color:var(--pink)">GLITCH</span> meter fills as you break bricks: it multiplies your score and makes the machine fight back harder.</p>' +
      '<p>Everything else is in the other tabs, and unlocks the first time you meet it in a run.</p>';
    return;
  }
  list.className = 'cxlist';
  const section = sections.find((s) => s.id === codexTab);
  for (const e of section.entries) {
    const known = !!Meta.data.seen[e.key];
    const row = document.createElement('div');
    row.className = 'cx' + (known ? '' : ' locked');
    const cv = document.createElement('canvas');
    cv.width = 78; cv.height = 46;
    row.appendChild(cv);
    const text = document.createElement('div');
    text.innerHTML = known ? `<h3>${e.name}</h3><p>${e.line}</p>` : '<h3>???</h3><p>Not met yet.</p>';
    row.appendChild(text);
    list.appendChild(row);
    codexThumb(cv, e, known);
  }
}

function buildAchv() {
  const grid = $('achvGrid');
  grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const got = !!Meta.data.ach[a.id];
    const card = document.createElement('div');
    card.className = 'card' + (got ? ' done' : ' locked');
    const name = a.hidden && !got ? '???' : a.name;
    const desc = a.hidden && !got ? 'Hidden achievement.' : a.desc;
    card.innerHTML = `<h3>${got ? '✓ ' : ''}${name}</h3><p>${desc}</p>`;
    grid.appendChild(card);
  }
}

function goMenu() {
  refreshMenuStats();
  showScreen('scrMenu');
  // backing out of a submenu: the demo is already running — don't restart it every time
  if (game.attract) return;
  AudioSys.stopMusic();
  $('bossBar').style.display = 'none';
  game.startAttract();             // AI plays itself behind the menu (muted)
}

// wire buttons
$('btnPlay').onclick = () => { AudioSys.init(); AudioSys.sfx('click'); buildModeGrid(); showScreen('scrModes'); };
$('btnSettings').onclick = () => { AudioSys.init(); AudioSys.sfx('click'); Skins.refresh(); Prizes.refresh(); refreshLooks(); showScreen('scrSettings'); };
$('btnShop').onclick = () => { AudioSys.init(); AudioSys.sfx('click'); buildShop(); showScreen('scrShop'); };
$('btnAchv').onclick = () => { AudioSys.init(); AudioSys.sfx('click'); buildAchv(); showScreen('scrAchv'); };
$('btnHelp').onclick = () => { AudioSys.init(); AudioSys.sfx('click'); buildCodex(); showScreen('scrHelp'); };
$('btnMute').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  const cur = +$('vol').value;
  const nv = cur > 0 ? 0 : (Meta.data.lastVol || 70);
  if (cur > 0) Meta.data.lastVol = cur;
  $('vol').value = nv; $('volVal').textContent = nv;
  AudioSys.setVolume(nv / 100); Meta.data.vol = nv; Meta.save();
};
function refreshAiRewardsBtn() {
  $('btnAiRewards').textContent = 'AI Progression: ' + (Meta.data.aiRewards ? 'ON' : 'OFF');
  $('btnAiRewards').classList.toggle('ghostc', !!Meta.data.aiRewards);   // mint text = switched on
}
$('btnAiRewards').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  Meta.data.aiRewards = !Meta.data.aiRewards;
  Meta.save();
  refreshAiRewardsBtn();
};
// Screen FX: defaults to REDUCED when the OS asks for reduced motion, until the player picks
function applyFxSetting() {
  const reduced = Meta.data.reducedFx ?? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  FX.setReduced(reduced);
  document.body.classList.toggle('reduced-fx', reduced);
  $('btnFx').textContent = 'Screen FX: ' + (reduced ? 'REDUCED' : 'FULL');
  $('btnFx').classList.toggle('ghostc', !reduced);
}
// Battery saver: shared with Glitch Pong and the arcade (same stored switch)
function refreshSaverBtn() {
  const label = Power.state === 'on' ? 'ON' : Power.state === 'auto' ? 'AUTO · LOW BATTERY' : 'OFF';
  $('btnSaver').textContent = 'Battery Saver: ' + label;
  $('btnSaver').classList.toggle('ghostc', Power.saving);
}
$('btnSaver').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  Power.setBatterySaver(!Power.batterySaver);
  updateGlowScale();
  refreshSaverBtn();
};
$('btnFx').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  Meta.data.reducedFx = !FX.reduced;
  Meta.save();
  applyFxSetting();
};
// Paddle colour: shared with Glitch Pong (you're its blue player)
function refreshPaddleColorBtn() {
  const b = $('btnPaddleColor');
  b.textContent = 'Paddle: ' + PaddleColor.name;
  b.style.color = PaddleColor.hex;
}
$('btnPaddleColor').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  PaddleColor.cycle();
  refreshPaddleColorBtn();
};
// Skins from Glitch Pong's Store (paddle, ball, trail) and Break Point's own
// prizes from the Glitchcade counter (bricks, break effect). Each button steps
// through what you own.
const LOOKS = [
  { btn: 'btnSkinPaddle', label: 'Paddle Skin', from: Skins, slot: 'paddle' },
  { btn: 'btnSkinBall',   label: 'Ball',        from: Skins, slot: 'ball' },
  { btn: 'btnSkinTrail',  label: 'Trail',       from: Skins, slot: 'trail' },
  { btn: 'btnBricks',     label: 'Bricks',      from: Prizes, slot: 'bricks' },
  { btn: 'btnBurst',      label: 'Break FX',    from: Prizes, slot: 'burst' },
];
const looksOwned = (look) => (look.from === Skins ? Skins.wardrobe(look.slot).length : Prizes.owned(look.slot));
function refreshLooks() {
  $('skinRows').style.display = Skins.available ? '' : 'none';
  $('prizeRows').style.display = Prizes.available ? '' : 'none';
  for (const look of LOOKS) {
    if (!look.from.available) continue;
    const owned = looksOwned(look), all = look.from.total(look.slot);
    $(look.btn).textContent = `${look.label}: ${look.from.name(look.slot)}`;
    $(look.btn).title = `You own ${owned} of ${all}`;
    $(look.btn).classList.toggle('ghostc', look.from === Skins ? Skins.get(look.slot) !== 'default' : Prizes[look.slot] !== 'default');
  }
  if (Skins.available) $('skinCount').textContent = LOOKS.slice(0, 3).map((l) => `${looksOwned(l)}/${Skins.total(l.slot)}`).join(' · ');
  if (Prizes.available) $('prizeCount').textContent = LOOKS.slice(3).map((l) => `${looksOwned(l)}/${Prizes.total(l.slot)}`).join(' · ');
}
for (const look of LOOKS) {
  $(look.btn).onclick = () => {
    AudioSys.init();
    if (looksOwned(look) < 2) {
      AudioSys.sfx('powerdn');
      toast(look.label.toUpperCase(), look.from === Skins ? 'You only own the standard one. Unlock more in Glitch Pong\'s Store.' : 'You only own the standard one. PRIZETRON-80 sells more at the Glitchcade prize counter.');
      return;
    }
    AudioSys.sfx('click');
    look.from.cycle(look.slot);
    refreshLooks();
  };
}

function refreshSentienceBtn() {
  $('btnSentience').textContent = 'Sentient Ball: ' + (game.sentient ? 'ON' : 'OFF');
  $('btnSentience').classList.toggle('ghostc', game.sentient);
}
$('btnSentience').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  Meta.data.sentience = !game.sentient;
  if (!game.sentient) game.clearProtectiveTarget();
  Meta.save();
  refreshSentienceBtn();
};
$('btnPauseHud').onclick = (e) => { e.currentTarget.blur(); game.togglePause(); };
// touch has no [T] key: tap the AI badge to take the paddle back
if (IS_TOUCH) $('aiBadge').innerHTML = 'AI PLAYING &nbsp;<b>TAP TO TAKE OVER</b>';
$('aiBadge').addEventListener('click', () => {
  if (game.autoplay && (game.state === 'play' || game.state === 'serve')) game.setAutoplay(false);
});
// touch: the [X] ability on its own button (the two-finger tap still works)
$('btnAbility').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); game.onAbility(); }, { passive: false });
$('btnAbility').onclick = (e) => { e.currentTarget.blur(); game.onAbility(); };
$('btnWipe').onclick = () => {
  AudioSys.sfx('click');
  if (confirm('Erase all BREAKPOINT save data — credits, upgrades, achievements and best scores?')) {
    localStorage.removeItem('gb_save');
    location.reload();
  }
};
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { AudioSys.sfx('click'); goMenu(); });
$('btnResume').onclick = () => game.togglePause();
$('btnSkipTut').onclick = () => { AudioSys.sfx('click'); game.endTutorial(); game.togglePause(); };
$('btnTutorial').onclick = () => {
  AudioSys.init(); AudioSys.sfx('click');
  Meta.data.tutorialDone = false;
  Meta.save();
  toast('TUTORIAL', 'Your next Classic run starts with the guided sector.');
};
$('btnRestart').onclick = () => game.startRun(game.mode);
$('btnQuit').onclick = () => goMenu();
$('btnNext').onclick = () => game.nextLevel();
$('btnAgain').onclick = () => game.startRun(game.mode);
$('btnOverMenu').onclick = () => goMenu();
$('btnArcade').onclick = () => { AudioSys.sfx('click'); Cabinet.exit(); };
if (Cabinet.active) $('btnArcade').style.display = '';
// coins spent at the prize counter (another tab, or the arcade around this cabinet)
window.addEventListener('storage', (e) => {
  if (e.key === Wallet.KEY) refreshMenuStats();
  if (e.key === PaddleColor.KEY) { PaddleColor.refresh(); refreshPaddleColorBtn(); }   // changed in Glitch Pong
  // a skin equipped in Glitch Pong's Store, or a prize bought at the counter
  if (e.key === Skins.COSMETICS_KEY || e.key === Skins.PROGRESSION_KEY) { Skins.refresh(); refreshLooks(); }
  if (e.key && e.key === Prizes.KEY) { Prizes.refresh(); refreshLooks(); }
});
$('vol').oninput = (e) => {
  AudioSys.init();
  AudioSys.setVolume(e.target.value / 100);
  Meta.data.vol = +e.target.value;
  $('volVal').textContent = e.target.value;
  Meta.save();
};

// ---------------- boot ----------------
Meta.load();
$('vol').value = Meta.data.vol ?? 70;
$('volVal').textContent = $('vol').value;
AudioSys.setVolume(($('vol').value) / 100);
refreshMenuStats();
refreshAiRewardsBtn();
refreshPaddleColorBtn();
refreshSentienceBtn();
refreshLooks();
refreshSaverBtn();
applyFxSetting();

// ---------------- layout: the playfield takes the screen's shape ----------------
// It used to be a fixed 960x640 field shrunk to fit, which on a phone held upright
// left a thin strip across the middle of the screen. Now:
//  - upright screens (phones) get a tall field 600 wide: 8 brick columns, the
//    paddle raised over a strip at the bottom for your thumb, and the height
//    picked so the whole cabinet fills the screen
//  - wide touch screens keep the 640-high field and widen it (up to 1560, with
//    more brick columns) to fill; desktop keeps the original 960x640
// A layout change rebuilds the level, so it only happens on the menu or at the
// start of a run; rotating mid-run just rescales until you're back on the menu.
let layoutKey = '';

function screenArea() {
  // the page's padding is the notch / home-indicator safe area
  const cs = getComputedStyle(document.body);
  const px = (v) => parseFloat(v) || 0;
  return {
    w: Math.max(200, window.innerWidth - px(cs.paddingLeft) - px(cs.paddingRight)),
    h: Math.max(200, window.innerHeight - px(cs.paddingTop) - px(cs.paddingBottom)),
  };
}

// Returns true if the field changed shape. Desktop windows always get 960x640
// unless they're taller than wide.
function applyLayout() {
  const { w: vw, h: vh } = screenArea();
  const portrait = vh > vw * 1.1;
  document.body.classList.toggle('portrait', portrait);
  const wrap = $('wrap');
  let W, H;
  if (portrait) {
    W = 600;
    wrap.style.width = (W + 20) + 'px';
    const hud = $('hudTop').offsetHeight + $('hudBot').offsetHeight;
    // canvas shows at (W+20) css px wide, so its css height is H*(W+20)/W
    H = Math.round(clamp(((vh / vw) * (W + 20) - hud) * W / (W + 20), 760, 1300));
  } else {
    H = 640;
    let best = 960, bestErr = Infinity;
    // wide phones / tablets: widen to fill. Desktop keeps the original 960 field.
    for (let w = 960; w <= (IS_TOUCH ? 1560 : 960); w += 8) {
      wrap.style.width = (w + 20) + 'px';
      const hud = $('hudTop').offsetHeight + $('hudBot').offsetHeight;
      const err = Math.abs((w + 20) / ((w + 20) * H / w + hud) - vw / vh);
      if (err < bestErr) { bestErr = err; best = w; }
    }
    W = best;
  }
  const key = W + 'x' + H;
  wrap.style.width = (W + 20) + 'px';
  if (key === layoutKey) { fitToScreen(); return false; }
  layoutKey = key;
  CFG.W = W; CFG.H = H;
  // wide phones in landscape get extra columns rather than empty sides
  CFG.BRICK_COLS = portrait ? 8 : clamp(Math.floor((W - 60) / (CFG.BRICK_W + CFG.BRICK_GAP)), 12, 20);
  CFG.PADDLE_W = portrait ? 100 : 110;
  CFG.PADDLE_Y = portrait ? H - 120 : 600;   // upright: room under the paddle for your thumb
  canvas.width = scene.width = W;
  canvas.height = scene.height = H;
  input.mouseX = W / 2;
  fitToScreen();
  return true;
}

// Scale the cabinet to the screen. Desktop never scales past 1:1 (it would blur);
// touch screens may scale up so tablets fill too.
function fitToScreen() {
  const w = $('wrap');
  const { w: vw, h: vh } = screenArea();
  const s = Math.min(vw / w.offsetWidth, vh / w.offsetHeight, IS_TOUCH ? 1.6 : 1);
  w.style.transform = Math.abs(s - 1) > 0.001 ? `scale(${s.toFixed(4)})` : '';
}

// On the menu, a new screen shape re-lays the demo level behind it; mid-run it just rescales.
function onScreenChange() {
  if (!game.attract) { fitToScreen(); return; }
  const open = document.querySelector('.screen.on');
  if (applyLayout()) {
    game.startLevel();
    if (open) showScreen(open.id);
  }
}
let screenChangeT = 0;
const queueScreenChange = () => { clearTimeout(screenChangeT); screenChangeT = setTimeout(onScreenChange, 120); };
window.addEventListener('resize', queueScreenChange);
window.addEventListener('orientationchange', queueScreenChange);
window.visualViewport?.addEventListener('resize', queueScreenChange);
applyLayout();
document.fonts?.ready.then(() => { Backdrop.fontsLoaded(); if (game.attract) onScreenChange(); else fitToScreen(); });   // HUD height settles once the web fonts land

let lastT = performance.now();
// How many frames a second this moment deserves. The menu, its demo and the result
// screens sit behind a veil; a paused game is a still picture. Play gets the full rate.
const pacer = Power.createPacer();
function wantFps() {
  if (game.state === 'pause') return Power.saving ? 5 : 8;
  const s = game.state;
  const mode = game.attract || s === 'menu' || s === 'clear' || s === 'over' ? 'idle' : 'active';
  return Power.fpsFor({ touch: IS_TOUCH, saving: Power.saving, mode });
}
function frame(now) {
  if (!pacer.due(now, wantFps())) { requestAnimationFrame(frame); return; }
  const rawDt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  game.update(rawDt);
  if (game.state !== 'menu') game.render();
  else {
    // idle menu backdrop
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, CFG.W, CFG.H);
    game.time += rawDt;
    game.renderGrid();
    FX.update(rawDt);
    FX.render(ctx);
    FX.composite(mainCtx, scene);
  }
  requestAnimationFrame(frame);
}
// Backgrounded (another app, a locked phone): pause a run, rest the audio, and don't
// let the first frame back see a huge gap.
document.addEventListener('visibilitychange', () => {
  AudioSys.setHidden(document.hidden);
  if (document.hidden) {
    input.left = input.right = false;
    if (!game.attract && !game.autoplay && (game.state === 'play' || game.state === 'serve')) game.togglePause(true);
  } else {
    lastT = performance.now();
    pacer.reset();
  }
});
game.arena = ARENAS[0];
game.startAttract();
requestAnimationFrame(frame);
// The Eye gauntlet cabinet opens Breakpoint straight into a mode.
if (Cabinet.startMode && MODES[Cabinet.startMode]) game.startRun(Cabinet.startMode);
