// ============ BREAKPOINT — icons ============
// Small drawings used by the menus and the HUD. Mode icons are inline SVG (they
// sit in HTML cards); power-up icons are canvas paths (they are drawn on the
// falling capsules as well as in the HUD and the codex).
'use strict';

// One per game mode, on a 24x24 grid, drawn in the card's own colour.
const MODE_ICONS = {
  classic:  '<path d="M2 5h20v14H2zM2 9.7h20M2 14.3h20M9 5v4.7M16 5v4.7M5.5 9.7v4.6M12.5 9.7v4.6M19 9.7v4.6M9 14.3V19M16 14.3V19"/>',
  endless:  '<path d="M7 8c-3 0-5 1.8-5 4s2 4 5 4c4 0 6-8 10-8 3 0 5 1.8 5 4s-2 4-5 4c-4 0-6-8-10-8z"/>',
  corrupt:  '<path d="M4 4h16v5H4zM7 10.5h15v4H7zM2 16h16v4H2z"/>',
  hardcore: '<path d="M12 20S3 14 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 14 12 20 12 20z"/><path d="M12 6l-2 4 4 2-2 4"/>',
  time:     '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9M9.5 3h5M12 3v3"/>',
  puzzle:   '<path d="M4 4h6v2.2a2 2 0 1 0 4 0V4h6v6h-2.2a2 2 0 1 0 0 4H20v6H4z"/>',
  bossrush: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  daily:    '<path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/><path d="M9 15l2 2 4-4"/>',
  ai:       '<path d="M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
};
function modeIcon(id) {
  return `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${MODE_ICONS[id] || ''}</svg>`;
}

