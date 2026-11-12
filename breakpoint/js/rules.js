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

  // ---------------- arenas ----------------
  // Every arena has one rule of its own. js/config.js gives each arena a rule
  // id; this is what the rule is called and what the player is told about it.
  const ARENA_RULES = {
    standard:  { name: 'STANDARD',         line: 'The original court. No tricks.' },
    lightBar:  { name: 'LIGHT BAR',        line: 'A neon bar patrols the middle and bats the ball away.' },
    pulse:     { name: 'REACTOR PULSE',    line: 'The core charges, then throws every ball near it outward.' },
    leak:      { name: 'LEAKING PADDLE',   line: 'Every return costs the paddle some length. Catch a power-up to get it back.' },
    tunnels:   { name: 'HIVE TUNNELS',     line: 'Two gates. In one, out the other.' },
    beam:      { name: 'LIGHT BEAM',       line: 'A beam sweeps the nave and turns the ball back.' },
    badSector: { name: 'BAD SECTOR',       line: 'A corrupted patch of the board scrambles the ball\'s direction.' },
    defender:  { name: 'DEFENDER',         line: 'The mainframe has a paddle of its own. It blocks shots on their way up.' },
    wrap:      { name: 'NO SIDE WALLS',    line: 'The ball leaves one side and comes back in the other.' },
    well:      { name: 'GRAVITY WELL',     line: 'A black hole drifts across the field and bends the ball toward it.' },
    descend:   { name: 'DESCENDING RACKS', line: 'The whole wall drops a row every 14 seconds.' },
    drift:     { name: 'DRIFT',            line: 'Sideways gravity that keeps changing its mind.' },
  };
  const ARENA_TUNING = {
    leak:     { perReturn: 0.03, least: 0.6 },               // share of the paddle lost per return, and the least it shrinks to
    pulse:    { every: 9, warn: 1.6, radius: 230, y: 340 },   // seconds between pulses, seconds of warning, reach in pixels
    defender: { width: 120, height: 10, speed: 170, y: 440, sees: 300 },
    descend:  { every: 14, warn: 2, step: 30, gap: 150 },     // a row is 30 pixels; it stops this far above the paddle
    drift:    { accel: 150, rate: 0.45 },                     // sideways pull in pixels a second squared, and how fast it swings
  };
  function arenaRule(arena) { return ARENA_RULES[arena && arena.rule] || ARENA_RULES.standard; }

  // MEMORY LEAK: how long the paddle is after this many returns (1 is full length).
  function leakFactor(returns) {
    const t = ARENA_TUNING.leak;
    return Math.max(t.least, 1 - t.perReturn * Math.max(0, returns));
  }

  // QUANTUM REACTOR. `s` is { t }: seconds since the last pulse. Returns how
  // charged the core is (0 until the warning starts, then up to 1) and whether
  // it fired on this step.
  function pulseTick(s, dt) {
    const t = ARENA_TUNING.pulse;
    s.t += dt;
    if (s.t >= t.every) { s.t = 0; return { fired: true, charge: 0 }; }
    return { fired: false, charge: Math.max(0, (s.t - (t.every - t.warn)) / t.warn) };
  }
  // A pulse throws a ball inside its reach straight away from the core, at the
  // speed it already had. Returns whether this ball was in reach.
  function pulseKick(ball, cx, cy) {
    const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy);
    if (d > ARENA_TUNING.pulse.radius) return false;
    const speed = Math.hypot(ball.vx, ball.vy);
    // a ball sitting on the core goes straight up rather than nowhere
    const ux = d < 1 ? 0 : dx / d, uy = d < 1 ? -1 : dy / d;
    ball.vx = ux * speed; ball.vy = uy * speed;
    return true;
  }

  // AI MAINFRAME. The defender is a bar at a fixed height that slides toward
  // whichever ball is coming up at it. It moves slower than a ball does, so an
  // angled shot gets round it. `d` is { x }.
  function defenderStep(d, balls, dt, W) {
    const t = ARENA_TUNING.defender;
    let target = null;
    for (const b of balls) {
      if (b.stuck || b.dead || !(b.vy < 0) || b.y < t.y || b.y > t.y + t.sees) continue;
      if (!target || b.y < target.y) target = b;           // the one that will arrive first
    }
    if (target) {
      const step = t.speed * dt, off = target.x - d.x;
      d.x += Math.abs(off) <= step ? off : Math.sign(off) * step;
    }
    d.x = Math.min(W - t.width / 2, Math.max(t.width / 2, d.x));
    return d.x;
  }
  // Does a ball that was at `prevY` and is now at ball.y hit the defender?
  // Only on the way up: a falling ball passes through it.
  function defenderBlocks(d, ball, prevY) {
    const t = ARENA_TUNING.defender, bottom = t.y + t.height / 2, r = ball.r || 0;
    if (!(ball.vy < 0)) return false;
    if (prevY - r < bottom || ball.y - r > bottom) return false;      // didn't reach the underside on this step
    return Math.abs(ball.x - d.x) <= t.width / 2 + r;
  }

  // INFINITE SERVER. `s` is { t }. Returns whether the racks drop on this step
  // and how close the next drop is (0 until the warning starts, then up to 1).
  function descendTick(s, dt) {
    const t = ARENA_TUNING.descend;
    s.t += dt;
    if (s.t >= t.every) { s.t = 0; return { drop: true, warn: 0 }; }
    return { drop: false, warn: Math.max(0, (s.t - (t.every - t.warn)) / t.warn) };
  }
  // The racks stop dropping once another row would bring the lowest brick
  // within `gap` of the paddle.
  function descendRoom(lowestBottom, paddleY) {
    const t = ARENA_TUNING.descend;
    return lowestBottom + t.step <= paddleY - t.gap;
  }

  // BROKEN SIMULATION: the sideways pull at this moment of the sector.
  function driftAccel(time) {
    const t = ARENA_TUNING.drift;
    return Math.sin(time * t.rate) * t.accel;
  }

  // DATA TUNNEL: a ball centred at x that has left the field comes back in the far side.
  function wrapX(x, r, W) {
    if (x < -r) return x + W + 2 * r;
    if (x > W + r) return x - W - 2 * r;
    return x;
  }

  return {
    levelFromXp,
    ARENA_RULES, ARENA_TUNING, arenaRule, leakFactor, pulseTick, pulseKick,
    defenderStep, defenderBlocks, descendTick, descendRoom, driftAccel, wrapX,
    UPGRADE_TREE, upgradeCost, upgradeParent, upgradeState, buyUpgrade,
    dailyMods, dailySeed,
  };
})();
