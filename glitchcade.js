// ═══════════════════════════════════════════════════════════════════════════
// GLITCHCADE — first-person 3D arcade that hosts Glitch Pong
// Walk in off the street, find the one cabinet that works, play it.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three-addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three-addons/postprocessing/OutputPass.js';

// ─── Palette (matches the site's design tokens) ─────────────────────────────
const C = {
  void: '#03040a',
  cyan: '#71efff',
  pink: '#ff58d9',
  purple: '#9a5dff',
  amber: '#ffd27a',
  green: '#50fa7b',
  text: '#eef7ff',
  logoPurple: '#3d1a6e',
  paddleBlue: '#1fd0ff',
  paddleRed: '#ff3b5c'
};

const COMING_SOON_ACCENTS = ['#ffd27a', '#50fa7b', '#9a5dff', '#ff7a3d', '#4d7cff', '#ff4d6d', '#71efff', '#ff58d9', '#c6ff4d'];

const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 3.4;
const RUN_SPEED = 6.0;
const GRAVITY = 18;
const JUMP_SPEED = 5.6;
const INTERACT_RANGE = 2.3;

// Building interior: x ∈ [-ROOM_W/2, ROOM_W/2], z ∈ [-ROOM_D, 0]. Door in the front wall.
const ROOM_W = 16;
const ROOM_D = 26;
const ROOM_H = 5.5;
const WALL_T = 0.3;
const DOOR_W = 3.2;
const DOOR_H = 3.3;

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const root = $('glitchcade');
const canvas = $('gcCanvas');
const promptEl = $('gcPrompt');
const toastEl = $('gcToast');
const crosshairEl = $('gcCrosshair');
const enterBtn = $('gcEnter');
const slicesEl = $('gcSlices');
const useBtn = $('gcUse');
const jumpBtn = $('gcJump');
const joyEl = $('gcJoy');
const joyKnob = $('gcJoyKnob');

if (isTouch) document.body.classList.add('gc-touch');

// ─── Small helpers ──────────────────────────────────────────────────────────
function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function scanlines(ctx, w, h, alpha = 0.18, step = 4) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, Math.max(1, step / 2));
}

// Horizontal slice displacement — the house glitch look.
function sliceGlitch(ctx, w, h, rand, count, maxShift) {
  for (let i = 0; i < count; i++) {
    const y = Math.floor(rand() * h);
    const sh = Math.max(2, Math.floor(rand() * h * 0.08));
    const dx = Math.floor((rand() - 0.5) * 2 * maxShift);
    ctx.drawImage(ctx.canvas, 0, y, w, sh, dx, y, w, sh);
  }
}

// Text with the Glitch Pong chromatic split (magenta left, cyan right).
function chromaText(ctx, text, x, y, split, core = C.text, glow = null) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,0,220,0.85)';
  ctx.fillText(text, x - split, y);
  ctx.fillStyle = 'rgba(0,240,255,0.85)';
  ctx.fillText(text, x + split, y);
  ctx.restore();
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = split * 4; }
  ctx.fillStyle = core;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ─── Renderer, scenes, cameras ──────────────────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
} catch (err) {
  showFatal('Your browser could not start WebGL, so the Glitchcade can\'t load. You can still play Glitch Pong on the main site.');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040f);
scene.fog = new THREE.FogExp2(0x070418, 0.024);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';

// The player's arms live in their own scene so they never clip into cabinets.
const viewScene = new THREE.Scene();
const viewCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
viewScene.add(viewCamera);

const useBloom = !isTouch;
let composer = null;
if (useBloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const armsPass = new RenderPass(viewScene, viewCamera);
  armsPass.clear = false;
  armsPass.clearDepth = true;
  composer.addPass(armsPass);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.7, 0.4, 0.72));
  composer.addPass(new OutputPass());
} else {
  renderer.autoClear = false;
}

function canvasTexture(cv, { repeat = null, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

function glowTexture() {
  const cv = makeCanvas(128, 128);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTexture(cv);
}

// ─── Assets ─────────────────────────────────────────────────────────────────
const assets = {};

async function loadAssets() {
  const fontLoads = document.fonts
    ? Promise.all([
        document.fonts.load('900 64px Orbitron'),
        document.fonts.load('700 64px Orbitron'),
        document.fonts.load('32px VT323'),
        document.fonts.load('20px "Share Tech Mono"')
      ]).catch(() => {})
    : Promise.resolve();
  const images = Promise.all([
    loadImage('assets/glitch_pong_main_menu.png'),
    loadImage('assets/blue_paddle.png'),
    loadImage('assets/red_paddle.png'),
    loadImage('assets/boss_eye_left.png'),
    loadImage('assets/boss_eye_neutral.png'),
    loadImage('assets/boss_eye_right.png')
  ]).then(([logo, bluePaddle, redPaddle, eyeLeft, eyeNeutral, eyeRight]) => {
    Object.assign(assets, { logo, bluePaddle, redPaddle, eyeLeft, eyeNeutral, eyeRight });
  });
  // Never let a slow font CDN hold the arcade hostage.
  await Promise.race([Promise.all([fontLoads, images]), wait(3500)]);
  await images;
}

// Crops of the real game art.
const LOGO_CROP = [412, 40, 1096, 498];      // "GLITCH PONG" title from the main menu image
const PADDLE_CROP = [455, 258, 90, 494];     // the paddle bar inside its 1000×1000 canvas

// ═══════════════════════════════════════════════════════════════════════════
// TEXTURES
// ═══════════════════════════════════════════════════════════════════════════

function drawWrapped(ctx, size, x, y, fn) {
  for (let ox = -size; ox <= size; ox += size) {
    for (let oy = -size; oy <= size; oy += size) fn(x + ox, y + oy);
  }
}

// Blacklight arcade carpet, glitch edition.
function makeCarpetTexture() {
  const S = 512;
  const cv = makeCanvas(S, S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a0718';
  ctx.fillRect(0, 0, S, S);
  const rand = seeded(1337);
  const cols = [C.cyan, C.pink, C.purple, C.amber, C.green];
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const kind = Math.floor(rand() * 5);
    const col = cols[Math.floor(rand() * cols.length)];
    const x = rand() * S;
    const y = rand() * S;
    const r = 10 + rand() * 18;
    const rot = rand() * Math.PI * 2;
    drawWrapped(ctx, S, x, y, (px, py) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      if (kind === 0) {
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7); ctx.closePath(); ctx.stroke();
      } else if (kind === 1) {
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.stroke();
      } else if (kind === 2) {
        ctx.moveTo(-r * 1.4, 0);
        for (let k = 0; k < 6; k++) ctx.lineTo(-r * 1.4 + (k + 1) * r * 0.48, k % 2 ? -r * 0.4 : r * 0.4);
        ctx.stroke();
      } else if (kind === 3) {
        for (let k = 0; k < 5; k++) ctx.fillRect(Math.floor(rand() * 4) * 7 - 14, Math.floor(rand() * 4) * 7 - 14, 6, 6);
      } else {
        ctx.fillRect(-r, -2.5, r * 2, 5); ctx.fillRect(-2.5, -r, 5, r * 2);
      }
      ctx.restore();
    });
  }
  return cv;
}

function makeWallTexture(base, line, seed) {
  const S = 256;
  const cv = makeCanvas(S, S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const rand = seeded(seed);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.025})`;
    ctx.fillRect(rand() * S, rand() * S, 2, 2);
  }
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, 3, S);
  ctx.fillRect(S / 2, 0, 2, S);
  ctx.fillRect(0, S - 3, S, 3);
  return cv;
}

function makeAsphaltTexture() {
  const S = 512;
  const cv = makeCanvas(S, S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0d0e16';
  ctx.fillRect(0, 0, S, S);
  const rand = seeded(99);
  for (let i = 0; i < 9000; i++) {
    const v = 20 + rand() * 30;
    ctx.fillStyle = `rgba(${v},${v},${v + 12},${0.25 + rand() * 0.3})`;
    ctx.fillRect(rand() * S, rand() * S, 1.5, 1.5);
  }
  return cv;
}

function makeSidewalkTexture() {
  const S = 256;
  const cv = makeCanvas(S, S);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#1a1726';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  const rand = seeded(5);
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.04})`;
    ctx.fillRect(rand() * S, rand() * S, 2, 2);
  }
  return cv;
}

function makeSkylineWindows(seed) {
  const cv = makeCanvas(64, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 128);
  const rand = seeded(seed);
  const cols = ['#71efff', '#ff58d9', '#ffd27a', '#9a5dff'];
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4; x < 64; x += 8) {
      if (rand() < 0.28) {
        ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
        ctx.globalAlpha = 0.25 + rand() * 0.5;
        ctx.fillRect(x, y, 4, 5);
      }
    }
  }
  ctx.globalAlpha = 1;
  return cv;
}

