import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';
import vm from 'node:vm';

// The site's scripts are classic browser scripts. Run the real ones in a sandbox
// with a fake localStorage: the cosmetics module, the progression / wallet /
// achievement singletons from the top of glitchpong-site.js, and the admin module.
// Objects made inside the sandbox have another realm's prototypes; compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const text = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const cosmeticsSrc = text('glitchpong-cosmetics.js');
const siteSrc = text('glitchpong-site.js');
const adminFile = new URL('../glitchpong-admin.js', import.meta.url);
const adminSrc = readFileSync(adminFile, 'utf8');
const PRIZE_IDS = ['paddle-keychain', 'pixel-brick', 'golden-paddle'];

// The singletons sit above the game itself; stop before it, which needs a real DOM.
const singletons = siteSrc.slice(0, siteSrc.indexOf('\nfunction injectGameById'));

const PASSPHRASE = 'correct horse battery staple';
function verifierLine(passphrase) {
  const salt = 'unit-test-salt';
  const hash = pbkdf2Sync(passphrase, salt, 1000, 32, 'sha256').toString('hex');
  return `  const VERIFIER = { salt: "${salt}", iterations: 1000, hash: "${hash}" };`;
}
const withVerifier = (line) => adminSrc.replace(/(\/\/ ADMIN-VERIFIER-START[^\n]*\n)[\s\S]*?(\n\s*\/\/ ADMIN-VERIFIER-END)/, `$1${line}$2`);

