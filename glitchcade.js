// ═══════════════════════════════════════════════════════════════════════════
// GLITCHCADE — first-person 3D arcade that hosts Glitch Pong
// Walk in off the street, find the cabinets that work, play them.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three-addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three-addons/postprocessing/OutputPass.js';
import { mergeGeometries } from './vendor/three-addons/utils/BufferGeometryUtils.js';
import { createArcadeAudio } from './glitchcade-audio.js?v=glitchcade-10';
import { installFloor } from './glitchcade-floor.js?v=floor-3';

// Power policy (glitchcade-power.js, a plain script loaded ahead of this module).
// A stub keeps the arcade running if that script is missing.
const Power = window.GlitchPower || {
  saving: false, state: 'off', batterySaver: false, setBatterySaver() { return false; }, onChange() {},
  createPacer: () => ({ due: () => true, reset() {} }), fpsFor: () => Infinity
};

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

// The games planned for cabinets 03–10, glitched takes on arcade classics.
// Still compiling: their marquees, side art and prompts carry the names.
const COMING_SOON_GAMES = {
  3: 'SIGNAL LOST',          // maze chase
  4: 'FIREWALL',             // invaders
  5: 'DEFRAG',               // falling blocks
  6: 'BLACK-HOLE NEXUS',     // spin-and-thrust rocks
  7: 'STACK OVERFLOW',       // girder climb
  8: 'PACKET HOP',           // lane crossing
  9: 'SWARM PROTOCOL',       // formation shooter
  10: 'MISSILE DEFENSE.EXE'  // missile defense
};

// Shrink a font (given as '<weight> <size>px <family>') until `text` fits `maxW`.
function fitFont(ctx, text, weight, size, family, maxW) {
  for (; size > 8; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return size;
}

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
const ROOM_W = 20;
const ROOM_D = 32;
const ROOM_H = 5.5;
const WALL_T = 0.3;
const DOOR_W = 3.2;
const DOOR_H = 3.3;
const PLAZA_X = ROOM_W / 2 + 5;   // street railings either side of the building
const UP = new THREE.Vector3(0, 1, 0);
// STAFF ONLY: a doorway in the right-hand wall, past the info board. The room
// behind it (and the door that keeps it shut) is built in glitchcade-floor.js.
const STAFF_DOOR = { z: -23.2, w: 1.5, h: 2.3 };
// Back of the room: prize counter across the back wall facing the door,
// Glitch Pong's stage in the back-left corner, the collection case back-right.
const GP_STAGE = { x: -6.6, z: -26.6, rot: 0.5 };
const CASE_SPOT = { x: 6.6, z: -26.6, rot: -0.5 };
const COUNTER = { halfW: 3.8, front: -28.5, back: -29.4, h: 1.05 };

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

const audio = createArcadeAudio({ isTouch });
const muteBtn = $('gcMute');

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
let useBloom = !isTouch;
try {
  // With bloom, the scene renders into off-screen targets, so canvas MSAA would be wasted work.
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  showFatal('Your browser could not start WebGL, so the Glitchcade can\'t load. You can still play Glitch Pong on the main site.');
  throw err;
}
// Adaptive resolution: start here, step down if frames run slow (see `quality`).
const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, isTouch ? 1 : 1.5);
renderer.setPixelRatio(MAX_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const maxAniso = Math.min(isTouch ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
// Several passes render per frame; count them all, reset once per frame.
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040f);
scene.fog = new THREE.FogExp2(0x070418, 0.024);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';

// The player's arms live in their own scene so they never clip into cabinets.
const viewScene = new THREE.Scene();
const viewCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
viewScene.add(viewCamera);

let composer = null;
let bloomPass = null;
if (useBloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const armsPass = new RenderPass(viewScene, viewCamera);
  armsPass.clear = false;
  armsPass.clearDepth = true;
  composer.addPass(armsPass);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.7, 0.4, 0.72);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
} else {
  renderer.autoClear = false;
}

function disableBloom() {
  if (!composer) return;
  composer.dispose();
  composer = null;
  bloomPass = null;
  useBloom = false;
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

// Cheap diffuse material for big rough surfaces (Lambert ignores roughness/metalness).
function matte({ roughness, metalness, ...params }) {
  return new THREE.MeshLambertMaterial(params);
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
// `flickerIndex` is the letter with the dodgy tube.
function createNeonSign(w, h, word = 'GLITCHCADE', flickerIndex = 6) {
  const cv = makeCanvas(1024, 256);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const rand = Math.random;
  let shownNormal = false;
  function draw(glitch) {
    const flickerNow = !glitch && rand() < 0.04;
    if (!glitch && !flickerNow && shownNormal) return false;   // nothing changed
    shownNormal = !glitch && !flickerNow;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = '900 150px Orbitron, "Arial Black", sans-serif';
    ctx.textBaseline = 'middle';
    const widths = [...word].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + 10 * (word.length - 1);
    let flickered = false;
    const scale = Math.min(1, 960 / total);
    ctx.save();
    ctx.translate(512 - (total * scale) / 2, 128);
    ctx.scale(scale, 1);
    let x = 0;
    [...word].forEach((ch, i) => {
      // The second C is the flickery tube, like every real neon sign.
      const dead = glitch ? rand() < 0.16 : false;
      const flicker = i === flickerIndex && flickerNow;
      if (flicker) flickered = true;
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
    return flickered;
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

// `tagline` replaces the COMING SOON line (repaired cabinets, the gauntlet).
function makeComingSoonMarquee(accent, slot, name = 'COMING SOON', tagline = null) {
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, name, 900, 54, 'Orbitron, "Arial Black", sans-serif', W - 44);
  chromaText(ctx, name, W / 2, 66, 3, '#ffffff', accent);
  ctx.font = '18px "Share Tech Mono", monospace';
  ctx.fillStyle = hexToRgba(accent, 0.9);
  ctx.fillText(tagline || `// COMING SOON — CABINET ${String(slot).padStart(2, '0')} //`, W / 2, 113);
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

function makeComingSoonSideArt(accent, seed, name = 'COMING SOON') {
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
  ctx.textAlign = 'left';
  fitFont(ctx, name, 700, 30, 'Orbitron, sans-serif', 450);
  ctx.fillStyle = hexToRgba(accent, 0.85);
  ctx.fillText(name, 0, 0);
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
// `onEvent('paddle' | 'wall' | 'score')` lets the cabinet make the real game's sounds.
// `opts.prompt: false` drops the PRESS E call to action (the ceiling TVs use it),
// `opts.t0` starts the loop part-way through so several feeds don't run in step.
function createGlitchPongScreen(onEvent = () => {}, opts = {}) {
  const W = 512, H = 384;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const s = {
    t: opts.t0 || 0,
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
    if (b.y < 14 || b.y > H - 14) { b.vy *= -1; b.y = Math.max(14, Math.min(H - 14, b.y)); onEvent('wall'); }
    // AI paddles with just enough lag to miss sometimes
    const track = (p, target, speed) => p + Math.max(-speed * dt, Math.min(speed * dt, target - p));
    s.left = track(s.left, b.vx < 0 ? b.y : H / 2, 250);
    s.right = track(s.right, b.vx > 0 ? b.y : H / 2, 250);
    const hit = (py) => Math.abs(b.y - py) < PAD_H / 2 + 6;
    if (b.vx < 0 && b.x < PAD_X + PAD_W + 6 && b.x > PAD_X) {
      if (hit(s.left)) { b.vx = Math.abs(b.vx) * 1.06; b.vy += (b.y - s.left) * 3; s.heat += 0.12; onEvent('paddle'); }
    }
    if (b.vx > 0 && b.x > W - PAD_X - PAD_W - 6 && b.x < W - PAD_X) {
      if (hit(s.right)) { b.vx = -Math.abs(b.vx) * 1.06; b.vy += (b.y - s.right) * 3; s.heat += 0.12; onEvent('paddle'); }
    }
    b.vx = Math.sign(b.vx) * Math.min(Math.abs(b.vx), 620);
    b.vy = Math.max(-360, Math.min(360, b.vy));
    if (b.x < -20 || b.x > W + 20) {
      s.score[b.x < 0 ? 1 : 0] = (s.score[b.x < 0 ? 1 : 0] + 1) % 8;
      s.glitchFor = 0.45;
      onEvent('score');
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
    if (opts.prompt !== false && Math.floor(s.t * 1.6) % 2 === 0) {
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

// ── Break Point (cabinet 02): marquee, side art and an attract-mode screen ──
// Brick colours borrowed from the game's own palette.
const BP_BRICKS = ['#ff4d6d', '#ff9a00', '#ffd27a', '#50fa7b', '#71efff', '#4d7cff', '#9a5dff', '#ff58d9'];

function makeBreakPointMarquee() {
  const W = 512, H = 160;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0718');
  g.addColorStop(0.5, '#1d0f38');
  g.addColorStop(1, '#0a0718');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a wall of bricks along the top, a few already knocked out
  const rand = seeded(202);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 12; c++) {
      if (rand() < 0.18) continue;
      ctx.fillStyle = hexToRgba(BP_BRICKS[(c + r * 3) % BP_BRICKS.length], 0.75);
      ctx.fillRect(10 + c * 41.5, 12 + r * 15, 38, 11);
    }
  }
  ctx.font = '900 58px Orbitron, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chromaText(ctx, 'BREAKPOINT', W / 2, 86, 3, '#f2eaff', C.purple);
  ctx.font = '16px "Share Tech Mono", monospace';
  ctx.fillStyle = C.amber;
  ctx.fillText('// CABINET 02 — SAME MACHINE //', W / 2, 128);
  // paddle + ball
  ctx.fillStyle = C.cyan;
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 10;
  ctx.fillRect(W / 2 - 36, H - 16, 72, 6);
  ctx.fillStyle = '#fff';
  ctx.fillRect(W / 2 + 60, H - 30, 8, 8);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.purple;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  scanlines(ctx, W, H, 0.14, 4);
  sliceGlitch(ctx, W, H, seeded(23), 2, 12);
  return canvasTexture(cv);
}

// Mirrored like the other side art: canvas left = back of the cabinet.
function makeBreakPointSideArt() {
  const W = 256, H = 512;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0322');
  g.addColorStop(1, '#05020f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a brick wall shattering upward
  const rand = seeded(77);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 5; c++) {
      const y = 40 + r * 22;
      if (rand() < r * 0.09) continue;
      const jitter = r > 4 ? (rand() - 0.5) * 18 : 0;
      ctx.fillStyle = hexToRgba(BP_BRICKS[(r + c) % BP_BRICKS.length], 0.55 + rand() * 0.35);
      ctx.fillRect(14 + c * 46 + jitter, y + jitter, 42, 16);
    }
  }
  // the ball's path
  ctx.save();
  ctx.strokeStyle = C.cyan;
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(40, 470); ctx.lineTo(200, 330); ctx.lineTo(90, 250);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.fillRect(84, 244, 14, 14);
  // the Eye watches from below
  if (assets.eyeNeutral) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.shadowColor = C.purple;
    ctx.shadowBlur = 24;
    ctx.drawImage(assets.eyeNeutral, 120, 330, 120, 120);
    ctx.restore();
  }
  ctx.fillStyle = C.pink;
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 12;
  ctx.fillRect(20, 476, 90, 10);
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(30, 494);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '900 30px Orbitron, "Arial Black", sans-serif';
  ctx.textBaseline = 'middle';
  chromaText(ctx, 'BREAKPOINT', 0, 0, 3, '#f4ecff');
  ctx.restore();
  scanlines(ctx, W, H, 0.14, 4);
  sliceGlitch(ctx, W, H, seeded(5), 4, 16);
  return canvasTexture(cv);
}

// Break Point attract mode: an AI paddle chipping away at a brick wall.
function createBreakPointScreen(opts = {}) {
  const W = 384, H = 288;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const COLS = 10, ROWS = 5, BW = 34, BH = 12, BX = (W - COLS * (BW + 2)) / 2, BY = 40;
  const PAD_W = 64, PAD_Y = H - 26;
  const s = { t: opts.t0 || 0, bricks: [], ball: null, pad: W / 2, score: 0, burst: 0, glitchFor: 0, trail: [] };
  const promptText = isTouch ? 'TAP  USE  TO  PLAY' : 'PRESS  E  TO  PLAY';

  function reset() {
    s.bricks = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s.bricks.push({ r, c, alive: true });
    s.ball = { x: W / 2, y: PAD_Y - 20, vx: 150 * (Math.random() < 0.5 ? -1 : 1), vy: -210 };
    s.glitchFor = 0.4;
  }
  reset();

  function step(dt) {
    const b = s.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 6 || b.x > W - 6) { b.vx *= -1; b.x = Math.max(6, Math.min(W - 6, b.x)); }
    if (b.y < 26) { b.vy = Math.abs(b.vy); }
    // the AI paddle lags a little so the ball sometimes gets past
    s.pad += Math.max(-260 * dt, Math.min(260 * dt, b.x - s.pad));
    if (b.vy > 0 && b.y > PAD_Y - 6 && b.y < PAD_Y + 4 && Math.abs(b.x - s.pad) < PAD_W / 2 + 4) {
      b.vy = -Math.abs(b.vy);
      b.vx += (b.x - s.pad) * 4;
      b.vx = Math.max(-280, Math.min(280, b.vx));
    }
    if (b.y > H + 10) { s.glitchFor = 0.45; s.ball = { x: s.pad, y: PAD_Y - 20, vx: 150, vy: -210 }; return; }
    for (const br of s.bricks) {
      if (!br.alive) continue;
      const x = BX + br.c * (BW + 2), y = BY + br.r * (BH + 2);
      if (b.x > x - 4 && b.x < x + BW + 4 && b.y > y - 4 && b.y < y + BH + 4) {
        br.alive = false;
        s.score += 50;
        b.vy *= -1;
        break;
      }
    }
    if (!s.bricks.some((br) => br.alive)) reset();
    s.trail.push({ x: b.x, y: b.y });
    if (s.trail.length > 10) s.trail.shift();
  }

  function draw(dt) {
    s.t += dt;
    s.burst = Math.max(0, s.burst - dt);
    s.glitchFor = Math.max(0, s.glitchFor - dt);
    const titleCard = s.t % 14 > 11;
    if (!titleCard) step(Math.min(dt, 1 / 20));

    ctx.fillStyle = '#04030c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(154,93,255,0.13)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    if (titleCard) {
      ctx.font = '900 44px Orbitron, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      chromaText(ctx, 'BREAK', W / 2, H / 2 - 56, 4, '#f2eaff');
      chromaText(ctx, 'POINT', W / 2, H / 2 - 8, 4, '#f2eaff');
      if (assets.eyeNeutral) ctx.drawImage(assets.eyeNeutral, W / 2 - 40, H / 2 + 22, 80, 80);
    } else {
      ctx.font = '26px VT323, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(113,239,255,0.85)';
      ctx.fillText(String(s.score).padStart(6, '0'), 10, 6);
      for (const br of s.bricks) {
        if (!br.alive) continue;
        ctx.fillStyle = BP_BRICKS[br.r % BP_BRICKS.length];
        ctx.fillRect(BX + br.c * (BW + 2), BY + br.r * (BH + 2), BW, BH);
      }
      s.trail.forEach((p, i) => {
        const a = i / s.trail.length;
        ctx.fillStyle = `rgba(113,239,255,${a * 0.45})`;
        const sz = 3 + a * 6;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      });
      ctx.save();
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 14;
      ctx.fillStyle = C.cyan;
      ctx.fillRect(s.pad - PAD_W / 2, PAD_Y, PAD_W, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.ball.x - 5, s.ball.y - 5, 10, 10);
      ctx.restore();
    }

    if (opts.prompt !== false && Math.floor(s.t * 1.6) % 2 === 0) {
      ctx.font = '700 15px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W / 2 - 110, H - 72, 220, 26);
      ctx.fillStyle = C.amber;
      ctx.fillText(promptText, W / 2, H - 59);
    }

    if (s.glitchFor > 0 || s.burst > 0 || Math.random() < 0.02) {
      sliceGlitch(ctx, W, H, Math.random, s.burst > 0 ? 10 : 4, s.burst > 0 ? 60 : 24);
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
    const lines = (infoLinesProvider && infoLinesProvider()) || [
      ['> CABINET 01 .......... GLITCH PONG', C.green],
      ['> CABINET 02 .......... BREAKPOINT', C.green],
      ['> CABINETS 03–10 ...... COMPILING', C.amber],
      ['> PRIZE COUNTER ....... COINS FOR WINS', C.cyan],
      ['> THE EYE ............. WATCHING', C.pink]
    ];
    lines.forEach(([txt, col], i) => {
      ctx.fillStyle = col;
      ctx.fillText(txt, 64, 240 + i * 50);
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
const platforms = [];        // raised floor areas: {cx,cz,hw,hd,rot,h} (rotated rectangles)
const cabinets = [];
const interactables = [];    // cabinets + the jukebox
let jukebox = null;
const animated = [];         // fn(dt, t) called each frame
const worldLights = [];      // every light, so a Kernel Panic can dim the building
let carpetMat = null;
let infoLinesProvider = null; // the floor module supplies the info board's live lines
let floor = null;            // glitchcade-floor.js: repairs, the Eye's events, the table...
let glowTex;
let pongScreen;
let bpScreen;
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

// ── Static batching: meshes that never move and look identical become one draw call ──
function materialKey(m) {
  if (m.isShaderMaterial) return m.uuid;
  const hex = (c) => (c ? c.getHexString() : '');
  const id = (t) => (t ? t.uuid : '');
  return [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.roughness, m.metalness,
    id(m.map), id(m.emissiveMap), id(m.alphaMap), m.transparent, m.opacity, m.blending,
    m.side, m.depthWrite, m.toneMapped].join('|');
}

// Geometry in `root` space with only the attributes every primitive shares.
function bakeableGeometry(mesh, toRoot) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  Object.keys(geo.attributes).forEach((name) => {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  });
  return geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
}

// One material slot of a multi-material mesh as its own geometry.
function groupSlice(geo, group) {
  const part = new THREE.BufferGeometry();
  Object.entries(geo.attributes).forEach(([name, attr]) => {
    const n = attr.itemSize;
    part.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(group.start * n, (group.start + group.count) * n), n));
  });
  return part;
}

// Merge static child meshes of `root` per material (multi-material meshes are split
// per slot first). Anything flagged `userData.noBake` or matched by `skip` is left
// alone, children included.
function bakeStatic(root, skip = () => false) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const add = (material, item) => {
    const key = materialKey(material);
    if (!buckets.has(key)) buckets.set(key, { material, items: [] });
    buckets.get(key).items.push(item);
  };
  const splitMeshes = [];
  (function walk(obj) {
    for (const child of obj.children) {
      if (child.userData.noBake || skip(child)) continue;
      const g = child.geometry;
      if (child.isMesh && !child.children.length && g.attributes.position && g.attributes.normal && g.attributes.uv) {
        if (!Array.isArray(child.material)) {
          add(child.material, { mesh: child });
        } else if (g.groups.length) {
          const flat = bakeableGeometry(child, toRoot);
          flat.groups.forEach((grp) => add(child.material[grp.materialIndex], { geo: groupSlice(flat, grp) }));
          splitMeshes.push(child);
        }
      }
      walk(child);
    }
  })(root);
  let removed = 0;
  for (const { material, items } of buckets.values()) {
    if (items.length < 2 && items[0].mesh) continue;     // a lone plain mesh gains nothing
    const geos = items.map((it) => {
      const geo = it.geo || bakeableGeometry(it.mesh, toRoot);
      geo.clearGroups();
      return geo;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    root.add(new THREE.Mesh(merged, material));
    items.forEach((it) => { if (it.mesh) it.mesh.parent.remove(it.mesh); });
    removed += items.length - 1;
  }
  splitMeshes.forEach((mesh) => { mesh.parent.remove(mesh); removed++; });
  return removed;
}

function bakeScene() {
  let removed = 0;
  // Most of the building is on screen at once, so one batch per material for the
  // whole world beats per-prop culling. The robot is baked piecewise (its parts move).
  if (robot) {
    const r = robot;
    removed += bakeStatic(r.root, (o) => o === r.torso);
    removed += bakeStatic(r.torso, (o) => o === r.head || o === r.armL.arm || o === r.armR.arm);
    removed += bakeStatic(r.head);
    [r.armL, r.armR].forEach((a) => {
      removed += bakeStatic(a.arm, (o) => o === a.elbow);
      removed += bakeStatic(a.elbow, (o) => o === a.claw);
    });
  }
  cabinets.forEach((c) => { if (c.group.userData.noBake) removed += bakeStatic(c.group); });
  removed += bakeStatic(scene);
  return removed;
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
  const hemi = new THREE.HemisphereLight(0x6a5acd, 0x120820, 0.55);
  const ambient = new THREE.AmbientLight(0x221a3a, 0.6);
  scene.add(hemi, ambient);
  worldLights.push(hemi, ambient);
  const interiorLights = [
    [0, 4.6, -6, C.cyan, 16],
    [0, 4.6, -16, C.purple, 18],
    [-6.5, 4.4, -24, C.pink, 13],
    [6.5, 4.4, -24, C.cyan, 13]
  ];
  interiorLights.forEach(([x, y, z, col, dist]) => {
    const l = new THREE.PointLight(col, 18, dist, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
    worldLights.push(l);
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
  // It's the costly PBR material and it lies under the whole building: drawn last, the
  // depth test throws away every pixel the carpet and walls already cover.
  ground.renderOrder = 100;
  scene.add(ground);

  const sidewalkTex = canvasTexture(makeSidewalkTexture(), { repeat: [14, 3] });
  const sidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 6),
    matte({ map: sidewalkTex, roughness: 0.8 })
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
  carpetMat = matte({
    map: carpetTex, emissiveMap: carpetTex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.95
  });
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), carpetMat);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.006, -ROOM_D / 2);
  scene.add(carpet);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    matte({ color: 0x0a0814, roughness: 1 })
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
  const interiorWall = matte({
    map: canvasTexture(makeWallTexture('#120d24', 'rgba(154,93,255,0.18)', 11), { repeat: [6, 2] }),
    roughness: 0.9
  });
  const exteriorWall = matte({
    map: canvasTexture(makeWallTexture('#17102e', 'rgba(255,88,217,0.14)', 12), { repeat: [8, 2] }),
    roughness: 0.75
  });
  const trimMat = matte({ color: 0x0b0816, roughness: 0.6 });

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
  // right wall, with the STAFF ONLY doorway cut into it
  const sdA = STAFF_DOOR.z - STAFF_DOOR.w / 2, sdB = STAFF_DOOR.z + STAFF_DOOR.w / 2;
  wall(hx, hx + WALL_T, -ROOM_D - WALL_T, sdA, ROOM_H, 1);
  wall(hx, hx + WALL_T, sdB, WALL_T, ROOM_H, 1);
  wall(hx, hx + WALL_T, sdA, sdB, ROOM_H - STAFF_DOOR.h, 1, STAFF_DOOR.h);
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

  // guide line from the door to the prize counter
  for (let z = -1.2; z > -27.6; z -= 0.9) {
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
    if (curtainTimer < 1 / 15 || Math.abs(camera.position.z) > 14) return;
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
    win.position.set(side * 6, 1.9, WALL_T + 0.012);
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

  // Interior signs over the prize counter on the back wall
  const innerSign = createNeonSign(3.9, 0.98);
  innerSign.mesh.position.set(0, 4.9, -ROOM_D + 0.05);
  scene.add(innerSign.mesh);
  const prizeSign = createNeonSign(4.4, 1.1, 'PRIZES', 2);
  prizeSign.mesh.position.set(0, 3.6, -ROOM_D + 0.06);
  scene.add(prizeSign.mesh);
  neonSigns = [outerSign, innerSign, prizeSign];

  // ── Plaza boundary: neon railings + invisible walls ──
  const railMat = neonMaterial(C.purple, 0.8);
  const railPostMat = matte({ color: 0x1a1430, roughness: 0.5 });
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
  railing(-PLAZA_X, 15, PLAZA_X, 15);
  railing(-PLAZA_X, 15, -PLAZA_X, WALL_T);
  railing(PLAZA_X, 15, PLAZA_X, WALL_T);
  addCollider(-PLAZA_X - 1, PLAZA_X + 1, 15, 16);
  addCollider(-PLAZA_X - 1, -PLAZA_X, -1, 16);
  addCollider(PLAZA_X, PLAZA_X + 1, -1, 16);
  addCollider(-PLAZA_X, -hx - WALL_T, -1, WALL_T);
  addCollider(hx + WALL_T, PLAZA_X, -1, WALL_T);

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
    return matte({ color: 0x0a0914, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 1 });
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

  const bodyMat = matte({ color: bodyColor, roughness: 0.55, metalness: 0.2 });
  const body = new THREE.Mesh(profileGeometry(width - SIDE_T * 2), bodyMat);
  inner.add(body);

  // side panels: caps carry the art (UVs = profile coords), walls get the edge colour
  const artFor = (tex) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / 1.07, 1 / 2.12);
    tex.offset.set(0.45 / 1.07, 0);
    return matte({ map: tex, roughness: 0.5, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.28 });
  };
  const edgeMat = matte({ color: 0x07060c, roughness: 0.4 });
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
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(innerW, hood.len), matte({ color: 0x050409, roughness: 0.9 }));
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

  return { group, screen, marquee, coin, scale, width, screenFace: sf };
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
  interactables.push(entry);
  return entry;
}

function buildCabinets() {
  pongScreen = createGlitchPongScreen((event) => audio.attract(event));
  bpScreen = createBreakPointScreen();
  soonScreen = createComingSoonScreen();

  // ── Glitch Pong: its own stage in the back-left corner, angled at the entrance ──
  const stage = new THREE.Group();
  stage.position.set(GP_STAGE.x, 0, GP_STAGE.z);
  stage.rotation.y = GP_STAGE.rot;
  scene.add(stage);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.18, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x120b26, roughness: 0.4, metalness: 0.4 })
  );
  platform.position.y = 0.09;
  stage.add(platform);
  platforms.push({ cx: GP_STAGE.x, cz: GP_STAGE.z, hw: 1.8, hd: 1.4, rot: GP_STAGE.rot, h: 0.18 });
  const platEdge = new THREE.Mesh(new THREE.BoxGeometry(3.64, 0.03, 0.03), neonMaterial(C.cyan));
  platEdge.position.set(0, 0.17, 1.41);
  stage.add(platEdge);
  [-1, 1].forEach((side) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 2.8), neonMaterial(C.pink));
    e.position.set(side * 1.81, 0.17, 0);
    stage.add(e);
  });
  const cabSpot = new THREE.Vector3(0, 0, -0.35).applyAxisAngle(UP, GP_STAGE.rot).add(new THREE.Vector3(GP_STAGE.x, 0, GP_STAGE.z));

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
  const gpEntry = registerCabinet(gp, cabSpot.x, cabSpot.z, GP_STAGE.rot, {
    id: 'glitch-pong', title: 'GLITCH PONG', playable: true, accent: C.cyan, baseY: 0.18
  });

  // Spotlight + the Eye hovering over it
  const spot = new THREE.SpotLight(C.purple, 40, 12, Math.PI / 7, 0.5, 1.4);
  spot.position.copy(cabSpot).addScaledVector(gpEntry.forward, 3.4).setY(ROOM_H - 0.2);
  spot.target.position.copy(cabSpot).setY(1.2);
  scene.add(spot, spot.target);
  addFloorGlow(scene, new THREE.Color(C.pink), 2.6, 2.0, cabSpot.x + gpEntry.forward.x * 1.6, cabSpot.z + gpEntry.forward.z * 1.6, 0.22);
  buildBossEye(gpEntry);

  // ── Nine cabinets that are still compiling ──
  const hx = ROOM_W / 2;
  const slots = [
    ...[-5, -8.6, -12.2, -15.8, -19.4].map((z) => ({ x: -hx + 0.62, z, rotY: Math.PI / 2 })),
    ...[-5, -8.6, -12.2, -15.8].map((z) => ({ x: hx - 0.62, z, rotY: -Math.PI / 2 }))
  ];
  slots.forEach((slot, i) => {
    if (i === 0) { buildBreakPointCabinet(slot); return; }
    const accent = COMING_SOON_ACCENTS[i];
    const mat = new THREE.MeshBasicMaterial({ map: soonScreen.tex, color: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.55), toneMapped: false });
    const cab = buildCabinet({
      width: 0.98,
      bodyColor: 0x0d0b18,
      trimLeft: accent,
      trimRight: accent,
      sideArt: makeComingSoonSideArt(accent, i + 10, COMING_SOON_GAMES[i + 2]),
      marqueeTex: makeComingSoonMarquee(accent, i + 2, COMING_SOON_GAMES[i + 2]),
      screenMat: mat,
      coinTex: makeCoinDoor('COMING SOON', accent),
      accent
    });
    // A Quantum Shift can swap two of these, so each is baked on its own
    // (bakeScene) instead of into the building's shared batches.
    cab.group.userData.noBake = true;
    registerCabinet(cab, slot.x, slot.z, slot.rotY, {
      id: `soon-${i + 2}`, title: COMING_SOON_GAMES[i + 2] || 'COMING SOON', slot: i + 2, playable: false, accent, screenMaterial: mat, movable: true
    });
  });
}

