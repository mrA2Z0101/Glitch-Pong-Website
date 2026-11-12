// ============ BREAKPOINT — rules ============
// The parts of the game that are decisions, not drawing: how XP becomes a level,
// what an upgrade costs and when it can be bought, how a sector is laid out,
// what a brick is worth, what each arena does to the ball, what the codex shows,
// how a run is summed up. Nothing here touches the page or the canvas, so
// tests/breakpoint-rules.test.mjs runs it under Node. js/game.js calls into it.
//
// Loaded after js/config.js, whose tables (BRICKS, UPGRADES, MODES...) it reads.
'use strict';

const Rules = (() => {
  // ---------------- progression ----------------
  // XP needed for each level grows as 100 * level^1.35.
  function levelFromXp(xp) {
    let level = 1, need = 100, left = Math.max(0, Math.floor(xp || 0));
    while (left >= need) { left -= need; level++; need = Math.floor(100 * Math.pow(level, 1.35)); }
    return { level, progress: left / need, into: left, need };
  }

  // ---------------- upgrades ----------------
  // Three branches of four. A node can be bought once the node above it in its
  // branch has at least one rank, so each branch reads top to bottom.
  const UPGRADE_TREE = [
    { id: 'paddle',  name: 'PADDLE',   nodes: ['pad_len', 'pad_spd', 'magnet', 'laser'] },
    { id: 'survive', name: 'SURVIVAL', nodes: ['damp', 'life_up', 'shield0', 'emp'] },
    { id: 'score',   name: 'SCORE',    nodes: ['luck', 'xp_boost', 'crit', 'startmult'] },
  ];
  const upgradeDef = (id) => UPGRADES.find((u) => u.id === id);
  // Each rank costs double the one before.
  function upgradeCost(id, rank) { return Math.round(upgradeDef(id).cost * Math.pow(2, rank)); }
  function upgradeParent(id) {
    for (const branch of UPGRADE_TREE) {
      const i = branch.nodes.indexOf(id);
      if (i > 0) return branch.nodes[i - 1];
      if (i === 0) return null;
    }
    return null;
  }
  // Where an upgrade stands for a save: 'max' (nothing left to buy), 'locked'
  // (the node above it isn't owned), 'buy' (affordable) or 'short' (not yet).
  function upgradeState(id, ranks, credits) {
    const def = upgradeDef(id), rank = (ranks && ranks[id]) || 0;
    const parent = upgradeParent(id);
    const cost = rank >= def.max ? 0 : upgradeCost(id, rank);
    let state;
    if (rank >= def.max) state = 'max';
    // something already owned can always be ranked up, whatever sits above it
    else if (parent && !((ranks && ranks[parent]) || 0) && !rank) state = 'locked';
    else state = credits >= cost ? 'buy' : 'short';
    return { id, rank, max: def.max, cost, state, parent, short: state === 'short' ? cost - credits : 0 };
  }
  // Buys one rank. Returns the new { ranks, credits }, or null if it can't be bought.
  function buyUpgrade(id, ranks, credits) {
    const s = upgradeState(id, ranks, credits);
    if (s.state !== 'buy') return null;
    return { ranks: Object.assign({}, ranks, { [id]: s.rank + 1 }), credits: credits - s.cost };
  }

  // ---------------- daily glitch ----------------
  // Two or three mutators, picked by the date so everyone gets the same ones.
  function dailyMods(dateStr) {
    const r = mulberry32(hashStr('gb_' + dateStr) ^ 0x5f5f5f);
    const pool = DAILY_MODS.slice(), out = [];
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }
  function dailySeed(dateStr) { return hashStr('gb_' + dateStr); }

  return {
    levelFromXp,
    UPGRADE_TREE, upgradeCost, upgradeParent, upgradeState, buyUpgrade,
    dailyMods, dailySeed,
  };
})();
