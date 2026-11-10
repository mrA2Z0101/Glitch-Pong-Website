// ═══════════════════════════════════════════════════════════════════════════
// GLITCH POWER — one place for "how hard should we work right now?"
//
// A plain script (not a module) so the arcade, Glitch Pong and Breakpoint, which
// is a separate page in a frame, can all load it. Exposes window.GlitchPower, and
// module.exports under Node for the tests.
//
//   · Battery saver: the stored switch (the same record Glitch Pong's settings
//     button has always written) plus a live "battery is low and unplugged" check.
//   · A frame pacer: draws at most N frames a second, so a 120 Hz phone does not
//     do twice the work of a 60 Hz one, and a screen nobody is touching can idle.
//   · The policy that says how many frames each situation deserves.
// ═══════════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlitchPower = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const KEY = 'glitchPongPerformance';       // Glitch Pong's setting; kept so one switch rules all three
  const LOW_BATTERY = 0.2;                   // unplugged at or below 20% counts as low
  const REREAD_MS = 1000;                    // the stored switch is re-read at most this often
  const TOLERANCE_MS = 1.5;                  // vsync timestamps jitter; don't skip a frame that is merely early

  const listeners = [];
  let stored = false;
  let readAt = -Infinity;
  let low = false;
  let lastSaving = null;

  const clock = () => (root.performance && root.performance.now ? root.performance.now() : Date.now());

  function readStored(force) {
    const t = clock();
    if (!force && t - readAt < REREAD_MS) return stored;
    readAt = t;
    try {
      const d = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      stored = !!(d && d.batterySaver);
    } catch (e) { stored = false; }
    return stored;
  }

  function notify() {
    const now = api.saving;
    if (now === lastSaving) return;
    lastSaving = now;
    listeners.slice().forEach((fn) => { try { fn(now); } catch (e) {} });
  }

  // ── frame pacing ──────────────────────────────────────────────────────────
  // due(now, fps) answers "should this vsync draw a frame?". It keeps the average
  // rate at `fps` even when the display's refresh isn't a multiple of it (a 90 Hz
  // screen asked for 60 alternates long and short gaps instead of settling on 45).
  function createPacer() {
    let then = -Infinity;
    return {
      due(now, fps) {
        if (!(fps > 0) || fps >= 1000) { then = now; return true; }
        const interval = 1000 / fps;
        const elapsed = now - then;
        if (elapsed < interval - TOLERANCE_MS) return false;
        // Stay on the nominal schedule so the cadence doesn't drift; after a stall
        // (a backgrounded tab, a hitch) start over rather than bank a burst of frames.
        then = elapsed > interval * 2 ? now : then + interval;
        return true;
      },
      reset() { then = -Infinity; }
    };
  }

  // How many frames a second a situation deserves.
  //   idle   menus, pause screens, anything with a full-screen card on top
  //   calm   a live scene nobody is moving through right now
  //   active walking, looking around, playing: motion the player can feel
  // Desktops that aren't saving are left alone, except that menus gain nothing
  // from 144 frames a second.
  function fpsFor({ touch, saving, mode }) {
    if (saving) return mode === 'active' ? 30 : 20;
    if (touch) return mode === 'active' ? 60 : 30;
    return mode === 'idle' ? 60 : Infinity;
  }

  // ── the battery ───────────────────────────────────────────────────────────
  // Chrome and Android expose the Battery API; Safari doesn't, so there it is
  // only ever the switch. Whatever it says, the player's own switch wins.
  try {
    if (root.navigator && typeof root.navigator.getBattery === 'function') {
      root.navigator.getBattery().then((b) => {
        const update = () => { low = !b.charging && b.level <= LOW_BATTERY; notify(); };
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
        update();
      }).catch(() => {});
    }
  } catch (e) {}

  const api = {
    KEY, LOW_BATTERY, TOLERANCE_MS,
    createPacer, fpsFor,
    // the player's switch
    get batterySaver() { return readStored(false); },
    setBatterySaver(on) {
      stored = !!on;
      readAt = clock();
      try { root.localStorage.setItem(KEY, JSON.stringify({ batterySaver: stored })); } catch (e) {}
      notify();
      return stored;
    },
    // the battery, live
    get lowBattery() { return low; },
    // should we be saving power right now, for either reason?
    get saving() { return readStored(false) || low; },
    // 'off' | 'on' | 'auto' (low battery, switch off) for labels
    get state() { return readStored(false) ? 'on' : low ? 'auto' : 'off'; },
    // called with the new `saving` value whenever it changes
    onChange(fn) {
      listeners.push(fn);
      lastSaving = lastSaving === null ? api.saving : lastSaving;
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    // pick up a change another page made (Glitch Pong's settings, another tab)
    refresh() { readStored(true); notify(); },
    // tests
    _setLowBattery(v) { low = !!v; notify(); }
  };

  try {
    if (root.addEventListener) root.addEventListener('storage', (e) => { if (!e || e.key === KEY) api.refresh(); });
  } catch (e) {}

  return api;
});