// The surveillance Eye from the boss fight keeps watch over its cabinet.
// ── Break Point: cabinet 02, the first machine on the left as you walk in ──
function buildBreakPointCabinet(slot) {
  const cab = buildCabinet({
    width: 0.98,
    bodyColor: 0x120a26,
    trimLeft: C.purple,
    trimRight: C.cyan,
    sideArt: makeBreakPointSideArt(),
    marqueeTex: makeBreakPointMarquee(),
    screenMat: new THREE.MeshBasicMaterial({ map: bpScreen.tex, toneMapped: false }),
    coinTex: makeCoinDoor('INSERT COIN', C.cyan),
    accent: C.purple,
    accent2: C.cyan
  });
  const entry = registerCabinet(cab, slot.x, slot.z, slot.rotY, {
    id: 'breakpoint', title: 'BREAKPOINT', slot: 2, playable: true, accent: C.purple
  });
  addFloorGlow(scene, new THREE.Color(C.purple), 1.6, 1.4,
    slot.x + entry.forward.x * 1.1, slot.z + entry.forward.z * 1.1, 0.2);
  return entry;
}

// ═══════════════════════════════════════════════════════════════════════════
// CEILING TVs — old CRT sets hung over the aisle, tilted down at the floor,
// flicking between Glitch Pong and Breakpoint gameplay
// ═══════════════════════════════════════════════════════════════════════════
const TV_PAIRS_Z = [-7.5, -15, -22.5];   // back-to-back pairs on drop poles down the centre aisle
const TV_Y = 4.25;                        // screen centre height (ceiling at ROOM_H)
const TV_TILT = 0.34;                     // radians the screens tip toward the floor
const tvs = [];                           // { mat, feed, next, flip, yaw, pos }
let tvFeeds = [];
// While set, every set shows tvOverride(tv) instead of its channel (the Eye
// takes over the feeds during its events).
let tvOverride = null;
let tvOverridden = false;
let tvStatic = null;

function makeWoodTexture() {
  const W = 256, H = 128;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a2c1a';
  ctx.fillRect(0, 0, W, H);
  const rand = seeded(91);
  for (let i = 0; i < 70; i++) {
    const y = rand() * H;
    ctx.strokeStyle = `rgba(${rand() < 0.5 ? '30,16,8' : '110,70,40'},${0.25 + rand() * 0.35})`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 3);
    ctx.stroke();
  }
  return canvasTexture(cv);
}

// Shared snow for channel changes
function createTvStatic() {
  const W = 128, H = 96;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const tex = canvasTexture(cv);
  const img = ctx.createImageData(W, H);
  function draw() {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, (Math.random() * H) | 0, W, 8);
    tex.needsUpdate = true;
  }
  draw();
  return { tex, draw };
}

// A curved CRT face: a plane bowed out toward the viewer
function crtGeometry(w, h, bulge) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (w / 2), v = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - u * u * 0.6) * (1 - v * v * 0.6));
  }
  geo.computeVertexNormals();
  return geo;
}

let tvShared = null;
function buildTv() {
  if (!tvShared) {
    const wood = makeWoodTexture();
    const lcv = makeCanvas(256, 32);
    const lctx = lcv.getContext('2d');
    lctx.fillStyle = '#16131c';
    lctx.fillRect(0, 0, 256, 32);
    lctx.font = '700 18px Orbitron, sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillStyle = '#c9c2d8';
    lctx.fillText('GLITCHVISION', 128, 17);
    tvShared = {
      wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.05 }),
      plastic: new THREE.MeshStandardMaterial({ color: 0x1a1720, roughness: 0.6, metalness: 0.2 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xc8c8d4, roughness: 0.25, metalness: 0.9 }),
      grille: new THREE.MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.9 }),
      badge: new THREE.MeshBasicMaterial({ map: canvasTexture(lcv), toneMapped: false, color: 0xbbbbbb }),
      led: new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false }),
      screenGeo: crtGeometry(0.74, 0.56, 0.035)
    };
  }
  const M = tvShared;
  const tv = new THREE.Group();
  // wooden cabinet, its picture-tube hump tapering out the back
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.8, 0.5), M.wood);
  cabinet.position.z = -0.25;
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.6, 0.36), M.plastic);
  hump.position.z = -0.66;
  const humpCap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.12), M.plastic);
  humpCap.position.z = -0.88;
  // front: bezel around the tube, controls down the right
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.66, 0.03), M.plastic);
  bezel.position.set(-0.11, 0.02, 0.005);
  const screen = new THREE.Mesh(M.screenGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  screen.position.set(-0.11, 0.02, 0.022);
  screen.userData.noBake = true;               // its picture changes channel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.02), M.plastic);
  panel.position.set(0.42, 0.02, 0.01);
  tv.add(cabinet, hump, humpCap, bezel, screen, panel);
  [0.22, 0.04].forEach((y) => {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 16), M.chrome);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.42, y, 0.045);
    tv.add(knob);
  });
  for (let i = 0; i < 5; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.01), M.grille);
    slot.position.set(0.42, -0.1 - i * 0.035, 0.025);
    tv.add(slot);
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), M.led);
  led.position.set(0.48, -0.27, 0.025);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.04), M.badge);
  badge.position.set(-0.11, -0.335, 0.003);
  tv.add(led, badge);
  return { group: tv, screen };
}

