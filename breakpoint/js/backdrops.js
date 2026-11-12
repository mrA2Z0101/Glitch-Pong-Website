// ============ BREAKPOINT — arena backdrops ============
// Each of the twelve arenas has a place drawn behind the play: a synthwave
// horizon, a reactor hall, a cathedral, server racks. A backdrop is painted once
// into an off-screen canvas (the `still` part) and stamped each frame, with a
// few moving details (the `live` part) drawn on top. Battery saver and reduced
// screen FX skip the moving details.
//
// Everything stays dark and faint so bricks, the ball and the paddle read over
// it. Painters work in the field's own size, so they fit the upright phone
// field and the wide landscape one as well as the 960x640 desktop field.
'use strict';

const Backdrop = (() => {
  let layer = null, layerKey = '', fontsReady = false;
  const thumbs = new Map();
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const TAU = Math.PI * 2;

  function hexPath(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  // the soft glow along the bottom edge that every arena keeps
  function floorGlow(c, W, H, col, a = 0.22) {
    const g = c.createLinearGradient(0, H - 110, 0, H);
    g.addColorStop(0, 'transparent'); g.addColorStop(1, rgba(col, a));
    c.fillStyle = g; c.fillRect(0, H - 110, W, 110);
  }
  function brackets(c, W, H, col) {
    c.strokeStyle = rgba(col, 0.35); c.lineWidth = 2;
    const m = 14, l = 34;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      c.beginPath(); c.moveTo(x + l * sx, y); c.lineTo(x, y); c.lineTo(x, y + l * sy); c.stroke();
    }
  }

  const PAINT = {
    // The original court: a drifting grid (the live part) over a faint Pong court.
    'GLITCH ARENA': {
      still(c, W, H, a) {
        const col = a.accent;
        c.strokeStyle = rgba(col, 0.13); c.lineWidth = 2;
        c.setLineDash([14, 14]);
        c.beginPath(); c.moveTo(0, H * 0.56); c.lineTo(W, H * 0.56); c.stroke();
        c.setLineDash([]);
        c.beginPath(); c.arc(W / 2, H * 0.56, Math.min(W, H) * 0.16, 0, TAU); c.stroke();
        brackets(c, W, H, col);
        floorGlow(c, W, H, col);
      },
      live(c, W, H, t, a) {
        c.strokeStyle = a.grid; c.lineWidth = 1;
        const o = t * 18 % 48;
        c.beginPath();
        for (let x = -48 + o; x < W + 48; x += 48) { c.moveTo(x, 0); c.lineTo(x, H); }
        for (let y = o; y < H; y += 48) { c.moveTo(0, y); c.lineTo(W, y); }
        c.stroke();
      },
    },

    // A synthwave road: striped sun, skyline, and a floor grid running at you.
    'NEON GRID': {
      still(c, W, H, a, r) {
        const hz = H * 0.6, sunR = Math.min(W * 0.24, H * 0.3);
        const sun = c.createLinearGradient(0, hz - sunR, 0, hz);
        sun.addColorStop(0, 'rgba(255,210,122,.30)'); sun.addColorStop(1, 'rgba(255,88,217,.30)');
        c.save();
        c.beginPath(); c.rect(0, 0, W, hz); c.clip();
        c.fillStyle = sun;
        c.beginPath(); c.arc(W / 2, hz, sunR, 0, TAU); c.fill();
        c.fillStyle = a.bg;                                    // the gaps that stripe the sun
        for (let i = 0; i < 6; i++) c.fillRect(W / 2 - sunR, hz - 8 - i * (sunR / 7.5), sunR * 2, 2 + (5 - i) * 1.2);
        c.restore();
        c.fillStyle = 'rgba(14,6,26,.95)';                     // skyline
        for (let x = 0; x < W;) {
          const w = 18 + r() * 44, h = 14 + r() * (Math.abs(x - W / 2) < sunR ? 34 : 74);
          c.fillRect(x, hz - h, w + 1, h);
          c.fillStyle = 'rgba(255,88,217,.16)';
          for (let k = 0; k < 3; k++) c.fillRect(x + 4 + r() * (w - 8), hz - h + 4 + r() * (h - 8), 2, 2);
          c.fillStyle = 'rgba(14,6,26,.95)';
          x += w;
        }
        c.strokeStyle = 'rgba(255,88,217,.5)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, hz); c.lineTo(W, hz); c.stroke();
        c.strokeStyle = 'rgba(255,88,217,.17)'; c.lineWidth = 1;   // lines to the vanishing point
        c.beginPath();
        for (let i = -12; i <= 12; i++) { c.moveTo(W / 2 + i * 14, hz); c.lineTo(W / 2 + i * W * 0.16, H); }
        c.stroke();
        floorGlow(c, W, H, a.accent, 0.16);
      },
      live(c, W, H, t) {
        const hz = H * 0.6;
        c.strokeStyle = 'rgba(255,88,217,.2)'; c.lineWidth = 1;
        c.beginPath();
        for (let i = 0; i < 9; i++) {
          const k = ((i + t * 0.35) % 9) / 9;                  // 0 at the horizon, 1 at your feet
          const y = hz + (H - hz) * k * k;
          c.moveTo(0, y); c.lineTo(W, y);
        }
        c.stroke();
      },
    },

    // A reactor hall: hex plating, feed pipes and the core's housing.
    'QUANTUM REACTOR': {
      still(c, W, H, a, r) {
        const col = a.accent, cx = W / 2, cy = 340;
        c.strokeStyle = rgba(col, 0.06); c.lineWidth = 1;
        const R = 30, dx = R * Math.sqrt(3), dy = R * 1.5;
        for (let row = 0, y = 0; y < H + R; row++, y += dy)
          for (let x = (row % 2) * dx / 2; x < W + R; x += dx) { hexPath(c, x, y, R - 2); c.stroke(); }
        c.strokeStyle = rgba(col, 0.2); c.lineWidth = 6;           // feed pipes to the walls
        for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(cx + s * 70, cy); c.lineTo(cx + s * W * 0.34, cy); c.lineTo(cx + s * W * 0.34, cy + 60); c.lineTo(cx + s * W / 2, cy + 60); c.stroke();
        }
        c.lineWidth = 1.5;
        for (const [rad, al] of [[60, 0.34], [118, 0.2], [176, 0.13], [234, 0.08]]) {
          c.strokeStyle = rgba(col, al);
          c.beginPath(); c.arc(cx, cy, rad, 0, TAU); c.stroke();
          for (let i = 0; i < 24; i++) {                            // tick marks round each ring
            const ang = i / 24 * TAU;
            c.beginPath(); c.moveTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
            c.lineTo(cx + Math.cos(ang) * (rad + 6), cy + Math.sin(ang) * (rad + 6)); c.stroke();
          }
        }
        c.fillStyle = 'rgba(255,210,122,.16)';                      // hazard chevrons along the floor
        for (let x = -20; x < W; x += 44) {
          c.beginPath(); c.moveTo(x, H); c.lineTo(x + 22, H - 16); c.lineTo(x + 40, H - 16); c.lineTo(x + 18, H); c.fill();
        }
        floorGlow(c, W, H, col, 0.18);
      },
    },

    // Rows of memory cells with addresses, and what is running out of them.
    'MEMORY LEAK': {
      still(c, W, H, a, r) {
        const col = a.accent;
        c.font = '10px "Share Tech Mono", monospace'; c.textBaseline = 'middle';
        const cw = 26, ch = 12, gx = 6, gy = 20, left = 62;
        for (let y = 34, row = 0; y < H * 0.72; y += ch + gy, row++) {
          c.fillStyle = rgba(col, 0.2);
          c.fillText('0x' + (0x3f00 + row * 16).toString(16).toUpperCase(), 10, y + ch / 2);
          for (let x = left; x < W - cw; x += cw + gx) {
            const full = r() < 0.3;
            c.fillStyle = rgba(col, full ? 0.13 : 0.035);
            c.fillRect(x, y, cw, ch);
            c.strokeStyle = rgba(col, 0.1); c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
            if (full && r() < 0.2) {                               // this one is leaking
              const len = 70 + r() * (H - y - 110);
              const g = c.createLinearGradient(0, y + ch, 0, y + ch + len);
              g.addColorStop(0, rgba(col, 0.26)); g.addColorStop(1, 'transparent');
              c.fillStyle = g; c.fillRect(x + cw / 2 - 1.5, y + ch, 3, len);
            }
          }
        }
        const pool = c.createLinearGradient(0, H - 70, 0, H);       // where it all ends up
        pool.addColorStop(0, 'transparent'); pool.addColorStop(1, rgba(col, 0.34));
        c.fillStyle = pool; c.fillRect(0, H - 70, W, 70);
      },
      live(c, W, H, t, a) {
        c.fillStyle = rgba(a.accent, 0.5);
        for (let i = 0; i < 7; i++) {
          const x = (i * 137.5 + 80) % (W - 40) + 20;
          const y = ((t * (60 + i * 13) + i * 211) % (H * 0.9)) + 40;
          c.fillRect(x, y, 3, 9);
        }
      },
    },

    // Honeycomb, some cells already taken.
    'VIRUS HIVE': {
      still(c, W, H, a, r) {
        const col = a.accent, R = 28, dx = R * Math.sqrt(3), dy = R * 1.5;
        for (let row = 0, y = 0; y < H + R; row++, y += dy) {
          for (let x = (row % 2) * dx / 2; x < W + R; x += dx) {
            const roll = r();
            hexPath(c, x, y, R - 3);
            if (roll < 0.14) { c.fillStyle = rgba(col, 0.05 + r() * 0.08); c.fill(); }
            c.strokeStyle = rgba(col, roll < 0.14 ? 0.24 : 0.085); c.lineWidth = 1.2; c.stroke();
            if (roll < 0.035) {                                    // a spore
              c.strokeStyle = rgba(col, 0.3);
              c.beginPath(); c.arc(x, y, 7, 0, TAU); c.stroke();
              for (let k = 0; k < 8; k++) {
                const ang = k / 8 * TAU;
                c.beginPath(); c.moveTo(x + Math.cos(ang) * 7, y + Math.sin(ang) * 7); c.lineTo(x + Math.cos(ang) * 12, y + Math.sin(ang) * 12); c.stroke();
              }
            }
          }
        }
        floorGlow(c, W, H, col, 0.2);
      },
      live(c, W, H, t, a) {
        const R = 28, dx = R * Math.sqrt(3), dy = R * 1.5;
        for (let i = 0; i < 4; i++) {
          const row = (i * 5 + 3) % Math.floor(H / dy), colN = (i * 7 + 2) % Math.floor(W / dx);
          hexPath(c, colN * dx + (row % 2) * dx / 2, row * dy, R - 3);
          c.fillStyle = rgba(a.accent, 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7)));
          c.fill();
        }
      },
    },

    // A nave: lancet windows, a rose window, and light falling from them.
    'DIGITAL CATHEDRAL': {
      still(c, W, H, a, r) {
        const glass = ['#71efff', '#ff58d9', '#9a5dff', '#ffd27a'];
        const cx = W / 2, cy = Math.min(H * 0.36, 250), R = Math.min(W * 0.2, 150);
        for (const s of [-1, 1]) {                                  // light shafts first, so the windows sit on them
          const g = c.createLinearGradient(cx, cy, cx + s * W * 0.3, H);
          g.addColorStop(0, 'rgba(238,247,255,.07)'); g.addColorStop(1, 'transparent');
          c.fillStyle = g;
          c.beginPath(); c.moveTo(cx - R * 0.5, cy); c.lineTo(cx + R * 0.5, cy); c.lineTo(cx + s * W * 0.42 + 90, H); c.lineTo(cx + s * W * 0.42 - 90, H); c.fill();
        }
        for (let i = 0; i < 12; i++) {                              // rose window
          const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU;
          c.fillStyle = rgba(glass[i % 4], 0.075);
          c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a1); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(238,247,255,.15)'; c.lineWidth = 1.2; c.stroke();
          c.fillStyle = rgba(glass[(i + 2) % 4], 0.1);
          c.beginPath(); c.arc(cx + Math.cos((a0 + a1) / 2) * R * 0.72, cy + Math.sin((a0 + a1) / 2) * R * 0.72, R * 0.11, 0, TAU); c.fill(); c.stroke();
        }
        c.strokeStyle = 'rgba(238,247,255,.2)'; c.lineWidth = 2;
        for (const rad of [R, R * 0.42, R * 0.14]) { c.beginPath(); c.arc(cx, cy, rad, 0, TAU); c.stroke(); }
        const lancet = (x, w, top, bottom) => {                     // a pointed arch
          c.beginPath(); c.moveTo(x - w / 2, bottom); c.lineTo(x - w / 2, top + w * 0.7);
          c.quadraticCurveTo(x - w / 2, top + w * 0.1, x, top);
          c.quadraticCurveTo(x + w / 2, top + w * 0.1, x + w / 2, top + w * 0.7);
          c.lineTo(x + w / 2, bottom); c.closePath();
        };
        const side = Math.max(1, Math.floor((W / 2 - R - 30) / 92));
        for (let i = 1; i <= side; i++) for (const s of [-1, 1]) {
          const x = cx + s * (R + 16 + i * 86), top = cy - R * 0.8 + i * 14;
          lancet(x, 54, top, H * 0.78);
          c.fillStyle = rgba(glass[(i + (s > 0 ? 1 : 3)) % 4], 0.055); c.fill();
          c.strokeStyle = 'rgba(238,247,255,.17)'; c.lineWidth = 1.4; c.stroke();
          c.beginPath(); c.moveTo(x, top); c.lineTo(x, H * 0.78);
          for (let y = top + 60; y < H * 0.78; y += 54) { c.moveTo(x - 27, y); c.lineTo(x + 27, y); }
          c.strokeStyle = 'rgba(238,247,255,.09)'; c.stroke();
        }
        c.strokeStyle = 'rgba(238,247,255,.07)'; c.lineWidth = 1;   // floor tiles
        c.beginPath();
        for (let i = -10; i <= 10; i++) { c.moveTo(cx + i * 26, H * 0.82); c.lineTo(cx + i * W * 0.13, H); }
        for (let k = 0; k < 5; k++) { const y = H * 0.82 + (H * 0.18) * (k / 5) ** 1.6; c.moveTo(0, y); c.lineTo(W, y); }
        c.stroke();
        floorGlow(c, W, H, '#eef7ff', 0.1);
      },
    },

    // A boot screen that didn't finish, and the chip it was reading.
    'CORRUPTED BIOS': {
      still(c, W, H, a, r) {
        const col = a.accent;
        const lines = ['GLITCHCADE BIOS v0.86  (C) 1986', 'UNIT 02 // BREAKPOINT', '', 'CPU ............ OK', 'MEMORY TEST .... 640K OK',
          'VIDEO .......... OK', 'PADDLE PORT .... OK', 'SOUND .......... OK', 'READING SECTOR 0x1F ...', 'ERROR: SECTOR 0x1F UNREADABLE',
          'RETRY (1/3) ...', 'RETRY (2/3) ...', 'RETRY (3/3) ...', 'CHECKSUM MISMATCH 0xDEAD != 0xBEEF', 'ATTEMPTING REPAIR ...', 'REPAIR FAILED',
          '', 'SOMETHING IS IN THE MACHINE', 'PRESS ANY KEY TO CONTINUE_'];
        c.font = '13px "Share Tech Mono", monospace'; c.textBaseline = 'top';
        const lh = Math.max(19, Math.min(26, (H - 150) / lines.length));
        lines.forEach((ln, i) => {
          const bad = /ERROR|FAILED|MISMATCH|SOMETHING/.test(ln);
          let text = ln;
          if (r() < 0.22) {                                        // a stretch of the line turned to noise
            const at = Math.floor(r() * ln.length), n = 2 + Math.floor(r() * 6);
            text = ln.slice(0, at) + '▒'.repeat(n) + ln.slice(at + n);
          }
          c.fillStyle = bad ? 'rgba(255,77,109,.26)' : rgba(col, 0.2);
          c.fillText(text, 22, 96 + i * lh);
        });
        const s = Math.min(150, W * 0.2), x = W - s - 46, y = Math.min(H * 0.5, 330) - s / 2;   // the chip
        c.strokeStyle = rgba(col, 0.26); c.lineWidth = 2; c.strokeRect(x, y, s, s);
        c.strokeStyle = rgba(col, 0.14); c.strokeRect(x + 16, y + 16, s - 32, s - 32);
        c.lineWidth = 3; c.beginPath();
        for (let i = 0; i < 9; i++) {
          const p = (i + 0.5) / 9 * s;
          c.moveTo(x + p, y); c.lineTo(x + p, y - 12); c.moveTo(x + p, y + s); c.lineTo(x + p, y + s + 12);
          c.moveTo(x, y + p); c.lineTo(x - 12, y + p); c.moveTo(x + s, y + p); c.lineTo(x + s + 12, y + p);
        }
        c.stroke();
        c.fillStyle = rgba(col, 0.22); c.font = '700 12px Orbitron, monospace'; c.textAlign = 'center';
        c.fillText('BIOS', x + s / 2, y + s / 2 - 6); c.textAlign = 'left';
        for (let i = 0; i < 9; i++) {                               // stuck blocks of screen
          c.fillStyle = r() < 0.5 ? 'rgba(255,77,109,.07)' : rgba(col, 0.06);
          c.fillRect(r() * W, 80 + r() * (H - 160), 30 + r() * 150, 4 + r() * 12);
        }
        floorGlow(c, W, H, col, 0.18);
      },
      live(c, W, H, t, a) {
        if (Math.floor(t * 2) % 2) return;                          // the cursor after the last line
        const lh = Math.max(19, Math.min(26, (H - 150) / 19));
        c.fillStyle = rgba(a.accent, 0.4);
        c.fillRect(22 + 26 * 7.8, 96 + 18 * lh, 8, 14);
      },
    },

    // A circuit board: the processor in the middle and traces out to the edge.
    'AI MAINFRAME': {
      still(c, W, H, a, r) {
        const col = a.accent, cx = W / 2, cy = Math.min(H * 0.52, 340), s = 74;
        c.lineWidth = 1.4;
        for (let i = 0; i < 46; i++) {
          const sideN = i % 4, off = (r() - 0.5) * s * 1.7;
          let x = cx + (sideN === 0 ? -s : sideN === 1 ? s : off), y = cy + (sideN === 2 ? -s : sideN === 3 ? s : off);
          const horizontal = sideN < 2, dir = sideN % 2 ? 1 : -1;
          c.strokeStyle = rgba(col, 0.1 + r() * 0.12);
          c.beginPath(); c.moveTo(x, y);
          let reach = 40 + r() * (horizontal ? W / 2 - s - 60 : H * 0.42 - s);
          if (horizontal) x += dir * reach; else y += dir * reach;
          c.lineTo(x, y);
          const jog = (r() < 0.5 ? -1 : 1) * (14 + r() * 50);         // a 45 degree jog, as traces do
          if (horizontal) { x += dir * Math.abs(jog); y += jog; } else { y += dir * Math.abs(jog); x += jog; }
          c.lineTo(x, y);
          reach = 20 + r() * 150;
          if (horizontal) x += dir * reach; else y += dir * reach;
          c.lineTo(x, y); c.stroke();
          c.fillStyle = rgba(col, 0.3); c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill();
        }
        c.fillStyle = 'rgba(4,8,13,.9)'; c.fillRect(cx - s, cy - s, s * 2, s * 2);
        c.strokeStyle = rgba(col, 0.42); c.lineWidth = 2; c.strokeRect(cx - s, cy - s, s * 2, s * 2);
        c.strokeStyle = rgba(col, 0.2); c.strokeRect(cx - s + 14, cy - s + 14, s * 2 - 28, s * 2 - 28);
        c.fillStyle = rgba(col, 0.3); c.font = '900 20px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('AI', cx, cy); c.textAlign = 'left';
        floorGlow(c, W, H, col, 0.2);
      },
      live(c, W, H, t, a) {
        const cx = W / 2, cy = Math.min(H * 0.52, 340);
        c.strokeStyle = rgba(a.accent, 0.18 + 0.16 * Math.sin(t * 2.2)); c.lineWidth = 2;
        c.strokeRect(cx - 52, cy - 52, 104, 104);                     // the processor's heartbeat
      },
    },

    // Looking down a tunnel: frames closing on a far point, and the rush toward it.
    'DATA TUNNEL': {
      still(c, W, H, a) {
        const col = a.accent, cx = W / 2, cy = H * 0.46;
        c.strokeStyle = rgba(col, 0.1); c.lineWidth = 1;
        c.beginPath();
        for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2], [W * 0.25, 0], [W * 0.75, 0], [W * 0.25, H], [W * 0.75, H]]) { c.moveTo(x, y); c.lineTo(cx, cy); }
        c.stroke();
        for (let i = 0; i < 9; i++) {
          const k = Math.pow(0.68, i);
          c.strokeStyle = rgba(col, 0.05 + 0.16 * k);
          c.strokeRect(cx - cx * k, cy - cy * k, W * k, H * k * (cy / (H / 2)) + (H - 2 * cy) * k);
        }
        const glow = c.createRadialGradient(cx, cy, 0, cx, cy, 120);
        glow.addColorStop(0, rgba(col, 0.2)); glow.addColorStop(1, 'transparent');
        c.fillStyle = glow; c.fillRect(cx - 120, cy - 120, 240, 240);
        floorGlow(c, W, H, col, 0.14);
      },
      live(c, W, H, t, a) {
        const cx = W / 2, cy = H * 0.46;
        for (let i = 0; i < 3; i++) {
          const k = Math.pow(((t * 0.22 + i / 3) % 1), 2.2);            // slow far away, fast as it passes
          c.strokeStyle = rgba(a.accent, 0.3 * k + 0.03); c.lineWidth = 1 + k * 2;
          c.strokeRect(cx - cx * k, cy - cy * k, W * k, H * k);
        }
      },
    },

    // Deep space, and the thing bending it.
    'BLACK HOLE NEXUS': {
      still(c, W, H, a, r) {
        const cx = W * 0.5, cy = Math.min(H * 0.5, 330);
        for (const [x, y, rad, colr] of [[W * 0.2, H * 0.25, 260, 'rgba(154,93,255,.10)'], [W * 0.82, H * 0.7, 300, 'rgba(255,88,217,.07)'], [W * 0.6, H * 0.15, 200, 'rgba(113,239,255,.05)']]) {
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, colr); g.addColorStop(1, 'transparent');
          c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        for (let i = 0; i < 170; i++) {
          c.fillStyle = `rgba(238,247,255,${(0.12 + r() * 0.4).toFixed(2)})`;
          const sz = r() < 0.1 ? 2 : 1;
          c.fillRect(r() * W, r() * H, sz, sz);
        }
        c.save(); c.translate(cx, cy); c.rotate(-0.32); c.scale(1, 0.34);   // the disc, seen nearly edge on
        for (let i = 0; i < 7; i++) {
          c.strokeStyle = `rgba(${200 - i * 12},${130 - i * 8},255,${(0.26 - i * 0.03).toFixed(2)})`; c.lineWidth = 5 - i * 0.5;
          c.beginPath(); c.arc(0, 0, 92 + i * 26, 0, TAU); c.stroke();
        }
        c.restore();
        const hole = c.createRadialGradient(cx, cy, 20, cx, cy, 78);
        hole.addColorStop(0, 'rgba(0,0,0,.95)'); hole.addColorStop(0.7, 'rgba(0,0,0,.8)'); hole.addColorStop(1, 'transparent');
        c.fillStyle = hole; c.beginPath(); c.arc(cx, cy, 78, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(200,170,255,.3)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, 46, 0, TAU); c.stroke();
        floorGlow(c, W, H, a.accent, 0.13);
      },
      live(c, W, H, t) {
        for (let i = 0; i < 9; i++) {
          const x = (i * 0.618 % 1) * W, y = ((i * 0.381 + 0.13) % 1) * H;
          c.fillStyle = `rgba(238,247,255,${(0.25 + 0.3 * Math.sin(t * (1.1 + i * 0.3) + i)).toFixed(2)})`;
          c.fillRect(x, y, 2, 2);
        }
      },
    },

    // An aisle of server racks that doesn't seem to end.
    'INFINITE SERVER': {
      still(c, W, H, a, r) {
        const col = a.accent, rackW = Math.max(96, W / Math.round(W / 118)), unit = 17;
        for (let x = 0; x < W; x += rackW) {
          c.strokeStyle = rgba(col, 0.16); c.lineWidth = 2;
          c.strokeRect(x + 7, 22, rackW - 14, H - 62);
          for (let y = 30; y < H - 54; y += unit) {
            const fade = 0.45 + 0.55 * (y / H);                        // quieter up where the bricks are
            c.fillStyle = rgba(col, 0.035 * fade); c.fillRect(x + 12, y, rackW - 24, unit - 4);
            c.strokeStyle = rgba(col, 0.09 * fade); c.lineWidth = 1;
            c.beginPath();
            for (let v = x + 30; v < x + rackW - 20; v += 6) { c.moveTo(v, y + 3); c.lineTo(v, y + unit - 7); }
            c.stroke();
            c.fillStyle = r() < 0.12 ? `rgba(255,154,0,${(0.5 * fade).toFixed(2)})` : rgba(col, (r() < 0.6 ? 0.5 : 0.12) * fade);
            c.fillRect(x + 16, y + 4, 4, 4);
            c.fillStyle = rgba(col, (r() < 0.4 ? 0.4 : 0.1) * fade);
            c.fillRect(x + 23, y + 4, 4, 4);
          }
        }
        floorGlow(c, W, H, col, 0.2);
      },
      live(c, W, H, t, a) {
        const rackW = Math.max(96, W / Math.round(W / 118)), unit = 17;
        for (let i = 0; i < 16; i++) {
          if (Math.sin(t * (2 + i % 5) + i * 2.4) < 0.2) continue;       // each light keeps its own time
          const x = (i * 5 % Math.round(W / rackW)) * rackW, y = 30 + ((i * 11) % Math.floor((H - 90) / unit)) * unit;
          c.fillStyle = rgba(a.accent, 0.75);
          c.fillRect(x + 16, y + 4, 4, 4);
        }
      },
    },

    // A world that stopped loading: wireframe hills, missing textures, loose debug text.
    'BROKEN SIMULATION': {
      still(c, W, H, a, r) {
        const col = a.accent;
        const sky = c.createLinearGradient(0, 0, 0, H * 0.6);
        sky.addColorStop(0, 'rgba(255,77,109,.05)'); sky.addColorStop(1, 'transparent');
        c.fillStyle = sky; c.fillRect(0, 0, W, H * 0.6);
        for (let k = 0; k < 5; k++) {                                   // missing-texture patches
          const x = Math.floor(r() * (W - 140) / 16) * 16, y = Math.floor((60 + r() * (H - 260)) / 16) * 16;
          const w = (3 + Math.floor(r() * 7)) * 16, h = (2 + Math.floor(r() * 4)) * 16;
          for (let yy = 0; yy < h; yy += 16) for (let xx = 0; xx < w; xx += 16) {
            c.fillStyle = (xx + yy) / 16 % 2 ? 'rgba(255,0,220,.11)' : 'rgba(0,0,0,.4)';
            c.fillRect(x + xx, y + yy, 16, 16);
          }
        }
        const base = H * 0.7, rows = 9, cols = 22;                      // the ground, as far as it got
        const hill = (i, j) => Math.sin(i * 0.7 + j * 0.9) * 16 + Math.sin(i * 0.27 - j * 0.4) * 22;
        const pt = (i, j) => {
          const depth = j / (rows - 1), w = W * (0.55 + 0.75 * depth);
          return [W / 2 + (i / (cols - 1) - 0.5) * w, base + depth * depth * (H - base) * 1.05 - hill(i, j) * (0.35 + depth * 0.8)];
        };
        c.strokeStyle = rgba(col, 0.2); c.lineWidth = 1;
        c.beginPath();
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          if (r() < 0.07) continue;                                     // polygons that never arrived
          const [x, y] = pt(i, j);
          if (i < cols - 1) { const [x2, y2] = pt(i + 1, j); c.moveTo(x, y); c.lineTo(x2, y2); }
          if (j < rows - 1) { const [x2, y2] = pt(i, j + 1); c.moveTo(x, y); c.lineTo(x2, y2); }
        }
        c.stroke();
        c.font = '700 13px "Share Tech Mono", monospace';
        for (const word of ['NaN', 'undefined', 'ERR_PHYSICS', 'null', 'vec3(?,?,?)', 'T-POSE', 'missing_tex.png', '0xFFFFFFFF']) {
          c.save(); c.translate(30 + r() * (W - 160), 70 + r() * (H - 200)); c.rotate((r() - 0.5) * 0.5);
          c.fillStyle = rgba(col, 0.2); c.fillText(word, 0, 0); c.restore();
        }
        floorGlow(c, W, H, col, 0.16);
      },
      live(c, W, H, t) {
        if (Math.floor(t * 3) % 7) return;                               // now and then a strip of it slips
        const y = (Math.floor(t * 3) * 97) % (H - 60) + 20;
        c.fillStyle = 'rgba(255,0,220,.09)'; c.fillRect(0, y, W, 6);
      },
    },
  };

  function build(arena, W, H) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = arena.bg; c.fillRect(0, 0, W, H);
    const p = PAINT[arena.name];
    // the same arena always paints the same picture
    if (p && p.still) { c.save(); p.still(c, W, H, arena, mulberry32(hashStr(arena.name))); c.restore(); }
    return cv;
  }

  return {
    // `live` false leaves out the moving details (battery saver, reduced screen FX)
    draw(ctx, arena, W, H, t, live = true) {
      const key = arena.name + '|' + W + '|' + H + '|' + fontsReady;
      if (key !== layerKey) { layer = build(arena, W, H); layerKey = key; }
      ctx.drawImage(layer, 0, 0);
      const p = PAINT[arena.name];
      if (live && p && p.live) { ctx.save(); p.live(ctx, W, H, t, arena); ctx.restore(); }
    },
    // the web fonts arrive after the first frame: repaint the text-bearing backdrops with them
    fontsLoaded() { fontsReady = true; thumbs.clear(); },
    // a small picture of an arena, for the codex (painted once at full size and kept)
    thumb(arena, w, h) {
      if (!thumbs.has(arena.name)) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(build(arena, 960, 640), 0, 0, w, h);
        thumbs.set(arena.name, cv);
      }
      return thumbs.get(arena.name);
    },
    has(name) { return !!PAINT[name]; },
    names() { return Object.keys(PAINT); },
  };
})();
