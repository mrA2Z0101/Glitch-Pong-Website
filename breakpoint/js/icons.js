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