function pickTvFeed(not) {
  const options = tvFeeds.filter((f) => f !== not);
  return options[Math.floor(Math.random() * options.length)];
}

function buildTvs() {
  // Two feeds per game, each starting at a different point in its loop
  tvFeeds = [
    createGlitchPongScreen(() => {}, { prompt: false, t0: 2 }),
    createGlitchPongScreen(() => {}, { prompt: false, t0: 8 }),
    createBreakPointScreen({ prompt: false, t0: 0 }),
    createBreakPointScreen({ prompt: false, t0: 6 })
  ];
  tvStatic = createTvStatic();
  const pole = new THREE.MeshStandardMaterial({ color: 0x2a2633, roughness: 0.4, metalness: 0.7 });
  TV_PAIRS_Z.forEach((z) => {
    const mount = new THREE.Group();
    mount.position.set(0, 0, z);
    scene.add(mount);
    // drop pole from the ceiling, a plate where it meets it, and a cross-yoke
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ROOM_H - TV_Y - 0.3, 10), pole);
    rod.position.y = (ROOM_H + TV_Y + 0.3) / 2;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16), pole);
    plate.position.y = ROOM_H - 0.015;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.9), pole);
    yoke.position.y = TV_Y + 0.42;
    mount.add(rod, plate, yoke);
    // one set facing the door, one facing the back of the room
    [0, Math.PI].forEach((yaw) => {
      const facing = new THREE.Group();
      facing.rotation.y = yaw;
      mount.add(facing);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), pole);
      arm.position.set(0, TV_Y + 0.35, 0.92);
      facing.add(arm);
      const set = buildTv();
      set.group.position.set(0, TV_Y, 1.12);   // the cabinet's back hangs toward the pole
      set.group.rotation.x = TV_TILT;
      facing.add(set.group);
      const feed = pickTvFeed();
      set.screen.material.map = feed.tex;
      // yaw 0 faces the door, π faces the prize counter
      tvs.push({
        mat: set.screen.material, mesh: set.screen, feed, next: 4 + Math.random() * 10, flip: 0, yaw,
        pos: new THREE.Vector3(0, TV_Y, z + Math.cos(yaw) * 1.12),
        normal: new THREE.Vector3(0, 0, Math.cos(yaw)),
        seen: true
      });
    });
  });
}

// Channel surfing: every so often a set flips to another feed through a burst of snow
function updateTvs(dt) {
  if (tvOverride) {
    tvOverridden = true;
    for (const tv of tvs) tv.mat.map = tvOverride(tv) || tvStatic.tex;
    return true;
  }
  if (tvOverridden) {            // the takeover ended: back to each set's channel
    tvOverridden = false;
    for (const tv of tvs) { tv.mat.map = tv.feed.tex; tv.flip = 0; }
  }
  let snowing = false;
  for (const tv of tvs) {
    if (tv.flip > 0) {
      tv.flip -= dt;
      snowing = true;
      if (tv.flip <= 0) {
        tv.feed = pickTvFeed(tv.feed);
        tv.mat.map = tv.feed.tex;
        tv.next = 7 + Math.random() * 10;
      }
      continue;
    }
    tv.next -= dt;
    if (tv.next <= 0) {
      tv.flip = reducedMotion ? 0.12 : 0.35;
      tv.mat.map = tvStatic.tex;
    }
  }
  return snowing;
}

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
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, cab.rotY);
  const base = cab.position.clone().addScaledVector(cab.forward, 0.25).setY(0.18 + 2.12 * cab.scale + 0.58);
  sprite.position.copy(base);
  scene.add(sprite);
  addGlow(scene, new THREE.Color(C.purple), 2.0, 0.25, base);

  const orbit = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), neonMaterial(i % 2 ? C.pink : C.cyan, 1.4));
    m.userData.noBake = true;
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
    const local = (player.pos.x - base.x) * right.x + (player.pos.z - base.z) * right.z;
    const want = local < -1.0 ? 'eyeLeft' : local > 1.0 ? 'eyeRight' : 'eyeNeutral';
    if (want !== state && tex[want]) {
      state = want;
      mat.map = tex[want];
      glitchT = 0.18;
    }
    glitchT = Math.max(0, glitchT - dt);
    sprite.position.copy(base).addScaledVector(right, glitchT > 0 ? (Math.random() - 0.5) * 0.12 : 0);
    sprite.position.y = base.y + Math.sin(t * 1.4) * 0.06;
    orbit.forEach((o) => {
      const a = o.a + t * 1.6;
      o.m.position.copy(base).addScaledVector(right, Math.cos(a) * 0.62).addScaledVector(cab.forward, Math.sin(a) * 0.15);
      o.m.position.y = sprite.position.y + Math.sin(a) * 0.36;
    });

    // every so often it lobs a harmless punishment shot at you
    if (gameState !== 'explore') return;
    const dist = player.pos.distanceTo(base);
    nextShot -= dt;
    if (!shot && nextShot <= 0 && dist < 11 && dist > 2.5 && !reducedMotion && !atPrizeCounter()) {
      const src = orbit[Math.floor(Math.random() * orbit.length)].m.position.clone();
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), neonMaterial(C.pink, 1.6));
      m.position.copy(src);
      scene.add(m);
      shot = { m, from: src, life: 0, dur: 0.9 };
      audio.eyeShot(src);
      nextShot = 5 + Math.random() * 4;
      glitchT = 0.25;
    }
    if (shot) {
      shot.life += dt;
      const k = Math.min(1, shot.life / shot.dur);
      const target = tmpV1.copy(camera.position);
      target.y -= 0.25;
      shot.m.position.lerpVectors(shot.from, target, k);
      shot.m.position.y += Math.sin(k * Math.PI) * 0.4;
      if (k > 0.86) {
        scene.remove(shot.m);
        shot.m.geometry.dispose();
        shot = null;
        audio.eyeHit();
        worldGlitch(true);
      }
    }
  });
}

// A jukebox by the door plays PRIZETRON’s Groove and the Construct tracks. Use it to skip.
function buildJukebox() {
  const hx = ROOM_W / 2;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x150d2a, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.6), bodyMat);
  body.position.y = 0.625;
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.6, 32, 1, false, Math.PI / 2, Math.PI), bodyMat);
  arch.rotation.x = Math.PI / 2;
  arch.position.y = 1.25;
  group.add(body, arch);

  // glowing window in the arch
  const winCv = makeCanvas(128, 64);
  const wctx = winCv.getContext('2d');
  const wg = wctx.createLinearGradient(0, 64, 0, 0);
  wg.addColorStop(0, '#ff58d9');
  wg.addColorStop(1, '#9a5dff');
  wctx.fillStyle = wg;
  wctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 9; i++) {
    wctx.fillStyle = 'rgba(255,255,255,0.35)';
    wctx.beginPath();
    wctx.arc(10 + i * 14, 54 - (i % 3) * 14, 3, 0, Math.PI * 2);
    wctx.fill();
  }
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ map: canvasTexture(winCv), toneMapped: false }));
  win.position.set(0, 1.25, 0.302);
  group.add(win);

  // neon tubes that cycle colour
  const tubeMats = [0, 1, 2].map(() => neonMaterial(C.pink));   // colours cycle per tube
  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.022, 8, 40, Math.PI), tubeMats[0]);
  outer.position.set(0, 1.25, 0.3);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.016, 8, 40, Math.PI), tubeMats[1]);
  inner.position.set(0, 1.25, 0.305);
  group.add(outer, inner);
  outer.userData.noBake = inner.userData.noBake = true;
  [-1, 1].forEach((side) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.25, 0.04), tubeMats[2]);
    t.position.set(side * 0.455, 0.625, 0.3);
    t.userData.noBake = true;
    group.add(t);
  });

  // front panel: title, now playing, speaker grille
  const panelCv = makeCanvas(256, 320);
  const pctx = panelCv.getContext('2d');
  const panelTex = canvasTexture(panelCv);
  function drawPanel(title) {
    pctx.fillStyle = '#0a0716';
    pctx.fillRect(0, 0, 256, 320);
    pctx.textAlign = 'center';
    pctx.textBaseline = 'middle';
    pctx.font = '900 34px Orbitron, "Arial Black", sans-serif';
    chromaText(pctx, 'JUKEBOX', 128, 34, 2, C.text);
    pctx.fillStyle = 'rgba(0,0,0,0.6)';
    pctx.fillRect(18, 62, 220, 52);
    pctx.font = '13px "Share Tech Mono", monospace';
    pctx.fillStyle = C.amber;
    pctx.fillText('NOW PLAYING', 128, 76);
    pctx.fillStyle = C.cyan;
    pctx.fillText(title, 128, 98);
    for (let y = 140; y < 300; y += 16) {
      for (let x = 28; x < 236; x += 16) {
        pctx.fillStyle = '#1c1430';
        pctx.beginPath();
        pctx.arc(x, y, 5, 0, Math.PI * 2);
        pctx.fill();
      }
    }
    pctx.strokeStyle = C.purple;
    pctx.lineWidth = 4;
    pctx.strokeRect(2, 2, 252, 316);
    panelTex.needsUpdate = true;
  }
  drawPanel(audio.trackTitle);
  audio.onTrack = drawPanel;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.025), new THREE.MeshStandardMaterial({ map: panelTex, emissiveMap: panelTex, emissive: 0xffffff, emissiveIntensity: 0.6 }));
  panel.position.set(0, 0.64, 0.302);
  group.add(panel);

  const x = hx - 0.32, z = -2.2, rotY = -Math.PI / 2;
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  scene.add(group);
  group.updateMatrixWorld(true);
  addCollider(x - 0.3, x + 0.3, z - 0.48, z + 0.48);
  addFloorGlow(scene, new THREE.Color(C.pink), 1.8, 1.6, x - 0.8, z, 0.35);

  animated.push((dt, t) => {
    tubeMats.forEach((m, i) => m.color.setHSL((t * 0.07 + i * 0.22) % 1, 1, 0.62));
  });

  jukebox = {
    kind: 'jukebox',
    scale: 1,
    position: new THREE.Vector3(x, 0, z),
    forward: new THREE.Vector3(-1, 0, 0),
    screenCenter: group.localToWorld(new THREE.Vector3(0, 1.0, 0.3))
  };
  interactables.push(jukebox);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIZE COUNTER — win a match, earn 10 coins, trade coins for collectables
// ═══════════════════════════════════════════════════════════════════════════
// Cheap prizes sit on the bottom shelves, the big-ticket ones up top.
// Two rows of six: the first six fill the lower shelf. Break Point's prizes are
// mixed in by price.
// The secret achievement `prizes_all` (glitchpong-site.js) has goal = PRIZES.length;
// adding or removing a prize means updating it (tests/achievements-prizes.test.mjs checks).
const PRIZES = [
  { id: 'paddle-keychain', name: 'PIXEL PADDLE KEYCHAIN', cost: 10 },
  { id: 'pixel-brick', name: 'PIXEL BRICK STACK', cost: 15 },
  { id: 'glitch-ball', name: 'GLITCH BALL', cost: 20 },
  { id: 'heat-gauge', name: 'HEAT GAUGE', cost: 30 },
  { id: 'overclock-chip', name: 'OVERCLOCK CHIP', cost: 35 },
  { id: 'construct-hex', name: 'CONSTRUCT HEXAGON', cost: 40 },
  { id: 'matrix-cube', name: 'MATRIX CODE CUBE', cost: 50 },
  { id: 'black-hole-globe', name: 'BLACK HOLE GLOBE', cost: 60 },
  { id: 'laser-paddle', name: 'LASER PADDLE', cost: 70 },
  { id: 'mini-eye', name: 'MINI BOSS EYE', cost: 80 },
  { id: 'eye-shard', name: 'EYE SHARD', cost: 90 },
  { id: 'golden-paddle', name: 'GOLDEN PADDLE TROPHY', cost: 100 }
];
// The admin menu (glitchpong-admin.js) unlocks every prize by id.
window.GlitchcadePrizeIds = PRIZES.map((p) => p.id);
const PRIZES_PER_ROW = 6;
const ROBOT_NAME = 'PRIZETRON-80';
const ROBOT_POS = new THREE.Vector3(0, 0, -30.35);

// The wallet lives in glitchpong-site.js (shared with the game, which pays out wins).
const Wallet = {
  get() {
    return window.GlitchcadeWallet ? window.GlitchcadeWallet.get() : { coins: 0, earned: 0, wins: 0, prizes: [] };
  },
  redeem(id, cost) {
    return window.GlitchcadeWallet ? window.GlitchcadeWallet.redeem(id, cost) : null;
  },
  award(n) {
    return window.GlitchcadeWallet && window.GlitchcadeWallet.award ? window.GlitchcadeWallet.award(n) : null;
  },
  spend(n) {
    return window.GlitchcadeWallet && window.GlitchcadeWallet.spend ? window.GlitchcadeWallet.spend(n) : null;
  }
};

const prizeSlots = [];       // shelf stock, one per prize: { prize, model, center, tag }
const caseSlots = [];        // collection case, one per prize: { prize, model, placeholder }
let robot = null;
let counterDisplay = null;
let casePlate = null;

function atPrizeCounter() {
  return player.pos.z < -25.5 && Math.abs(player.pos.x) < 5;
}

// ── Hologram shader: fresnel rim + scanlines + a sweeping band, additive ──
const holoUniforms = { uTime: { value: 0 }, uFlicker: { value: 1 } };

function hologramMaterial(color, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: holoUniforms.uTime,
      uFlicker: holoUniforms.uFlicker
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uFlicker;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float lines = 0.62 + 0.38 * sin(vY * 150.0 - uTime * 9.0);
        float band = 1.0 - abs(fract(vY * 0.4 - uTime * 0.3) - 0.5) * 2.0;
        float sweep = smoothstep(0.9, 1.0, band);
        float a = (0.14 + fres * 0.9 + sweep * 0.4) * lines * uOpacity * uFlicker;
        gl_FragColor = vec4(uColor * (0.7 + fres * 1.3 + sweep * 1.2), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

function glowMaterial(color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  });
}