function load({ verifier = verifierLine(PASSPHRASE), store = {}, prizes = PRIZE_IDS } = {}) {
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const events = [];
  const window = {
    GlitchcadePrizeIds: prizes,
    addEventListener() {},
    dispatchEvent: (e) => { events.push(e); return true; },
    chrome: {}
  };
  const sandbox = {
    localStorage, window, events, console,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    TextEncoder, TextDecoder, Uint8Array, crypto: globalThis.crypto,
    Math, JSON, Object, Array, Number, String, Date, Promise, Set, setTimeout, clearTimeout, setInterval, clearInterval,
    URL, atob, btoa
  };
  vm.createContext(sandbox);
  const run = (code, filename) => new vm.Script(code, { filename, importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInContext(sandbox);
  run(cosmeticsSrc, 'cosmetics.js');
  run(`${singletons}\nthis.GlitchCosmetics = GlitchCosmetics; this.GlitchProgression = GlitchProgression; this.GlitchcadeWallet = GlitchcadeWallet; this.GlitchAchievements = GlitchAchievements;`, 'site-singletons.js');
  run(`${withVerifier(verifier)}\nthis.GlitchAdmin = GlitchAdmin;`, adminFile.href);
  return { store, events, sandbox, A: sandbox.GlitchAdmin };
}

// What the match hooks look like to the admin module.
const fakeGame = (online = false) => ({
  online: () => online, inMatch: () => true, snapshot: () => ({ left: 0, right: 0, win: 7 }),
  maxHeat() {}, spawnEye() {}, setScore() {}, skipRound() {}, winMatch() {}, loseMatch() {}
});

test('admin mode is off until the right passphrase is entered', async () => {
  const { A, store } = load();
  assert.equal(A.enabled, false);
  const wrong = await A.enable('not it');
  assert.equal(wrong.ok, false);
  assert.equal(A.enabled, false);
  assert.equal('glitchPong_admin_v1' in store, false);
  assert.equal(A.cheatsAllowed(), false);
  // Too many wrong tries in a row are held off, even with the right passphrase.
  const locked = await A.enable(PASSPHRASE);
  assert.equal(locked.ok, false);
  assert.match(locked.error, /WAIT/);
});

test('the right passphrase switches admin mode on and the flag survives a reload', async () => {
  const first = load();
  assert.deepEqual(plain(await first.A.enable(` ${PASSPHRASE} `)), { ok: true });
  assert.equal(first.A.enabled, true);
  assert.equal(first.A.cheatsAllowed(), true);
  const reloaded = load({ store: first.store });
  assert.equal(reloaded.A.enabled, true);
  reloaded.A.disable();
  assert.equal(reloaded.A.enabled, false);
  assert.equal('glitchPong_admin_v1' in reloaded.store, false);
});

test('a flag made for a different passphrase does not count', async () => {
  const first = load();
  await first.A.enable(PASSPHRASE);
  const other = load({ store: first.store, verifier: verifierLine('some other passphrase') });
  assert.equal(other.A.enabled, false);
});

test('with no passphrase set up, admin mode cannot be switched on', async () => {
  const blank = load({ verifier: '  const VERSION_UNSET = 0; const VERIFIER = { salt: "", iterations: 1000, hash: "" };' });
  assert.equal(blank.A.configured, false);
  assert.equal((await blank.A.enable('anything')).ok, false);
  assert.equal(blank.A.enabled, false);
  // a hand-made flag does nothing either
  const forged = load({ verifier: '  const VERIFIER = { salt: "", iterations: 1000, hash: "" };', store: { glitchPong_admin_v1: '{"v":1,"k":""}' } });
  assert.equal(forged.A.enabled, false);
});

test('the shipped file has a passphrase hash (not the passphrase) in it', () => {
  const m = adminSrc.match(/const VERIFIER = \{ salt: "([0-9a-f]+)", iterations: (\d+), hash: "([0-9a-f]{64})" \}/);
  assert.ok(m, 'a salted PBKDF2 verifier is set; run scripts/set-admin-passphrase.mjs');
  assert.ok(Number(m[2]) >= 100000, 'enough PBKDF2 iterations');
});

test('Unlock Everything maxes the profile, perks, coins, prizes, achievements and cosmetics', async () => {
  const { A, sandbox, store } = load();
  await A.enable(PASSPHRASE);
  const r = await A.actions.unlockEverything();
  assert.equal(r.ok, true);

  const P = sandbox.GlitchProgression;
  assert.equal(P.level, 50);
  assert.equal(P.data.equippedPerks.length, P.ALL_PERKS.length);
  assert.equal(P.data.unlockedPerks.length, P.ALL_PERKS.length);

  const wallet = sandbox.GlitchcadeWallet.get();
  assert.ok(wallet.coins >= 10000);
  assert.deepEqual(plain(wallet.prizes).sort(), [...PRIZE_IDS].sort());

  const ach = sandbox.GlitchAchievements;
  assert.equal(ach.unlockedCount, ach.ACHIEVEMENTS.length);

  const C = sandbox.GlitchCosmetics;
  let checked = 0;
  C.SLOTS.forEach((slot) => C.CATALOG[slot].forEach((item) => {
    assert.equal(C.isUnlocked(slot, item.id, P.data), true, `${slot} ${item.id} (${item.unlock.type}) is unlocked`);
    checked++;
  }));
  assert.ok(checked > 100, 'walked the whole catalog');

  // everything is also in storage, so it survives a reload
  assert.equal(JSON.parse(store.glitchPong_progression_v1).level, 50);
  assert.ok(JSON.parse(store.glitchcade_wallet_v1).prizes.includes('golden-paddle'));
  assert.ok(Object.keys(JSON.parse(store.glitchPong_achievements_v1).unlocked).length >= ach.ACHIEVEMENTS.length);
  assert.ok(JSON.parse(store.glitchPong_cosmetics_v1).owned.length > 0, 'coin items are owned');
});

test('Unlock Everything also repairs the arcade floor', async () => {
  const { A, store } = load();
  await A.enable(PASSPHRASE);
  const r = await A.actions.unlockEverything();
  assert.deepEqual(plain(r.skipped), [], 'the floor state module loaded');
  const floor = JSON.parse(store.glitchcade_floor_v1);
  assert.deepEqual(plain(floor.repaired).sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(floor.toys.length > 0 && floor.packs.length > 0);
});

test('unlocking keeps what the player already had', async () => {
  const store = {
    glitchcade_wallet_v1: JSON.stringify({ coins: 99999, earned: 123456, wins: 7, prizes: ['mini-eye'] }),
    glitchPong_progression_v1: JSON.stringify({ level: 12, wins: 400, longestRally: 99 })
  };
  const { A, sandbox } = load({ store });
  await A.enable(PASSPHRASE);
  await A.actions.unlockEverything();
  const w = sandbox.GlitchcadeWallet.get();
  assert.equal(w.coins, 99999, 'more coins than the cheat gives are kept');
  assert.equal(w.wins, 7);
  assert.ok(w.prizes.includes('mini-eye'), 'a prize the arcade no longer lists is not thrown away');
  assert.equal(sandbox.GlitchProgression.data.wins, 400);
  assert.equal(sandbox.GlitchProgression.data.longestRally, 99);
});

test('prizes are skipped, not faked, when the arcade has not listed them yet', async () => {
  const { A } = load({ prizes: [] });
  await A.enable(PASSPHRASE);
  const one = A.actions.unlockPrizes();
  assert.equal(one.ok, false);
  const all = await A.actions.unlockEverything();
  assert.deepEqual(plain(all.skipped).filter((s) => s === 'prizes'), ['prizes']);
});

test('set level, add coins and the single unlocks work on their own', async () => {
  const { A, sandbox } = load();
  await A.enable(PASSPHRASE);
  A.actions.setLevel(20);
  assert.equal(sandbox.GlitchProgression.level, 20);
  A.actions.setLevel(999);
  assert.equal(sandbox.GlitchProgression.level, 50, 'level is capped at 50');
  A.actions.setLevel(-4);
  assert.equal(sandbox.GlitchProgression.level, 1);
  A.actions.addCoins(250);
  assert.equal(sandbox.GlitchcadeWallet.get().coins, 250);
  assert.equal(A.actions.unlockPrizes().ok, true);
  assert.equal(sandbox.GlitchcadeWallet.get().prizes.length, PRIZE_IDS.length);
  A.actions.unlockAchievements();
  assert.equal(sandbox.GlitchAchievements.unlockedCount, sandbox.GlitchAchievements.ACHIEVEMENTS.length);
  const before = sandbox.GlitchProgression.level;
  A.actions.unlockCosmetics();
  assert.ok(sandbox.GlitchProgression.level >= before);
});

test('Reset Progress clears progress but keeps settings and admin mode', async () => {
  const { A, store, sandbox } = load({ store: { glitchPong_keyBindings_v1: '{"p1Up":"KeyI"}' } });
  await A.enable(PASSPHRASE);
  await A.actions.unlockEverything();
  A.actions.resetProgress();
  assert.equal(sandbox.GlitchProgression.level, 1);
  assert.equal(sandbox.GlitchcadeWallet.get().coins, 0);
  assert.equal(sandbox.GlitchAchievements.unlockedCount, 0);
  ['glitchcade_wallet_v1', 'glitchPong_achievements_v1', 'glitchPong_cosmetics_v1', 'glitchcade_floor_v1'].forEach((k) => {
    assert.equal(k in store, false, `${k} removed`);
  });
  assert.equal(store.glitchPong_keyBindings_v1, '{"p1Up":"KeyI"}', 'key bindings kept');
  assert.equal(A.enabled, true, 'still an admin');
});

test('match cheats need admin mode and are off in online matches', async () => {
  const { A } = load();
  const game = fakeGame();
  A.attachGame(game);
  assert.equal(A.cheatsAllowed(), false, 'not an admin yet');
  assert.equal(A.setGod(true), false);
  assert.equal(A.godActive(), false);

  await A.enable(PASSPHRASE);
  assert.equal(A.cheatsAllowed(), true);
  assert.equal(A.godActive(), false, 'god mode starts off');
  assert.equal(A.setGod(true), true);
  assert.equal(A.godActive(), true);

  const online = fakeGame(true);
  A.attachGame(online);
  assert.equal(A.godActive(), false, 'a new match starts without god mode');
  assert.equal(A.cheatsAllowed(), false, 'online matches never get cheats');
  assert.equal(A.setGod(true), false);

  A.detachGame(online);
  assert.equal(A.godActive(), false);
  assert.equal(A.cheatsAllowed(), true, 'no match: nothing to block');
});

test('god mode is dropped when the match ends or admin mode is switched off', async () => {
  const { A } = load();
  await A.enable(PASSPHRASE);
  const game = fakeGame();
  A.attachGame(game);
  A.setGod(true);
  A.detachGame(game);
  A.attachGame(game);
  assert.equal(A.godActive(), false);
  A.setGod(true);
  A.disable();
  assert.equal(A.godActive(), false);
  assert.equal(A.cheatsAllowed(), false);
});

// ── glitchpong-site.js wiring (read as text, like the prize-count test) ──
test('the Q debug key is gated behind admin mode', () => {
  const key = siteSrc.match(/\(e\.key === "q" \|\| e\.key === "Q"\) && currentScreen === "game"\) \{[\s\S]*?\n      \}/);
  assert.ok(key, 'found the Q key handler');
  assert.match(key[0], /if \(adminCheats\(\)\) adminHooks\.spawnEye\(\)/);
  assert.doesNotMatch(key[0], /heat = HEAT_MAX/, 'Q no longer maxes Heat for everyone');
  assert.doesNotMatch(key[0], /triggerPreBoss\(\)/, 'Q no longer calls the Eye directly');
});

test('god mode only ever protects the left goal and the Eye never scores on it', () => {
  assert.equal((siteSrc.match(/adminGod\(\)/g) || []).length >= 2, true);
  assert.match(siteSrc, /if \(powerState\.blue\.shieldTimer > 0 \|\| adminGod\(\)\)/);
  assert.doesNotMatch(siteSrc, /powerState\.red\.shieldTimer > 0 \|\| adminGod/);
  assert.match(siteSrc, /bossOutcome\.type === "fail" && awardSide === "right" && adminGod\(\)/);
});

test('the match is frozen while the menu is open, but never an online one', () => {
  const loopAt = siteSrc.indexOf('if (onlineState.active) {\n        if (onlineState.snapshot) {\n          const lastX = ballX, lastY = ballY;\n          drawOnlineSnapshot();');
  const freezeAt = siteSrc.indexOf('if (isPaused || adminFrozen())');
  assert.ok(loopAt > 0 && freezeAt > loopAt, 'the freeze comes after the online branch returns');
});

test('the admin hooks refuse to act in online matches', () => {
  const hooks = siteSrc.match(/const adminHooks = \{[\s\S]*?\n    \};/);
  assert.ok(hooks);
  assert.match(hooks[0], /inMatch: \(\) => .*!onlineState\.active/);
});

test('Spawn the Eye and Skip round wait for the ball to be in play', () => {
  // During the 3-2-1 countdown the ball is relaunched, which would undo the Eye's cinematic.
  const eye = siteSrc.match(/spawnEye\(\) \{[\s\S]*?\n      \},/);
  const skip = siteSrc.match(/skipRound\(\) \{[\s\S]*?\n      \}\n    \};/);
  assert.ok(eye && skip);
  assert.match(eye[0], /roundFrozen \|\| countdownActive/);
  assert.match(skip[0], /roundFrozen \|\| countdownActive/);
});