// ── The big neon "GLITCHCADE" sign (redrawn when it glitches) ──
function createNeonSign(w, h) {
  const cv = makeCanvas(1024, 256);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const word = 'GLITCHCADE';
  const rand = Math.random;
  function draw(glitch) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = '900 150px Orbitron, "Arial Black", sans-serif';
    ctx.textBaseline = 'middle';
    const widths = [...word].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + 10 * (word.length - 1);
    const scale = Math.min(1, 960 / total);
    ctx.save();
    ctx.translate(512 - (total * scale) / 2, 128);
    ctx.scale(scale, 1);
    let x = 0;
    [...word].forEach((ch, i) => {
      // The second C is the flickery tube, like every real neon sign.
      const dead = glitch ? rand() < 0.16 : false;
      const flicker = i === 6 && !glitch && rand() < 0.04;
      if (!dead && !flicker) {
        const split = glitch ? 6 + rand() * 10 : 5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 26;
        ctx.shadowColor = C.pink;
        ctx.fillStyle = C.pink;
        ctx.fillText(ch, x - split, 0);
        ctx.shadowColor = C.cyan;
        ctx.fillStyle = C.cyan;
        ctx.fillText(ch, x + split, 0);
        ctx.restore();
        ctx.fillStyle = '#f6f0ff';
        ctx.fillText(ch, x, 0);
      } else {
        ctx.strokeStyle = 'rgba(120,90,160,0.55)';
        ctx.lineWidth = 3;
        ctx.strokeText(ch, x, 0);
      }
      x += widths[i] + 10;
    });
    ctx.restore();
    if (glitch) sliceGlitch(ctx, cv.width, cv.height, rand, 5, 46);
    tex.needsUpdate = true;
  }
  draw(false);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xb8b8b8, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return { mesh, draw };
}

// ── Glitch Pong marquee: the real logo, backlit ──
function makeGlitchPongMarquee() {
  const W = 1024, H = 320;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1450');
  g.addColorStop(0.5, '#e9e2ff');
  g.addColorStop(1, '#2a1450');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W / 2);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // paddles bookending the logo
  if (assets.bluePaddle) ctx.drawImage(assets.bluePaddle, ...PADDLE_CROP, 70, 40, 46, 240);
  if (assets.redPaddle) ctx.drawImage(assets.redPaddle, ...PADDLE_CROP, W - 116, 40, 46, 240);
  if (assets.logo) {
    const [sx, sy, sw, sh] = LOGO_CROP;
    const dh = 270;
    const dw = dh * (sw / sh);
    ctx.drawImage(assets.logo, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    ctx.font = '900 110px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chromaText(ctx, 'GLITCH PONG', W / 2, H / 2, 6, C.logoPurple);
  }
  // pixel ball mid-rally
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 16;
  ctx.fillRect(150, 210, 18, 18);
  ctx.shadowBlur = 0;
  // frame
  ctx.lineWidth = 10;
  ctx.strokeStyle = C.pink;
  ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.cyan;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  scanlines(ctx, W, H, 0.12, 4);
  sliceGlitch(ctx, W, H, seeded(7), 3, 18);
  return canvasTexture(cv);
}

function makeComingSoonMarquee(accent, slot) {
  const W = 512, H = 160;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#07060f');
  g.addColorStop(0.5, hexToRgba(accent, 0.22));
  g.addColorStop(1, '#07060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // hazard stripes along the bottom
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H - 22, W, 22);
  ctx.clip();
  for (let x = -40; x < W + 40; x += 28) {
    ctx.fillStyle = hexToRgba(accent, 0.55);
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 14, H);
    ctx.lineTo(x + 36, H - 22);
    ctx.lineTo(x + 22, H - 22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.font = '900 54px Orbitron, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chromaText(ctx, 'COMING SOON', W / 2, 66, 3, '#ffffff', accent);
  ctx.font = '18px "Share Tech Mono", monospace';
  ctx.fillStyle = hexToRgba(accent, 0.9);
  ctx.fillText(`// CABINET ${String(slot).padStart(2, '0')} — COMPILING //`, W / 2, 113);
  ctx.lineWidth = 6;
  ctx.strokeStyle = accent;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  scanlines(ctx, W, H, 0.16, 4);
  sliceGlitch(ctx, W, H, seeded(slot * 31), 2, 14);
  return canvasTexture(cv);
}

function makeCoinDoor(label, accent) {
  const W = 128, H = 160;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#16141f';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2c2838';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  for (const x of [34, 78]) {
    ctx.fillStyle = '#05040a';
    ctx.fillRect(x, 30, 18, 40);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillRect(x + 7, 36, 4, 28);
    ctx.shadowBlur = 0;
  }
  ctx.font = '700 13px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.fillText(label, W / 2, 104);
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.fillStyle = '#7a6f90';
  ctx.fillText('1 CREDIT', W / 2, 126);
  return canvasTexture(cv);
}

// Side art. The extruded side panels show their cap UVs mirrored, so the art is
// painted mirrored to read correctly. Canvas left = back of the cabinet.
function makeGlitchPongSideArt() {
  const W = 512, H = 1024;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0322');
  g.addColorStop(0.55, '#1c0940');
  g.addColorStop(1, '#05020f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // neon racing stripes
  const stripe = (offset, col, width) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.shadowColor = col;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(-60, H - 120 + offset);
    ctx.lineTo(W + 60, 420 + offset);
    ctx.stroke();
    ctx.restore();
  };
  stripe(0, C.cyan, 26);
  stripe(56, C.pink, 26);
  stripe(100, C.purple, 10);
  // pixel debris
  const rand = seeded(42);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = [C.cyan, C.pink, C.purple][i % 3];
    ctx.globalAlpha = 0.35 + rand() * 0.5;
    const s = 6 + Math.floor(rand() * 3) * 6;
    ctx.fillRect(Math.floor(rand() * W / 6) * 6, Math.floor(rand() * H / 6) * 6, s, s);
  }
  ctx.globalAlpha = 1;
  // the Eye
  if (assets.eyeNeutral) {
    ctx.save();
    ctx.shadowColor = C.purple;
    ctx.shadowBlur = 40;
    ctx.drawImage(assets.eyeNeutral, 40, 150, 440, 440);
    ctx.restore();
  }
  // paddles
  if (assets.bluePaddle) ctx.drawImage(assets.bluePaddle, ...PADDLE_CROP, 70, 640, 44, 240);
  if (assets.redPaddle) ctx.drawImage(assets.redPaddle, ...PADDLE_CROP, 400, 600, 44, 240);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 18;
  ctx.fillRect(250, 700, 22, 22);
  ctx.shadowBlur = 0;
  // vertical title along the back edge
  ctx.save();
  ctx.translate(46, 980);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '900 64px Orbitron, "Arial Black", sans-serif';
  ctx.textBaseline = 'middle';
  chromaText(ctx, 'GLITCH PONG', 0, 0, 5, '#f4ecff');
  ctx.restore();
  scanlines(ctx, W, H, 0.14, 6);
  sliceGlitch(ctx, W, H, seeded(3), 6, 30);
  return canvasTexture(cv);
}

function makeComingSoonSideArt(accent, seed) {
  const W = 256, H = 512;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = '#0b0a14';
  ctx.fillRect(0, 0, W, H);
  const rand = seeded(seed);
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 12;
  ctx.globalAlpha = 0.85;
  const tilt = 120 + rand() * 120;
  ctx.beginPath(); ctx.moveTo(-20, H - 40); ctx.lineTo(W + 20, H - 40 - tilt); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-20, H - 70); ctx.lineTo(W + 20, H - 70 - tilt); ctx.stroke();
  ctx.restore();
  ctx.font = '900 190px Orbitron, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  chromaText(ctx, '?', W / 2 + 10, 230, 6, hexToRgba(accent, 0.9));
  ctx.globalAlpha = 1;
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = hexToRgba(accent, 0.25 + rand() * 0.5);
    ctx.fillRect(Math.floor(rand() * W / 8) * 8, Math.floor(rand() * H / 8) * 8, 8, 8);
  }
  ctx.save();
  ctx.translate(30, 488);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '700 26px Orbitron, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = hexToRgba(accent, 0.85);
  ctx.fillText('COMING SOON', 0, 0);
  ctx.restore();
  scanlines(ctx, W, H, 0.16, 4);
  return canvasTexture(cv);
}

// ── Animated screens ──

// One shared "no signal" feed for every offline cabinet (each tints it).
function createComingSoonScreen() {
  const W = 256, H = 192;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const noise = ctx.createImageData(W, H);
  let roll = 0;
  let t = 0;
  function draw(dt) {
    t += dt;
    roll = (roll + dt * 60) % H;
    const d = noise.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 120) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(noise, 0, 0);
    ctx.fillStyle = 'rgba(4,4,10,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, roll, W, 18);
    ctx.font = '900 27px Orbitron, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const jitter = Math.random() < 0.12 ? (Math.random() - 0.5) * 14 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(14, 62, W - 28, 66);
    chromaText(ctx, 'COMING', W / 2 + jitter, 80, 2);
    chromaText(ctx, 'SOON', W / 2 - jitter, 110, 2);
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(Math.floor(t * 2) % 2 ? 'NO SIGNAL_' : 'NO SIGNAL', W / 2, 152);
    scanlines(ctx, W, H, 0.22, 3);
    if (Math.random() < 0.1) sliceGlitch(ctx, W, H, Math.random, 3, 22);
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw };
}