// ── The host: a boxy 80s robot projected as a hologram ──
function buildRobot() {
  const root = new THREE.Group();
  root.userData.noBake = true;   // baked piecewise in bakeScene(); the hologram jitters
  root.position.copy(ROBOT_POS);
  const holo = hologramMaterial('#5fe8ff');
  const holoDim = hologramMaterial('#5fe8ff', 0.55);
  const holoPink = hologramMaterial('#ff7ae3', 0.8);

  // projector pad on the floor (solid) and its light beam
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.56, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: 0x15121f, metalness: 0.6, roughness: 0.35 })
  );
  pad.position.y = 0.06;
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.018, 8, 48), neonMaterial(C.cyan));
  padRing.rotation.x = Math.PI / 2;
  padRing.position.y = 0.125;
  const padGlow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), glowMaterial('#5fe8ff', 0.45));
  padGlow.rotation.x = -Math.PI / 2;
  padGlow.position.y = 0.13;
  // faint projector beam: a cone that fades out as it rises
  const beamCv = makeCanvas(4, 64);
  const bctx = beamCv.getContext('2d');
  const bg = bctx.createLinearGradient(0, 0, 0, 64);
  bg.addColorStop(0, 'rgba(255,255,255,0)');
  bg.addColorStop(1, 'rgba(255,255,255,1)');
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 4, 64);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.4, 1.6, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: '#5fe8ff', alphaMap: canvasTexture(beamCv, { srgb: false }), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  beam.position.y = 0.92;
  root.add(pad, padRing, padGlow, beam);

  const box = (w, h, d, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 20) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // tank treads, hips and a ribbed waist
  [-1, 1].forEach((s) => box(0.16, 0.22, 0.55, holoDim, s * 0.24, 0.28, 0, root));
  box(0.5, 0.14, 0.36, holo, 0, 0.45, 0, root);
  cyl(0.13, 0.15, 0.3, holoDim, 0, 0.66, 0, root);
  [0.58, 0.68, 0.76].forEach((y) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 24), holo);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    root.add(r);
  });

  // torso (pivots to follow the player a little)
  const torso = new THREE.Group();
  torso.position.y = 0.8;
  root.add(torso);
  box(0.74, 0.62, 0.42, holo, 0, 0.33, 0, torso);
  box(0.44, 0.28, 0.02, holoDim, 0, 0.37, 0.215, torso);
  const chestLights = ['#ff58d9', '#ffd27a', '#50fa7b'].map((c, i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), glowMaterial(c));
    l.position.set(-0.12 + i * 0.12, 0.44, 0.23);
    torso.add(l);
    return l;
  });
  const dial = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 24), holo);
  dial.position.set(0, 0.29, 0.228);
  torso.add(dial);
  const needle = box(0.008, 0.05, 0.004, glowMaterial('#ffd27a'), 0, 0.29, 0.232, torso);
  needle.geometry.translate(0, 0.022, 0);
  needle.position.y = 0.29;
  [-1, 1].forEach((s) => {
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), holo);
    bolt.position.set(s * 0.45, 0.52, 0);
    torso.add(bolt);
  });

  // accordion arms with pincer claws
  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.47, 0.5, 0);
    torso.add(arm);
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 16), holo);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = -0.06 - i * 0.075;
      arm.add(rib);
    }
    cyl(0.03, 0.03, 0.4, holoDim, 0, -0.2, 0, arm, 10);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), holo);
    elbowBall.position.y = -0.43;
    arm.add(elbowBall);
    // The forearm and claw hang off an elbow joint so the dance can bend it.
    const elbow = new THREE.Group();
    elbow.position.y = -0.43;
    arm.add(elbow);
    const fore = cyl(0.05, 0.045, 0.28, holo, 0, 0, 0.14, elbow, 14);
    fore.rotation.x = Math.PI / 2;
    const claw = new THREE.Group();
    claw.position.set(0, 0, 0.3);
    elbow.add(claw);
    const fingers = [-1, 1].map((f) => {
      const finger = box(0.025, 0.03, 0.11, holoPink, f * 0.035, 0, 0.05, claw);
      return finger;
    });
    return { arm, elbow, claw, fingers };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // neck + the big boxy head
  cyl(0.05, 0.06, 0.14, holoDim, 0, 0.69, 0, torso, 12);
  const head = new THREE.Group();
  head.position.y = 0.74;
  torso.add(head);
  box(0.54, 0.4, 0.42, holo, 0, 0.2, 0, head);
  box(0.46, 0.06, 0.36, holoDim, 0, 0.43, 0, head);
  const eyes = [-1, 1].map((s) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24), holo);
    rim.position.set(s * 0.13, 0.25, 0.212);
    head.add(rim);
    const eyeMesh = new THREE.Mesh(new THREE.CircleGeometry(0.072, 24), glowMaterial('#ff58d9'));
    eyeMesh.position.set(s * 0.13, 0.25, 0.214);
    head.add(eyeMesh);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glowMaterial('#ffffff'));
    pupil.position.set(s * 0.13, 0.25, 0.216);
    head.add(pupil);
    return eyeMesh;
  });
  const mouth = [0.07, 0.1, 0.13].map((y) => box(0.24, 0.016, 0.01, glowMaterial('#5fe8ff', 0.5), 0, y, 0.215, head));
  [-1, 1].forEach((s) => {
    const ear = cyl(0.075, 0.075, 0.06, holoDim, s * 0.3, 0.22, 0, head, 18);
    ear.rotation.z = Math.PI / 2;
  });
  const antennae = [-1, 1].map((s) => {
    const stalk = cyl(0.008, 0.008, 0.24, holo, s * 0.14, 0.52, 0, head, 6);
    stalk.rotation.z = -s * 0.35;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glowMaterial('#ffd27a'));
    tip.position.set(s * 0.18, 0.64, 0);
    head.add(tip);
    return tip;
  });

  addGlow(root, new THREE.Color('#5fe8ff'), 2.6, isTouch ? 0.22 : 0.1, new THREE.Vector3(0, 1.4, 0));

  // parts animated individually stay separate meshes
  [...eyes, ...mouth, ...antennae, ...chestLights, needle].forEach((m) => { m.userData.noBake = true; });
  scene.add(root);
  return {
    root, torso, head, armL, armR, eyes, mouth, antennae, chestLights, needle,
    yaw: 0, pitch: 0, flickerT: 0, blinkT: 0, waveT: 0, talkT: 0,
    inZone: false, lastGreet: -999, pending: null,
    dancing: false, danceW: 0, lastBeat: null, lastBar: null, beatFlash: 0
  };
}

// ── PRIZETRON's robot dance ──
// Poses are keyed to beats of the jukebox song (audio.beatClock()). Each beat
// the robot SNAPS into the next pose in a few hundredths of a second and then
// holds it — the stiff, ticking feel of "the robot". A new move starts every
// two bars, so changes land on the music's phrase boundaries.
//   arm x: 0 = hanging down, -π/2 = straight forward, -π = straight up
//   arm z: raises the arm sideways (right arm +, left arm −)
//   elbow: 0 = forearm forward (an L), −π/2 = forearm up, +π/2 = straight arm
const DANCE_REST = { rootY: 0, tY: 0, tZ: 0, hY: 0, hX: 0, hZ: 0, lX: -0.55, lZ: -0.08, lE: 0, rX: -0.55, rZ: 0.08, rE: 0, claw: 0.035 };
const robotPose = (o) => Object.assign({}, DANCE_REST, o);
// Moves keep the claws above the prize counter (≈1.2 m), which hides his
// lower half from the player.
const DANCE_MOVES = [
  { // THE ROBOT: elbows up at shoulder height, forearms tick up and down in turn
    name: 'ROBOT ARMS',
    pose: (n) => wrap(n, 2) === 0
      ? robotPose({ lX: -1.35, lZ: -0.35, lE: 0, rX: -1.35, rZ: 0.35, rE: 2.5, hY: 0.38, tY: 0.12 })
      : robotPose({ lX: -1.35, lZ: -0.35, lE: 2.5, rX: -1.35, rZ: 0.35, rE: 0, hY: -0.38, tY: -0.12 })
  },
  { // DISCO POINT: right arm points to the sky, then down across the body
    name: 'DISCO POINT',
    pose: (n) => wrap(n, 2) === 0
      ? robotPose({ rX: -2.55, rZ: 0.55, rE: 1.45, lX: -1.2, lZ: -0.5, lE: 0.2, hY: 0.3, hX: -0.32, tZ: -0.08 })
      : robotPose({ rX: -1.0, rZ: -0.5, rE: 1.45, lX: -1.2, lZ: -0.5, lE: 0.2, hY: -0.25, hX: 0.22, tZ: 0.06 })
  },
  { // POP & LOCK: torso ticks left, centre, right, centre; forearms flip up on 4
    name: 'POP & LOCK',
    pose: (n) => {
      const k = wrap(n, 4);
      const tY = [0.42, 0, -0.42, 0][k];
      const e = k === 3 ? 0 : 1.35;
      return robotPose({ tY, hY: -tY * 0.7, lX: -1.3, lZ: -0.2, lE: e, rX: -1.3, rZ: 0.2, rE: e, hX: k === 3 ? -0.18 : 0.05 });
    }
  },
  { // ARM WAVE: arms out to the sides, a ripple travels hand to hand
    name: 'ARM WAVE',
    smooth: true,
    pose: (n, f) => {
      const s = (wrap(n, 4) + f) / 2;                    // one ripple every two beats
      const a = Math.sin(s * Math.PI * 2);
      const b = Math.sin(s * Math.PI * 2 - Math.PI * 0.9);
      return robotPose({ lX: -0.1, lZ: -1.45 + a * 0.22, lE: a * 0.8, rX: -0.1, rZ: 1.45 + b * 0.22, rE: b * 0.8, hZ: (a - b) * 0.12, tZ: (b - a) * 0.05 });
    }
  },
  { // CLAW CLAP: arms forward, claws snap together on every beat, head bobs
    name: 'CLAW CLAP',
    pose: (n) => wrap(n, 2) === 0
      ? robotPose({ lX: -1.7, lZ: 0.2, lE: 1.4, rX: -1.7, rZ: -0.2, rE: 1.4, hX: 0.25, claw: 0.015 })
      : robotPose({ lX: -1.7, lZ: -0.55, lE: 1.4, rX: -1.7, rZ: 0.55, rE: 1.4, hX: -0.12, claw: 0.05 })
  },
  { // TREAD TURN: quarter-turn shuffle on the treads, punching forward each beat
    name: 'TREAD TURN',
    pose: (n) => {
      const k = wrap(n, 8);
      const rootY = [0.45, 0.9, 0.45, 0, -0.45, -0.9, -0.45, 0][k];
      return wrap(n, 2) === 0
        ? robotPose({ rootY, lX: -1.55, lZ: -0.1, lE: 1.5, rX: -1.3, rZ: 0.3, rE: 0, hY: -rootY * 0.4 })
        : robotPose({ rootY, lX: -1.3, lZ: -0.3, lE: 0, rX: -1.55, rZ: 0.1, rE: 1.5, hY: -rootY * 0.4 });
    }
  }
];
const DANCE_KEYS = Object.keys(DANCE_REST);
// Beat numbers go negative before a song's first beat, so wrap like a clock.
const wrap = (n, m) => ((n % m) + m) % m;

// Snap into a pose quickly, then hold it for the rest of the beat.
function danceSnap(f) {
  const k = Math.min(1, f / 0.14);
  return 1 - Math.pow(1 - k, 3);
}

// Falls back to an internal 112.5 BPM clock while the music is muted/paused,
// so he still dances, just to his own count.
function danceClock(t) {
  const c = audio && audio.ready ? audio.beatClock() : null;
  if (c && c.playing) return c;
  return { playing: false, bpm: 112.5, beat: t * 112.5 / 60, down: 0, level: 0.65, kick: false };
}

function dancePose(clock) {
  const barBeat = clock.beat - clock.down;          // beat 0 of the grid's first bar
  const n = Math.floor(barBeat);
  const f = barBeat - n;
  const moveOf = (beatIdx) => DANCE_MOVES[wrap(Math.floor(beatIdx / 8), DANCE_MOVES.length)];
  const move = moveOf(n);
  if (move.smooth) return { pose: move.pose(n, f), move, n, f };
  const prevMove = moveOf(n - 1);
  const from = prevMove.smooth ? prevMove.pose(n - 1, 0.999) : prevMove.pose(n - 1, 0);
  const to = move.pose(n, 0);
  const k = danceSnap(f);
  const out = {};
  DANCE_KEYS.forEach((key) => { out[key] = from[key] + (to[key] - from[key]) * k; });
  return { pose: out, move, n, f };
}

function updateRobot(dt, t) {
  if (!robot) return;
  holoUniforms.uTime.value = t;
  const r = robot;

  // hologram instability: occasional dropout + sideways jitter
  if (!reducedMotion && Math.random() < dt * 0.5) r.flickerT = 0.12 + Math.random() * 0.15;
  r.flickerT = Math.max(0, r.flickerT - dt);
  holoUniforms.uFlicker.value = r.flickerT > 0 ? 0.3 + Math.random() * 0.5 : 0.92 + Math.sin(t * 31) * 0.05;
  r.root.position.x = ROBOT_POS.x + (r.flickerT > 0 ? (Math.random() - 0.5) * 0.06 : 0);
  r.root.scale.y = r.flickerT > 0 ? 0.97 + Math.random() * 0.06 : 1;

  // the head follows the player wherever they walk
  const headWorld = r.head.getWorldPosition(tmpV1);
  const dx = camera.position.x - headWorld.x;
  const dz = camera.position.z - headWorld.z;
  const dy = camera.position.y - (headWorld.y + 0.22);
  const yaw = Math.max(-1.3, Math.min(1.3, Math.atan2(dx, dz)));
  const pitch = Math.max(-0.45, Math.min(0.5, -Math.atan2(dy, Math.hypot(dx, dz))));
  const k = 1 - Math.exp(-dt * 6);
  r.yaw += (yaw - r.yaw) * k;
  r.pitch += (pitch - r.pitch) * k;
  if (!Number.isFinite(r.yaw)) r.yaw = 0;
  if (!Number.isFinite(r.pitch)) r.pitch = 0;

  // dance when the player walks up to the counter (wider exit than entry)
  const dist = Math.hypot(player.pos.x - ROBOT_POS.x, player.pos.z - ROBOT_POS.z);
  if (gameState !== 'explore') r.dancing = false;
  else if (!r.dancing && dist < 8.5) r.dancing = true;
  else if (r.dancing && dist > 10.5) r.dancing = false;
  r.danceW += ((r.dancing ? 1 : 0) - r.danceW) * (1 - Math.exp(-dt * 4));
  const w = r.danceW < 0.002 ? 0 : r.danceW;

  // idle pose (what he did before the dance existed)
  r.waveT = Math.max(0, r.waveT - dt);
  r.talkT = Math.max(0, r.talkT - dt);
  const rest = -0.55 + Math.sin(t * 1.2) * 0.04;
  const idle = robotPose({
    tY: r.yaw * 0.3, hY: r.yaw * 0.7, hX: r.pitch,
    lX: rest, rX: rest + (r.talkT > 0 ? Math.sin(t * 7) * 0.12 : 0),
    claw: r.talkT > 0 ? 0.02 + Math.abs(Math.sin(t * 14)) * 0.03 : 0.035
  });

  let p = idle;
  let bounce = 0;
  let onBeat = false;
  if (w > 0) {
    const clock = danceClock(t);
    const { pose: dp, n, f, move } = dancePose(clock);
    r.danceMove = move.name;
    r.danceClock = clock;
    // Louder music (the drop) = bigger moves; quiet intros = smaller ones.
    const energy = clock.playing ? 0.6 + 0.4 * Math.min(1, clock.level * 1.15) : 0.85;
    const motion = reducedMotion ? 0.5 : 1;
    p = {};
    DANCE_KEYS.forEach((key) => {
      const target = DANCE_REST[key] + (dp[key] - DANCE_REST[key]) * energy * (key === 'rootY' ? motion : 1);
      p[key] = idle[key] + (target - idle[key]) * w;
    });
    // keep half an eye on the player while dancing
    p.hY += r.yaw * 0.3 * w;
    p.hX += r.pitch * 0.4 * w;
    bounce = Math.exp(-f * 7) * 0.045 * energy * w * motion;   // a dip on every beat
    if (r.lastBeat !== n) {
      onBeat = r.lastBeat !== null;
      r.lastBeat = n;
      r.beatFlash = 1;
      // the hologram glitches on each new 8-bar phrase
      const bar = Math.floor(n / 4);
      if (onBeat && bar !== r.lastBar && bar % 8 === 0 && !reducedMotion) r.flickerT = 0.1;
      r.lastBar = bar;
    }
  }
  r.beatFlash = Math.max(0, r.beatFlash - dt * 5);

  // the greeting wave wins over the dance for the right arm
  if (r.waveT > 0) {
    const ww = Math.min(1, r.waveT * 3);
    p.rX += (0 - p.rX) * ww; p.rE += (0 - p.rE) * ww;
    p.rZ += (2.3 + Math.sin(t * 12) * 0.3 - p.rZ) * ww;
  }

  // A non-finite value would hide him for good (it feeds back through the
  // head-follow), so drop a bad frame instead of applying it.
  if (!DANCE_KEYS.every((key) => Number.isFinite(p[key]))) p = idle;
  r.root.rotation.y = p.rootY;
  r.torso.position.y = 0.8 + Math.sin(t * 1.6) * 0.015 * (1 - w) - bounce;
  r.torso.rotation.set(0, p.tY, p.tZ);
  r.head.rotation.set(p.hX, p.hY, p.hZ);
  r.armL.arm.rotation.set(p.lX, 0, p.lZ);
  r.armR.arm.rotation.set(p.rX, 0, p.rZ);
  r.armL.elbow.rotation.x = p.lE;
  r.armR.elbow.rotation.x = p.rE;
  [r.armL, r.armR].forEach((a) => a.fingers.forEach((fg, i) => { fg.position.x = (i ? 1 : -1) * p.claw; }));

  // blink, chest lights, dial, antenna tips — they pulse to the beat while dancing
  r.blinkT -= dt;
  if (r.blinkT < -3 - Math.random() * 3) r.blinkT = 0.12;
  r.eyes.forEach((e) => { e.scale.y = r.blinkT > 0 ? 0.12 : 1; });
  if (w > 0.5) {
    const lit = wrap(r.lastBeat || 0, 3);
    r.chestLights.forEach((l, i) => { l.material.opacity = i === lit ? 0.35 + 0.6 * Math.max(r.beatFlash, 0.4) : 0.18; });
    r.antennae.forEach((a) => { a.material.opacity = 0.3 + 0.7 * r.beatFlash; });
    r.needle.rotation.z = (wrap(r.lastBeat || 0, 2) ? -0.7 : 0.7) * danceSnap(1 - r.beatFlash);
  } else {
    r.chestLights.forEach((l, i) => { l.material.opacity = Math.sin(t * (2 + i) + i * 2) > 0 ? 0.95 : 0.25; });
    r.needle.rotation.z = Math.sin(t * 1.3) * 0.9;
    r.antennae.forEach((a, i) => { a.material.opacity = Math.sin(t * 4 + i * Math.PI) > 0 ? 1 : 0.3; });
  }
  r.mouth.forEach((m, i) => { m.material.opacity = r.talkT > 0 ? (Math.sin(t * 22 + i) > 0 ? 1 : 0.2) : 0.45; });

  // greet the player when they walk up to the counter
  if (gameState !== 'explore') return;
  if (!r.inZone && dist < 7.5) {
    r.inZone = true;
    if (r.pending || elapsed - r.lastGreet > 25) {
      r.waveT = 1.6;
      robotSay(r.pending || greetingLine());
      r.pending = null;
      r.lastGreet = elapsed;
    }
  } else if (r.inZone && dist > 9.5) {
    r.inZone = false;
  }
}
const tmpV1 = new THREE.Vector3();

// ── What PRIZETRON-80 says ──
function nextGoal(w) {
  return PRIZES.find((p) => !w.prizes.includes(p.id) && p.cost > w.coins) || null;
}

