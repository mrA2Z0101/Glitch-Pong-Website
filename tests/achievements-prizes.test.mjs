import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// glitchcade.js and glitchpong-site.js are browser scripts (THREE, window, localStorage),
// so they can't be imported under Node. Read the source text instead.
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('prizes_all goal equals the number of prizes on the counter', () => {
  const cade = read('glitchcade.js');
  const block = cade.match(/const PRIZES = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'found the PRIZES array in glitchcade.js');
  const prizeCount = (block[1].match(/\bid:\s*'/g) || []).length;
  assert.ok(prizeCount > 0, 'counted at least one prize');

  const site = read('glitchpong-site.js');
  const ach = site.match(/\{\s*id:\s*"prizes_all"[^}]*\}/);
  assert.ok(ach, 'found the prizes_all achievement in glitchpong-site.js');
  const goal = Number(ach[0].match(/goal:\s*(\d+)/)?.[1]);
  assert.equal(goal, prizeCount, `prizes_all goal (${goal}) must equal PRIZES.length (${prizeCount})`);
});