// Glitch Pong attract mode: an actual little rally on the cabinet screen.
function createGlitchPongScreen() {
  const W = 512, H = 384;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const s = {
    t: 0,
    ball: { x: W / 2, y: H / 2, vx: 230, vy: 140 },
    left: H / 2, right: H / 2,
    score: [0, 0],
    trail: [],
    heat: 0,
    glitchFor: 0,
    burst: 0
  };
  const PAD_H = 100, PAD_W = 16, PAD_X = 24;
  const promptText = isTouch ? 'TAP  USE  TO  PLAY' : 'PRESS  E  TO  PLAY';

  function step(dt) {
    const b = s.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < 14 || b.y > H - 14) { b.vy *= -1; b.y = Math.max(14, Math.min(H - 14, b.y)); }
    // AI paddles with just enough lag to miss sometimes
    const track = (p, target, speed) => p + Math.max(-speed * dt, Math.min(speed * dt, target - p));
    s.left = track(s.left, b.vx < 0 ? b.y : H / 2, 250);
    s.right = track(s.right, b.vx > 0 ? b.y : H / 2, 250);
    const hit = (py) => Math.abs(b.y - py) < PAD_H / 2 + 6;
    if (b.vx < 0 && b.x < PAD_X + PAD_W + 6 && b.x > PAD_X) {
      if (hit(s.left)) { b.vx = Math.abs(b.vx) * 1.06; b.vy += (b.y - s.left) * 3; s.heat += 0.12; }
    }
    if (b.vx > 0 && b.x > W - PAD_X - PAD_W - 6 && b.x < W - PAD_X) {
      if (hit(s.right)) { b.vx = -Math.abs(b.vx) * 1.06; b.vy += (b.y - s.right) * 3; s.heat += 0.12; }
    }
    b.vx = Math.sign(b.vx) * Math.min(Math.abs(b.vx), 620);
    b.vy = Math.max(-360, Math.min(360, b.vy));
    if (b.x < -20 || b.x > W + 20) {
      s.score[b.x < 0 ? 1 : 0] = (s.score[b.x < 0 ? 1 : 0] + 1) % 8;
      s.glitchFor = 0.45;
      s.heat = 0;
      Object.assign(b, { x: W / 2, y: H / 2, vx: (Math.random() < 0.5 ? -1 : 1) * 230, vy: (Math.random() - 0.5) * 300 });
    }
    s.trail.push({ x: b.x, y: b.y });
    if (s.trail.length > 14) s.trail.shift();
  }

  function draw(dt) {
    s.t += dt;
    s.glitchFor = Math.max(0, s.glitchFor - dt);
    s.burst = Math.max(0, s.burst - dt);
    const cycle = s.t % 14;
    const titleCard = cycle > 11;
    if (!titleCard) step(Math.min(dt, 1 / 20));

    ctx.fillStyle = '#04030c';
    ctx.fillRect(0, 0, W, H);
    // arena grid
    ctx.strokeStyle = 'rgba(113,239,255,0.13)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    if (titleCard) {
      ctx.font = '900 62px Orbitron, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      chromaText(ctx, 'GLITCH', W / 2, H / 2 - 50, 5, '#f2eaff');
      chromaText(ctx, 'PONG', W / 2, H / 2 + 20, 5, '#f2eaff');
      if (assets.eyeNeutral) ctx.drawImage(assets.eyeNeutral, W / 2 - 60, H / 2 + 40, 120, 120);
    } else {
      // centre line
      ctx.fillStyle = 'rgba(238,247,255,0.25)';
      for (let y = 8; y < H; y += 26) ctx.fillRect(W / 2 - 2, y, 4, 14);
      // score
      ctx.font = '84px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(113,239,255,0.8)';
      ctx.fillText(String(s.score[0]), W / 2 - 60, 10);
      ctx.fillStyle = 'rgba(255,88,217,0.8)';
      ctx.fillText(String(s.score[1]), W / 2 + 60, 10);
      // heat bar
      const heat = Math.min(1, s.heat);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(W / 2 - 80, H - 16, 160, 5);
      ctx.fillStyle = heat > 0.8 ? C.pink : C.amber;
      ctx.fillRect(W / 2 - 80, H - 16, 160 * heat, 5);
      // trail
      s.trail.forEach((p, i) => {
        const a = i / s.trail.length;
        ctx.fillStyle = i % 2 ? `rgba(255,88,217,${a * 0.5})` : `rgba(113,239,255,${a * 0.5})`;
        const sz = 6 + a * 12;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      });
      // paddles (real game art when available)
      const drawPaddle = (img, x, y, col) => {
        if (img) ctx.drawImage(img, ...PADDLE_CROP, x - 4, y - PAD_H / 2 - 4, PAD_W + 8, PAD_H + 8);
        else { ctx.fillStyle = col; ctx.fillRect(x, y - PAD_H / 2, PAD_W, PAD_H); }
      };
      drawPaddle(assets.bluePaddle, PAD_X, s.left, C.paddleBlue);
      drawPaddle(assets.redPaddle, W - PAD_X - PAD_W, s.right, C.paddleRed);
      // ball
      ctx.save();
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.ball.x - 10, s.ball.y - 10, 20, 20);
      ctx.restore();
    }

    // blinking call to action
    if (Math.floor(s.t * 1.6) % 2 === 0) {
      ctx.font = '700 18px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W / 2 - 130, H - 62, 260, 30);
      ctx.fillStyle = C.amber;
      ctx.fillText(promptText, W / 2, H - 47);
    }

    // glitch passes
    const glitching = s.glitchFor > 0 || s.burst > 0 || Math.random() < 0.02;
    if (glitching) {
      sliceGlitch(ctx, W, H, Math.random, s.burst > 0 ? 10 : 4, s.burst > 0 ? 70 : 30);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25;
      ctx.drawImage(cv, -6, 0);
      ctx.restore();
    }
    scanlines(ctx, W, H, 0.22, 3);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    tex.needsUpdate = true;
  }

  draw(0);
  return { tex, draw, burst: () => { s.burst = 0.7; } };
}