// ---------------- power-up icons ----------------
// Each is drawn in a box 24 units across, centred on (0,0), in the power-up's
// colour. `c` is already translated and scaled when a painter runs.
const POWER_ICONS = {
  triple(c) { for (const [x, y] of [[0, -6], [-6.5, 5], [6.5, 5]]) { c.beginPath(); c.arc(x, y, 3.6, 0, 7); c.fill(); } },
  split(c) {
    c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 1); c.lineTo(-7, -6); c.moveTo(0, 1); c.lineTo(7, -6); c.stroke();
    for (const x of [-7, 7]) { c.beginPath(); c.arc(x, -6, 3, 0, 7); c.fill(); }
  },
  laser(c) {
    c.fillRect(-10, 6, 20, 3.5);
    c.beginPath(); c.moveTo(-7, 3); c.lineTo(-7, -10); c.moveTo(7, 3); c.lineTo(7, -10); c.stroke();
  },
  emp(c) { c.beginPath(); c.moveTo(2, -10); c.lineTo(-6, 1.5); c.lineTo(-0.5, 1.5); c.lineTo(-3, 10); c.lineTo(6, -2.5); c.lineTo(0.5, -2.5); c.closePath(); c.fill(); },
  gravity(c) {
    c.beginPath(); c.arc(0, -5.5, 4.2, 0, 7); c.fill();
    c.beginPath(); c.moveTo(0, 1); c.lineTo(0, 10); c.moveTo(-4, 6); c.lineTo(0, 10); c.lineTo(4, 6); c.stroke();
  },
  fire(c) {
    c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(9, -1, 6, 5.5); c.quadraticCurveTo(4, 10, 0, 10);
    c.quadraticCurveTo(-4, 10, -6, 5.5); c.quadraticCurveTo(-8, 0, -3, -4); c.quadraticCurveTo(-2, -1, 0, -1); c.quadraticCurveTo(-1, -6, 0, -10); c.fill();
  },
  freeze(c) {
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3, x = Math.cos(a) * 10, y = Math.sin(a) * 10;
      c.moveTo(-x, -y); c.lineTo(x, y);
    }
    c.stroke();
  },
  shield(c) { c.beginPath(); c.moveTo(0, -10); c.lineTo(8, -6.5); c.lineTo(8, 1); c.quadraticCurveTo(8, 7, 0, 10); c.quadraticCurveTo(-8, 7, -8, 1); c.lineTo(-8, -6.5); c.closePath(); c.stroke(); c.globalAlpha *= 0.35; c.fill(); },
  pulse(c) { c.beginPath(); c.arc(0, 0, 2.6, 0, 7); c.fill(); for (const r of [6, 10]) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); } },
  magnet(c) {
    c.lineWidth = 4.2;
    c.beginPath(); c.moveTo(-6, -9); c.lineTo(-6, 2); c.arc(0, 2, 6, Math.PI, 0, true); c.lineTo(6, -9); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-8.1, -10, 4.2, 3.4); c.fillRect(3.9, -10, 4.2, 3.4);
  },
  pierce(c) {
    c.strokeRect(-9, -1, 18, 5);
    c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -10); c.moveTo(-4, -6); c.lineTo(0, -10); c.lineTo(4, -6); c.stroke();
  },
  boom(c) {
    c.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 4.5 : 10.5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill();
  },
  slow(c) { c.beginPath(); c.moveTo(-6, -9); c.lineTo(6, -9); c.lineTo(-6, 9); c.lineTo(6, 9); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-3, 9); c.lineTo(0, 4); c.lineTo(3, 9); c.fill(); },
  warp(c) { c.beginPath(); c.arc(0, 0, 9, 0, 7); c.stroke(); c.beginPath(); c.moveTo(0, -5.5); c.lineTo(0, 0); c.lineTo(4.5, 2.5); c.stroke(); },
  gbomb(c) {
    c.beginPath(); c.arc(-1, 3, 6.5, 0, 7); c.fill();
    c.beginPath(); c.moveTo(3.5, -2); c.quadraticCurveTo(6, -6, 8.5, -6.5); c.stroke();
    c.fillRect(7.5, -10, 3, 3);
  },
  drone(c) {
    c.strokeRect(-5, -2, 10, 7); c.fillRect(-1.5, 0, 3, 3);
    c.beginPath(); c.moveTo(-11, -6); c.lineTo(-3, -6); c.moveTo(3, -6); c.lineTo(11, -6); c.moveTo(-7, -6); c.lineTo(-5, -2); c.moveTo(7, -6); c.lineTo(5, -2); c.stroke();
  },
  random(c) {
    c.strokeRect(-8, -8, 16, 16);
    for (const [x, y] of [[-4, -4], [0, 0], [4, 4]]) { c.beginPath(); c.arc(x, y, 1.7, 0, 7); c.fill(); }
  },
  life(c) { c.beginPath(); c.moveTo(0, 9); c.bezierCurveTo(-13, 0, -9, -10, 0, -4); c.bezierCurveTo(9, -10, 13, 0, 0, 9); c.fill(); },
  mult(c) { c.font = '900 15px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('x2', 0, 1); },
  wide(c) {
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.moveTo(-6, -4); c.lineTo(-10, 0); c.lineTo(-6, 4); c.moveTo(6, -4); c.lineTo(10, 0); c.lineTo(6, 4); c.stroke();
    c.fillRect(-6, 6, 12, 3);
  },
};

// Draws a power-up's icon `size` pixels across, centred on x,y.
function drawPowerIcon(c, kind, x, y, size, color) {
  const paint = POWER_ICONS[kind];
  c.save();
  c.translate(x, y); c.scale(size / 24, size / 24);
  c.fillStyle = c.strokeStyle = color || (POWERUPS[kind] && POWERUPS[kind].color) || '#fff';
  c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
  if (paint) paint(c);
  else { c.font = '700 11px Orbitron, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((POWERUPS[kind] || {}).tag || '?', 0, 1); }
  c.restore();
}

// The same icon as an image address, for the HUD's HTML tags. Made once each.
const powerIconUrl = (() => {
  const made = {};
  return (kind) => {
    if (!made[kind]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 48;
      drawPowerIcon(cv.getContext('2d'), kind, 24, 24, 44);
      made[kind] = cv.toDataURL();
    }
    return made[kind];
  };
})();
