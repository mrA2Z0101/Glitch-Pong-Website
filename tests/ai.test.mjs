import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { AI, COURT, playMatch, playRally, seeded } from './helpers/rally-sim.mjs';

// The computer player (glitchpong-ai.js). It plays through a model of a
// person: it reacts late, misjudges, slips, gets nervous and can be fooled.
// These tests cover each of those on its own, then play whole rallies and
// matches to check that every difficulty can be beaten and that the three are
// in the right order. See docs/ai.md.

// The court from the right-hand paddle's side, with the ball in the middle
// heading for it.
const world = (over = {}) => Object.assign({
  side: 'right', ballX: 640, ballY: 360, vx: 6, vy: 0,
  faceX: COURT.rightFace, span: COURT.rightFace - COURT.leftFace,
  paddleY: 290, paddleH: 140, step: 8, top: 0, bottom: 720,
  ballTop: 10, ballBottom: 710, height: 720,
  dashReady: true, rally: 0, critical: false, matchPoint: false,
  myScore: 0, theirScore: 0, opponentY: 360
}, over);

// A player with no faults except the ones a test switches on.
const exact = (over = {}) => Object.assign({}, AI.PROFILES.hard, {
  reaction: 0, reread: 1, readError: 0, aimError: 0, motor: 0, slack: 0, lapse: 0,
  dashUse: 0, dashWrong: 0, fooled: 0, lean: 0, strategy: 0, nerve: 0
}, over);

const half = () => 0.5;          // a random source that never picks an extreme
const mindOf = (rand = half) => AI.createMind(rand);

// Lets the ball fly on for `n` frames, moving the paddle as the player asks.
function fly(mind, profile, w, n, rand = half, each) {
  for (let i = 0; i < n; i++) {
    const act = AI.think(mind, profile, w, rand);
    w.paddleY = Math.max(w.top, Math.min(w.bottom - w.paddleH, w.paddleY + act.move));
    if (each) each(act, i);
    w.ballX += w.vx; w.ballY += w.vy;
    if (w.decoys) for (const d of w.decoys) { d.x += d.vx; d.y += d.vy; }
  }
}

test('the ball\'s path is projected through bounces, wraps and falls', () => {
  const w = { ballTop: 10, ballBottom: 710 };
  assert.equal(AI.projectY(100, 0, 50, w), 100, 'a flat ball stays level');
  assert.equal(AI.projectY(100, 5, 20, w), 200, 'a rising or falling ball carries on');
  assert.equal(AI.projectY(100, -5, 40, w), 120, 'up 90 to the top edge, then 110 back down');
  assert.equal(AI.projectY(600, 5, 62, w), 510, 'down 110 to the bottom edge, then 200 back up');
  assert.equal(AI.projectY(700, 5, 10, { ballTop: 10, ballBottom: 710, wrap: true }), 50, 'on a wrapping court it comes back in at the other edge');

  const falling = AI.projectY(200, 0, 30, { ballTop: 10, ballBottom: 710, gravity: 0.2, fallMax: 10 });
  assert.ok(falling > 200 + 60 && falling < 710, `gravity pulls it down on the way (${falling})`);
  assert.equal(AI.projectY(300, 4, 100, { ballTop: 5, ballBottom: 5 }), 300, 'a court with no room leaves the ball where it is');
});

test('it needs time to react to a ball that does something unexpected', () => {
  const mind = mindOf(), hard = AI.PROFILES.hard;
  const w = world({ vx: -6 });                       // the ball is going away
  fly(mind, hard, w, 20);
  assert.equal(mind.blind, 0, 'a ball doing what it expected needs no reaction');
  assert.equal(mind.incoming, false);

  w.vx = 6;                                           // the other paddle hits it back
  AI.think(mind, hard, w, half);
  assert.equal(mind.blind, hard.reaction, 'it starts reacting');
  assert.ok(mind.belief.vx < 0, 'and until then still sees the ball going away');
  assert.equal(mind.incoming, false);

  fly(mind, hard, w, hard.reaction - 1);
  assert.ok(mind.belief.vx < 0, 'still catching up');
  fly(mind, hard, w, 1);
  assert.equal(mind.belief.vx, 6, 'caught up');
  assert.equal(mind.incoming, true, 'and now reads the shot');

  // Reaction times vary a fifth either way, shot by shot.
  for (const [roll, frames] of [[0, Math.round(hard.reaction * 0.8)], [0.999, Math.round(hard.reaction * 1.2)]]) {
    const m = mindOf(), v = world({ vx: -6 });
    fly(m, hard, v, 5);
    v.vx = 6;
    const rolls = [0.9, roll];                        // the lapse roll (no), then the reaction roll
    AI.think(m, hard, v, () => (rolls.length ? rolls.shift() : 0.5));
    assert.equal(m.blind, frames);
  }
});