function createInfoBoard() {
  const W = 1024, H = 512;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  function draw(glitch) {
    ctx.fillStyle = '#05040c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.purple;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '900 54px Orbitron, "Arial Black", sans-serif';
    chromaText(ctx, 'NOW PLAYING', 60, 48, 3, C.text);
    ctx.font = '900 76px Orbitron, "Arial Black", sans-serif';
    chromaText(ctx, 'GLITCH PONG', 60, 120, 4, C.cyan, C.cyan);
    ctx.font = '30px "Share Tech Mono", monospace';
    const lines = [
      ['> CABINET 01 .......... ONLINE', C.green],
      ['> CABINETS 02–10 ...... COMPILING', C.amber],
      ['> THE EYE ............. WATCHING', C.pink],
      ['> REALITY ............. 63% STABLE', C.purple]
    ];
    lines.forEach(([txt, col], i) => {
      ctx.fillStyle = col;
      ctx.fillText(txt, 64, 252 + i * 54);
    });
    scanlines(ctx, W, H, 0.2, 4);
    if (glitch) sliceGlitch(ctx, W, H, Math.random, 6, 60);
    tex.needsUpdate = true;
  }
  draw(false);
  return { tex, draw };
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD
// ═══════════════════════════════════════════════════════════════════════════
const colliders = [];        // AABBs on the floor plane: {minX,maxX,minZ,maxZ}
const platforms = [];        // raised floor areas: {minX,maxX,minZ,maxZ,h}
const cabinets = [];
const animated = [];         // fn(dt, t) called each frame
let glowTex;
let pongScreen;
let soonScreen;
let neonSigns = [];
let infoBoard;
let eye;

function addCollider(minX, maxX, minZ, maxZ) {
  colliders.push({ minX, maxX, minZ, maxZ });
}

function neonMaterial(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
}

function addGlow(parent, color, size, opacity, position) {
  const mat = new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  sp.position.copy(position);
  parent.add(sp);
  return sp;
}

// Floor decal glow (light pool) — cheap fake lighting.
function addFloorGlow(parent, color, w, d, x, z, opacity = 0.5) {
  const mat = new THREE.MeshBasicMaterial({
    map: glowTex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.012, z);
  parent.add(m);
  return m;
}

function buildEnvironment() {
  glowTex = glowTexture();

  // ── Lights ──
  scene.add(new THREE.HemisphereLight(0x6a5acd, 0x120820, 0.55));
  scene.add(new THREE.AmbientLight(0x221a3a, 0.6));
  const interiorLights = [
    [0, 4.6, -5, C.cyan, 14],
    [0, 4.6, -13, C.purple, 16],
    [-5, 4.4, -18, C.pink, 14],
    [5, 4.4, -18, C.cyan, 14]
  ];
  interiorLights.forEach(([x, y, z, col, dist]) => {
    const l = new THREE.PointLight(col, 18, dist, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
  });
  const doorLight = new THREE.PointLight(C.pink, 22, 16, 1.6);
  doorLight.position.set(0, 4.2, 3.2);
  scene.add(doorLight);
  const facadeLight = new THREE.PointLight(C.cyan, 16, 22, 1.6);
  facadeLight.position.set(0, 7.5, 6);
  scene.add(facadeLight);

  // ── Ground outside ──
  const asphaltTex = canvasTexture(makeAsphaltTexture(), { repeat: [24, 24] });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.38, metalness: 0.35 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.001, 0);
  scene.add(ground);

  const sidewalkTex = canvasTexture(makeSidewalkTexture(), { repeat: [14, 3] });
  const sidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 6),
    new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.8 })
  );
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, 0.004, 3);
  scene.add(sidewalk);

  // painted crosswalk-style glitch stripes leading to the door
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), neonMaterial(i % 2 ? C.pink : C.cyan, 0.35));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.008, 7 + i * 1.1);
    scene.add(m);
  }

  // ── Interior floor & ceiling ──
  const carpetCv = makeCarpetTexture();
  const carpetTex = canvasTexture(carpetCv, { repeat: [ROOM_W / 3.2, ROOM_D / 3.2] });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({
      map: carpetTex, emissiveMap: carpetTex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.95
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.006, -ROOM_D / 2);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x0a0814, roughness: 1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM_H, -ROOM_D / 2);
  scene.add(ceiling);

  // ceiling light strips
  [-3.2, 3.2].forEach((x, i) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, ROOM_D - 3), neonMaterial(i ? C.pink : C.cyan, 0.9));
    strip.position.set(x, ROOM_H - 0.03, -ROOM_D / 2);
    scene.add(strip);
  });

  // ── Walls (box face order: +x, -x, +y, -y, +z, -z) ──
  const interiorWall = new THREE.MeshStandardMaterial({
    map: canvasTexture(makeWallTexture('#120d24', 'rgba(154,93,255,0.18)', 11), { repeat: [6, 2] }),
    roughness: 0.9
  });
  const exteriorWall = new THREE.MeshStandardMaterial({
    map: canvasTexture(makeWallTexture('#17102e', 'rgba(255,88,217,0.14)', 12), { repeat: [8, 2] }),
    roughness: 0.75
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0b0816, roughness: 0.6 });

  function wall(minX, maxX, minZ, maxZ, height, interiorFace, y0 = 0) {
    const mats = [exteriorWall, exteriorWall, trimMat, trimMat, exteriorWall, exteriorWall];
    if (interiorFace !== null) mats[interiorFace] = interiorWall;
    const m = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, height, maxZ - minZ), mats);
    m.position.set((minX + maxX) / 2, y0 + height / 2, (minZ + maxZ) / 2);
    scene.add(m);
    if (y0 === 0) addCollider(minX, maxX, minZ, maxZ);
    return m;
  }
  const hx = ROOM_W / 2;
  wall(-hx - WALL_T, -hx, -ROOM_D - WALL_T, WALL_T, ROOM_H, 0);        // left
  wall(hx, hx + WALL_T, -ROOM_D - WALL_T, WALL_T, ROOM_H, 1);          // right
  wall(-hx, hx, -ROOM_D - WALL_T, -ROOM_D, ROOM_H, 4);                 // back
  wall(-hx, -DOOR_W / 2, 0, WALL_T, ROOM_H, 5);                        // front left
  wall(DOOR_W / 2, hx, 0, WALL_T, ROOM_H, 5);                          // front right
  wall(-DOOR_W / 2, DOOR_W / 2, 0, WALL_T, ROOM_H - DOOR_H, 5, DOOR_H); // lintel

  // roof slab
  const roof = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W + WALL_T * 2 + 0.4, 0.35, ROOM_D + WALL_T * 2 + 0.4), trimMat);
  roof.position.set(0, ROOM_H + 0.175, -ROOM_D / 2);
  scene.add(roof);

  // ── Interior neon trim ──
  const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, ROOM_D), neonMaterial(C.cyan));
  leftStrip.position.set(-hx + 0.03, 3.25, -ROOM_D / 2);
  const rightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, ROOM_D), neonMaterial(C.pink));
  rightStrip.position.set(hx - 0.03, 3.25, -ROOM_D / 2);
  const backStrip = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.07, 0.05), neonMaterial(C.purple));
  backStrip.position.set(0, 3.25, -ROOM_D + 0.03);
  scene.add(leftStrip, rightStrip, backStrip);
  [[-hx + 0.03, 0, 0.05, ROOM_D], [hx - 0.03, 0, 0.05, ROOM_D]].forEach(([x, , w, d]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), neonMaterial(C.purple, 0.7));
    b.position.set(x, 0.06, -ROOM_D / 2);
    scene.add(b);
  });

  // guide line from the door to the Glitch Pong cabinet
  for (let z = -1.2; z > -21.5; z -= 0.9) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.5), neonMaterial(C.cyan, 0.55));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.015, z);
    scene.add(dash);
  }

  // ── Exterior facade ──
  const doorFrameMat = neonMaterial(C.pink);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, DOOR_H, 0.1), doorFrameMat);
  frameL.position.set(-DOOR_W / 2 - 0.05, DOOR_H / 2, WALL_T + 0.04);
  const frameR = frameL.clone();
  frameR.position.x = DOOR_W / 2 + 0.05;
  const frameT = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 0.2, 0.1, 0.1), doorFrameMat);
  frameT.position.set(0, DOOR_H + 0.05, WALL_T + 0.04);
  scene.add(frameL, frameR, frameT);

  // shimmering glitch curtain you walk straight through
  const curtainCv = makeCanvas(64, 256);
  const cctx = curtainCv.getContext('2d');
  const curtainTex = canvasTexture(curtainCv);
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_W, DOOR_H),
    new THREE.MeshBasicMaterial({
      map: curtainTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    })
  );
  curtain.position.set(0, DOOR_H / 2, WALL_T / 2);
  scene.add(curtain);
  let curtainTimer = 0;
  animated.push((dt) => {
    curtainTimer += dt;
    if (curtainTimer < 1 / 15) return;
    curtainTimer = 0;
    cctx.clearRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 4) {
      const a = Math.random() * 0.18;
      cctx.fillStyle = Math.random() < 0.5 ? `rgba(113,239,255,${a})` : `rgba(255,88,217,${a})`;
      cctx.fillRect(0, y, 64, 2);
    }
    curtainTex.needsUpdate = true;
  });

  // roofline neon
  const roofNeon = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W + WALL_T * 2 + 0.4, 0.08, 0.08), neonMaterial(C.cyan));
  roofNeon.position.set(0, ROOM_H + 0.38, WALL_T + 0.22);
  scene.add(roofNeon);
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, ROOM_H + 0.35, 0.08), neonMaterial(C.pink));
    edge.position.set(side * (hx + WALL_T + 0.02), (ROOM_H + 0.35) / 2, WALL_T + 0.02);
    scene.add(edge);
  });

  // frosted glowing windows either side of the door
  [-1, 1].forEach((side) => {
    const winCv = makeCanvas(128, 128);
    const wctx = winCv.getContext('2d');
    const wg = wctx.createLinearGradient(0, 0, 0, 128);
    wg.addColorStop(0, side < 0 ? 'rgba(113,239,255,0.55)' : 'rgba(255,88,217,0.55)');
    wg.addColorStop(1, 'rgba(154,93,255,0.35)');
    wctx.fillStyle = wg;
    wctx.fillRect(0, 0, 128, 128);
    const r = seeded(side + 5);
    for (let i = 0; i < 18; i++) {
      wctx.fillStyle = `rgba(255,255,255,${r() * 0.25})`;
      wctx.fillRect(Math.floor(r() * 16) * 8, Math.floor(r() * 16) * 8, 8, 8);
    }
    wctx.fillStyle = 'rgba(5,4,12,0.85)';
    wctx.fillRect(62, 0, 4, 128);
    wctx.fillRect(0, 62, 128, 4);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.2),
      new THREE.MeshBasicMaterial({ map: canvasTexture(winCv), color: 0x8a8a8a, toneMapped: false })
    );
    win.position.set(side * 4.9, 1.9, WALL_T + 0.012);
    scene.add(win);
  });

  // "NOW PLAYING" canopy over the door
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 1.6, 0.16, 1.3), trimMat);
  canopy.position.set(0, DOOR_H + 0.5, WALL_T + 0.65);
  scene.add(canopy);
  const canopyEdge = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 1.6, 0.05, 0.05), neonMaterial(C.cyan));
  canopyEdge.position.set(0, DOOR_H + 0.42, WALL_T + 1.3);
  scene.add(canopyEdge);
  const canopyCv = makeCanvas(512, 80);
  const pctx = canopyCv.getContext('2d');
  pctx.fillStyle = '#06040e';
  pctx.fillRect(0, 0, 512, 80);
  pctx.font = '700 30px Orbitron, sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  chromaText(pctx, 'NOW PLAYING: GLITCH PONG', 256, 41, 2, C.amber, C.amber);
  const canopySign = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_W + 1.4, 0.3),
    new THREE.MeshBasicMaterial({ map: canvasTexture(canopyCv), toneMapped: false })
  );
  canopySign.position.set(0, DOOR_H + 0.75, WALL_T + 0.02);
  scene.add(canopySign);

  // ── Big rooftop sign ──
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(12.4, 2.6, 0.25), trimMat);
  signBack.position.set(0, ROOM_H + 1.85, 0.35);
  scene.add(signBack);
  [-4.5, 4.5].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), trimMat);
    post.position.set(x, ROOM_H + 0.4, 0.2);
    scene.add(post);
  });
  const outerSign = createNeonSign(12, 3);
  outerSign.mesh.position.set(0, ROOM_H + 1.85, 0.49);
  scene.add(outerSign.mesh);
  const signFrame = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.06, 0.06), neonMaterial(C.purple));
  signFrame.position.set(0, ROOM_H + 0.52, 0.49);
  const signFrameTop = signFrame.clone();
  signFrameTop.position.y = ROOM_H + 3.18;
  scene.add(signFrame, signFrameTop);

  // Interior sign over the back wall
  const innerSign = createNeonSign(5.2, 1.3);
  innerSign.mesh.position.set(0, 4.75, -ROOM_D + 0.05);
  scene.add(innerSign.mesh);
  neonSigns = [outerSign, innerSign];

  // ── Plaza boundary: neon railings + invisible walls ──
  const railMat = neonMaterial(C.purple, 0.8);
  const railPostMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, roughness: 0.5 });
  function railing(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), railMat);
    rail.position.set((x1 + x2) / 2, 1.0, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    scene.add(rail);
    const n = Math.max(2, Math.round(len / 2.5));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), railPostMat);
      p.position.set(x1 + (x2 - x1) * (i / n), 0.5, z1 + (z2 - z1) * (i / n));
      scene.add(p);
    }
  }
  railing(-13, 15, 13, 15);
  railing(-13, 15, -13, WALL_T);
  railing(13, 15, 13, WALL_T);
  addCollider(-14, 14, 15, 16);
  addCollider(-14, -13, -1, 16);
  addCollider(13, 14, -1, 16);
  addCollider(-13, -hx - WALL_T, -1, WALL_T);
  addCollider(hx + WALL_T, 13, -1, WALL_T);

  // street lamps
  [-7, 7].forEach((x, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), railPostMat);
    pole.position.set(x, 2.1, 6.5);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.2), neonMaterial(i ? C.pink : C.cyan));
    head.position.set(x + (i ? -0.35 : 0.35), 4.2, 6.5);
    scene.add(pole, head);
    addCollider(x - 0.15, x + 0.15, 6.35, 6.65);
    addFloorGlow(scene, new THREE.Color(i ? C.pink : C.cyan), 5, 5, x, 6.5, 0.35);
  });

  // ── City skyline & sky ──
  const skyMats = [1, 2, 3, 4].map((seed) => {
    const t = canvasTexture(makeSkylineWindows(seed), { repeat: [2, 3] });
    return new THREE.MeshStandardMaterial({ color: 0x0a0914, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 1 });
  });
  const rand = seeded(2024);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rand() * 0.08;
    const r = 42 + rand() * 22;
    const w = 5 + rand() * 9;
    const h = 10 + rand() * 34;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (0.7 + rand() * 0.6)), skyMats[i % 4]);
    b.position.set(Math.sin(a) * r, h / 2, -12 + Math.cos(a) * r);
    b.rotation.y = rand() * Math.PI;
    scene.add(b);
  }
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 600; i++) {
    const th = rand() * Math.PI * 2;
    const ph = rand() * Math.PI * 0.45;
    const r = 120;
    starPos.push(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r * 0.6 + 20, Math.sin(th) * Math.sin(ph) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.45, fog: false, toneMapped: false }));
  scene.add(stars);

  // ── Info board where the last right-hand slot would be ──
  infoBoard = createInfoBoard();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshBasicMaterial({ map: infoBoard.tex, toneMapped: false })
  );
  board.position.set(hx - 0.02, 2.3, -19.5);
  board.rotation.y = -Math.PI / 2;
  scene.add(board);
  addGlow(scene, new THREE.Color(C.purple), 3.5, 0.15, new THREE.Vector3(hx - 0.4, 2.3, -19.5));

  // floating glitch cubes under the ceiling
  const cubeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.4, 0.4, 0.4));
  for (let i = 0; i < 16; i++) {
    const col = [C.cyan, C.pink, C.purple][i % 3];
    const cube = new THREE.LineSegments(cubeGeo, new THREE.LineBasicMaterial({ color: col, toneMapped: false }));
    const spot = () => cube.position.set((rand() - 0.5) * (ROOM_W - 3), 3.6 + rand() * 1.4, -2 - rand() * (ROOM_D - 4));
    spot();
    const spin = new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(1.4);
    const s = 0.5 + rand() * 0.9;
    cube.scale.setScalar(s);
    scene.add(cube);
    animated.push((dt) => {
      cube.rotation.x += spin.x * dt;
      cube.rotation.y += spin.y * dt;
      cube.rotation.z += spin.z * dt;
      if (!reducedMotion && Math.random() < dt * 0.08) spot();   // teleport glitch
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CABINETS
// ═══════════════════════════════════════════════════════════════════════════
// Side profile in (z, y): front faces +z. Points run counter-clockwise.
const PROFILE = [
  [-0.45, 0],     // 0 back bottom
  [0.42, 0],      // 1 front bottom
  [0.42, 0.92],   // 2 under the control panel
  [0.62, 1.0],    // 3 panel lip bottom
  [0.62, 1.06],   // 4 panel lip top
  [0.38, 1.14],   // 5 panel back / screen bottom
  [0.2, 1.8],     // 6 screen top
  [0.36, 1.84],   // 7 marquee bottom
  [0.36, 2.12],   // 8 marquee top
  [-0.45, 2.12]   // 9 back top
];
const SIDE_T = 0.05;

function profileShape() {
  const shape = new THREE.Shape();
  PROFILE.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  return shape;
}

function profileGeometry(depth) {
  const g = new THREE.ExtrudeGeometry(profileShape(), { depth, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);         // shape x → +z, extrusion → -x
  g.translate(depth / 2, 0, 0);
  return g;
}

// Face helpers between two profile points.
function faceFrame(a, b) {
  const [za, ya] = PROFILE[a];
  const [zb, yb] = PROFILE[b];
  const dz = zb - za, dy = yb - ya;
  const len = Math.hypot(dz, dy);
  const n = { z: dy / len, y: -dz / len };          // outward normal (CCW polygon)
  return { mid: { z: (za + zb) / 2, y: (ya + yb) / 2 }, len, n, dir: { z: dz / len, y: dy / len } };
}

function placeOnFace(mesh, a, b, along = 0.5, lift = 0.004) {
  const f = faceFrame(a, b);
  const [za, ya] = PROFILE[a];
  mesh.position.set(mesh.position.x, ya + f.dir.y * f.len * along + f.n.y * lift, za + f.dir.z * f.len * along + f.n.z * lift);
  mesh.rotation.x = Math.atan2(-f.n.y, f.n.z);
  return f;
}

function buildCabinet(opts) {
  const {
    width = 1.0, scale = 1, bodyColor = 0x0d0b18, trimLeft, trimRight,
    sideArt, marqueeTex, screenMat, coinTex, accent, accent2 = accent,
    joysticks = 1
  } = opts;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(scale);
  group.add(inner);

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0.2 });
  const body = new THREE.Mesh(profileGeometry(width - SIDE_T * 2), bodyMat);
  inner.add(body);

  // side panels: caps carry the art (UVs = profile coords), walls get the edge colour
  const artFor = (tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / 1.07, 1 / 2.12);
    tex.offset.set(0.45 / 1.07, 0);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.28 });
  };
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x07060c, roughness: 0.4 });
  const artMat = artFor(sideArt);
  [-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(profileGeometry(SIDE_T), [artMat, edgeMat]);
    panel.position.x = side * (width / 2 - SIDE_T / 2);
    inner.add(panel);
    // T-molding neon along the front edge
    const trim = neonMaterial(side < 0 ? trimLeft : trimRight);
    for (let i = 1; i < PROFILE.length - 1; i++) {
      const f = faceFrame(i, i + 1);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(SIDE_T + 0.012, 0.022, f.len + 0.02), trim);
      seg.position.set(side * (width / 2 - SIDE_T / 2), f.mid.y + f.n.y * 0.008, f.mid.z + f.n.z * 0.008);
      seg.rotation.x = Math.atan2(-f.dir.y, f.dir.z);
      inner.add(seg);
    }
  });

  const innerW = width - SIDE_T * 2;

  // bezel + screen
  const screenFace = faceFrame(5, 6);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(innerW, screenFace.len), new THREE.MeshStandardMaterial({ color: 0x030306, roughness: 0.2, metalness: 0.4 }));
  placeOnFace(bezel, 5, 6, 0.5, 0.002);
  inner.add(bezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(innerW - 0.1, screenFace.len - 0.1), screenMat);
  placeOnFace(screen, 5, 6, 0.5, 0.006);
  inner.add(screen);

  // marquee
  const marqueeFace = faceFrame(7, 8);
  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(innerW, marqueeFace.len - 0.02),
    new THREE.MeshBasicMaterial({ map: marqueeTex, color: 0xd0d0d0, toneMapped: false })
  );
  placeOnFace(marquee, 7, 8, 0.5, 0.004);
  inner.add(marquee);

  // speaker grille strip under the marquee hood
  const hood = faceFrame(6, 7);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(innerW, hood.len), new THREE.MeshStandardMaterial({ color: 0x050409, roughness: 0.9 }));
  placeOnFace(grille, 6, 7, 0.5, 0.003);
  inner.add(grille);

  // control panel
  const panelFace = faceFrame(4, 5);
  const panelTop = new THREE.Mesh(new THREE.PlaneGeometry(innerW, panelFace.len), new THREE.MeshStandardMaterial({ color: 0x14111f, roughness: 0.4, metalness: 0.3 }));
  placeOnFace(panelTop, 4, 5, 0.5, 0.003);
  inner.add(panelTop);
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(innerW, faceFrame(3, 4).len), neonMaterial(accent, 0.75));
  placeOnFace(lip, 3, 4, 0.5, 0.003);
  inner.add(lip);

  const stickPositions = joysticks === 2 ? [[-innerW * 0.3, accent], [innerW * 0.2, accent2]] : [[-innerW * 0.2, accent]];
  const buttonMat = (col) => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.3 });
  const tiltX = Math.atan2(panelFace.n.z, panelFace.n.y);
  stickPositions.forEach(([x, col]) => {
    const stick = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0x999aa8, metalness: 0.8, roughness: 0.3 }));
    shaft.position.y = 0.045;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), buttonMat(col));
    ball.position.y = 0.095;
    stick.add(base, shaft, ball);
    stick.position.x = x;
    placeOnFace(stick, 4, 5, 0.45, 0.0);
    stick.rotation.x = tiltX;
    inner.add(stick);
    for (let k = 0; k < 2; k++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16), buttonMat(k ? accent2 : col));
      btn.position.x = x + 0.12 + k * 0.07;
      placeOnFace(btn, 4, 5, 0.42 + k * 0.08, 0.006);
      btn.rotation.x = tiltX;
      inner.add(btn);
    }
  });

  // coin door + kick plate
  const coin = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.375), new THREE.MeshStandardMaterial({ map: coinTex, emissiveMap: coinTex, emissive: 0xffffff, emissiveIntensity: 0.5 }));
  coin.position.set(0, 0.5, 0.424);
  inner.add(coin);
  const kick = new THREE.Mesh(new THREE.PlaneGeometry(innerW, 0.04), neonMaterial(accent2, 0.8));
  kick.position.set(0, 0.06, 0.425);
  inner.add(kick);

  // light spill: on the floor in front and a halo off the screen
  addFloorGlow(group, new THREE.Color(accent), width * 2.0 * scale, 1.6 * scale, 0, 0.9 * scale, 0.32);
  const sf = faceFrame(5, 6);
  // without bloom (phones) fake the screen halo with a sprite
  if (!useBloom) {
    addGlow(group, new THREE.Color(accent), 1.5 * scale, 0.22,
      new THREE.Vector3(0, (sf.mid.y + sf.n.y * 0.3) * scale, (sf.mid.z + sf.n.z * 0.3) * scale));
  }

  return { group, screen, marquee, scale, width, screenFace: sf };
}