function greetingLine() {
  const w = Wallet.get();
  if (w.prizes.length >= PRIZES.length) return 'YOU OWN EVERY PRIZE IN THE GLITCHCADE. MY CIRCUITS ARE... PROUD.';
  const affordable = PRIZES.filter((p) => !w.prizes.includes(p.id) && p.cost <= w.coins);
  if (w.coins === 0 && w.prizes.length === 0) {
    return `GREETINGS, HUMAN. I AM ${ROBOT_NAME}. BEAT THE AI AT GLITCH PONG FOR 10 COINS, OR PURGE SECTORS IN BREAKPOINT. COINS BUY PRIZES.`;
  }
  if (affordable.length) {
    return `WELCOME BACK. YOU HAVE ${w.coins} COINS — ENOUGH FOR ${affordable.length} PRIZE${affordable.length > 1 ? 'S' : ''}. AIM AT ONE ON MY SHELVES AND PRESS ${isTouch ? 'USE' : 'E'}.`;
  }
  const goal = nextGoal(w);
  const need = goal ? goal.cost - w.coins : 0;
  return `YOU HAVE ${w.coins} COINS. ${goal ? `THE ${goal.name} COSTS ${goal.cost} — ${need} MORE COIN${need > 1 ? 'S' : ''}.` : ''} THE CABINETS AWAIT.`;
}

function robotChat() {
  const w = Wallet.get();
  const lines = [
    greetingLine(),
    `EVERY MATCH YOU WIN AGAINST THE AI EARNS 10 COINS. YOU HAVE WON ${w.wins} SO FAR.`,
    'BREAKPOINT PAYS 2 COINS PER SECTOR PURGED. TAKE DOWN A BOSS AND I PAY 10. CABINET 02, BY THE DOOR.',
    `YOUR COLLECTION: ${w.prizes.length} OF ${PRIZES.length}. IT IS ON DISPLAY IN THE CASE TO MY LEFT.`,
    'TIP: LONG RALLIES BUILD HEAT. AT MAX HEAT THE EYE ARRIVES. SURVIVE IT.',
    ...(floor ? floor.robotLines(w) : [])
  ];
  robot.chatIndex = ((robot.chatIndex || 0) + 1) % lines.length;
  robot.waveT = robot.chatIndex === 0 ? 1.2 : 0;
  robotSay(lines[robot.chatIndex]);
}

let sayTimer = null;
let typeTimer = null;
function robotSay(text) {
  const box = $('gcRobotSay');
  const out = $('gcRobotText');
  if (!box || !robot) return;
  clearTimeout(sayTimer);
  clearInterval(typeTimer);
  box.classList.add('show');
  out.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    i += 2;
    out.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(typeTimer);
  }, 28);
  robot.talkT = Math.min(4, text.length * 0.03);
  audio.robotTalk(Math.min(16, Math.ceil(text.length / 7)));
  sayTimer = setTimeout(() => box.classList.remove('show'), 2600 + text.length * 45);
}

// ── Collectable models (built from primitives, about 0.45 m tall, origin at the base) ──
function standMat() {
  return new THREE.MeshStandardMaterial({ color: 0x1a1430, metalness: 0.5, roughness: 0.4 });
}

function makePrizeModel(id) {
  const g = new THREE.Group();
  g.userData.noBake = true;     // its parts animate
  let update = () => {};
  const emissive = (c, i = 0.9) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.35 });
  const base = () => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 24), standMat());
    b.position.y = 0.02;
    g.add(b);
  };
  if (id === 'paddle-keychain') {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.035), emissive(C.paddleBlue));
    paddle.position.y = 0.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 20), new THREE.MeshStandardMaterial({ color: 0xd8d8e8, metalness: 0.9, roughness: 0.25 }));
    ring.position.y = 0.38;
    g.add(paddle, ring);
    for (let i = 0; i < 3; i++) {
      const link = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), ring.material);
      link.position.y = 0.34 - i * 0.012;
      g.add(link);
    }
    base();
    update = (dt, t) => { g.rotation.z = Math.sin(t * 1.7) * 0.12; };
  } else if (id === 'glitch-ball') {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), emissive('#dfe6ff', 0.28));
    ball.position.y = 0.2;
    g.add(ball);
    const bits = [];
    for (let i = 0; i < 7; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), emissive(i % 2 ? C.pink : C.cyan, 1.2));
      g.add(bit);
      bits.push({ bit, a: (i / 7) * Math.PI * 2 });
    }
    base();
    update = (dt, t) => {
      bits.forEach((b, i) => {
        const jitter = Math.random() < 0.05 ? 0.04 : 0;
        b.bit.position.set(Math.cos(b.a + t) * (0.15 + jitter), 0.2 + Math.sin(t * 2 + i) * 0.08, Math.sin(b.a + t) * 0.15);
      });
    };
  } else if (id === 'heat-gauge') {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.04), standMat());
    plate.position.y = 0.14;
    g.add(plate);
    [C.cyan, C.amber, C.pink].forEach((c, i) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 16, Math.PI / 3), emissive(c, 1.1));
      arc.rotation.z = Math.PI - (i + 1) * Math.PI / 3;
      arc.position.set(0, 0.1, 0.03);
      g.add(arc);
    });
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 0.01), emissive('#ffffff', 1));
    needle.geometry.translate(0, 0.06, 0);
    needle.position.set(0, 0.1, 0.04);
    g.add(needle);
    update = (dt, t) => { needle.rotation.z = Math.sin(t * 0.9) * 1.2; };
  } else if (id === 'construct-hex') {
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 6), emissive('#58ecff', 1.2));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 6), emissive(C.purple, 1.2));
    outer.position.y = inner.position.y = 0.24;
    g.add(outer, inner);
    base();
    update = (dt, t) => { outer.rotation.y = t * 0.8; inner.rotation.y = -t * 1.1; };
  } else if (id === 'matrix-cube') {
    const cv = makeCanvas(128, 128);
    const cx = cv.getContext('2d');
    cx.fillStyle = '#021006';
    cx.fillRect(0, 0, 128, 128);
    cx.font = '16px monospace';
    const glyphs = 'アカサタナハマヤラワ01ｱｶｻ';
    for (let x = 4; x < 128; x += 14) {
      for (let y = 14; y < 128; y += 16) {
        cx.fillStyle = `rgba(80,250,123,${0.3 + Math.random() * 0.7})`;
        cx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], x, y);
      }
    }
    const tex = canvasTexture(cv);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    cube.position.y = 0.24;
    g.add(cube);
    base();
    update = (dt, t) => { cube.rotation.y = t * 0.7; cube.rotation.x = Math.sin(t * 0.5) * 0.3; cube.position.y = 0.24 + Math.sin(t * 1.4) * 0.02; };
  } else if (id === 'black-hole-globe') {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 24), standMat());
    stand.position.y = 0.04;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), new THREE.MeshStandardMaterial({ color: 0xb8a0ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false }));
    glass.position.y = 0.23;
    const disc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 32), emissive('#b100d3', 1.4));
    disc.position.y = 0.23;
    disc.rotation.x = Math.PI / 2.4;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    core.position.y = 0.23;
    g.add(stand, glass, disc, core);
    update = (dt, t) => { disc.rotation.z = t * 2.2; };
  } else if (id === 'mini-eye') {
    if (assets.eyeNeutral) {
      const t0 = new THREE.Texture(assets.eyeNeutral);
      t0.colorSpace = THREE.SRGBColorSpace;
      t0.needsUpdate = true;
      const eyeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t0, transparent: true, depthWrite: false }));
      eyeSprite.scale.set(0.42, 0.42, 1);
      eyeSprite.position.y = 0.25;
      g.add(eyeSprite);
    }
    const orbit = [];
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), emissive(i % 2 ? C.pink : C.cyan, 1.4));
      g.add(o);
      orbit.push(o);
    }
    base();
    update = (dt, t) => {
      orbit.forEach((o, i) => {
        const a = t * 1.6 + (i / 6) * Math.PI * 2;
        o.position.set(Math.cos(a) * 0.16, 0.25 + Math.sin(a) * 0.09, Math.sin(a) * 0.04);
      });
    };
  } else if (id === 'pixel-brick') {
    // Break Point: three bricks stacked off-kilter, the top one flickering
    const cols = ['#ff4d6d', '#ffd27a', '#71efff'];
    const bricks = cols.map((c, i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.09), emissive(c, 0.9));
      b.position.set((i - 1) * 0.025, 0.075 + i * 0.075, 0);
      b.rotation.y = (i - 1) * 0.25;
      g.add(b);
      return b;
    });
    base();
    update = (dt, t) => {
      bricks[2].material.emissiveIntensity = Math.random() < 0.04 ? 0.15 : 0.9 + Math.sin(t * 4) * 0.2;
      bricks[2].position.y = 0.225 + Math.sin(t * 1.8) * 0.012;
    };
  } else if (id === 'overclock-chip') {
    // Break Point: a CPU running hot, pins glowing in sequence
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.2), new THREE.MeshStandardMaterial({ color: 0x15121f, metalness: 0.6, roughness: 0.35 }));
    chip.position.y = 0.2;
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.09), emissive(C.amber, 1.1));
    die.position.y = 0.222;
    const tilt = new THREE.Group();
    tilt.position.y = 0;
    tilt.add(chip, die);
    const pins = [];
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 4; i++) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.01, 0.03), emissive('#ff9a00', 0.4));
        const off = -0.066 + i * 0.044;
        const a = side * Math.PI / 2;
        pin.position.set(Math.cos(a) * 0.115 - Math.sin(a) * off, 0.2, Math.sin(a) * 0.115 + Math.cos(a) * off);
        pin.rotation.y = -a;
        tilt.add(pin);
        pins.push(pin);
      }
    }
    g.add(tilt);
    base();
    update = (dt, t) => {
      tilt.rotation.y = t * 0.5;
      const hot = Math.floor(t * 12) % pins.length;
      pins.forEach((p, i) => { p.material.emissiveIntensity = i === hot ? 1.6 : 0.35; });
      die.material.emissiveIntensity = 0.9 + Math.sin(t * 9) * 0.3;
    };
  } else if (id === 'laser-paddle') {
    // Break Point: the laser paddle power-up, firing twin beams
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.06), emissive(C.cyan, 0.9));
    paddle.position.y = 0.12;
    const beams = [-1, 1].map((sd) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.2, 0.012), new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.9, toneMapped: false }));
      beam.position.set(sd * 0.1, 0.25, 0);
      g.add(beam);
      return beam;
    });
    g.add(paddle);
    base();
    update = (dt, t) => {
      const phase = (t * 1.5) % 1;
      beams.forEach((b, i) => {
        const p = (phase + i * 0.5) % 1;
        b.position.y = 0.16 + p * 0.22;
        b.material.opacity = 1 - p;
      });
    };
  } else if (id === 'eye-shard') {
    // Break Point: a crystal fragment of THE EYE with an iris glowing inside
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({
      color: 0xc9b6ff, emissive: C.purple, emissiveIntensity: 0.5, transparent: true, opacity: 0.55,
      roughness: 0.1, metalness: 0.2, flatShading: true, depthWrite: false
    }));
    shard.scale.set(0.8, 1.5, 0.8);
    shard.position.y = 0.25;
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), emissive(C.pink, 1.4));
    iris.position.y = 0.25;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pupil.position.set(0, 0.25, 0.03);
    g.add(shard, iris, pupil);
    base();
    update = (dt, t) => {
      shard.rotation.y = t * 0.6;
      const look = Math.sin(t * 0.8) * 0.02;
      pupil.position.x = look;
      shard.position.y = iris.position.y = pupil.position.y = 0.25 + Math.sin(t * 1.3) * 0.015;
    };
  } else if (id === 'golden-paddle') {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#7a5200', emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.25 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.16), standMat());
    plinth.position.y = 0.03;
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.12), gold);
    step.position.y = 0.08;
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.035), gold);
    paddle.position.set(-0.03, 0.24, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), gold);
    ball.position.set(0.06, 0.34, 0);
    g.add(plinth, step, paddle, ball);
    update = (dt, t) => { ball.position.y = 0.32 + Math.abs(Math.sin(t * 2.5)) * 0.06; };
  }
  return { group: g, update };
}

// Fade a shelf model to a ghost once it's been collected.
function setGhost(group, ghost) {
  group.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (m.userData.baseOpacity === undefined) {
        m.userData.baseOpacity = m.opacity;
        m.userData.baseTransparent = m.transparent;
      }
      m.transparent = ghost || m.userData.baseTransparent;
      m.opacity = ghost ? Math.min(0.16, m.userData.baseOpacity) : m.userData.baseOpacity;
      m.needsUpdate = true;
    });
  });
}

function drawPriceTag(tag, prize, owned, coins) {
  const { ctx, tex } = tag;
  ctx.fillStyle = '#0b0816';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = owned ? C.green : prize.cost <= coins ? C.amber : 'rgba(154,93,255,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 92);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 17px Orbitron, sans-serif';
  ctx.fillStyle = C.text;
  ctx.fillText(prize.name, 128, 30, 236);
  ctx.font = '900 30px Orbitron, sans-serif';
  if (owned) {
    ctx.fillStyle = C.green;
    ctx.fillText('COLLECTED ✓', 128, 66, 236);
  } else {
    ctx.fillStyle = prize.cost <= coins ? C.amber : '#b9a6e8';
    ctx.fillText(`◎ ${prize.cost}`, 128, 66);
  }
  tex.needsUpdate = true;
}

function buildPrizeCounter() {
  const back = -ROOM_D;
  const dark = new THREE.MeshStandardMaterial({ color: 0x120c22, roughness: 0.45, metalness: 0.35 });

  // ── the counter itself ──
  const cw = COUNTER.halfW * 2;
  const cd = COUNTER.front - COUNTER.back;
  const cz = (COUNTER.front + COUNTER.back) / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(cw, COUNTER.h, cd), dark);
  body.position.set(0, COUNTER.h / 2, cz);
  const top = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.12, 0.06, cd + 0.12), new THREE.MeshStandardMaterial({ color: 0x241a3e, roughness: 0.2, metalness: 0.5 }));
  top.position.set(0, COUNTER.h + 0.03, cz);
  scene.add(body, top);
  [[C.cyan, COUNTER.h + 0.065], [C.pink, 0.05]].forEach(([col, y]) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.12, 0.025, 0.025), neonMaterial(col));
    strip.position.set(0, y, COUNTER.front + 0.07);
    scene.add(strip);
  });
  addCollider(-COUNTER.halfW - 0.06, COUNTER.halfW + 0.06, COUNTER.back - 0.06, COUNTER.front + 0.06);

  // front banner
  const fcv = makeCanvas(1024, 128);
  const fctx = fcv.getContext('2d');
  const fg = fctx.createLinearGradient(0, 0, 1024, 0);
  fg.addColorStop(0, '#0a0614');
  fg.addColorStop(0.5, '#1d0f38');
  fg.addColorStop(1, '#0a0614');
  fctx.fillStyle = fg;
  fctx.fillRect(0, 0, 1024, 128);
  fctx.textAlign = 'center';
  fctx.textBaseline = 'middle';
  fctx.font = '900 46px Orbitron, "Arial Black", sans-serif';
  chromaText(fctx, 'PRIZE COUNTER', 512, 50, 3, C.text, C.purple);
  fctx.font = '20px "Share Tech Mono", monospace';
  fctx.fillStyle = C.amber;
  fctx.fillText('◎ GLITCH PONG WIN = 10   ◎   BREAKPOINT SECTOR = 2 · BOSS = 10   ◎', 512, 98);
  scanlines(fctx, 1024, 128, 0.14, 4);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.3, 0.72), new THREE.MeshBasicMaterial({ map: canvasTexture(fcv), color: 0xcccccc, toneMapped: false }));
  banner.position.set(0, 0.55, COUNTER.front + 0.004);
  scene.add(banner);

  // little screen on the counter showing your balance
  const dcv = makeCanvas(256, 128);
  counterDisplay = { ctx: dcv.getContext('2d'), tex: canvasTexture(dcv) };
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: counterDisplay.tex, toneMapped: false }));
  screen.position.set(-2.3, COUNTER.h + 0.22, COUNTER.front - 0.25);
  screen.rotation.x = -0.35;
  const screenBack = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.36, 0.05), dark);
  screenBack.position.copy(screen.position).add(new THREE.Vector3(0, 0, -0.03));
  screenBack.rotation.x = -0.35;
  scene.add(screenBack, screen);

  // staff-only partitions so you can't wander behind the counter
  [-1, 1].forEach((s) => {
    const x = s * (COUNTER.halfW + 0.15);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, back - COUNTER.back), dark);
    wall.position.set(x, 0.55, (back + COUNTER.back) / 2);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, back - COUNTER.back), neonMaterial(C.purple, 0.8));
    cap.position.set(x, 1.11, (back + COUNTER.back) / 2);
    scene.add(wall, cap);
    addCollider(x - 0.1, x + 0.1, back, COUNTER.back);
  });

  // ── prize shelves against the back wall ──
  const shelfZ = back + 0.32;
  const rows = [1.18, 1.98];
  const columns = [-3.33, -2.43, -1.53, 1.53, 2.43, 3.33];
  [-1, 1].forEach((s) => {
    const cx = s * 2.43;
    const unit = new THREE.Group();
    unit.position.set(cx, 0, shelfZ);
    scene.add(unit);
    const sideMat = dark;
    [-1, 1].forEach((e) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.7, 0.55), sideMat);
      side.position.set(e * 1.37, 1.35, 0);
      unit.add(side);
    });
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.7, 0.04), matte({ color: 0x1b1033, roughness: 0.8 }));
    backPanel.position.set(0, 1.35, -0.26);
    unit.add(backPanel);
    [0.6, ...rows, 2.7].forEach((y, i) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.05, 0.52), sideMat);
      board.position.set(0, y - 0.025, 0);
      unit.add(board);
      if (i > 0 && i < 3) {
        const lip = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.02, 0.02), neonMaterial(s < 0 ? C.cyan : C.pink, 0.9));
        lip.position.set(0, y - 0.05, 0.26);
        unit.add(lip);
      }
    });
  });

  PRIZES.forEach((prize, i) => {
    const row = i < PRIZES_PER_ROW ? 0 : 1;
    const x = columns[i % PRIZES_PER_ROW];
    const y = rows[row];
    const model = makePrizeModel(prize.id);
    model.group.position.set(x, y, shelfZ + 0.02);
    model.group.scale.setScalar(1.1);
    scene.add(model.group);
    const tcv = makeCanvas(256, 96);
    const tag = { ctx: tcv.getContext('2d'), tex: canvasTexture(tcv) };
    const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.21), new THREE.MeshBasicMaterial({ map: tag.tex, toneMapped: false }));
    tagMesh.position.set(x, y - 0.16, shelfZ + 0.275);
    scene.add(tagMesh);
    prizeSlots.push({ kind: 'prize', prize, model, tag, center: new THREE.Vector3(x, y + 0.26, shelfZ), radius: 0.32 });
  });

  robot = buildRobot();
  buildCollectionCase();
  refreshPrizes();

  let prizesShown = true;
  animated.push((dt, t) => {
    const near = camera.position.z < -12;
    if (near !== prizesShown) {
      prizesShown = near;
      prizeSlots.forEach((s) => { s.model.group.visible = near; });
      caseSlots.forEach((s) => { s.anchor.visible = near; });
    }
    updateRobot(dt, t);
    if (!near) return;
    prizeSlots.forEach((s) => s.model.update(dt, t));
    caseSlots.forEach((s) => {
      if (s.model) {
        s.model.update(dt, t);
        s.model.group.scale.setScalar(Math.min(1, (elapsed - s.popT) / 0.5));   // pops into the case
      }
      if (s.placeholder) s.placeholder.rotation.y = t * 0.6;
    });
  });

  interactables.push({
    kind: 'robot',
    scale: 1,
    position: new THREE.Vector3(0, 0, COUNTER.front),
    forward: new THREE.Vector3(0, 0, 1),
    screenCenter: new THREE.Vector3(0, 1.75, ROBOT_POS.z)
  });
}