test('slower players react slower, and the menu rally reacts at once', () => {
  const blindAfterSurprise = (profile, over) => {
    const mind = mindOf(), w = world(Object.assign({ vx: -6 }, over));
    fly(mind, profile, w, 5);
    w.vx = 6;
    AI.think(mind, profile, w, half);
    return mind.blind;
  };
  const { easy, medium, hard, demo } = AI.PROFILES;
  assert.ok(blindAfterSurprise(easy) > blindAfterSurprise(medium));
  assert.ok(blindAfterSurprise(medium) > blindAfterSurprise(hard));
  assert.ok(blindAfterSurprise(hard) >= 9, 'even Hard takes about a sixth of a second');
  assert.equal(blindAfterSurprise(demo), 0);

  // The Eye looks at its target before it throws, so its throws need less.
  assert.equal(blindAfterSurprise(hard, { telegraphed: true }), Math.round(hard.reaction * AI.TUNING.telegraph));

  // An attention slip makes the reaction itself slow.
  const mind = mindOf(), w = world({ vx: -6 });
  fly(mind, hard, w, 5);
  w.vx = 6;
  const rolls = [0, 0.5];                             // the lapse roll (yes), then the reaction roll
  AI.think(mind, hard, w, () => (rolls.length ? rolls.shift() : 0.5));
  assert.equal(mind.blind, Math.round(hard.reaction * AI.TUNING.lapseCost));
  assert.equal(mind.slipped, true);
});

test('the paddle never moves faster than a player\'s, and a dash is up, down or nothing', () => {
  for (const name of ['easy', 'medium', 'hard', 'demo']) {
    const rand = seeded(31), mind = AI.createMind(rand), profile = AI.PROFILES[name];
    const w = world({ vy: 5 });
    let dashes = 0;
    for (let i = 0; i < 6000; i++) {
      const act = AI.think(mind, profile, w, rand);
      assert.ok(Math.abs(act.move) <= w.step + 1e-9, `${name} moved ${act.move} in a frame`);
      assert.ok(act.dash === 0 || act.dash === 1 || act.dash === -1, `${name} dash ${act.dash}`);
      if (act.dash) { dashes++; assert.ok(w.dashReady, 'only with a dash to spend'); }
      w.paddleY = Math.max(0, Math.min(720 - w.paddleH, w.paddleY + act.move + act.dash * 76));
      w.dashReady = i % 3 !== 0;
      w.ballX += w.vx; w.ballY += w.vy;
      if (w.ballY < 10 || w.ballY > 710) w.vy = -w.vy;
      if (w.ballX < 60 || w.ballX > 1220) { w.vx = -w.vx * (0.8 + rand() * 0.5); w.vx = Math.max(-20, Math.min(20, w.vx)); w.vy = rand() * 16 - 8; }
    }
    assert.ok(Number.isFinite(w.paddleY));
    if (name === 'medium' || name === 'hard') assert.ok(dashes > 0, `${name} dashes sometimes`);
  }
});

test('with nothing wrong with it, it puts the middle of the paddle where the ball will arrive', () => {
  const mind = mindOf(), p = exact();
  // From (640, 360) at 6 across and 5 down: 598 pixels to go, so about 100 frames and 498 pixels of fall.
  const w = world({ vy: 5 });
  const lands = AI.projectY(360, 5, (COURT.rightFace - 640) / 6, w);
  fly(mind, p, w, 70);
  assert.ok(Math.abs(w.paddleY + w.paddleH / 2 - lands) < 2, `paddle at ${w.paddleY + 70}, ball arriving at ${lands}`);
});