function registerCabinet(cab, x, z, rotY, meta) {
  cab.group.position.set(x, meta.baseY || 0, z);
  cab.group.rotation.y = rotY;
  scene.add(cab.group);
  cab.group.updateMatrixWorld(true);

  // footprint collider (rotated AABB of the profile's z range)
  const s = cab.scale;
  const hw = (cab.width / 2) * s;
  const corners = [[-hw, -0.45 * s], [hw, -0.45 * s], [-hw, 0.62 * s], [hw, 0.62 * s]].map(([lx, lz]) => {
    const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    return [v.x + x, v.z + z];
  });
  addCollider(
    Math.min(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[0])),
    Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[1]))
  );

  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const sf = cab.screenFace;
  const screenCenter = new THREE.Vector3(0, sf.mid.y * s, sf.mid.z * s);
  const screenNormal = new THREE.Vector3(0, sf.n.y, sf.n.z);
  cab.group.localToWorld(screenCenter);
  screenNormal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const entry = Object.assign(cab, meta, {
    position: new THREE.Vector3(x, 0, z),
    forward,
    screenCenter,
    screenNormal,
    rotY
  });
  cabinets.push(entry);
  return entry;
}

function buildCabinets() {
  pongScreen = createGlitchPongScreen();
  soonScreen = createComingSoonScreen();

  // ── Glitch Pong: centre stage on a platform at the back wall ──
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.18, 3.0),
    new THREE.MeshStandardMaterial({ color: 0x120b26, roughness: 0.4, metalness: 0.4 })
  );
  platform.position.set(0, 0.09, -ROOM_D + 1.6);
  scene.add(platform);
  platforms.push({ minX: -2.1, maxX: 2.1, minZ: -ROOM_D + 0.1, maxZ: -ROOM_D + 3.1, h: 0.18 });
  const platEdge = new THREE.Mesh(new THREE.BoxGeometry(4.24, 0.03, 0.03), neonMaterial(C.cyan));
  platEdge.position.set(0, 0.17, -ROOM_D + 3.11);
  scene.add(platEdge);
  [-1, 1].forEach((side) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 3.0), neonMaterial(C.pink));
    e.position.set(side * 2.11, 0.17, -ROOM_D + 1.6);
    scene.add(e);
  });

  const gp = buildCabinet({
    width: 1.12,
    scale: 1.18,
    bodyColor: 0x140a2c,
    trimLeft: C.paddleBlue,
    trimRight: C.paddleRed,
    sideArt: makeGlitchPongSideArt(),
    marqueeTex: makeGlitchPongMarquee(),
    screenMat: new THREE.MeshBasicMaterial({ map: pongScreen.tex, toneMapped: false }),
    coinTex: makeCoinDoor('INSERT COIN', C.pink),
    accent: C.cyan,
    accent2: C.pink,
    joysticks: 2
  });
  const gpEntry = registerCabinet(gp, 0, -ROOM_D + 1.2, 0, {
    id: 'glitch-pong', title: 'GLITCH PONG', playable: true, accent: C.cyan, baseY: 0.18
  });

  // Spotlight + the Eye hovering over it
  const spot = new THREE.SpotLight(C.purple, 40, 12, Math.PI / 7, 0.5, 1.4);
  spot.position.set(0, ROOM_H - 0.2, -ROOM_D + 5);
  spot.target.position.set(0, 1.2, -ROOM_D + 1.2);
  scene.add(spot, spot.target);
  const pinkFill = new THREE.PointLight(C.pink, 10, 7, 1.6);
  pinkFill.position.set(0, 1.6, -ROOM_D + 3.4);
  scene.add(pinkFill);
  buildBossEye(gpEntry);

  // ── Nine cabinets that are still compiling ──
  const hx = ROOM_W / 2;
  const slots = [
    ...[-5, -8.6, -12.2, -15.8, -19.4].map((z) => ({ x: -hx + 0.62, z, rotY: Math.PI / 2 })),
    ...[-5, -8.6, -12.2, -15.8].map((z) => ({ x: hx - 0.62, z, rotY: -Math.PI / 2 }))
  ];
  slots.forEach((slot, i) => {
    const accent = COMING_SOON_ACCENTS[i];
    const mat = new THREE.MeshBasicMaterial({ map: soonScreen.tex, color: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.55), toneMapped: false });
    const cab = buildCabinet({
      width: 0.98,
      bodyColor: 0x0d0b18,
      trimLeft: accent,
      trimRight: accent,
      sideArt: makeComingSoonSideArt(accent, i + 10),
      marqueeTex: makeComingSoonMarquee(accent, i + 2),
      screenMat: mat,
      coinTex: makeCoinDoor('COMING SOON', accent),
      accent
    });
    registerCabinet(cab, slot.x, slot.z, slot.rotY, {
      id: `soon-${i + 2}`, title: 'COMING SOON', slot: i + 2, playable: false, accent, screenMaterial: mat
    });
  });
}

