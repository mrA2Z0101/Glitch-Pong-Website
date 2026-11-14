// Plays Black-Hole Nexus (cabinet 03) with its own bot and prints what
// happened: how far runs get, how long a sector takes, what ends a ball.
// The numbers in docs/nexus.md come from this.
//
//   node scripts/nexus-sim.mjs                 12 runs, the bot at full skill
//   node scripts/nexus-sim.mjs 20 0.2          20 runs, a bot that looks a short way ahead
//   node scripts/nexus-sim.mjs 20 1 15         20 runs that start at sector 15 (the third Eye)
//
// The bot decides twenty times a second and sees only what a player sees
// (botInput in nexus/js/rules.js). It is steadier than a person, so read the
// results as what the rules allow, not as how a first run goes.
import * as R from '../nexus/js/rules.js';

const runs = Number(process.argv[2] || 12);
const skill = Number(process.argv[3] === undefined ? 1 : process.argv[3]);
const startAt = Number(process.argv[4] || 1);
const CAP = 20 * 60;            // seconds of play before a run is stopped
const DT = 1 / 60;

const results = [];
for (let seed = 1; seed <= runs; seed++) {
  const s = R.createRun({ seed, sector: startAt });
  const perSector = {}, causes = {};
  let hold = { thrust: false }, n = 0, mark = 0;
  while (s.phase !== 'over' && s.stats.time < CAP) {
    if (n++ % 3 === 0) hold = R.botInput(s, skill);
    R.step(s, hold, DT);
    for (const e of s.events) {
      if (e.type === 'sectorClear') { perSector[e.sector] = s.stats.time - mark; mark = s.stats.time; }
      if (e.type === 'ballLost') causes[e.cause] = (causes[e.cause] || 0) + 1;
    }
    s.events.length = 0;
  }
  results.push({ sector: s.sector, score: Math.floor(s.score), time: s.stats.time, coins: s.stats.coins, chain: s.bestChain, perSector, causes, capped: s.phase !== 'over' });
}

const median = (list) => { const a = list.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const col = (key) => results.map((r) => r[key]);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

console.log(`${runs} runs, bot skill ${skill}, from sector ${startAt}${results.some((r) => r.capped) ? ` (${results.filter((r) => r.capped).length} stopped at ${CAP / 60} minutes)` : ''}`);
console.log(`  sector reached   median ${median(col('sector'))}   least ${Math.min(...col('sector'))}   most ${Math.max(...col('sector'))}`);
console.log(`  score            median ${median(col('score'))}   least ${Math.min(...col('score'))}   most ${Math.max(...col('score'))}`);
console.log(`  time in play     median ${mmss(median(col('time')))}`);
console.log(`  coins            median ${median(col('coins'))}`);
console.log(`  best rally       median ${median(col('chain'))}`);
const causes = {};
results.forEach((r) => Object.entries(r.causes).forEach(([k, v]) => { causes[k] = (causes[k] || 0) + v; }));
console.log('  balls lost to    ' + (Object.entries(causes).map(([k, v]) => `${k} ${v}`).join('   ') || 'nothing'));
const bySector = {};
results.forEach((r) => Object.entries(r.perSector).forEach(([k, v]) => { (bySector[k] = bySector[k] || []).push(v); }));
console.log('  seconds a sector (median, and how many runs cleared it)');
for (const [k, v] of Object.entries(bySector)) {
  console.log(`    ${String(k).padStart(2, '0')} ${R.sectorRule(Number(k)).name.padEnd(14)} ${String(Math.round(median(v))).padStart(4)}s   ${v.length}/${runs}`);
}