test('a misjudged ball becomes clearer as it gets closer', () => {
  const p = exact({ readError: 0.1 });
  const aimOff = (ballX) => {
    const mind = mindOf(), w = world({ ballX, paddleY: 290 });
    AI.think(mind, p, w, () => 0.7);                  // a clear misjudgement, the same way every time
    return Math.abs(mind.goal - 360);
  };
  const far = aimOff(200), middle = aimOff(640), near = aimOff(1150);
  assert.ok(far > middle && middle > near, `${far} > ${middle} > ${near}`);
  assert.ok(far > 40, 'from the far side it can be most of a paddle out');
  // Half a paddle is 70 pixels; an error that survives to the end larger than that is a miss.
  assert.ok(near < 70);

  // A faster or steeper ball is harder to judge than a slow, flat one.
  const off = (over) => { const mind = mindOf(), w = world(over); AI.think(mind, p, w, () => 0.7); return Math.abs(mind.goal - AI.projectY(w.ballY, w.vy, (w.faceX - w.ballX) / w.vx, w)); };
  assert.ok(off({ vx: 16 }) > off({ vx: 8 }) * 1.5);
  assert.ok(off({ vx: 8, vy: -4, ballY: 500 }) > off({ vx: 8, vy: 0, ballY: 500 }) * 1.3);
});

test('a ball that changes course on its way in is judged worse', () => {
  const p = exact({ readError: 0.1 });
  const calm = mindOf(), w1 = world();
  AI.think(calm, p, w1, () => 0.9);
  assert.equal(calm.shot.rushed, false);

  const rushed = mindOf(), w2 = world({ ballY: 200 });
  fly(rushed, p, w2, 3, () => 0.9);
  w2.ballY = 360;                                     // a teleport, still coming
  AI.think(rushed, p, w2, () => 0.9);
  assert.equal(rushed.shot.rushed, true);
  w1.ballX = w2.ballX; AI.newPoint(calm);
  AI.think(calm, p, w1, () => 0.9);
  assert.ok(Math.abs(rushed.goal - 360) > Math.abs(calm.goal - 360) * 1.4);
});

test('when its attention slips it sets up off the ball and wakes up late', () => {
  const p = exact({ lapse: 1 });
  const mind = mindOf(), w = world();
  AI.think(mind, p, w, half);
  assert.equal(mind.shot.lapse, true);
  const out = Math.abs(mind.goal - 360);
  assert.ok(out >= w.paddleH * AI.TUNING.lapseOff[0] * 0.9 && out <= w.paddleH * AI.TUNING.lapseOff[1] * 1.15,
    `it waits ${out} pixels from where the ball is going: more than a paddle's reach`);

  // Close in, it sees the ball for what it is.
  const close = mindOf(), near = world({ ballX: COURT.rightFace - 10 });
  AI.think(close, p, near, half);
  assert.ok(Math.abs(close.goal - 360) < 1);
  assert.ok(AI.TUNING.wake[1] <= 0.15, 'it never wakes up with more than a seventh of the court to go');

  // Players who never slip never do this.
  const steady = mindOf();
  AI.think(steady, exact(), world(), half);
  assert.equal(steady.shot.lapse, false);
});

test('pressure makes it play worse, and how much depends on the player', () => {
  const { easy, hard, demo } = AI.PROFILES;
  const mind = mindOf();                              // form 1.02 with this random source
  const calm = AI.nerves(mind, hard, { rally: 0 });
  assert.ok(Math.abs(calm - mind.form) < 1e-9, 'with nothing going on it plays to its form');
  assert.ok(AI.nerves(mind, hard, { rally: 20 }) > calm, 'a long rally tires it');
  assert.ok(AI.nerves(mind, hard, { rally: 0, critical: true }) > calm, 'so does Critical Heat');
  assert.ok(AI.nerves(mind, hard, { rally: 0, matchPoint: true }) > calm, 'and match point');
  assert.equal(AI.nerves(mind, hard, { rally: AI.TUNING.tired[0] }), calm, 'short rallies cost nothing');
  assert.equal(AI.nerves(mind, hard, { rally: 500 }), AI.nerves(mind, hard, { rally: 5000 }), 'tiredness has a ceiling');

  const everything = { rally: 30, critical: true, matchPoint: true };
  assert.ok(AI.nerves(mind, easy, everything) > AI.nerves(mind, hard, everything), 'a beginner feels it more');
  assert.equal(AI.nerves(mind, demo, everything), 1, 'the menu rally feels nothing');
  assert.ok(AI.nerves(mind, easy, everything) <= 2.2, 'it never falls apart completely');

  // Losing a point rattles it for a few seconds; winning one settles it.
  const p = exact({ nerve: 1 }), m = mindOf(), w = world({ vx: -6 });
  AI.think(m, p, w, half);
  w.theirScore = 1;
  AI.think(m, p, w, half);
  assert.ok(m.tilt > 0.99);
  assert.ok(AI.nerves(m, p, w) > m.form);
  fly(m, p, w, AI.TUNING.tiltFrames);
  assert.ok(m.tilt < 1e-9, 'and it passes');
  w.myScore = 1;
  AI.think(m, p, w, half);
  assert.ok(m.glow > 0.99);
  assert.ok(AI.nerves(m, p, w) < m.form);

  // Form is drawn once a match, inside the stated range.
  for (const roll of [0, 0.5, 0.999]) {
    const form = AI.createMind(() => roll).form;
    assert.ok(form >= AI.TUNING.form[0] && form <= AI.TUNING.form[1]);
  }
});