// The surveillance Eye from the boss fight keeps watch over its cabinet.
function buildBossEye(cab) {
  const tex = {};
  ['eyeLeft', 'eyeNeutral', 'eyeRight'].forEach((k) => {
    if (assets[k]) {
      const t = new THREE.Texture(assets[k]);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      tex[k] = t;
    }
  });
  if (!tex.eyeNeutral) return;
  const mat = new THREE.SpriteMaterial({ map: tex.eyeNeutral, transparent: true, toneMapped: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 1.6, 1);
  const base = new THREE.Vector3(0, 0.18 + 2.12 * cab.scale + 0.58, cab.position.z + 0.25);
  sprite.position.copy(base);
  scene.add(sprite);
  addGlow(scene, new THREE.Color(C.purple), 2.0, 0.25, base);

  const orbit = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), neonMaterial(i % 2 ? C.pink : C.cyan, 1.4));
    scene.add(m);
    orbit.push({ m, a: (Math.PI * 2 * i) / 6 });
  }

  let state = 'eyeNeutral';
  let glitchT = 0;
  let nextShot = 4;
  let shot = null;

  eye = { sprite, base };
  animated.push((dt, t) => {
    // follow the player: look left / straight / right
    const local = player.pos.x - base.x;
    const want = local < -1.0 ? 'eyeLeft' : local > 1.0 ? 'eyeRight' : 'eyeNeutral';
    if (want !== state && tex[want]) {
      state = want;
      mat.map = tex[want];
      glitchT = 0.18;
    }
    glitchT = Math.max(0, glitchT - dt);
    sprite.position.set(
      base.x + (glitchT > 0 ? (Math.random() - 0.5) * 0.12 : 0),
      base.y + Math.sin(t * 1.4) * 0.06,
      base.z
    );
    orbit.forEach((o) => {
      const a = o.a + t * 1.6;
      o.m.position.set(base.x + Math.cos(a) * 0.62, sprite.position.y + Math.sin(a) * 0.36, base.z + Math.sin(a) * 0.15);
    });

    // every so often it lobs a harmless punishment shot at you
    if (gameState !== 'explore') return;
    const dist = player.pos.distanceTo(base);
    nextShot -= dt;
    if (!shot && nextShot <= 0 && dist < 11 && dist > 2.5 && !reducedMotion) {
      const src = orbit[Math.floor(Math.random() * orbit.length)].m.position.clone();
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), neonMaterial(C.pink, 1.6));
      m.position.copy(src);
      scene.add(m);
      shot = { m, from: src, life: 0, dur: 0.9 };
      nextShot = 5 + Math.random() * 4;
      glitchT = 0.25;
    }
    if (shot) {
      shot.life += dt;
      const k = Math.min(1, shot.life / shot.dur);
      const target = camera.position.clone().add(new THREE.Vector3(0, -0.25, 0));
      shot.m.position.lerpVectors(shot.from, target, k);
      shot.m.position.y += Math.sin(k * Math.PI) * 0.4;
      if (k > 0.86) {
        scene.remove(shot.m);
        shot.m.geometry.dispose();
        shot = null;
        worldGlitch(true);
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER (first-person character)
// ═══════════════════════════════════════════════════════════════════════════
const player = {
  pos: new THREE.Vector3(0, 0, 10.5),     // feet
  vel: new THREE.Vector3(),
  vy: 0,
  camY: 0,
  grounded: true,
  yaw: 0,
  pitch: -0.04,
  bob: 0
};

const keys = { fwd: false, back: false, left: false, right: false, run: false };
const joy = { x: 0, y: 0, id: null };
let arms;

function buildArms() {
  viewScene.add(new THREE.AmbientLight(0x6c5a9a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.3, 1, 0.6);
  viewScene.add(key);
  const rim = new THREE.PointLight(C.pink, 3, 3);
  rim.position.set(0, -0.3, -0.4);
  viewScene.add(rim);

  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1a1430, roughness: 0.6 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.45, metalness: 0.2 });
  const make = (side) => {
    const g = new THREE.Group();
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.42), sleeve);
    forearm.position.z = 0.12;
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.092, 0.025), neonMaterial(side < 0 ? C.cyan : C.pink, 0.7));
    cuff.position.z = -0.08;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.11), glove);
    hand.position.z = -0.15;
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.012, 0.012), neonMaterial(side < 0 ? C.cyan : C.pink, 0.7));
    knuckles.position.set(0, 0.026, -0.19);
    g.add(forearm, cuff, hand, knuckles);
    g.rotation.set(0.12, side * -0.18, side * 0.08);
    return g;
  };
  arms = { left: make(-1), right: make(1), reach: 0 };
  arms.left.scale.setScalar(0.8);
  arms.right.scale.setScalar(0.8);
  arms.left.position.set(-0.3, -0.34, -0.56);
  arms.right.position.set(0.3, -0.34, -0.56);
  arms.leftBase = arms.left.position.clone();
  arms.rightBase = arms.right.position.clone();
  viewCamera.add(arms.left, arms.right);
}

