"use strict";

// Prizes that only Breakpoint can wear: how its bricks look, and what a brick
// does when it breaks. PRIZETRON-80 sells them for Glitchcade coins from the
// rack on the prize counter (glitchcade-floor.js), and Breakpoint's Settings
// screen equips them (breakpoint/js/game.js draws them).
//
// The arcade page and the Breakpoint page both load this file and share the
// record through localStorage, the same way they share the coin wallet. It has
// no page code of its own, so tests/breakpoint-prizes.test.mjs runs it under Node.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlitchBreakpointPrizes = api;
})(typeof self !== "undefined" ? self : this, function () {
  const KEY = "glitchcade_breakpoint_prizes_v1";

  // Each slot has a free default that everyone owns.
  const SLOTS = {
    bricks: { noun: "BREAKPOINT BRICKS", label: "Bricks" },
    burst:  { noun: "BREAKPOINT BREAK EFFECT", label: "Break Effect" }
  };
  const CATALOG = [
    { slot: "bricks", id: "default",  name: "HOLO BRICKS",   cost: 0,  desc: "The standard glowing outlines." },
    { slot: "bricks", id: "pixel",    name: "8-BIT BRICKS",  cost: 25, desc: "Solid, chunky and bevelled, as on the first cabinets." },
    { slot: "bricks", id: "glass",    name: "GLASS BRICKS",  cost: 45, desc: "Clear panes with a glint across each one." },
    { slot: "bricks", id: "bullion",  name: "GOLD BULLION",  cost: 80, desc: "Every brick is a gold bar, with a stripe in its own colour." },
    { slot: "burst",  id: "default",  name: "SPARKS",        cost: 0,  desc: "The standard burst of sparks." },
    { slot: "burst",  id: "confetti", name: "CONFETTI",      cost: 20, desc: "Every brick goes off like a party popper." },
    { slot: "burst",  id: "shards",   name: "GLASS SHARDS",  cost: 35, desc: "Pale splinters that fall away under their own weight." },
    { slot: "burst",  id: "coins",    name: "COIN SHOWER",   cost: 60, desc: "Gold coins jump out and drop. They are not real coins." }
  ];
  const find = (slot, id) => CATALOG.find((p) => p.slot === slot && p.id === id) || null;
  const key = (slot, id) => slot + "-" + id;

  function defaults() { return { owned: [], equipped: { bricks: "default", burst: "default" } }; }
  // Rebuilds a record from whatever was stored, keeping only what the catalog knows.
  function sanitize(raw) {
    const out = defaults();
    if (!raw || typeof raw !== "object") return out;
    if (Array.isArray(raw.owned)) {
      for (const k of raw.owned) {
        if (typeof k !== "string" || out.owned.includes(k)) continue;
        const i = k.indexOf("-");
        const item = i > 0 ? find(k.slice(0, i), k.slice(i + 1)) : null;
        if (item && item.cost > 0) out.owned.push(k);
      }
    }
    for (const slot of Object.keys(SLOTS)) {
      const id = raw.equipped && raw.equipped[slot];
      if (typeof id === "string" && find(slot, id) && (id === "default" || out.owned.includes(key(slot, id)))) out.equipped[slot] = id;
    }
    return out;
  }

  const storage = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };
  function read() {
    const s = storage();
    if (!s) return defaults();
    try { return sanitize(JSON.parse(s.getItem(KEY) || "null")); } catch (e) { return defaults(); }
  }
  function write(state) {
    const s = storage();
    if (s) { try { s.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
    return state;
  }

  const owns = (slot, id, state) => id === "default" || (state || read()).owned.includes(key(slot, id));

  // Everything with a price, cheapest first, with whether it is already owned.
  function forSale() {
    const state = read();
    return CATALOG.filter((p) => p.cost > 0)
      .map((p) => ({ slot: p.slot, item: p, cost: p.cost, owned: owns(p.slot, p.id, state) }))
      .sort((a, b) => a.cost - b.cost);
  }

  // `wallet` is anything with spend(n) that returns a falsy value when the
  // coins aren't there. Returns "ok", "owned", "poor" or "invalid".
  function buy(slot, id, wallet) {
    const item = find(slot, id);
    if (!item || !(item.cost > 0)) return "invalid";
    const state = read();
    if (owns(slot, id, state)) return "owned";
    if (!wallet || typeof wallet.spend !== "function" || !wallet.spend(item.cost)) return "poor";
    state.owned.push(key(slot, id));
    write(state);
    return "ok";
  }

  // What is being worn in a slot (always something the player owns).
  function equipped(slot) { return read().equipped[slot] || "default"; }
  function equip(slot, id) {
    const state = read();
    if (!SLOTS[slot] || !find(slot, id) || !owns(slot, id, state)) return false;
    state.equipped[slot] = id;
    write(state);
    return true;
  }
  // The items a player can wear in a slot, default first.
  function wardrobe(slot) {
    const state = read();
    return CATALOG.filter((p) => p.slot === slot && owns(slot, p.id, state));
  }
  // Wears the next owned item in a slot and returns it.
  function cycle(slot) {
    const mine = wardrobe(slot);
    const at = mine.findIndex((p) => p.id === equipped(slot));
    const next = mine[(at + 1) % mine.length];
    equip(slot, next.id);
    return next;
  }

  return { KEY, SLOTS, CATALOG, find, sanitize, forSale, buy, owns, equipped, equip, wardrobe, cycle };
});