test('a decoy ball can fool it until the real one is close', () => {
  const decoy = () => ({ ref: 'fake', x: 640, y: 600, vx: 6, vy: 0, weight: 1 });
  const fooled = exact({ fooled: 1, wise: 0.36 });
  const mind = mindOf(), w = world({ ballY: 200, decoys: [decoy()] });
  AI.think(mind, fooled, w, half);
  assert.equal(mind.shot.chase, 'fake');
  assert.ok(Math.abs(mind.goal - 600) < 1, 'it goes where the decoy is going');

  // It tells them apart once the real ball is within `wise` of the court.
  const tell = COURT.rightFace - fooled.wise * w.span;
  fly(mind, fooled, w, 60, half, () => {
    if (w.ballX < tell - 12) assert.ok(Math.abs(mind.goal - 600) < 1, `still fooled at ${w.ballX}`);
  });
  assert.ok(w.ballX > tell);
  assert.equal(mind.shot.chase, null);
  assert.ok(Math.abs(mind.goal - 200) < 1, 'then goes for the real one');

  // Someone who is never fooled ignores it, and a faint decoy fools less often.
  const sharp = mindOf(), w2 = world({ ballY: 200, decoys: [decoy()] });
  AI.think(sharp, exact(), w2, half);
  assert.equal(sharp.shot.chase, null);
  assert.ok(Math.abs(sharp.goal - 200) < 1);

  const faint = mindOf(), w3 = world({ ballY: 200, decoys: [Object.assign(decoy(), { weight: 0.4 })] });
  AI.think(faint, exact({ fooled: 1 }), w3, half);    // the roll is 0.5, the chance 0.4
  assert.equal(faint.shot.chase, null);

  // A decoy that disappears stops fooling it.
  const gone = mindOf(), w4 = world({ ballY: 200, decoys: [decoy()] });
  AI.think(gone, fooled, w4, half);
  w4.decoys = [];
  fly(gone, fooled, w4, 3);
  assert.ok(Math.abs(gone.goal - 200) < 1);

  const { easy, medium, hard } = AI.PROFILES;
  assert.ok(easy.fooled > medium.fooled && medium.fooled > hard.fooled && hard.fooled > 0, 'every difficulty can be fooled, the better ones less');
});

test('the dash is a late lunge for a ball it cannot walk to', () => {
  const p = exact({ dashUse: 1, dashLate: 18 });
  // The ball is 10 frames away and 300 pixels above the paddle's middle: walking covers 80.
  const late = () => world({ ballX: COURT.rightFace - 60, ballY: 60, paddleY: 290 });
  let mind = mindOf();
  assert.equal(AI.think(mind, p, late(), half).dash, -1, 'it dashes up, towards the ball');
  assert.equal(mind.dashRest, AI.TUNING.dashRest, 'and will not consider another straight away');
  assert.equal(AI.think(mind, p, late(), half).dash, 0);

  mind = mindOf();
  assert.equal(AI.think(mind, p, late(), half).dash !== 0, true);
  mind = mindOf();
  assert.equal(AI.think(mind, p, Object.assign(late(), { dashReady: false }), half).dash, 0, 'not while the dash is cooling down');
  mind = mindOf();
  assert.equal(AI.think(mind, p, Object.assign(late(), { ballX: 640 }), half).dash, 0, 'not while the ball is still far away');
  mind = mindOf();
  assert.equal(AI.think(mind, p, Object.assign(late(), { ballY: 380 }), half).dash, 0, 'not for a ball it can walk to');
  mind = mindOf();
  assert.equal(AI.think(mind, exact({ dashUse: 0 }), late(), half).dash, 0, 'not if it does not think of it');
  mind = mindOf();
  assert.equal(AI.think(mind, exact({ dashUse: 1, dashWrong: 1 }), late(), half).dash, 1, 'and in a panic it can go the wrong way');

  const { easy, medium, hard } = AI.PROFILES;
  assert.ok(easy.dashUse < medium.dashUse && medium.dashUse < hard.dashUse && hard.dashUse < 1, 'nobody finds the dash every time');
  assert.ok(easy.dashWrong > medium.dashWrong && medium.dashWrong > hard.dashWrong && hard.dashWrong > 0);
});