function floorHeightAt(x, z) {
  for (const p of platforms) {
    if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) return p.h;
  }
  return 0;
}

function collide(pos) {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of colliders) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= PLAYER_RADIUS * PLAYER_RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (PLAYER_RADIUS - d);
        pos.z += (dz / d) * (PLAYER_RADIUS - d);
      } else {
        // centre inside the box: push out along the shallowest axis
        const pushes = [
          [b.minX - PLAYER_RADIUS - pos.x, 0], [b.maxX + PLAYER_RADIUS - pos.x, 0],
          [0, b.minZ - PLAYER_RADIUS - pos.z], [0, b.maxZ + PLAYER_RADIUS - pos.z]
        ].sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
        pos.x += pushes[0][0];
        pos.z += pushes[0][1];
      }
    }
  }
}

function updatePlayer(dt) {
  let f = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0) - joy.y;
  let s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joy.x;
  const mag = Math.hypot(f, s);
  if (mag > 1) { f /= mag; s /= mag; }
  const speed = keys.run || Math.hypot(joy.x, joy.y) > 0.92 ? RUN_SPEED : WALK_SPEED;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const tx = (-sin * f + cos * s) * speed;
  const tz = (-cos * f - sin * s) * speed;
  const k = 1 - Math.exp(-(player.grounded ? 12 : 3) * dt);
  player.vel.x += (tx - player.vel.x) * k;
  player.vel.z += (tz - player.vel.z) * k;
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  collide(player.pos);

  const floorY = floorHeightAt(player.pos.x, player.pos.z);
  player.vy -= GRAVITY * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= floorY) {
    player.pos.y = floorY;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = player.pos.y - floorY < 0.02;
  }
  // ease the camera over small steps (the stage) instead of popping
  player.camY = player.grounded ? player.camY + (player.pos.y - player.camY) * Math.min(1, dt * 14) : player.pos.y;

  const moving = Math.hypot(player.vel.x, player.vel.z);
  if (player.grounded && moving > 0.3) player.bob += dt * moving * 2.4;
  const bobY = player.grounded ? Math.sin(player.bob) * 0.035 * Math.min(1, moving / WALK_SPEED) : 0;

  camera.position.set(player.pos.x, player.camY + EYE_HEIGHT + bobY, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  if (arms) {
    const swing = Math.sin(player.bob) * 0.018 * Math.min(1, moving / WALK_SPEED);
    arms.left.position.set(arms.leftBase.x, arms.leftBase.y + swing, arms.leftBase.z);
    arms.right.position.set(arms.rightBase.x, arms.rightBase.y - swing, arms.rightBase.z - arms.reach * 0.22);
    arms.right.position.y += arms.reach * 0.1;
    arms.reach = Math.max(0, arms.reach - dt * 3);
  }
}

function jump() {
  if (gameState !== 'explore' || !player.grounded) return;
  player.vy = JUMP_SPEED;
  player.grounded = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTION
// ═══════════════════════════════════════════════════════════════════════════
let focused = null;
let toastTimer = null;

function findFocus() {
  const look = new THREE.Vector3();
  camera.getWorldDirection(look);
  let best = null;
  let bestScore = -Infinity;
  for (const cab of cabinets) {
    const toCab = cab.screenCenter.clone().sub(camera.position);
    const dist = Math.hypot(player.pos.x - cab.position.x, player.pos.z - cab.position.z);
    if (dist > INTERACT_RANGE * cab.scale) continue;
    // must be in front of the machine, not behind/beside it
    const rel = new THREE.Vector3(player.pos.x - cab.position.x, 0, player.pos.z - cab.position.z);
    if (rel.normalize().dot(cab.forward) < 0.5) continue;
    const facing = look.dot(toCab.normalize());
    if (facing < 0.55) continue;
    const score = facing - dist * 0.2;
    if (score > bestScore) { bestScore = score; best = cab; }
  }
  return best;
}

function updateFocus() {
  const next = gameState === 'explore' ? findFocus() : null;
  if (next === focused) return;
  focused = next;
  crosshairEl.classList.toggle('on', !!focused);
  useBtn.classList.toggle('ready', !!focused);
  if (!focused) {
    promptEl.classList.remove('show');
    return;
  }
  const key = isTouch ? 'USE' : 'E';
  if (focused.playable) {
    promptEl.className = 'show';
    promptEl.innerHTML = `<span class="key">${key}</span>PLAY GLITCH PONG<small>CABINET 01 // ONLINE</small>`;
  } else {
    promptEl.className = 'show soon';
    promptEl.innerHTML = `<span class="key">${key}</span>COMING SOON<small>CABINET ${String(focused.slot).padStart(2, '0')} // STILL COMPILING</small>`;
  }
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

let sfxCache = {};
function sfx(name, volume = 0.5) {
  try {
    const a = sfxCache[name] || (sfxCache[name] = new Audio(encodeURI(`sounds/sfx/${name}.mp3`)));
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (e) {}
}

function interact() {
  if (gameState !== 'explore' || !focused) return;
  if (arms) arms.reach = 1;
  if (focused.playable) {
    launchGlitchPong(focused);
    return;
  }
  const cab = focused;
  sfx('Glitch Pulse', 0.45);
  toast(`CABINET ${String(cab.slot).padStart(2, '0')} IS COMING SOON — this machine is still compiling.`);
  // the screen freaks out for a moment
  const original = cab.screenMaterial.color.clone();
  let n = 0;
  const iv = setInterval(() => {
    cab.screenMaterial.color.setHSL(Math.random(), 1, 0.7);
    if (++n > 6) { clearInterval(iv); cab.screenMaterial.color.copy(original); }
  }, 70);
}

// ═══════════════════════════════════════════════════════════════════════════
// GLITCH FX
// ═══════════════════════════════════════════════════════════════════════════
let nextWorldGlitch = 8;
function worldGlitch(small = false) {
  if (reducedMotion) return;
  root.classList.remove('gc-glitch');
  void root.offsetWidth;
  root.classList.add('gc-glitch');
  setTimeout(() => root.classList.remove('gc-glitch'), 340);
  const count = small ? 3 : 7;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'gc-slice';
    s.style.top = `${Math.random() * 100}%`;
    s.style.height = `${4 + Math.random() * 14}px`;
    s.style.animationDelay = `${i * 0.03}s`;
    slicesEl.appendChild(s);
    setTimeout(() => s.remove(), 420);
  }
  neonSigns.forEach((sg) => sg.draw(true));
  if (infoBoard) infoBoard.draw(true);
  if (pongScreen) pongScreen.burst();
  setTimeout(() => {
    neonSigns.forEach((sg) => sg.draw(false));
    if (infoBoard) infoBoard.draw(false);
  }, 260);
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME HAND-OFF
// ═══════════════════════════════════════════════════════════════════════════
// intro → explore ⇄ paused → launching → playing → (exit) → paused/explore
let gameState = 'intro';
let launch = null;

function setExploring(on) {
  document.body.classList.toggle('gc-exploring', on);
}

function launchGlitchPong(cab) {
  if (!window.GlitchPong || typeof window.GlitchPong.launch !== 'function') {
    toast('GLITCH PONG FAILED TO LOAD — try refreshing.');
    return;
  }
  // Unlock audio while we still hold the user gesture.
  window.GlitchPong.unlockAudio();
  gameState = 'launching';
  focused = null;
  promptEl.classList.remove('show');
  crosshairEl.classList.remove('on');
  resetInput();
  if (document.pointerLockElement) document.exitPointerLock();
  setExploring(false);
  document.body.classList.add('gc-launching');

  const target = cab.screenCenter.clone().addScaledVector(cab.screenNormal, 0.62);
  const look = new THREE.Object3D();
  look.position.copy(target);
  look.lookAt(cab.screenCenter);
  launch = {
    t: 0,
    dur: 0.85,
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos: target,
    toQuat: look.quaternion.clone(),
    cab,
    started: false
  };
  sfx('Game Start', 0.5);
}

function updateLaunch(dt) {
  if (!launch) return;
  launch.t += dt;
  const k = Math.min(1, launch.t / launch.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(launch.fromPos, launch.toPos, e);
  camera.quaternion.slerpQuaternions(launch.fromQuat, launch.toQuat, e);
  if (arms) {
    arms.left.visible = arms.right.visible = k < 0.6;
  }
  if (k >= 1 && !launch.started) {
    launch.started = true;
    pongScreen.burst();
    const ok = window.GlitchPong.launch({ onExit: onGameExit });
    if (!ok) { onGameExit(); return; }
  }
  // the game's own glitch transition runs ~1s, then its overlay appears
  if (launch.started && document.getElementById('__glitchcade_overlay')) {
    gameState = 'playing';
    root.classList.add('gc-hidden');
    document.body.classList.remove('gc-launching');
    document.body.classList.add('gp-playing');
  }
}

function onGameExit() {
  const cab = launch ? launch.cab : cabinets.find((c) => c.playable);
  launch = null;
  document.body.classList.remove('gp-playing', 'gc-launching');
  root.classList.remove('gc-hidden');
  if (arms) arms.left.visible = arms.right.visible = true;
  resetInput();

  // step back from the cabinet, facing it
  const stand = cab.position.clone().addScaledVector(cab.forward, 2.0);
  player.pos.set(stand.x, floorHeightAt(stand.x, stand.z), stand.z);
  player.camY = player.pos.y;
  player.vel.set(0, 0, 0);
  player.vy = 0;
  player.yaw = Math.atan2(cab.forward.x, cab.forward.z);
  player.pitch = -0.05;
  camera.position.set(player.pos.x, player.camY + EYE_HEIGHT, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  resize();
  worldGlitch();
  lastFrame = performance.now();

  if (isTouch) {
    gameState = 'explore';
    setExploring(true);
  } else {
    showPauseCard('Welcome back', 'GLITCHCADE', 'Glitch Pong is waiting whenever you are. Click to keep exploring.', 'Keep exploring');
    gameState = 'paused';
    setExploring(false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════════
function resetInput() {
  Object.keys(keys).forEach((k) => (keys[k] = false));
  joy.x = joy.y = 0;
  joy.id = null;
  joyKnob.style.transform = '';
  lookTouch = null;
}

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run'
};

window.addEventListener('keydown', (e) => {
  if (gameState !== 'explore') return;
  if (dragLook && e.code === 'Escape') {
    gameState = 'paused';
    resetInput();
    setExploring(false);
    showPauseCard('Paused', 'GLITCHCADE', 'The machines are waiting. Click to jump back in.', 'Resume');
    return;
  }
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); return; }
  if (e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); interact(); }
  if (e.code === 'Space') { e.preventDefault(); jump(); }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
});
window.addEventListener('blur', resetInput);

// Mouse look (pointer lock)
const SENS = 0.0022;
function applyLook(dx, dy, sens = SENS) {
  player.yaw -= dx * sens;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dy * sens));
}

// When pointer lock is unavailable (blocked in some embeds), fall back to drag-to-look.
let dragLook = false;
let lockFailures = 0;

document.addEventListener('mousemove', (e) => {
  if (gameState !== 'explore') return;
  if (dragLook) {
    if (e.buttons & 1) applyLook(e.movementX, e.movementY);
    return;
  }
  if (document.pointerLockElement !== canvas) return;
  // ignore the occasional huge spike some browsers emit on lock
  if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
  applyLook(e.movementX, e.movementY);
});

canvas.addEventListener('mousedown', (e) => {
  if (isTouch || dragLook) return;
  if (gameState === 'explore' && document.pointerLockElement === canvas && e.button === 0) interact();
});

function enterWithoutLock() {
  dragLook = true;
  $('gcHints').innerHTML = '<span>WASD</span> move &nbsp;·&nbsp; <span>DRAG</span> look &nbsp;·&nbsp; <span>SHIFT</span> run &nbsp;·&nbsp; <span>SPACE</span> jump<br><span>E</span> interact &nbsp;·&nbsp; <span>ESC</span> pause';
  gameState = 'explore';
  setExploring(true);
  lastFrame = performance.now();
}

function lockFailed() {
  // A single failure is usually the browser's re-lock cooldown; a second means it's blocked.
  if (++lockFailures >= 2) enterWithoutLock();
}

function requestLock() {
  if (isTouch) return;
  if (dragLook || !canvas.requestPointerLock) { enterWithoutLock(); return; }
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(lockFailed);
  } catch (e) {
    lockFailed();
  }
}
document.addEventListener('pointerlockerror', lockFailed);

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    lockFailures = 0;
    if (gameState === 'paused' || gameState === 'intro') {
      gameState = 'explore';
      setExploring(true);
      lastFrame = performance.now();
    }
  } else if (gameState === 'explore') {
    gameState = 'paused';
    resetInput();
    setExploring(false);
    showPauseCard('Paused', 'GLITCHCADE', 'The machines are waiting. Click to jump back in.', 'Resume');
  }
});

