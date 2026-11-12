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

// How many sectors you have cleared by hand, ever. Glitch Pong's Store reads this
// (glitchpong-site.js → glitchBreakpointSectors) to unlock its Breakpoint cosmetics.
const SectorLog = (() => {
  const KEY = 'glitchcade_breakpoint_v1';
  function read() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      return Math.max(0, Math.floor(Number(d && d.sectors) || 0));
    } catch (e) { return 0; }
  }
  return {
    KEY,
    get: read,
    add() {
      const n = read() + 1;
      try { localStorage.setItem(KEY, JSON.stringify({ sectors: n })); } catch (e) {}
      return n;
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
  // A mode the arcade asked for with ?cabinet&mode=bossrush (the Eye gauntlet
  // cabinet does): the run starts straight away instead of at the menu.
  get startMode() {
    const m = new URLSearchParams(location.search).get('mode');
    return this.active && m && /^[a-z]{1,12}$/.test(m) ? m : null;
  },
  // Tell the arcade how a run went so its high-score board and the Eye
  // gauntlet can keep up. Scores from AI-assisted runs are never reported.
  report(event, detail) {
    if (!this.active) return;
    try { window.parent.postMessage(Object.assign({ type: 'glitchcade:breakpoint', event }, detail), '/'); } catch (e) {}
  },
};

// ============ SKINS — shared with Glitch Pong ============
// Paddle skins, ball skins and ball trails come from Glitch Pong's Store
// (../glitchpong-cosmetics.js, which this page loads for its catalog and its
// drawing code). You are the blue player there, so Break Point wears what the
// blue side has equipped, and changing it here changes it there. What you have
// unlocked is recorded in Glitch Pong's progression save.
// If the file isn't there (Break Point copied out on its own) everything is
// drawn the standard way.
const hexRgb = (hex) => { const n = parseInt(String(hex).slice(1, 7), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; };

const Skins = (() => {
  const cos = () => (typeof GlitchCosmetics !== 'undefined' ? GlitchCosmetics : null);
  const PROGRESSION_KEY = 'glitchPong_progression_v1', COSMETICS_KEY = 'glitchPong_cosmetics_v1';
  let worn = {};
  function unlocked() {
    try {
      const d = JSON.parse(localStorage.getItem(PROGRESSION_KEY));
      return Array.isArray(d && d.cosmeticsUnlocked) ? d.cosmeticsUnlocked : [];
    } catch (e) { return []; }
  }
  function refresh() { const c = cos(); if (c) c.load(); worn = {}; }
  // the id worn in 'paddle', 'ball' or 'trail' ('default' draws Break Point's own)
  function get(slot) {
    if (!(slot in worn)) { const c = cos(); worn[slot] = c ? c.getEquipped('blue', slot) : 'default'; }
    return worn[slot];
  }
  function wardrobe(slot) {
    const c = cos();
    if (!c) return [];
    const mine = unlocked();
    return c.CATALOG[slot].filter((it) => it.id === 'default' || it.unlock.type === 'free' || mine.includes(slot + '-' + it.id));
  }
  function total(slot) { const c = cos(); return c ? c.CATALOG[slot].length : 0; }
  function cycle(slot) {
    const c = cos(), mine = wardrobe(slot);
    if (!c || !mine.length) return null;
    const next = mine[(mine.findIndex((it) => it.id === get(slot)) + 1) % mine.length];
    c.equip('blue', slot, next.id);
    worn = {};
    return next;
  }
  function name(slot) { const c = cos(), it = c && c.find(slot, get(slot)); return it ? it.name : 'STANDARD'; }
  return { PROGRESSION_KEY, COSMETICS_KEY, get available() { return !!cos(); }, get, wardrobe, total, cycle, name, refresh };
})();

// ============ PRIZES — Break Point only ============
// Brick styles and break effects, sold by PRIZETRON-80 at the Glitchcade's prize
// counter (../glitchcade-breakpoint-prizes.js holds the catalog and the record).
// What is worn is read once and kept, because bricks ask every frame.
const Prizes = (() => {
  const api = () => (typeof GlitchBreakpointPrizes !== 'undefined' ? GlitchBreakpointPrizes : null);
  let worn = { bricks: 'default', burst: 'default' };
  function refresh() { const p = api(); if (p) worn = { bricks: p.equipped('bricks'), burst: p.equipped('burst') }; }
  refresh();
  return {
    get available() { return !!api(); },
    get KEY() { const p = api(); return p ? p.KEY : null; },
    get bricks() { return worn.bricks; },
    get burst() { return worn.burst; },
    refresh,
    cycle(slot) { const p = api(); if (!p) return null; const it = p.cycle(slot); refresh(); return it; },
    name(slot) { const p = api(), it = p && p.find(slot, worn[slot]); return it ? it.name : 'STANDARD'; },
    owned(slot) { const p = api(); return p ? p.wardrobe(slot).length : 1; },
    total(slot) { const p = api(); return p ? p.CATALOG.filter((it) => it.slot === slot).length : 1; },
  };
})();

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