test('between shots it goes back towards the middle, leaning where its opponent usually hits', () => {
  const p = exact({ retreat: 1 });
  const mind = mindOf(), w = world({ vx: -6, ballY: 100, paddleY: 0 });
  fly(mind, p, w, 60);
  assert.ok(Math.abs(w.paddleY + w.paddleH / 2 - 360) < 1, 'all the way back with retreat 1');

  // Shots that keep arriving low teach it to wait low.
  const learner = mindOf(), q = exact({ retreat: 1, lean: 0.6 });
  for (let shot = 0; shot < 6; shot++) {
    const coming = world({ ballX: 900, ballY: 650, vx: 8 });
    fly(learner, q, coming, 20);
    const going = world({ ballX: coming.ballX, ballY: 650, vx: -8, paddleY: coming.paddleY });
    fly(learner, q, going, 12);
  }
  assert.ok(learner.habit > 0.2, `it has noticed (${learner.habit})`);
  const waiting = world({ vx: -6, ballY: 360, paddleY: 290 });
  fly(learner, q, waiting, 40);
  assert.ok(waiting.paddleY + waiting.paddleH / 2 > 360 + 30, 'and waits below the middle');

  const { easy, hard } = AI.PROFILES;
  assert.equal(easy.lean, 0, 'a beginner does not');
  assert.ok(hard.lean > 0);
});

test('a new point clears what it knew about the ball but not its mood', () => {
  const mind = mindOf(), p = exact({ nerve: 1 });
  const w = world();
  AI.think(mind, p, w, half);
  w.theirScore = 1;
  AI.think(mind, p, w, half);
  const { tilt, form, habit } = mind;
  AI.newPoint(mind);
  assert.equal(mind.belief, null);
  assert.equal(mind.shot, null);
  assert.equal(mind.goal, null);
  assert.equal(mind.blind, 0);
  assert.equal(mind.incoming, false);
  assert.deepEqual([mind.tilt, mind.form, mind.habit], [tilt, form, habit]);
  // The serve is not a surprise: it sees the new ball at once.
  const serve = world({ ballX: 640, ballY: 300, vx: 6 });
  AI.think(mind, p, serve, half);
  assert.equal(mind.blind, 0);
  assert.equal(mind.incoming, true);
});

// Whole rallies. The simulator in tests/helpers/rally-sim.mjs is a plain
// court with the game's ball speeds, Heat, teleports and jukes.
function rallies(name, count, seed, opts = {}) {
  const rand = seeded(seed);
  const players = { left: { mind: AI.createMind(rand), profile: AI.PROFILES[name] }, right: { mind: AI.createMind(rand), profile: AI.PROFILES[name] } };
  const out = { mean: 0, longest: 0, unfinished: 0, eye: 0, short: 0, wins: { left: 0, right: 0 } };
  for (let i = 0; i < count; i++) {
    const r = playRally(players, rand, opts);
    out.mean += r.returns / count;
    out.longest = Math.max(out.longest, r.returns);
    if (r.eye) out.eye++;
    else if (!r.winner) out.unfinished++;
    else out.wins[r.winner]++;
    if (r.returns < 6) out.short++;
  }
  return out;
}

test('every difficulty misses: no rally against itself goes on for ever', () => {
  for (const seed of [1, 2, 3]) {
    const easy = rallies('easy', 300, seed, { eye: false });
    const medium = rallies('medium', 300, seed, { eye: false });
    const hard = rallies('hard', 300, seed, { eye: false });
    for (const [name, r] of [['easy', easy], ['medium', medium], ['hard', hard]]) {
      assert.equal(r.unfinished, 0, `${name}: every rally ends with somebody missing`);
      assert.ok(Math.abs(r.wins.left - r.wins.right) < 75, `${name}: neither side of the court is favoured (${r.wins.left} v ${r.wins.right})`);
    }
    assert.ok(easy.mean < medium.mean && medium.mean < hard.mean, `rallies get longer with difficulty: ${easy.mean.toFixed(1)}, ${medium.mean.toFixed(1)}, ${hard.mean.toFixed(1)}`);
    assert.ok(easy.mean > 2 && easy.mean < 6, `Easy returns a few (${easy.mean.toFixed(1)})`);
    assert.ok(hard.mean > 6 && hard.mean < 16, `Hard is good, not a wall (${hard.mean.toFixed(1)})`);
    assert.ok(hard.longest < 60, `Hard's longest rally of 300 was ${hard.longest} returns`);
    assert.ok(hard.short > 15, `Hard sometimes loses a point early (${hard.short} of 300 inside six returns)`);
  }
});

