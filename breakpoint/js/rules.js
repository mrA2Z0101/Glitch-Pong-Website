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

  // ---------------- codex ----------------
  // Everything the game can show you, in the order the codex lists it. An entry
  // unlocks the first time you meet the thing: `key` is what is saved.
  function codexSections() {
    const from = (kind, table, name) => Object.keys(table).map((id) => ({
      key: kind + ':' + id, kind, id, name: name ? name(id) : table[id].name, line: table[id].line || table[id],
    }));
    return [
      { id: 'brick', name: 'BRICKS', entries: from('brick', BRICK_INFO) },
      { id: 'power', name: 'POWER-UPS', entries: POWERUP_KEYS.map((id) => ({
        key: 'power:' + id, kind: 'power', id, name: POWERUPS[id].name,
        line: POWERUPS[id].desc + (POWERUPS[id].dur ? ' Lasts ' + POWERUPS[id].dur + ' seconds.' : ''),
      })) },
      { id: 'enemy', name: 'ENEMIES', entries: from('enemy', ENEMY_INFO) },
      { id: 'boss', name: 'BOSSES', entries: from('boss', BOSS_INFO, (id) => id) },
      { id: 'arena', name: 'ARENAS', entries: ARENAS.map((a) => ({
        key: 'arena:' + a.rule, kind: 'arena', id: a.name, name: a.name,
        line: ARENA_RULES[a.rule].name + '. ' + ARENA_RULES[a.rule].line,
      })) },
      { id: 'event', name: 'GLITCHES', entries: EVENTS.map((e) => ({ key: 'event:' + e.id, kind: 'event', id: e.id, name: e.name, line: EVENT_INFO[e.id] })) },
      { id: 'mood', name: 'THE BALL', entries: from('mood', MOOD_INFO) },
    ];
  }
  function codexEntry(key) {
    for (const s of codexSections()) for (const e of s.entries) if (e.key === key) return e;
    return null;
  }
  // How many entries a save has unlocked, overall and in each section.
  function codexCount(seen) {
    const out = { seen: 0, total: 0, sections: {} };
    for (const s of codexSections()) {
      const got = s.entries.filter((e) => seen && seen[e.key]).length;
      out.sections[s.id] = { seen: got, total: s.entries.length };
      out.seen += got; out.total += s.entries.length;
    }
    return out;
  }

  // ---------------- the guided first sector ----------------
  // A new player's first sector is laid out by hand and comes with a coach: one
  // line at a time, each staying until the player has done the thing it
  // describes (or has had time to read it). `e` is what has happened so far:
  //   moved (pixels the paddle has travelled), returns, bricks, bestCombo,
  //   falling (capsules in the air), powerups (caught), cleared
  const TUTOR_STEPS = [
    { id: 'move',   text: 'Move the paddle with the mouse or the arrow keys.', touch: 'Drag anywhere to move the paddle.',
      done: (e) => e.moved >= 160 },
    { id: 'aim',    text: 'Where the ball lands on the paddle sets its angle. The edges send it wide. The middle sends it straight up.',
      done: (e, shown) => e.returns >= 2 && shown >= 5 },
    { id: 'combo',  text: 'Bricks broken between two touches of the paddle chain into a COMBO. Each brick in the chain is worth more.',
      done: (e, shown) => (e.bestCombo >= 3 || e.bricks >= 8) && shown >= 5 },
    { id: 'power',  text: 'A power-up is falling. Catch it with the paddle.',
      when: (e) => e.falling > 0, done: (e, shown) => e.powerups >= 1 || (e.falling === 0 && shown >= 1) },
    { id: 'glitch', text: 'The GLITCH meter at the bottom fills as you break bricks. 25% scores x1.5, 50% x2, 75% x3. The fuller it is, the harder the machine fights back.',
      when: (e) => e.bricks >= 5, done: (e, shown) => shown >= 9 },
    { id: 'ball',   text: 'The ball is alive. Go five returns without breaking a brick and it gets BORED and steers itself at one. The codex lists its other moods as you meet them.',
      when: (e) => e.bricks >= 10, done: (e, shown) => shown >= 9 },
    // shown only while nothing above has anything to say
    { id: 'clear',  text: 'Break every brick to clear the sector.', filler: true, done: (e) => !!e.cleared },
  ];
  function tutorNew() { return { done: {}, at: null, shown: 0 }; }
  // Moves the coach on by `dt` seconds and returns the step to show, or null.
  function tutorTick(t, e, dt) {
    const eligible = (s) => !t.done[s.id] && (!s.when || s.when(e));
    let cur = t.at ? TUTOR_STEPS.find((s) => s.id === t.at) : null;
    if (cur) {
      t.shown += dt;
      if (cur.done(e, t.shown)) { t.done[cur.id] = true; t.at = null; cur = null; }
      else if (cur.filler && TUTOR_STEPS.some((s) => !s.filler && eligible(s))) { t.at = null; cur = null; }
    }
    if (!cur) {
      cur = TUTOR_STEPS.find((s) => !s.filler && eligible(s)) || TUTOR_STEPS.find(eligible) || null;
      if (cur) { t.at = cur.id; t.shown = 0; }
    }
    return cur;
  }
  function tutorProgress(t) {
    const real = TUTOR_STEPS.filter((s) => !s.filler);
    return { done: real.filter((s) => t.done[s.id]).length, total: real.length };
  }
  // The first sector's layout: three plain rows with two heavy bricks in the
  // middle. Returns [{ r, c, type }].
  function tutorialLayout(cols) {
    const cells = [], mid = Math.floor(cols / 2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      if (r === 0 && (c === 0 || c === cols - 1)) continue;      // open corners: an easy way behind the wall
      cells.push({ r, c, type: r === 1 && (c === mid - 1 || c === mid) ? 'heavy' : 'normal' });
    }
    return cells;
  }
  const TUTORIAL = { dropAfter: 4, drop: 'wide' };                // the fourth brick always drops a wide paddle

  // ---------------- the run recap ----------------
  // What the game-over screen says about a run, beyond the numbers. `run` is
  // what the game kept track of:
  //   mode, won, maxCombo, comboSector, powers: { kind: times caught },
  //   lives: one record per life lost, the last being the one that ended the run:
  //     { sector, arena, rule, event, stunnedBy, gap, speed }
  //   newEntries: codex entries unlocked during the run
  function favouritePower(powers) {
    let best = null;
    for (const kind of POWERUP_KEYS) {
      const n = (powers && powers[kind]) || 0;
      if (n > 0 && (!best || n > best.n)) best = { kind, n };       // a tie goes to the first in the catalog
    }
    return best;
  }
  // The sector that cost the most lives, if any cost more than one.
  function toughestSector(lives) {
    const by = {};
    let worst = null;
    for (const life of lives || []) {
      const rec = by[life.sector] || (by[life.sector] = { sector: life.sector, arena: life.arena, n: 0 });
      rec.n++;
      if (!worst || rec.n > worst.n) worst = rec;
    }
    return worst && worst.n >= 2 ? worst : null;
  }
  const sectorName = (n) => 'sector ' + String(n).padStart(2, '0');
  // One sentence on what ended the run.
  function deathCause(run) {
    if (run.won) return 'Nothing. You cleared it.';
    const life = run.lives && run.lives[run.lives.length - 1];
    if (!life) return 'The run was abandoned.';
    const where = sectorName(life.sector) + ', ' + life.arena;
    if (run.mode === 'puzzle') return 'You ran out of balls in ' + where + '.';
    if (life.stunnedBy) return 'A shot from ' + life.stunnedBy + ' stunned your paddle and the ball got past, in ' + where + '.';
    if (life.event) {
      const ev = EVENTS.find((e) => e.id === life.event);
      return 'The ball got past during ' + (ev ? ev.name : 'a glitch') + ', in ' + where + '.';
    }
    if (life.gap !== undefined && life.gap <= 24) return 'A near miss: the ball passed ' + Math.round(life.gap) + ' pixels from the end of the paddle, in ' + where + '.';
    if (life.speed >= 0.85) return 'The ball was close to top speed when it got past, in ' + where + '.';
    const rule = ARENA_RULES[life.rule];
    if (rule && life.rule !== 'standard') return 'The ball got past in ' + where + ', where the rule is ' + rule.name + '.';
    return 'The ball got past in ' + where + '.';
  }
  // The recap, as rows of { id, label, text, power? }.
  function runRecap(run) {
    const rows = [];
    rows.push({ id: 'combo', label: 'BEST COMBO',
      text: run.maxCombo > 0 ? 'x' + run.maxCombo + (run.comboSector ? ' in ' + sectorName(run.comboSector) : '') : 'None. Every brick was a single.' });
    const fav = favouritePower(run.powers);
    rows.push({ id: 'power', label: 'FAVOURITE POWER-UP', power: fav ? fav.kind : null,
      text: fav ? POWERUPS[fav.kind].name + ', caught ' + (fav.n === 1 ? 'once' : fav.n + ' times') : 'None caught.' });
    rows.push({ id: 'cause', label: run.won ? 'WHAT STOPPED YOU' : 'WHAT ENDED IT', text: deathCause(run) });
    const tough = toughestSector(run.lives);
    if (tough) rows.push({ id: 'tough', label: 'TOUGHEST SECTOR', text: sectorName(tough.sector) + ', ' + tough.arena + ': ' + tough.n + ' lives lost' });
    if (run.newEntries > 0) rows.push({ id: 'codex', label: 'NEW IN THE CODEX', text: run.newEntries === 1 ? '1 entry' : run.newEntries + ' entries' });
    return rows;
  }

  return {
    levelFromXp,
    favouritePower, toughestSector, deathCause, runRecap,
    codexSections, codexEntry, codexCount,
    TUTOR_STEPS, TUTORIAL, tutorNew, tutorTick, tutorProgress, tutorialLayout,
    ARENA_RULES, ARENA_TUNING, arenaRule, leakFactor, pulseTick, pulseKick,
    defenderStep, defenderBlocks, descendTick, descendRoom, driftAccel, wrapX,
    UPGRADE_TREE, upgradeCost, upgradeParent, upgradeState, buyUpgrade,
    dailyMods, dailySeed,
  };
})();
