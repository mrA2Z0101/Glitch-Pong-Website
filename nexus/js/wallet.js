// ═══════════════════════════════════════════════════════════════════════════
// BLACK-HOLE NEXUS — what it shares with the rest of the Glitchcade
//
// The coin wallet, the cabinet bridge, the ball's colour, skin and trail, and
// the things NULL is allowed to know about the other two cabinets. The same
// records Breakpoint reads (breakpoint/js/wallet.js), so everything here
// carries over between the three games as long as they are served from one site.
// ═══════════════════════════════════════════════════════════════════════════
import { SAVE_KEY, sanitizeSave } from './rules.js';

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
const num = (v) => Math.max(0, Math.floor(Number(v) || 0));

// Glitch Pong (glitchpong-site.js → GlitchcadeWallet) keeps the arcade's coins
// here. Keep the record's shape exactly as it writes it: its read() drops any
// field it doesn't know the next time it saves.
export const Wallet = {
  KEY: 'glitchcade_wallet_v1',
  get() {
    const d = readJson(this.KEY);
    if (d && typeof d.coins === 'number') {
      return { coins: num(d.coins), earned: num(d.earned), wins: num(d.wins), prizes: Array.isArray(d.prizes) ? d.prizes.filter((p) => typeof p === 'string') : [] };
    }
    return { coins: 0, earned: 0, wins: 0, prizes: [] };
  },
  award(n) {
    const d = this.get();
    if (!(n > 0)) return d;
    d.coins += n;
    d.earned += n;
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('glitchcade:wallet', { detail: d })); } catch (e) {}
    return d;
  }
};

// This cabinet's own record (see defaultSave in js/rules.js).
export const Save = {
  fresh: readJson(SAVE_KEY) === null,          // nothing saved yet: the first visit
  data: sanitizeSave(readJson(SAVE_KEY)),
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {} },
  reset() { this.data = sanitizeSave(null); this.write(); }
};

// Running inside the Glitchcade's cabinet 03 (a frame the arcade opens with
// ?cabinet). The arcade listens for these messages to put the player back in
// front of the machine and to keep its high-score board.
export const Cabinet = {
  active: new URLSearchParams(location.search).has('cabinet') && window.parent !== window,
  exit() {
    if (!this.active) return;
    try { window.parent.postMessage({ type: 'glitchcade:exit', game: 'nexus' }, '/'); } catch (e) {}
  },
  report(event, detail) {
    if (!this.active) return;
    try { window.parent.postMessage(Object.assign({ type: 'glitchcade:nexus', event }, detail), '/'); } catch (e) {}
  }
};

// The ball wears what the blue player wears in Glitch Pong: its colour, its
// skin and its trail (../glitchpong-cosmetics.js has the catalog and the
// drawing code). Without that file everything is drawn the standard way.
const COLORS = {
  cyan: '#00d9ff', magenta: '#ff4fd8', gold: '#ffd166', orange: '#ff8a3d', violet: '#b18cff', white: '#f4f7ff'
};
export const Look = (() => {
  const cos = () => (typeof GlitchCosmetics !== 'undefined' ? GlitchCosmetics : null);   // eslint-disable-line no-undef
  let worn = {}, hex = COLORS.cyan;
  function refresh() {
    const c = cos();
    try { if (c) c.load(); } catch (e) {}
    worn = {};
    const sel = readJson('glitchPongPaddleColors');
    hex = COLORS[sel && sel.blue] || COLORS.cyan;
  }
  function get(slot) {
    if (!(slot in worn)) {
      const c = cos();
      try { worn[slot] = c ? c.getEquipped('blue', slot) : 'default'; } catch (e) { worn[slot] = 'default'; }
    }
    return worn[slot];
  }
  function name(slot) {
    const c = cos();
    try { const it = c && c.find(slot, get(slot)); return it ? it.name : 'STANDARD'; } catch (e) { return 'STANDARD'; }
  }
  // step to the next skin or trail you own
  function cycle(slot) {
    const c = cos();
    if (!c) return null;
    let mine = [];
    try {
      const d = readJson('glitchPong_progression_v1');
      const unlocked = Array.isArray(d && d.cosmeticsUnlocked) ? d.cosmeticsUnlocked : [];
      mine = c.CATALOG[slot].filter((it) => it.id === 'default' || it.unlock.type === 'free' || unlocked.includes(slot + '-' + it.id));
    } catch (e) {}
    if (!mine.length) return null;
    const next = mine[(mine.findIndex((it) => it.id === get(slot)) + 1) % mine.length];
    try { c.equip('blue', slot, next.id); } catch (e) {}
    worn = {};
    return next;
  }
  refresh();
  return {
    refresh, get, name, cycle,
    get available() { return !!cos(); },
    get hex() { return hex; },
    get rgb() { const n = parseInt(hex.slice(1, 7), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; },
    draw: {
      trail(ctx, trail, look) { const c = cos(); if (c) c.drawBallTrail(ctx, get('trail'), trail, look); },
      ball(ctx, x, y, r, look) { const c = cos(); if (c) c.drawBallSkin(ctx, get('ball'), x, y, r, look); }
    }
  };
})();

// What NULL knows about the other two cabinets. It only ever reads.
export function otherCabinets() {
  const gp = readJson('glitchPong_progression_v1') || {};
  const bp = readJson('glitchcade_breakpoint_v1') || {};
  return {
    pongRally: num(gp.longestRally),
    pongWins: num(gp.wins),
    pongLosses: num(gp.losses),
    bpSectors: num(bp.sectors)
  };
}