// ── The player's own trophy case: redeemed prizes show up here ──
function buildCollectionCase() {
  const group = new THREE.Group();
  group.position.set(CASE_SPOT.x, 0, CASE_SPOT.z);
  group.rotation.y = CASE_SPOT.rot;
  scene.add(group);
  const W = 2.7, D = 0.85;
  const baseBox = new THREE.Mesh(new THREE.BoxGeometry(W, 0.9, D), new THREE.MeshStandardMaterial({ color: 0x120c22, roughness: 0.45, metalness: 0.35 }));
  baseBox.position.y = 0.45;
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 1.15, 0.04), matte({ color: 0x1b1033, roughness: 0.8 }));
  inner.position.set(0, 1.475, -D / 2 + 0.04);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W, 1.15, D), new THREE.MeshStandardMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.08, roughness: 0.05, depthWrite: false }));
  glass.position.y = 1.475;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 1.15, D)), new THREE.LineBasicMaterial({ color: C.cyan, toneMapped: false }));
  edges.position.y = 1.475;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.02, D - 0.06), new THREE.MeshStandardMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.2, depthWrite: false }));
  shelf.position.y = 1.47;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.06, D + 0.06), new THREE.MeshStandardMaterial({ color: 0x120c22, roughness: 0.45 }));
  lid.position.y = 2.08;
  const caseLight = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.02, 0.04), neonMaterial('#ffffff', 0.8));
  caseLight.position.set(0, 2.03, 0.2);
  group.add(baseBox, inner, glass, edges, shelf, lid, caseLight);

  const pcv = makeCanvas(512, 96);
  casePlate = { ctx: pcv.getContext('2d'), tex: canvasTexture(pcv) };
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshBasicMaterial({ map: casePlate.tex, toneMapped: false }));
  plate.position.set(0, 2.35, 0.1);
  group.add(plate);

  const xs = [-1.1, -0.66, -0.22, 0.22, 0.66, 1.1];
  PRIZES.forEach((prize, i) => {
    const anchor = new THREE.Group();
    anchor.userData.noBake = true;
    anchor.position.set(xs[i % PRIZES_PER_ROW], i < PRIZES_PER_ROW ? 0.92 : 1.49, 0.05);
    group.add(anchor);
    const placeholder = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.16, 0.16, 0.16)),
      new THREE.LineBasicMaterial({ color: 0x5a4a8a, transparent: true, opacity: 0.6 })
    );
    placeholder.position.y = 0.16;
    anchor.add(placeholder);
    caseSlots.push({ prize, anchor, placeholder, model: null });
  });

  group.updateMatrixWorld(true);
  const corners = [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]].map(([lx, lz]) =>
    new THREE.Vector3(lx, 0, lz).applyAxisAngle(UP, CASE_SPOT.rot).add(group.position));
  addCollider(
    Math.min(...corners.map((c) => c.x)), Math.max(...corners.map((c) => c.x)),
    Math.min(...corners.map((c) => c.z)), Math.max(...corners.map((c) => c.z))
  );
  addFloorGlow(scene, new THREE.Color(C.cyan), 3.2, 1.6,
    group.position.x + Math.sin(CASE_SPOT.rot) * 0.9, group.position.z + Math.cos(CASE_SPOT.rot) * 0.9, 0.25);

  interactables.push({
    kind: 'collection',
    scale: 1.2,
    position: group.position.clone(),
    forward: new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, CASE_SPOT.rot),
    screenCenter: new THREE.Vector3(0, 1.45, 0).applyMatrix4(group.matrixWorld)
  });
}

// Sync shelves, case, counter screen and HUD with the wallet.
function refreshPrizes() {
  const w = Wallet.get();
  refreshMenuStats(w);
  const firstSync = !refreshPrizes.ran;
  refreshPrizes.ran = true;
  prizeSlots.forEach((s) => {
    const owned = w.prizes.includes(s.prize.id);
    drawPriceTag(s.tag, s.prize, owned, w.coins);
    if (s.ghost !== owned) {
      setGhost(s.model.group, owned);
      s.ghost = owned;
    }
  });
  caseSlots.forEach((s) => {
    const owned = w.prizes.includes(s.prize.id);
    s.animatePop = !firstSync;    // only animate prizes redeemed after load
    if (owned && !s.model) {
      s.model = makePrizeModel(s.prize.id);
      s.anchor.add(s.model.group);
      s.placeholder.visible = false;
      s.popT = s.animatePop ? elapsed : -1;
    }
  });
  if (counterDisplay) {
    const { ctx, tex } = counterDisplay;
    ctx.fillStyle = '#05040c';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 124);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px "Share Tech Mono", monospace';
    ctx.fillStyle = '#b9a6e8';
    ctx.fillText('YOUR COINS', 128, 26);
    ctx.font = '64px VT323, monospace';
    ctx.fillStyle = C.amber;
    ctx.fillText(`◎ ${w.coins}`, 128, 78);
    scanlines(ctx, 256, 128, 0.2, 3);
    tex.needsUpdate = true;
  }
  if (casePlate) {
    const { ctx, tex } = casePlate;
    ctx.fillStyle = '#0b0816';
    ctx.fillRect(0, 0, 512, 96);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px Orbitron, "Arial Black", sans-serif';
    chromaText(ctx, `MY COLLECTION ${w.prizes.length}/${PRIZES.length}`, 256, 50, 2, C.text, C.cyan);
    tex.needsUpdate = true;
  }
  updateCoinHud(w);
}

function updateCoinHud(w = Wallet.get()) {
  const el = $('gcCoins');
  if (!el) return;
  el.innerHTML = `<b>◎ ${w.coins}</b> COINS <i>//</i> ${w.prizes.length}/${PRIZES.length} PRIZES`;
}