function showPauseCard(eyebrow, title, sub, button) {
  $('gcEyebrow').textContent = eyebrow;
  $('gcTitle').textContent = title;
  $('gcSub').textContent = sub;
  enterBtn.textContent = button;
}

enterBtn.addEventListener('click', () => {
  if (gameState !== 'intro' && gameState !== 'paused') return;
  if (isTouch) {
    gameState = 'explore';
    setExploring(true);
    lastFrame = performance.now();
    // Ask for fullscreen on phones so browser chrome doesn't eat the view.
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
  } else {
    requestLock();
  }
});
canvas.addEventListener('click', () => {
  if (!isTouch && gameState === 'paused') requestLock();
});

// Touch: left stick + drag-to-look + buttons
let lookTouch = null;
const JOY_R = 52;

function joyUpdate(t) {
  const r = joyEl.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = t.clientX - cx, dy = t.clientY - cy;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
  joy.x = dx / JOY_R;
  joy.y = dy / JOY_R;
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

joyEl.addEventListener('touchstart', (e) => {
  if (gameState !== 'explore') return;
  e.preventDefault();
  const t = e.changedTouches[0];
  joy.id = t.identifier;
  joyUpdate(t);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (gameState !== 'explore') return;
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) joyUpdate(t);
    else if (lookTouch && t.identifier === lookTouch.id) {
      applyLook(t.clientX - lookTouch.x, t.clientY - lookTouch.y, 0.0048);
      lookTouch.x = t.clientX;
      lookTouch.y = t.clientY;
    }
  }
}, { passive: true });

function endTouches(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      joy.id = null;
      joy.x = joy.y = 0;
      joyKnob.style.transform = '';
    }
    if (lookTouch && t.identifier === lookTouch.id) lookTouch = null;
  }
}
window.addEventListener('touchend', endTouches);
window.addEventListener('touchcancel', endTouches);

canvas.addEventListener('touchstart', (e) => {
  if (gameState !== 'explore') return;
  for (const t of e.changedTouches) {
    if (!lookTouch && t.identifier !== joy.id) lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
}, { passive: true });

useBtn.addEventListener('touchstart', (e) => { e.preventDefault(); interact(); }, { passive: false });
useBtn.addEventListener('click', interact);
jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

// ═══════════════════════════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════════════════════════
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  viewCamera.aspect = w / h;
  viewCamera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
}
window.addEventListener('resize', () => { if (gameState !== 'playing') resize(); });

let lastFrame = performance.now();
let elapsed = 0;
let screenTimer = 0;
let soonTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (gameState === 'playing') return;      // Glitch Pong has the screen; the arcade sleeps
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  elapsed += dt;

  if (gameState === 'explore') updatePlayer(dt);
  else if (gameState === 'launching') updateLaunch(dt);
  else if (gameState === 'intro') {
    // slow drift on the title screen
    player.yaw = Math.sin(elapsed * 0.15) * 0.25;
    camera.position.set(player.pos.x, EYE_HEIGHT + 0.3, player.pos.z + 1.5);
    camera.rotation.set(0.04, player.yaw, 0);
  }
  updateFocus();

  animated.forEach((fn) => fn(dt, elapsed));

  // throttle the canvas-texture screens
  screenTimer += dt;
  if (screenTimer > 1 / 30) { pongScreen.draw(screenTimer); screenTimer = 0; }
  soonTimer += dt;
  if (soonTimer > 1 / 12) { soonScreen.draw(soonTimer); soonTimer = 0; }

  // the neon sign's dodgy tube + random arcade-wide glitches
  if (Math.random() < dt * 2) neonSigns.forEach((s) => s.draw(false));
  nextWorldGlitch -= dt;
  if (nextWorldGlitch <= 0 && gameState === 'explore') {
    worldGlitch();
    nextWorldGlitch = 9 + Math.random() * 10;
  }

  if (composer) {
    composer.render();
  } else {
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(viewScene, viewCamera);
  }
}

function showFatal(msg) {
  const el = $('gcError');
  el.textContent = msg;
  el.style.display = 'block';
  enterBtn.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
(async function boot() {
  await loadAssets();
  buildEnvironment();
  buildCabinets();
  buildArms();
  resize();
  requestAnimationFrame((t) => { lastFrame = t; frame(t); });
  enterBtn.disabled = false;
  enterBtn.textContent = isTouch ? 'Tap to enter' : 'Enter the Glitchcade';
  enterBtn.focus({ preventScroll: true });

  // Hooks for automated testing / debugging from the console.
  window.__glitchcade = {
    get state() { return gameState; },
    player,
    cabinets,
    teleport(x, z, yaw = player.yaw, pitch = player.pitch) {
      player.pos.set(x, floorHeightAt(x, z), z);
      player.camY = player.pos.y;
      player.yaw = yaw;
      player.pitch = pitch;
    },
    start() { gameState = 'explore'; setExploring(true); },
    interact
  };
})();
