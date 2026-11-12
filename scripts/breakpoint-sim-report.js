// Summarises runs written by scripts/breakpoint-sim.js: how often they were won,
// where they ended, and for each sector how long it took, how many lives it cost,
// and what dropped.
//
// Usage: node scripts/breakpoint-sim-report.js <label> <file...>
const fs = require('fs');
const [label, ...files] = process.argv.slice(2);
const runs = files.flatMap(f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
const med = (a) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
console.log(`\n=== ${label}: ${runs.length} runs ===`);
if (!runs.length) process.exit(0);
const won = runs.filter(r => r.won).length;
console.log(`won ${won} (${Math.round(100 * won / runs.length)}%) | run length: median ${(med(runs.map(r => r.time)) / 60).toFixed(1)} game-min, 90th pct ${(pct(runs.map(r => r.time), 0.9) / 60).toFixed(1)} | score median ${med(runs.map(r => r.score))} | lives lost per run ${mean(runs.map(r => r.sectors.reduce((s, x) => s + x.lives, 0))).toFixed(2)}`);
const ends = {}; for (const r of runs) if (!r.won) ends[r.level] = (ends[r.level] || 0) + 1;
console.log('runs ending (lost) at sector:', Object.keys(ends).map(Number).sort((a, b) => a - b).map(k => `${k}:${ends[k]}`).join(' ') || 'none');
const by = {};
for (const r of runs) for (const s of r.sectors) (by[s.level] = by[s.level] || []).push(s);
console.log('sector | arena              | n   | bricks | time med (p90) | lives/try | drops | caught | events | enemies | returns | glitch% | not cleared');
for (const lv of Object.keys(by).map(Number).sort((a, b) => a - b)) {
  const ss = by[lv], cl = ss.filter(s => s.cleared);
  console.log(`${String(lv).padStart(6)} | ${(ss[0].arena + (ss[0].boss ? ' *' : '')).padEnd(18)} | ${String(ss.length).padEnd(3)} | ${String(Math.round(mean(ss.map(s => s.bricks0)))).padStart(6)} | ${String(Math.round(med(cl.map(s => s.time)))).padStart(4)} (${String(Math.round(pct(cl.map(s => s.time), 0.9))).padStart(4)})    | ${mean(ss.map(s => s.lives)).toFixed(2).padStart(9)} | ${mean(ss.map(s => s.drops)).toFixed(1).padStart(5)} | ${mean(ss.map(s => s.caught)).toFixed(1).padStart(6)} | ${mean(ss.map(s => s.events)).toFixed(1).padStart(6)} | ${mean(ss.map(s => s.enemies)).toFixed(1).padStart(7)} | ${String(Math.round(mean(ss.map(s => s.returns)))).padStart(7)} | ${String(Math.round(mean(cl.map(s => s.glitch)))).padStart(7)} | ${ss.length - cl.length}`);
}
const lostDuring = {}; let lostN = 0;
for (const r of runs) for (const s of r.sectors) for (const d of s.lostDuring || []) { lostDuring[d] = (lostDuring[d] || 0) + 1; lostN++; }
console.log('lives lost while:', Object.entries(lostDuring).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${Math.round(100 * v / lostN)}%)`).join(', ') || 'none');
const powers = {}; for (const r of runs) for (const k in r.powers) powers[k] = (powers[k] || 0) + r.powers[k];
const tot = Object.values(powers).reduce((s, x) => s + x, 0);
console.log('power-ups caught per run:', (tot / runs.length).toFixed(1), '| drops per run', mean(runs.map(r => r.sectors.reduce((s, x) => s + x.drops, 0))).toFixed(1), '| bricks broken per run', Math.round(mean(runs.map(r => r.sectors.reduce((s, x) => s + x.broken, 0)))));
console.log('by kind:', Object.entries(powers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / runs.length).toFixed(1)}`).join(', '));