function pulseCoinHud() {
  const el = $('gcCoins');
  if (!el) return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function redeemPrize(slot) {
  const w = Wallet.get();
  const p = slot.prize;
  if (w.prizes.includes(p.id)) {
    robotSay(`YOU ALREADY OWN THE ${p.name}. IT IS ON DISPLAY IN YOUR COLLECTION CASE.`);
    return;
  }
  if (w.coins < p.cost) {
    const need = p.cost - w.coins;
    audio.deny();
    robotSay(`INSUFFICIENT COINS. THE ${p.name} NEEDS ${need} MORE — THAT IS ${Math.ceil(need / 10)} MORE WIN${need > 10 ? 'S' : ''}. THE EYE AWAITS.`);
    return;
  }
  const after = Wallet.redeem(p.id, p.cost);
  if (!after) return;
  audio.redeem();
  pulseCoinHud();
  robot.waveT = 1.2;
  const done = after.prizes.length >= PRIZES.length;
  robotSay(done
    ? `THE ${p.name} IS YOURS. THAT COMPLETES THE ENTIRE COLLECTION. YOU ARE A GLITCHCADE LEGEND.`
    : `EXCELLENT CHOICE! THE ${p.name} IS YOURS. ${after.coins} COINS REMAINING.`);
  toast(`PRIZE COLLECTED: ${p.name} (${after.prizes.length}/${PRIZES.length})`);
  refreshPrizes();
}

// Ray from the crosshair against the shelf prizes (closest hit wins).
function pickPrize() {
  if (!atPrizeCounter()) return null;
  const dir = camera.getWorldDirection(tmpV1);
  const o = camera.position;
  let best = null;
  let bestT = 6;
  for (const s of prizeSlots) {
    const cx = s.center.x - o.x, cy = s.center.y - o.y, cz = s.center.z - o.z;
    const t = cx * dir.x + cy * dir.y + cz * dir.z;
    if (t < 0 || t > bestT) continue;
    const d2 = cx * cx + cy * cy + cz * cz - t * t;
    if (d2 < s.radius * s.radius) { bestT = t; best = s; }
  }
  return best;
}

// Small things you aim at rather than walk up to (the capsule machine, the
// record crate, the ball): { center, radius, range, prompt, use }. The nearest
// one under the crosshair wins, and it beats a shelf prize behind it.
const rayTargets = [];
function pickRayTarget(maxT = Infinity) {
  const dir = camera.getWorldDirection(tmpV1);
  const o = camera.position;
  let best = null;
  let bestT = maxT;
  for (const s of rayTargets) {
    if (s.hidden) continue;
    const cx = s.center.x - o.x, cy = s.center.y - o.y, cz = s.center.z - o.z;
    const t = cx * dir.x + cy * dir.y + cz * dir.z;
    if (t < 0 || t > Math.min(bestT, s.range || 3)) continue;
    const d2 = cx * cx + cy * cy + cz * cz - t * t;
    if (d2 < s.radius * s.radius) { bestT = t; best = s; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER (first-person character)
// ═══════════════════════════════════════════════════════════════════════════
const player = {
  pos: new THREE.Vector3(0, 0, 10.5),     // feet
  vel: new THREE.Vector3(),
  vy: 0,
  camY: 0,
  lastZ: 10.5,
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
    const dx = x - p.cx, dz = z - p.cz;
    const lx = dx * Math.cos(p.rot) - dz * Math.sin(p.rot);
    const lz = dx * Math.sin(p.rot) + dz * Math.cos(p.rot);
    if (Math.abs(lx) < p.hw && Math.abs(lz) < p.hd) return p.h;
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

  // walking through the glitch curtain
  if (Math.abs(player.pos.x) < DOOR_W / 2 && Math.sign(player.pos.z - WALL_T / 2) !== Math.sign(player.lastZ - WALL_T / 2)) {
    audio.doorway(new THREE.Vector3(0, 1.6, WALL_T / 2));
  }
  player.lastZ = player.pos.z;

  const floorY = floorHeightAt(player.pos.x, player.pos.z);
  const wasGrounded = player.grounded;
  player.vy -= GRAVITY * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= floorY) {
    if (!wasGrounded && player.vy < -2) audio.land(player.vy < -7);
    player.pos.y = floorY;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = player.pos.y - floorY < 0.02;
  }
  // ease the camera over small steps (the stage) instead of popping
  player.camY = player.grounded ? player.camY + (player.pos.y - player.camY) * Math.min(1, dt * 14) : player.pos.y;

  const moving = Math.hypot(player.vel.x, player.vel.z);
  if (moving > 0.15 || !player.grounded || joy.id !== null || lookTouch) noteActivity();
  if (player.grounded && moving > 0.3) {
    const step = Math.floor(player.bob / Math.PI);
    player.bob += dt * moving * 2.4;
    if (Math.floor(player.bob / Math.PI) !== step) audio.footstep(surfaceAt(player.pos));
  }
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

function surfaceAt(pos) {
  if (pos.z < WALL_T / 2 && Math.abs(pos.x) < ROOM_W / 2) return floorHeightAt(pos.x, pos.z) > 0 ? 'stage' : 'carpet';
  return pos.z < 6 ? 'sidewalk' : 'asphalt';
}

function jump() {
  if (gameState !== 'explore' || !player.grounded) return;
  player.vy = JUMP_SPEED;
  player.grounded = false;
  audio.jump();
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTION
// ═══════════════════════════════════════════════════════════════════════════
let focused = null;
let toastTimer = null;

const focusLook = new THREE.Vector3();
const focusTo = new THREE.Vector3();
function findFocus() {
  const prize = pickPrize();
  const target = pickRayTarget(prize ? camera.position.distanceTo(prize.center) : Infinity);
  if (target) return target;
  if (prize) return prize;
  const look = camera.getWorldDirection(focusLook);
  let best = null;
  let bestScore = -Infinity;
  for (const cab of interactables) {
    const rx = player.pos.x - cab.position.x, rz = player.pos.z - cab.position.z;
    const dist = Math.hypot(rx, rz);
    if (cab.hidden || dist > INTERACT_RANGE * cab.scale) continue;
    // must be in front of the machine, not behind/beside it
    if (!cab.omni && (rx * cab.forward.x + rz * cab.forward.z) / (dist || 1) < 0.5) continue;
    const facing = look.dot(focusTo.subVectors(cab.screenCenter, camera.position).normalize());
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
  audio.hover();
  const key = isTouch ? 'USE' : 'E';
  const w = Wallet.get();
  // Things the floor module added (and cabinets it has taken over) describe themselves.
  const custom = focused.prompt ? focused.prompt(key, w) : null;
  if (custom) {
    promptEl.className = custom.soon ? 'show soon' : 'show';
    promptEl.innerHTML = `<span class="key">${custom.key || key}</span>${custom.title}<small>${custom.sub || ''}</small>`;
  } else if (focused.kind === 'prize') {
    const p = focused.prize;
    if (w.prizes.includes(p.id)) {
      promptEl.className = 'show';
      promptEl.innerHTML = `<span class="key">✓</span>${p.name}<small>COLLECTED // ON DISPLAY IN YOUR CASE</small>`;
    } else if (w.coins >= p.cost) {
      promptEl.className = 'show';
      promptEl.innerHTML = `<span class="key">${key}</span>REDEEM ${p.name}<small>◎ ${p.cost} COINS // YOU HAVE ${w.coins}</small>`;
    } else {
      promptEl.className = 'show soon';
      const wins = Math.ceil((p.cost - w.coins) / 10);
      promptEl.innerHTML = `<span class="key">${key}</span>${p.name}<small>◎ ${p.cost} COINS // NEED ${p.cost - w.coins} MORE (${wins} WIN${wins > 1 ? 'S' : ''})</small>`;
    }
  } else if (focused.kind === 'robot') {
    promptEl.className = 'show';
    promptEl.innerHTML = `<span class="key">${key}</span>TALK TO ${ROBOT_NAME}<small>◎ ${w.coins} COINS // ${w.prizes.length}/${PRIZES.length} PRIZES</small>`;
  } else if (focused.kind === 'collection') {
    promptEl.className = 'show';
    promptEl.innerHTML = `<span class="key">${key}</span>MY COLLECTION<small>${w.prizes.length}/${PRIZES.length} PRIZES COLLECTED</small>`;
  } else if (focused.kind === 'jukebox') {
    promptEl.className = 'show';
    promptEl.innerHTML = `<span class="key">${key}</span>CHOOSE A TRACK<small>JUKEBOX // ${audio.trackTitle}</small>`;
  } else if (focused.id === 'breakpoint') {
    promptEl.className = 'show';
    promptEl.innerHTML = `<span class="key">${key}</span>PLAY BREAKPOINT<small>CABINET 02 // ONLINE</small>`;
  } else if (focused.playable) {
    promptEl.className = 'show';
    promptEl.innerHTML = `<span class="key">${key}</span>PLAY GLITCH PONG<small>CABINET 01 // ONLINE</small>`;
  } else {
    promptEl.className = 'show soon';
    promptEl.innerHTML = `<span class="key">${key}</span>${focused.title}<small>CABINET ${String(focused.slot).padStart(2, '0')} // COMING SOON</small>`;
  }
}

function toast(text, ms = 2400) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function interact() {
  if (gameState !== 'explore' || !focused) return;
  noteActivity(1200);
  if (arms) arms.reach = 1;
  if (focused.use) {
    const target = focused;
    focused = null;            // whatever it did, redraw the prompt afterwards
    if (target.use() !== false) return;
    focused = target;          // it declined: fall through to the default behaviour
  }
  if (focused.kind === 'prize') {
    redeemPrize(focused);
    focused = null;            // refresh the prompt with the new balance
    return;
  }
  if (focused.kind === 'robot') {
    robotChat();
    return;
  }
  if (focused.kind === 'collection') {
    const w = Wallet.get();
    const goal = nextGoal(w);
    robotSay(w.prizes.length
      ? `YOUR CASE HOLDS ${w.prizes.length} OF ${PRIZES.length} PRIZES.${goal ? ` NEXT UP: THE ${goal.name} FOR ${goal.cost} COINS.` : ''}`
      : 'YOUR COLLECTION CASE IS EMPTY. WIN AT GLITCH PONG OR BREAKPOINT AND COME SEE ME.');
    return;
  }
  if (focused.kind === 'jukebox') {
    if (floor) { floor.openJukebox(); focused = null; return; }
    const title = audio.nextTrack();
    if (title) toast(`NOW PLAYING: ${title}`);
    focused = null;            // refresh the prompt with the new title
    return;
  }
  if (focused.id === 'breakpoint') {
    launchBreakPoint(focused);
    return;
  }
  if (focused.playable) {
    launchGlitchPong(focused);
    return;
  }
  const cab = focused;
  audio.comingSoon(cab.screenCenter);
  toast(`${cab.title} (CABINET ${String(cab.slot).padStart(2, '0')}) IS COMING SOON — this machine is still compiling.`);
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
  audio.glitch(small);
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
  if (bpScreen) bpScreen.burst();
  setTimeout(() => {
    neonSigns.forEach((sg) => sg.draw(false));
    if (infoBoard) infoBoard.draw(false);
  }, 260);
}

// ═══════════════════════════════════════════════════════════════════════════
// TITLE MENU FOOTAGE — security-cam shots touring the arcade behind the menu
// ═══════════════════════════════════════════════════════════════════════════
// Each shot dollies the camera from `from` to `to` while it looks from `look`
// toward `lookTo`, then hard-cuts (with a glitch) to the next. Shots aimed at
// a cabinet are worked out from where that cabinet stands.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let tourShots = [];
const tour = { i: 0, t: 0, tc: 0, labelled: -1 };

function cabinetShot(cam, label, cab, side) {
  const right = V(0, 1, 0).cross(cab.forward).normalize().multiplyScalar(side);
  const at = cab.screenCenter.clone();
  return {
    cam, label,
    from: at.clone().addScaledVector(cab.forward, 2.7).addScaledVector(right, 1.4).setY(at.y + 0.5),
    to: at.clone().addScaledVector(cab.forward, 1.5).addScaledVector(right, -0.3).setY(at.y + 0.1),
    look: at.clone().setY(at.y - 0.05),
    lookTo: at.clone()
  };
}

function buildTour() {
  const bp = cabinets.find((c) => c.id === 'breakpoint');
  const gp = cabinets.find((c) => c.id === 'glitch-pong');
  tourShots = [
    { cam: 'CAM 01', label: 'STREET // FRONT ENTRANCE', from: V(1.6, 1.8, 14), to: V(0.2, 1.7, 6.5), look: V(0, 4.2, 0), lookTo: V(0, 2.6, -4) },
    { cam: 'CAM 02', label: 'MAIN FLOOR', from: V(0, 2.5, -1.2), to: V(0, 2.1, -9.5), look: V(0, 1.6, -20), lookTo: V(0, 1.7, -28) },
    cabinetShot('CAM 03', 'CABINET 02 // BREAKPOINT', bp, 1),
    { cam: 'CAM 04', label: 'GLITCHVISION // CEILING FEEDS', from: V(1.9, 2.3, -11.4), to: V(-1.5, 2.6, -12.3), look: V(0, TV_Y - 0.1, -15), lookTo: V(0, TV_Y - 0.1, -15) },
    cabinetShot('CAM 05', 'CABINET 01 // GLITCH PONG', gp, -1),
    { cam: 'CAM 06', label: 'PRIZE COUNTER // PRIZETRON-80', from: V(2.8, 1.8, -24.2), to: V(-2.4, 1.7, -25.6), look: V(0, 1.7, -30.4), lookTo: V(0, 1.6, -30.4) },
    { cam: 'CAM 07', label: 'CABINETS 03–10 // COMPILING', from: V(5.6, 2.0, -2.5), to: V(5.8, 1.7, -14), look: V(9.4, 1.3, -6), lookTo: V(9.4, 1.3, -17) }
  ];
}

const tourLook = new THREE.Vector3();
function updateTour(dt) {
  if (!tourShots.length) return;
  const dur = reducedMotion ? 9 : 6.5;
  tour.t += dt;
  tour.tc += dt;
  if (tour.t >= dur) {
    tour.t = 0;
    tour.i = (tour.i + 1) % tourShots.length;
    if (!reducedMotion) {   // a glitch cut, picture only (the arcade's sound may not be unlocked yet)
      root.classList.remove('gc-glitch');
      void root.offsetWidth;
      root.classList.add('gc-glitch');
      setTimeout(() => root.classList.remove('gc-glitch'), 340);
    }
  }
  const shot = tourShots[tour.i];
  const k = tour.t / dur;
  const e = k * k * (3 - 2 * k);                      // ease in and out of each move
  camera.position.lerpVectors(shot.from, shot.to, reducedMotion ? k * 0.5 : e);
  tourLook.lerpVectors(shot.look, shot.lookTo, e);
  camera.lookAt(tourLook);
  if (tour.labelled !== tour.i) {
    tour.labelled = tour.i;
    $('gcCamId').textContent = shot.cam;
    $('gcCamLabel').textContent = shot.label;
  }
  const f = Math.floor(tour.tc * 30);
  const pad = (n) => String(n).padStart(2, '0');
  $('gcTimecode').textContent = `${pad(Math.floor(f / 108000))}:${pad(Math.floor(f / 1800) % 60)}:${pad(Math.floor(f / 30) % 60)}:${pad(f % 30)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME HAND-OFF
// ═══════════════════════════════════════════════════════════════════════════
// intro → explore ⇄ paused → launching → playing → (exit) → paused/explore
// 'busy' is the floor module's: you're at the air hockey table, in a menu, in
// photo mode or inside a ROM fragment. The arcade keeps running, you don't walk.
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
  beginLaunch(cab);
}

function launchBreakPoint(cab) {
  beginLaunch(cab);
}

// Fly the camera into the cabinet's screen; updateLaunch starts the game on arrival.
// `onArrive` replaces the game start (ROM fragments run in their own overlay).
function beginLaunch(cab, onArrive = null) {
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
    coinsBefore: Wallet.get().coins,
    t: 0,
    dur: 0.85,
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos: target,
    toQuat: look.quaternion.clone(),
    cab,
    onArrive,
    started: false
  };
  audio.launch();
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
  // a cabinet can stand in for one of the two games (the Eye gauntlet does)
  const isBreakPoint = (launch.cab.game || launch.cab.id) === 'breakpoint';
  if (k >= 1 && !launch.started) {
    launch.started = true;
    if (launch.onArrive) {
      document.body.classList.remove('gc-launching');
      gameState = 'busy';
      launch.onArrive();
      return;
    }
    if (isBreakPoint) {
      bpScreen.burst();
      openBreakPoint(launch.cab.bpQuery || '');
    } else {
      pongScreen.burst();
      const ok = window.GlitchPong.launch({ onExit: onGameExit });
      if (!ok) { onGameExit(); return; }
    }
  }
  if (!launch.started || launch.onArrive) return;
  if (isBreakPoint) {
    // Break Point's page has loaded in its frame
    if (bpFrame && bpFrame.dataset.ready) {
      gameState = 'playing';
      root.classList.add('gc-hidden');
      document.body.classList.remove('gc-launching');
      document.body.classList.add('bp-playing');
      try { bpFrame.contentWindow.focus(); } catch (e) {}
    }
  } else if (document.getElementById('__glitchcade_overlay')) {
    // Glitch Pong's own glitch transition runs ~1s, then its overlay appears
    gameState = 'playing';
    root.classList.add('gc-hidden');
    document.body.classList.remove('gc-launching');
    document.body.classList.add('gp-playing');
  }
}

// ── Break Point runs as its own page in a full-screen frame over the arcade ──
// It's served from ./breakpoint/ (same origin, so it shares the coin wallet) and
// posts {type: 'glitchcade:exit'} when the player picks EXIT TO ARCADE.
const BREAKPOINT_URL = 'breakpoint/index.html?cabinet';
let bpFrame = null;

function openBreakPoint(query = '') {
  closeBreakPoint();
  bpFrame = document.createElement('iframe');
  bpFrame.id = 'gcBreakPoint';
  bpFrame.title = 'Breakpoint';
  bpFrame.allow = 'autoplay; fullscreen';
  bpFrame.addEventListener('load', () => {
    // A missing build loads an error page instead of the game: back out rather
    // than strand the player in a frame with no way to exit.
    let ok = false;
    try { ok = !!bpFrame.contentDocument.getElementById('game'); } catch (e) {}
    if (!ok) {
      closeBreakPoint();
      onGameExit();
      toast('BREAKPOINT FAILED TO LOAD — try refreshing.');
      return;
    }
    bpFrame.dataset.ready = '1';
  });
  bpFrame.src = BREAKPOINT_URL + query;
  document.body.appendChild(bpFrame);
}

function closeBreakPoint() {
  if (!bpFrame) return;
  bpFrame.remove();
  bpFrame = null;
}

window.addEventListener('message', (e) => {
  if (!bpFrame || e.source !== bpFrame.contentWindow || e.origin !== location.origin) return;
  // run results, for the high-score board and the Eye gauntlet
  if (e.data && e.data.type === 'glitchcade:breakpoint' && floor) { floor.onBreakpointReport(e.data, launch && launch.cab); return; }
  if (!e.data || e.data.type !== 'glitchcade:exit') return;
  if (gameState !== 'playing' && gameState !== 'launching') return;
  closeBreakPoint();
  onGameExit();
});

function onGameExit() {
  const cab = launch ? launch.cab : cabinets.find((c) => c.id === 'glitch-pong');
  const wallet = Wallet.get();
  const gained = launch ? wallet.coins - launch.coinsBefore : 0;
  launch = null;
  document.body.classList.remove('gp-playing', 'bp-playing', 'gc-launching');
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
  audio.unlock(audioWorld);
  audio.welcomeBack();
  worldGlitch();
  lastFrame = performance.now();
  refreshPrizes();
  if (floor) floor.onGameExit(cab, gained);
  if (gained > 0) {
    audio.coin();
    pulseCoinHud();
    toast(`+${gained} COINS! YOU HAVE ${wallet.coins}. REDEEM THEM AT THE PRIZE COUNTER.`);
    if (robot && !cab.fragment) {
      robot.pending = (cab.game || cab.id) === 'breakpoint'
        ? `SECTORS PURGED. +${gained} COINS. YOU NOW HAVE ${wallet.coins}. COME SEE WHAT THEY BUY.`
        : `VICTORY DETECTED. +${gained} COINS. YOU NOW HAVE ${wallet.coins}. COME SEE WHAT THEY BUY.`;
      robot.inZone = false;
    }
  }

  if (isTouch) {
    gameState = 'explore';
    setExploring(true);
  } else {
    const name = cab.fragment || cab.game ? cab.title : cab.id === 'breakpoint' ? 'Breakpoint' : 'Glitch Pong';
    showPauseCard('Welcome back', 'GLITCHCADE', `${name} is waiting whenever you are.`, 'Continue');
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

function toggleMute() {
  const m = audio.toggleMute();
  muteBtn.classList.toggle('muted', m);
  muteBtn.setAttribute('aria-pressed', String(m));
  muteBtn.setAttribute('aria-label', m ? 'Unmute arcade sound' : 'Mute arcade sound');
}
// ── Battery saver: the player's switch (shared with Glitch Pong and Breakpoint) plus a
// low-battery check. It slows the frame rate, lowers the resolution ceiling and
// hides the additive glow decals, the biggest fill-rate cost in the scene. ──
const glowDecals = [];                       // filled once the world is baked
const saverButtons = ['gcSaver', 'gcMenuSaver'].map((id) => $(id)).filter(Boolean);
function applyPower() {
  const saving = Power.saving;
  pixelCeiling = saving ? Math.min(MAX_PIXEL_RATIO, 0.8) : MAX_PIXEL_RATIO;
  if (quality.scale > pixelCeiling + 0.01) setPixelScale(pixelCeiling);
  else if (!saving && quality.scale < MAX_PIXEL_RATIO - 0.01) setPixelScale(MAX_PIXEL_RATIO);   // it will step down again if it must
  glowDecals.forEach((o) => { o.visible = !saving; });
  const label = Power.state === 'on' ? 'On' : Power.state === 'auto' ? 'Auto · low battery' : 'Off';
  saverButtons.forEach((b) => {
    b.classList.toggle('on', saving);
    b.setAttribute('aria-pressed', String(saving));
    if (b.id === 'gcMenuSaver') b.textContent = `Battery Saver: ${label}`;
  });
}
function toggleSaver() {
  const on = Power.setBatterySaver(!Power.batterySaver);     // onChange below applies it
  applyPower();                                              // (also when a low battery keeps it on)
  toast(on ? 'BATTERY SAVER ON — 30 FPS, SOFTER GLOW, QUIETER ROOM'
    : Power.saving ? 'SWITCH OFF — A LOW BATTERY KEEPS BATTERY SAVER ON' : 'BATTERY SAVER OFF');
}
Power.onChange(() => {
  applyPower();
  if (Power.state === 'auto') toast('LOW BATTERY — BATTERY SAVER ON');
});
saverButtons.forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toggleSaver(); }));

// Backgrounded (another app, a locked phone): stop the music and the audio engine
// and start again where we were when the page is back.
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (!document.hidden) { lastFrame = performance.now(); pacer.reset(); }
});

muteBtn.classList.toggle('muted', audio.muted);
muteBtn.setAttribute('aria-pressed', String(audio.muted));
muteBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });

// Browsers only allow sound after a gesture; any click, tap or key wakes the arcade up.
let audioWorld = null;
function unlockAudio() {
  if (gameState !== 'playing') {
    audio.unlock(audioWorld, audioWorld ? { position: camera.position, inside: insideFactor() } : null);
  }
}
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);

window.addEventListener('keydown', (e) => {
  if (gameState === 'playing') return;
  if (gameState === 'busy') { if (floor) floor.key(e, true); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyB' && (gameState === 'explore' || gameState === 'paused' || gameState === 'intro')) { toggleSaver(); return; }
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
  if (e.code === 'KeyP' && floor) { e.preventDefault(); floor.togglePhoto(); }
});
window.addEventListener('keyup', (e) => {
  if (gameState === 'busy' && floor) floor.key(e, false);
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
});
window.addEventListener('blur', resetInput);

// Mouse look (pointer lock)
const SENS = 0.0022;
function applyLook(dx, dy, sens = SENS) {
  noteActivity();
  player.yaw -= dx * sens;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dy * sens));
}

// When pointer lock is unavailable (blocked in some embeds), fall back to drag-to-look.
let dragLook = false;
let lockFailures = 0;

document.addEventListener('mousemove', (e) => {
  if (gameState === 'busy' && floor && (document.pointerLockElement === canvas || (dragLook && (e.buttons & 1)))) {
    if (Math.abs(e.movementX) <= 300 && Math.abs(e.movementY) <= 300) floor.mouse(e.movementX, e.movementY);
    return;
  }
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
  if (isTouch) return;
  if (gameState === 'busy' && floor && e.button === 0) { floor.click(); return; }
  if (dragLook) return;
  if (gameState === 'explore' && document.pointerLockElement === canvas && e.button === 0) interact();
});

function enterWithoutLock() {
  dragLook = true;
  $('gcHints').innerHTML = '<span>WASD</span> move &nbsp;·&nbsp; <span>DRAG</span> look &nbsp;·&nbsp; <span>SHIFT</span> run &nbsp;·&nbsp; <span>SPACE</span> jump<br><span>E</span> interact &nbsp;·&nbsp; <span>P</span> photo &nbsp;·&nbsp; <span>M</span> mute &nbsp;·&nbsp; <span>ESC</span> pause';
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
  } else if (gameState === 'explore' || (gameState === 'busy' && floor && floor.cancelOnUnlock())) {
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

// ── Title menu (intro only): ENTER does what the pause screen's button does ──
const menuEnter = $('gcMenuEnter');
function showMenuScreen(id) {
  document.querySelectorAll('.gm-screen').forEach((el) => el.classList.toggle('on', el.id === id));
  const first = $(id).querySelector('button:not(:disabled)');
  if (first) first.focus({ preventScroll: true });
}
function refreshMenuStats(w = Wallet.get()) {
  $('gmCoins').textContent = w.coins;
  $('gmPrizes').textContent = `${w.prizes.length}/${PRIZES.length}`;
}
menuEnter.addEventListener('click', () => enterBtn.click());
// Straight into a game from the menu: the footage camera flies into that cabinet
function launchFromMenu(id) {
  if (gameState !== 'intro') return;
  const cab = cabinets.find((c) => c.id === id);
  if (!cab) return;
  audio.unlock(audioWorld);
  if (id === 'breakpoint') launchBreakPoint(cab);
  else launchGlitchPong(cab);
}
$('gcMenuGP').addEventListener('click', () => launchFromMenu('glitch-pong'));
$('gcMenuBP').addEventListener('click', () => launchFromMenu('breakpoint'));
$('gcMenuControls').addEventListener('click', () => showMenuScreen('gcMenuHelp'));
$('gcMenuBack').addEventListener('click', () => showMenuScreen('gcMenu'));
window.addEventListener('keydown', (e) => {
  if (gameState === 'intro' && e.code === 'Escape' && $('gcMenuHelp').classList.contains('on')) showMenuScreen('gcMenu');
});

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
  if (gameState === 'busy' && floor) {
    for (const t of e.changedTouches) {
      if (lookTouch && t.identifier === lookTouch.id) {
        floor.mouse((t.clientX - lookTouch.x) * 2.2, (t.clientY - lookTouch.y) * 2.2);
        lookTouch.x = t.clientX;
        lookTouch.y = t.clientY;
      }
    }
    return;
  }
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
  if (gameState !== 'explore' && gameState !== 'busy') return;
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
  if (composer) {
    composer.setSize(w, h);
    // Bloom is a blur anyway: run it from CSS-pixel size, not the (higher) device-pixel size.
    if (bloomPass) bloomPass.setSize(w, h);
  }
}
window.addEventListener('resize', () => { if (gameState !== 'playing') resize(); });

let lastFrame = performance.now();
let elapsed = 0;
let screenTimer = 0;
let soonTimer = 0;
let tvTimer = 0;
let menuMode = null;

const listenerDir = new THREE.Vector3();
const gpScreenPos = new THREE.Vector3();
const bpScreenPos = new THREE.Vector3();
const gpScreenNormal = new THREE.Vector3();
const bpScreenNormal = new THREE.Vector3();
let audioMode = null;

// 0 outside → 1 inside, blended across the doorway
function insideFactor() {
  if (Math.abs(camera.position.x) > ROOM_W / 2) return 0;
  return Math.min(1, Math.max(0, (WALL_T + 0.6 - camera.position.z) / 1.6));
}

// ── Adaptive quality: when frames run slow, render fewer pixels, then drop bloom ──
const QUALITY_MIN = isTouch ? 0.6 : 0.75;
const quality = { scale: MAX_PIXEL_RATIO, sum: 0, n: 0, fast: 0 };
let pixelCeiling = MAX_PIXEL_RATIO;            // battery saver lowers this

function setPixelScale(v) {
  quality.scale = v;
  renderer.setPixelRatio(v);
  if (composer) composer.setPixelRatio(v);
  resize();
}

const FIXED_QUALITY = new URLSearchParams(location.search).has('fixedquality');   // for benchmarking

function trackQuality(rawMs) {
  if (FIXED_QUALITY || gameState !== 'explore' || document.hidden || rawMs > 250) return;   // ignore tab switches/hitches
  quality.sum += rawMs;
  if (++quality.n < 90) return;                                            // ~1.5 s windows
  const avg = quality.sum / quality.n;
  quality.sum = quality.n = 0;
  if (avg > 24) {                                                          // slower than ~42 fps
    quality.fast = 0;
    if (quality.scale > QUALITY_MIN + 0.01) setPixelScale(Math.max(QUALITY_MIN, quality.scale - 0.25));
    else if (composer) disableBloom();
  } else if (avg < 14 && quality.scale < pixelCeiling) {                  // lots of headroom: claw back detail
    if (++quality.fast >= 4) { quality.fast = 0; setPixelScale(Math.min(pixelCeiling, quality.scale + 0.25)); }
  } else {
    quality.fast = 0;
  }
}

// ── Pacing: draw only as many frames as the moment deserves (see glitchcade-power.js) ──
// Full rate while you walk, look, play or something on screen is animating; half of it
// once you've stood still for a moment or while the title menu is up. On a phone that
// is the difference between the scene being drawn 30 times a second and 60 (or 120).
const pacer = Power.createPacer();
let activeUntil = 0;
let prevFull = false;
function noteActivity(hold = 700) { activeUntil = Math.max(activeUntil, performance.now() + hold); }

function wantFps(now) {
  if (gameState === 'busy' && floor) {
    if (floor.coversWorld()) return 10;                         // a ROM fragment's overlay hides the world
    if (floor.menuOpen()) return Power.fpsFor({ touch: isTouch, saving: Power.saving, mode: 'calm' });
  }
  let mode = 'active';
  if (gameState === 'intro' || gameState === 'paused') mode = 'idle';
  else if (gameState === 'explore' && now > activeUntil && !(floor && floor.animating())) mode = 'calm';
  return Power.fpsFor({ touch: isTouch, saving: Power.saving, mode });
}

// ── What can the camera see? Canvas screens are only worth redrawing (and re-uploading
// to the GPU) when they're in front of it, close enough to read, and facing it. ──
const camFrustum = new THREE.Frustum();
const camProj = new THREE.Matrix4();
const visSphere = new THREE.Sphere();
const visTmp = new THREE.Vector3();
function updateFrustum() {
  camera.updateMatrixWorld();
  camProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  camFrustum.setFromProjectionMatrix(camProj);
}
function canSee(center, radius, normal = null, maxDist = Infinity) {
  visTmp.subVectors(camera.position, center);
  if (visTmp.lengthSq() > maxDist * maxDist) return false;
  if (normal && visTmp.dot(normal) < -radius * 0.5) return false;   // looking at its back
  visSphere.center.copy(center);
  visSphere.radius = radius;
  return camFrustum.intersectsSphere(visSphere);
}
// Redraw rates are given for a desktop; phones and battery saver run them slower.
const screenHz = (base) => base * (Power.saving ? 0.45 : isTouch ? 0.65 : 1);

const perf = { frames: 0, cpu: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const cpuStart = performance.now();
  renderer.info.reset();
  // the arcade sounds the same whether you're walking it or busy at a table
  const wantAudio = gameState === 'busy' ? 'explore' : gameState;
  if (wantAudio !== audioMode) { audioMode = wantAudio; audio.setMode(wantAudio); }
  if (gameState === 'playing') return;      // Glitch Pong has the screen; the arcade sleeps
  const fps = wantFps(now);
  if (!pacer.due(now, fps)) return;
  // Resolution tuning reads the gap between frames, so it only listens while we're
  // trying for full rate; a deliberately slow frame would look like a struggling one.
  const full = fps >= 55;
  if (full && prevFull) trackQuality(now - lastFrame);
  prevFull = full;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  elapsed += dt;

  // A full-screen overlay (a ROM fragment) hides the world: no scene, no screens, no textures.
  if (gameState === 'busy' && floor && floor.coversWorld()) {
    audio.update(dt, camera, listenerDir, insideFactor());
    return;
  }

  if (gameState === 'explore') updatePlayer(dt);
  else if (gameState === 'busy') { if (floor) floor.updateBusy(dt); }
  else if (gameState === 'launching') updateLaunch(dt);
  else if (gameState === 'intro') updateTour(dt);   // footage behind the title menu
  if (gameState !== menuMode) {
    menuMode = gameState;
    document.body.classList.toggle('gc-intro', gameState === 'intro');
    // no hands in the footage, at the air hockey table or in a photo
    if (arms) arms.left.visible = arms.right.visible = gameState !== 'intro' && !(floor && floor.hidesArms());
  }
  updateFocus();

  animated.forEach((fn) => fn(dt, elapsed));

  // Canvas screens re-upload a texture every redraw: only animate them when you can see them up close.
  const inside = insideFactor() > 0;
  updateFrustum();
  for (const tv of tvs) {                      // sets behind you or turned away cost nothing
    tv.seen = inside && canSee(tv.pos, 0.75, tv.normal, 26);
    tv.mesh.visible = tv.seen;
  }
  screenTimer += dt;
  if (screenTimer > 1 / screenHz(24)) {
    if (inside && canSee(gpScreenPos, 0.7, gpScreenNormal, 18)) pongScreen.draw(screenTimer);
    if (inside && canSee(bpScreenPos, 0.6, bpScreenNormal, 14)) bpScreen.draw(screenTimer);
    screenTimer = 0;
  }
  soonTimer += dt;
  if (soonTimer > 1 / screenHz(12)) {
    if (inside && cabinets.some((c) => c.movable && !c.fragment && canSee(c.screenCenter, 0.6, c.screenNormal, 22))) soonScreen.draw(soonTimer);
    soonTimer = 0;
  }
  // ceiling TVs: shared feeds at ~15 fps, snow only while a set is changing channel
  tvTimer += dt;
  if (tvTimer > 1 / screenHz(15)) {
    const snowing = updateTvs(tvTimer);
    if (inside) {
      // only the channels a set you can see is tuned to need redrawing
      tvFeeds.forEach((f) => { if (tvs.some((tv) => tv.seen && tv.feed === f)) f.draw(tvTimer); });
      if (snowing && tvs.some((tv) => tv.seen)) tvStatic.draw();
    }
    tvTimer = 0;
  }

  audio.update(dt, camera, listenerDir, insideFactor());

  // the neon sign's dodgy tube + random arcade-wide glitches
  if (Math.random() < dt * 2) {
    const [outer, inner] = neonSigns;
    if (outer.draw(false)) audio.signFlicker();
    inner.draw(false);
  }
  nextWorldGlitch -= dt;
  if (nextWorldGlitch <= 0 && gameState === 'explore') {
    worldGlitch();
    nextWorldGlitch = 9 + Math.random() * 10;
  }

  // a ROM fragment's overlay covers the whole view: nothing to draw behind it
  if (gameState === 'busy' && floor && floor.coversWorld()) return;
  renderWorld();
  perf.frames++;
  perf.cpu += performance.now() - cpuStart;
}

function renderWorld() {
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
  enterBtn.style.display = 'none';
  $('gcMenuEnter').style.display = 'none';   // can run before menuEnter is declared (WebGL check)
  $('gcMenuError').textContent = msg;
  $('gcMenuError').style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOOR MODULE BRIDGE — what glitchcade-floor.js is allowed to reach
// ═══════════════════════════════════════════════════════════════════════════
function floorContext() {
  return {
    THREE, C, scene, camera, renderer, canvas, root, audio, Wallet, assets,
    isTouch, reducedMotion, useBloom: () => useBloom,
    ROOM_W, ROOM_D, ROOM_H, WALL_T, COUNTER, STAFF_DOOR, EYE_HEIGHT, PRIZES, ROBOT_NAME, TV_Y,
    COMING_SOON_GAMES,
    player, colliders, platforms, cabinets, interactables, rayTargets, animated, worldLights,
    tvs, tvFeeds: () => tvFeeds, tvStatic: () => tvStatic,
    setTvOverride(fn) { tvOverride = fn; },
    carpetMat: () => carpetMat,
    // helpers
    makeCanvas, canvasTexture, chromaText, scanlines, sliceGlitch, fitFont, matte, neonMaterial,
    addGlow, addFloorGlow, addCollider, hologramMaterial, glowMaterial, glowTex: () => glowTex,
    buildCabinet, registerCabinet, makeCoinDoor, makeComingSoonMarquee, makeComingSoonSideArt,
    makeGlitchPongMarquee, floorHeightAt, collide,
    // HUD + state
    toast, robotSay, worldGlitch, pulseCoinHud, refreshPrizes,
    robot: () => robot,
    setRobotPending(text) { if (robot) { robot.pending = text; robot.inZone = false; } },
    get state() { return gameState; },
    setBusy(on) {
      if (on && gameState === 'explore') { gameState = 'busy'; resetInput(); focused = null; promptEl.classList.remove('show'); crosshairEl.classList.remove('on'); }
      else if (!on && gameState === 'busy') { gameState = 'explore'; lastFrame = performance.now(); }
      document.body.classList.toggle('gc-busy', gameState === 'busy');
    },
    elapsed: () => elapsed,
    canSee,
    atPrizeCounter, insideFactor,
    refocus() { focused = null; },          // redraw the prompt for whatever you're aiming at
    setInfoLines(fn) { infoLinesProvider = fn; if (infoBoard) infoBoard.draw(false); },
    redrawInfoBoard() { if (infoBoard) infoBoard.draw(false); },
    soonTexture: () => soonScreen.tex,
    // launching
    beginLaunch, onGameExit,
    launchGame(cab) { if ((cab.game || cab.id) === 'breakpoint') launchBreakPoint(cab); else launchGlitchPong(cab); },
    renderWorld,
    arms: () => arms,
    releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); },
    hasPointerLock: () => document.pointerLockElement === canvas
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
(async function boot() {
  await loadAssets();
  buildEnvironment();
  buildCabinets();
  buildTvs();
  buildJukebox();
  buildPrizeCounter();
  buildArms();
  floor = installFloor(floorContext());
  buildTour();
  const gpCabinet = cabinets.find((c) => c.id === 'glitch-pong');
  const bpCabinet = cabinets.find((c) => c.id === 'breakpoint');
  gpScreenPos.copy(gpCabinet.screenCenter);
  bpScreenPos.copy(bpCabinet.screenCenter);
  gpScreenNormal.copy(gpCabinet.screenNormal);
  bpScreenNormal.copy(bpCabinet.screenNormal);
  const batched = bakeScene();
  scene.traverse((o) => {
    const m = o.material;
    if ((o.isMesh || o.isSprite) && m && !Array.isArray(m) && m.map === glowTex && m.blending === THREE.AdditiveBlending) glowDecals.push(o);
  });
  applyPower();
  window.addEventListener('glitchcade:wallet', () => { refreshPrizes(); floor.onWallet(); });
  // Achievements unlocked out here (e.g. at the prize counter) get the arcade toast;
  // inside Glitch Pong the game shows its own pop-up.
  let achievementNames = [];
  window.addEventListener('glitchpong:achievement', (e) => {
    if (gameState === 'playing' || gameState === 'launching') return;
    const name = e.detail && e.detail.name;
    if (!name) return;
    achievementNames.push(name);
    if (achievementNames.length > 1) return; // already scheduled; it will include this one
    setTimeout(() => {
      toast('🏆 ACHIEVEMENT UNLOCKED: ' + achievementNames.join(' + '));
      achievementNames = [];
    }, 2500);
  });
  window.addEventListener('storage', (e) => { if (e.key === 'glitchcade_wallet_v1') refreshPrizes(); });
  audioWorld = {
    signPos: new THREE.Vector3(0, ROOM_H + 1.85, 0.6),
    doorPos: new THREE.Vector3(0, 1.6, WALL_T / 2),
    soonCabinets: cabinets.filter((c) => !c.playable),
    gpScreen: cabinets.find((c) => c.id === 'glitch-pong').screenCenter,
    jukeboxPos: jukebox.screenCenter,
    robotPos: ROBOT_POS.clone().setY(1.7)
  };
  // An early menu click may already be playing music while the art loaded.
  // Attach its positional emitters without requiring another click or reload.
  if (audio.ready) audio.unlock(audioWorld);
  resize();
  requestAnimationFrame((t) => { lastFrame = t; frame(t); });
  enterBtn.disabled = false;
  menuEnter.disabled = false;
  menuEnter.textContent = 'Enter';
  $('gcMenuGP').disabled = $('gcMenuBP').disabled = false;
  menuEnter.focus({ preventScroll: true });

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
    interact,
    audio,
    prizes: prizeSlots,
    inventory() {
      const out = {};
      scene.traverseVisible((o) => {
        if (!(o.isMesh || o.isSprite || o.isLine || o.isPoints)) return;
        const parent = o.parent === scene ? 'scene' : (o.parent && o.parent.parent === scene ? 'group' : 'nested');
        const k = `${o.type}:${Array.isArray(o.material) ? 'multi' : o.material.type}:${parent}`;
        out[k] = (out[k] || 0) + 1;
      });
      return out;
    },
    stats() {
      const out = {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        programs: renderer.info.programs.length, lights: (() => { let n = 0; scene.traverse((o) => { if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight) n++; }); return n; })(),
        frames: perf.frames, avgFrameMs: perf.frames ? +(perf.cpu / perf.frames).toFixed(2) : 0,
        pixelRatio: quality.scale, bloom: !!composer, batchedAway: batched
      };
      perf.frames = 0; perf.cpu = 0;
      return out;
    },
    robot: () => robot,
    floor,
    scene,
    power: Power,
    glowDecals,
    lights: worldLights,
    focused: () => focused,
    seekTour(i, t = 2) { tour.i = i % tourShots.length; tour.t = t; }
  };
})();
