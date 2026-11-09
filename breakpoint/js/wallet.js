// ============ SHARED WITH GLITCH PONG: coin wallet, cabinet bridge, paddle colour ============
'use strict';

// Glitch Pong (glitchpong-site.js → GlitchcadeWallet) keeps the arcade's coins
// in localStorage under this key, and PRIZETRON-80's prize counter spends them.
// Break Point reads and writes the same record so coins earned here buy prizes
// there. Browsers only share localStorage within one origin, so the two games
// must be served from the same site (e.g. both on <user>.github.io, or Break
// Point inside the Glitchcade's own folder) for the balance to carry over.
//
// Keep the record's shape exactly as Glitch Pong writes it: its read() drops
// any field it doesn't know about the next time it saves.
const Wallet = (() => {
  const KEY = 'glitchcade_wallet_v1';

  function read() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d.coins === 'number') {
        return {
          coins: Math.max(0, Math.floor(d.coins)),
          earned: Math.max(0, Math.floor(d.earned || 0)),
          wins: Math.max(0, Math.floor(d.wins || 0)),
          prizes: Array.isArray(d.prizes) ? d.prizes.filter((p) => typeof p === 'string') : [],
        };
      }
    } catch (e) {}
    return { coins: 0, earned: 0, wins: 0, prizes: [] };
  }

  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('glitchcade:wallet', { detail: d })); } catch (e) {}
    return d;
  }

  return {
    KEY,
    get: read,
    // `wins` is Glitch Pong's match-win count (PRIZETRON quotes it), so Break
    // Point only adds coins.
    award(n) {
      const d = read();
      if (n <= 0) return d;
      d.coins += n;
      d.earned += n;
      return write(d);
    },
  };
})();

// What a cleared sector pays. A Glitch Pong win against the AI pays 10.
const COINS = { sector: 2, boss: 10 };

// Running inside the Glitchcade's Break Point cabinet (an iframe the arcade opens
// with ?cabinet). The arcade listens for this message to put the player back in
// front of the machine.
const Cabinet = {
  active: new URLSearchParams(location.search).has('cabinet') && window.parent !== window,
  exit() {
    if (!this.active) return;
    try { window.parent.postMessage({ type: 'glitchcade:exit', game: 'breakpoint' }, '/'); } catch (e) {}
  },
};

// ============ PADDLE COLOUR — shared with Glitch Pong ============
// Glitch Pong saves both players' paddle colours as {blue, red} under this key
// (glitchpong-site.js → paddleColorSelection). You are the blue player when you
// play the AI there, so Break Point's paddle takes the blue colour, and changing
// it here changes it there. Same six options, ids and hex values.
const PADDLE_COLORS = [
  { id: 'cyan',    name: 'ION CYAN',    hex: '#00d9ff' },
  { id: 'magenta', name: 'HOT MAGENTA', hex: '#ff4fd8' },
  { id: 'gold',    name: 'SOLAR GOLD',  hex: '#ffd166' },
  { id: 'orange',  name: 'EMBER ORANGE', hex: '#ff8a3d' },
  { id: 'violet',  name: 'ULTRAVIOLET', hex: '#b18cff' },
  { id: 'white',   name: 'GHOST WHITE', hex: '#f4f7ff' },
];

const PaddleColor = (() => {
  const KEY = 'glitchPongPaddleColors';
  const valid = (id) => PADDLE_COLORS.some(c => c.id === id);
  let current = PADDLE_COLORS[0];

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && valid(v.blue) && valid(v.red)) return { blue: v.blue, red: v.red };
    } catch (e) {}
    return { blue: 'cyan', red: 'magenta' };
  }
  function refresh() {
    const id = read().blue;
    current = PADDLE_COLORS.find(c => c.id === id) || PADDLE_COLORS[0];
    return current;
  }
  // Step to the next colour. Glitch Pong never lets both players share one,
  // so taking the red player's colour swaps the two.
  function cycle() {
    const sel = read();
    const i = PADDLE_COLORS.findIndex(c => c.id === sel.blue);
    const next = PADDLE_COLORS[(i + 1) % PADDLE_COLORS.length].id;
    if (next === sel.red) sel.red = sel.blue;
    sel.blue = next;
    try { localStorage.setItem(KEY, JSON.stringify(sel)); } catch (e) {}
    return refresh();
  }
  refresh();
  return {
    KEY, refresh, cycle,
    get hex() { return current.hex; },
    get name() { return current.name; },
  };
})();
