import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRAGMENTS, fragmentPayout } from '../glitchcade-state.js';
import { MICROGAMES, simulateFragment } from '../glitchcade-microgames.js';

// A simple bot for each fragment: good enough to play it properly, nowhere
// near perfect. They prove each game can be won and that its target is fair.
const W = 320;
const PILOTS = {
  'signal-lost'(s) {
    const p = s.packets.reduce((a, b) => (Math.hypot(a.x - s.x, a.y - s.y) < Math.hypot(b.x - s.x, b.y - s.y) ? a : b));
    return { left: p.x < s.x - 2, right: p.x > s.x + 2, up: p.y < s.y - 2, down: p.y > s.y + 2 };
  },
  firewall(s) {
    const reds = s.packets.filter((p) => p.bad).sort((a, b) => b.y - a.y);
    if (!reds.length) return {};
    return { pl: reds[0].col < s.col, pr: reds[0].col > s.col };
  },
  defrag(s) {
    const p = s.piece;
    return { pl: p.kind < p.col, pr: p.kind > p.col, down: p.kind === p.col };
  },
  'black-hole-nexus'(s) {
    if (!s.stars.length) return {};
    const star = s.stars.reduce((a, b) => (Math.abs(a.r - s.r) < Math.abs(b.r - s.r) ? a : b));
    return { up: star.r > s.r + 2, down: star.r < s.r - 2 };
  },
  // human pace: lines the pointer up, then needs a beat before the next press
  'stack-overflow'(s, g) {
    if (Math.floor(s.ptr) !== s.mark || g.t - (s.botLast || -9) < 0.75) return {};
    s.botLast = g.t;
    return { pa: true };
  },
  'packet-hop'(s) {
    if (s.dead > 0) return {};
    if (s.row >= s.lanes.length) return { pu: true };
    const px = s.col * 24 + 16;
    const lane = s.lanes[s.row];
    const clear = lane.cars.every((c) => px + 22 < c.x || px - 22 > c.x + c.w);
    return { pu: clear };
  },
  'swarm-protocol'(s) {
    if (!s.drones.length) return {};
    const d = s.drones.reduce((a, b) => (a.y > b.y ? a : b));
    return { left: d.x < s.x - 4, right: d.x > s.x + 4 };
  },
  'missile-defense'(s) {
    if (!s.threats.length) return {};
    const t = s.threats.reduce((a, b) => (a.k > b.k ? a : b));
    const tx = t.x0 + (t.x1 - t.x0) * Math.min(1, t.k + 0.06), ty = Math.min(196, 30 + 186 * Math.min(1, t.k + 0.06));
    const near = Math.hypot(tx - s.cx, ty - s.cy) < 14;
    return { left: tx < s.cx - 4, right: tx > s.cx + 4, up: ty < s.cy - 4, down: ty > s.cy + 4, pa: near };
  }
};

test('every repairable cabinet has a microgame', () => {
  for (const f of Object.values(FRAGMENTS)) {
    assert.ok(MICROGAMES[f.id], `${f.id} exists`);
    assert.equal(typeof MICROGAMES[f.id].hint, 'string');
  }
  assert.equal(Object.keys(MICROGAMES).length, Object.keys(FRAGMENTS).length);
});

for (const f of Object.values(FRAGMENTS)) {
  test(`${f.title}: a competent run earns the full payout`, () => {
    const scores = [1, 2, 3, 4, 5].map((seed) => simulateFragment(f.id, PILOTS[f.id], 30, seed * 7919).score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    assert.ok(scores.every((s) => Number.isFinite(s) && s >= 0), `scores are sane: ${scores}`);
    if (process.env.SHOW_SCORES) console.log(`${f.id}: target ${f.target}, bot ${scores}`);
    assert.ok(avg >= f.target, `bot averages ${avg} against a target of ${f.target} (${scores})`);
    assert.ok(avg <= f.target * 4, `target ${f.target} isn't trivially low for a bot scoring ${avg}`);
  });

  test(`${f.title}: doing nothing pays nothing`, () => {
    for (const seed of [11, 22, 33]) {
      const { score } = simulateFragment(f.id, () => ({}), 30, seed);
      assert.equal(fragmentPayout(score, f.target), 0, `idle score ${score} must not pay`);
    }
  });
}