test('the three difficulties are in order', () => {
  const rand = seeded(5);
  const wins = (a, b, n = 40) => { let w = 0; for (let i = 0; i < n; i++) if (playMatch(a, b, rand) === 'left') w++; return w; };
  const hardOverMedium = wins('hard', 'medium'), mediumOverEasy = wins('medium', 'easy'), hardOverEasy = wins('hard', 'easy');
  assert.ok(hardOverMedium >= 30, `Hard beat Medium ${hardOverMedium} times in 40`);
  assert.ok(mediumOverEasy >= 30, `Medium beat Easy ${mediumOverEasy} times in 40`);
  assert.ok(hardOverEasy >= 37, `Hard beat Easy ${hardOverEasy} times in 40`);
  const even = wins('hard', 'hard');
  assert.ok(even >= 10 && even <= 30, `Hard against itself is a contest (${even} of 40 to the left)`);
});

test('the menu\'s background rally never ends in a miss', () => {
  const plain = rallies('demo', 100, 9, { glitches: false });
  assert.equal(plain.eye, 100, 'on a plain court every rally runs until Heat is full');
  const { demo } = AI.PROFILES;
  assert.deepEqual([demo.reaction, demo.readError, demo.aimError, demo.motor, demo.lapse, demo.fooled, demo.nerve], [0, 0, 0, 0, 0, 0, 0]);
});

test('each difficulty is a better player than the one below in every respect', () => {
  const { easy, medium, hard } = AI.PROFILES;
  for (const worseWhenHigher of ['reaction', 'reread', 'readError', 'aimError', 'motor', 'slack', 'lapse', 'dashWrong', 'fooled', 'nerve']) {
    assert.ok(easy[worseWhenHigher] > medium[worseWhenHigher] && medium[worseWhenHigher] > hard[worseWhenHigher], worseWhenHigher);
  }
  for (const betterWhenHigher of ['lookAhead', 'dashUse', 'dashLate', 'wise', 'lean', 'strategy', 'retreat']) {
    assert.ok(easy[betterWhenHigher] <= medium[betterWhenHigher] && medium[betterWhenHigher] < hard[betterWhenHigher], betterWhenHigher);
  }
  // Hard is a person too: none of its faults is switched off.
  for (const fault of ['reaction', 'readError', 'aimError', 'motor', 'lapse', 'dashWrong', 'fooled', 'nerve']) assert.ok(hard[fault] > 0, fault);
  assert.ok(hard.reaction >= 9, 'nobody reacts in under about 150 milliseconds');
  const keys = Object.keys(easy).sort();
  for (const name of ['medium', 'hard', 'demo']) assert.deepEqual(Object.keys(AI.PROFILES[name]).sort(), keys, `${name} sets every value`);
});

test('the game loads the player and uses it for both paddles', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tag = html.match(/<script src="(glitchpong-ai\.js[^"]*)"/);
  assert.ok(tag, 'index.html loads glitchpong-ai.js');
  assert.ok(html.indexOf(tag[0]) < html.indexOf('<script src="glitchpong-site.js'), 'before the game itself');
  const worker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.ok(worker.includes(`"./${tag[1]}"`), 'service-worker.js caches the same URL');

  const site = readFileSync(new URL('../glitchpong-site.js', import.meta.url), 'utf8');
  assert.ok(site.includes('window.GlitchAI'), 'the game reads the player from the page');
  assert.ok(/AiPlayer\.think\(aiMinds\[side\]/.test(site), 'and asks it what to do each frame');
  assert.ok(!site.includes('aiTrackingState'), 'the old tracking code is gone');
  for (const name of ['easy', 'medium', 'hard']) assert.ok(site.includes(`data-diff="${name}"`) || site.includes(`"${name}"`), `${name} is still a choice`);
});
