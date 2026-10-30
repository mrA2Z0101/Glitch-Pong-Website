// Injected before page scripts: virtual clock driving rAF, timers, performance.now and Date.now.
(() => {
  let vt = 0;
  const t0 = Date.now();
  const base = performance.now();
  let rafQ = [], rafId = 1, timers = [], tid = 1e6;
  window.requestAnimationFrame = (cb) => { const id = rafId++; rafQ.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((r) => r.id !== id); };
  performance.now = () => base + vt;
  Date.now = () => t0 + vt;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = tid++; timers.push({ id, at: vt + Math.max(0, +ms || 0), fn, args }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = tid++; timers.push({ id, at: vt + Math.max(1, +ms || 1), fn, args, every: Math.max(1, +ms || 1) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers = timers.filter((t) => t.id !== id); };
  let seed = 12345;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = rnd;
  window.__seed = (n) => { seed = n | 0; };
  window.__gpFrame = 0;
  window.__sfxLog = [];
  window.__step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      vt += 1000 / 60;
      window.__gpFrame++;
      for (let guard = 0; guard < 500; guard++) {
        let due = null;
        for (const t of timers) if (t.at <= vt && (!due || t.at < due.at)) due = t;
        if (!due) break;
        if (due.every) due.at += due.every; else timers = timers.filter((t) => t !== due);
        try { typeof due.fn === "function" ? due.fn(...due.args) : (0, eval)(due.fn); } catch (e) { console.error("timer", e && e.stack); }
      }
      const q = rafQ; rafQ = [];
      for (const r of q) { try { r.cb(base + vt); } catch (e) { console.error("raf", e && e.stack); } }
    }
    return window.__gpFrame;
  };
})();
