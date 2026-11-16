// The look this cabinet shares with Glitch Pong and Breakpoint: holographic
// glass, neon tubes, light that blooms. Drawing helpers only — nothing in here
// knows the rules. (Signal Lost carries the same file; a test keeps them equal.)

export const TAU = Math.PI * 2;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const sheet = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// ── a soft round light, kept per colour and added to whatever is under it ──
const lights = new Map();
function lightOf(color) {
  let s = lights.get(color);
  if (!s) {
    s = sheet(64, 64);
    const g = s.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 0.9)); grad.addColorStop(0.25, rgba(color, 0.42)); grad.addColorStop(0.6, rgba(color, 0.1)); grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    lights.set(color, s);
  }
  return s;
}
export function light(c, x, y, R, color, a = 1) {
  if (a <= 0 || R <= 0) return;
  const op = c.globalCompositeOperation, ga = c.globalAlpha;
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = ga * Math.min(1, a);
  c.drawImage(lightOf(color), x - R, y - R, R * 2, R * 2);
  c.globalCompositeOperation = op; c.globalAlpha = ga;
}

// ── the current path as a neon tube: a wide soft stroke, the colour, a hot core ──
export function tube(c, color, w = 2, a = 1) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = rgba(color, 0.14 * a); c.lineWidth = w * 4.5; c.stroke();
  c.strokeStyle = rgba(color, 0.92 * a); c.lineWidth = w; c.stroke();
  c.strokeStyle = `rgba(255,255,255,${0.55 * a})`; c.lineWidth = Math.max(0.6, w * 0.38); c.stroke();
  c.restore();
}

// ── a pane of holographic glass, centred on x, y: see-through body, a sheen
//    across the top, a crisp edge. Breakpoint's bricks are made of this. ──
export function glass(c, x, y, w, h, color, o = {}) {
  const r = o.r === undefined ? 2.5 : o.r, body = o.fill === undefined ? 0.26 : o.fill, edge = o.edge === undefined ? 1 : o.edge;
  const X = x - w / 2, Y = y - h / 2;
  roundRect(c, X, Y, w, h, r);
  c.fillStyle = rgba(color, body); c.fill();
  if (o.sheen !== false) {
    const g = c.createLinearGradient(0, Y, 0, Y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.26)'); g.addColorStop(0.42, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fill();
  }
  c.lineWidth = o.lw || 1.6; c.strokeStyle = rgba(color, edge); c.stroke();
  // the line of light along the top edge
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(X + r + 1, Y + 2); c.lineTo(X + w - r - 1, Y + 2); c.stroke();
}

// ── a comet's tail through a list of points (newest first) ──
export function comet(c, pts, R, color, a = 1) {
  const n = pts.length;
  if (n < 3 || a <= 0) return;
  const L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let dx = o.x - q.x, dy = o.y - q.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const k = 1 - i / (n - 1), wd = R * (0.15 + 0.85 * k * k);
    L.push(p.x - dy * wd, p.y + dx * wd); Rr.push(p.x + dy * wd, p.y - dx * wd);
  }
  const head = pts[0], tail = pts[n - 1];
  if (Math.hypot(head.x - tail.x, head.y - tail.y) < 2) return;
  const g = c.createLinearGradient(head.x, head.y, tail.x, tail.y);
  g.addColorStop(0, rgba(color, 0.75 * a)); g.addColorStop(0.35, rgba(color, 0.3 * a)); g.addColorStop(1, rgba(color, 0));
  const op = c.globalCompositeOperation;
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
  for (let i = Rr.length - 2; i >= 0; i -= 2) c.lineTo(Rr[i], Rr[i + 1]);
  c.closePath(); c.fill();
  c.globalCompositeOperation = op;
}

// ── sparks and shockwaves: { x, y, vx, vy, life, max, color, size, ring? } ──
export function sparks(c, parts) {
  const op = c.globalCompositeOperation;
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (const p of parts) {
    const k = Math.max(0, p.life / p.max);
    c.globalAlpha = k;
    c.strokeStyle = p.color;
    if (p.ring) {
      c.lineWidth = 0.6 + 2.4 * k;
      c.beginPath(); c.arc(p.x, p.y, p.ring * (1 - k * k) + 3, 0, TAU); c.stroke();
      continue;
    }
    c.lineWidth = 0.8 + p.size * 0.55 * k;
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04 + 0.01); c.stroke();
  }
  c.globalAlpha = 1; c.lineCap = 'butt';
  c.globalCompositeOperation = op;
}

// ── the corner brackets Breakpoint frames its field with ──
export function brackets(c, x, y, w, h, color, len = 26, a = 0.45) {
  c.strokeStyle = rgba(color, a); c.lineWidth = 1.5;
  c.beginPath();
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.moveTo(px + sx * len, py); c.lineTo(px, py); c.lineTo(px, py + sy * len);
  }
  c.stroke();
}

// ── bloom: the picture, shrunk until it blurs, added back over itself ──
// Only two passes touch the full-size canvas (one read, one write); the
// blurring itself happens on sheets a ninth of the size and smaller.
export function createBloom() {
  const a = sheet(2, 2), b = sheet(2, 2), d = sheet(2, 2);
  const ac = a.getContext('2d'), bc = b.getContext('2d'), dc = d.getContext('2d');
  return {
    // `w` and `h` are the design size, so the glow is as wide on a phone as on a desk
    apply(c, canvas, w, h, k = 1) {
      const aw = Math.max(2, Math.round(w / 3)), ah = Math.max(2, Math.round(h / 3));
      if (a.width !== aw || a.height !== ah) {
        a.width = aw; a.height = ah;
        b.width = Math.max(2, aw >> 1); b.height = Math.max(2, ah >> 1);
        d.width = Math.max(2, aw >> 2); d.height = Math.max(2, ah >> 2);
      }
      for (const [g, src, to] of [[ac, canvas, a], [bc, a, b], [dc, b, d]]) {
        g.globalCompositeOperation = 'copy'; g.globalAlpha = 1; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
        g.drawImage(src, 0, 0, to.width, to.height);
      }
      // the two wider blurs are folded into the first, small as it is
      ac.globalCompositeOperation = 'lighter'; ac.imageSmoothingQuality = 'low';
      ac.globalAlpha = 0.9; ac.drawImage(b, 0, 0, aw, ah);
      ac.globalAlpha = 1; ac.drawImage(d, 0, 0, aw, ah);
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
      c.globalAlpha = 0.34 * k; c.drawImage(a, 0, 0, canvas.width, canvas.height);
      c.restore();
    }
  };
}

// a cheap repeatable random, for backdrops that must look the same each time they are painted
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
