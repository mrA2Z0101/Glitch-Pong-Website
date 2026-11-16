// Plays Signal Lost (cabinet 04) with its own bot and prints what happened:
// how far runs get, whether the tenth maze is cleared, how long a maze takes,
// what ends a ball. The numbers in docs/signal-lost.md come from this.
//
//   node scripts/signal-sim.mjs                12 runs, the bot at full skill
//   node scripts/signal-sim.mjs 20 0.3         20 runs, a bot that leaves the static less room
//   node scripts/signal-sim.mjs 20 1 10        20 runs that start at maze 10 (THE EYE'S LAIR)
//
// The bot decides fifteen times a second and sees only what a player sees
// (botInput in signal/js/rules.js). It never hesitates, so read the results
// as what the rules allow, not as how a first run goes.
import * as R from '../signal/js/rules.js';

const runs = Number(process.argv[2] || 12);
const skill = Number(process.argv[3] === undefined ? 1 : process.argv[3]);
const startAt = Number(process.argv[4] || 1);
const CAP = 30 * 60;            // seconds of play before a run is stopped
const DT = 1 / 60;

const results = [];
for (let seed = 1; seed <= runs; seed++) {
  const s = R.createRun({ seed, maze: startAt });
  const perMaze = {}, causes = {};
  let hold = { dir: -1, dash: false }, n = 0, mark = 0;
  // a run stops when the balls run out or the tenth maze is cleared
  while (s.phase !== 'over' && s.phase !== 'won' && s.stats.time < CAP) {
    if (n++ % 4 === 0) hold = R.botInput(s, skill);
    R.step(s, hold, DT);
    for (const e of s.events) {
      if (e.type === 'mazeClear') { perMaze[e.n] = s.stats.time - mark; mark = s.stats.time; }
      if (e.type === 'ballLost') { const k = e.cause === 'static' ? e.by : e.cause; causes[k] = (causes[k] || 0) + 1; }
    }
    s.events.length = 0;
  }
  results.push({ maze: s.n, won: s.phase === 'won', score: Math.floor(s.score), time: s.stats.time, coins: s.stats.coins, eyes: s.stats.eyes, catches: s.stats.catches, perMaze, causes, capped: s.phase !== 'over' && s.phase !== 'won' });
}

const median = (list) => { const a = list.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const col = (key) => results.map((r) => r[key]);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

console.log(`${runs} runs, bot skill ${skill}, from maze ${startAt}${results.some((r) => r.capped) ? ` (${results.filter((r) => r.capped).length} stopped at ${CAP / 60} minutes)` : ''}`);
console.log(`  cleared the tenth maze   ${results.filter((r) => r.won).length} of ${runs}`);
console.log(`  maze reached     median ${median(col('maze'))}   least ${Math.min(...col('maze'))}   most ${Math.max(...col('maze'))}`);
console.log(`  score            median ${median(col('score'))}   least ${Math.min(...col('score'))}   most ${Math.max(...col('score'))}`);
console.log(`  time in play     median ${mmss(median(col('time')))}`);
console.log(`  coins            median ${median(col('coins'))}`);
console.log(`  Eyes survived    median ${median(col('eyes'))}     static caught  median ${median(col('catches'))}`);
const causes = {};
results.forEach((r) => Object.entries(r.causes).forEach(([k, v]) => { causes[k] = (causes[k] || 0) + v; }));
console.log('  balls lost to    ' + (Object.entries(causes).map(([k, v]) => `${k} ${v}`).join('   ') || 'nothing'));
const byMaze = {};
results.forEach((r) => Object.entries(r.perMaze).forEach(([k, v]) => { (byMaze[k] = byMaze[k] || []).push(v); }));
console.log('  seconds a maze (median, and how many runs cleared it)');
for (const [k, v] of Object.entries(byMaze)) {
  console.log(`    ${String(k).padStart(2, '0')} ${R.mazeSpec(Number(k)).name.padEnd(15)} ${String(Math.round(median(v))).padStart(4)}s   ${v.length}/${runs}`);
}
