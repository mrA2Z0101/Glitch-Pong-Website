import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { createRequire } from 'node:module';
import { FakeNet, makePeerClass } from './helpers/fake-peer.mjs';

const require = createRequire(import.meta.url);
const { createP2P, ID_PREFIX, clean } = require('../glitchpong-p2p.js');
const sim = require('../server/authoritative-pong.js');
const { SessionManager } = require('../server/session-manager.js');
const { createOnlineHost } = require('../server/online-host.js');

const live = [];
afterEach(() => { live.splice(0).forEach((b) => b.close()); });
const it = (name, fn) => test(name, { timeout: 15000 }, fn);

// What arrives over the wire is parsed JSON, which can hold 1e999 (Infinity).
const wire = (text) => JSON.parse(text);

const goodSnapshot = () => sim.snapshot((() => { const s = sim.initialState(); s.status = 'playing'; sim.resetBall(s, 1); return s; })());

it('escapeHtml neutralises every character that can open markup or an attribute', () => {
  const out = clean.escapeHtml('<img src=x onerror="a()"> \'q\' `t` &');
  assert.ok(!/[<>"'`]/.test(out), out);
  assert.equal(clean.escapeHtml('&lt;'), '&amp;lt;', 'already-escaped text is escaped again, not trusted');
  assert.equal(clean.escapeHtml(12345), '12345');
});

it('text is trimmed, bounded and stripped of control characters', () => {
  const spoof = clean.text('  hi\u0000\u202e\n there ', 20);
  assert.match(spoof, /^hi\s+there$/, 'the direction override and the control characters are gone');
  for (const ch of ['\u202e', '\u202d', '\u2066', '\u200b', '\u200f', '\ufeff', '\u0000', '\u061c']) assert.equal(clean.text(`a${ch}b`, 20), 'a b', `U+${ch.charCodeAt(0).toString(16)}`);
  assert.equal(clean.text('x'.repeat(10_000_000), 20).length, 20);
  assert.equal(clean.text({ toString() { return 'evil'; } }, 20, 'fallback'), 'fallback', 'objects are not coerced');
  assert.equal(clean.text(null, 20, 'Player'), 'Player');
  assert.equal(clean.text('   ', 20, 'Player'), 'Player');
  assert.equal(clean.text('line\nbreak here', 40), 'line break here');
});

it('a lobby is rebuilt from known fields only', () => {
  const hostile = {
    code: '"><img src=x onerror=alert(1)>123456789', status: '<b>', joinLocked: 'yes', expiresAt: 'soon', __proto__: { polluted: true }, extra: 'x'.repeat(100000),
    players: [
      { playerId: 'a'.repeat(5000), nickname: '<img src=x onerror=1>' + 'z'.repeat(5000), side: 'middle', host: 1, connected: 'true', ready: {},
        card: { title: '<img src=x onerror=1>', plate: 'p'.repeat(500), extra: 'x' } },
      null, 5, 'player', { nickname: 'second', side: 'right', connected: true, card: { title: 'netrunner', plate: 'gold' } },
      { nickname: 'third' }, { nickname: 'fourth' }
    ]
  };
  const out = clean.lobby(hostile);
  assert.equal(out.code, '112345', 'digits only (the 1 in alert(1) is one), six at most');
  assert.equal(out.status, 'lobby');
  assert.equal(out.joinLocked, false, 'only a real boolean counts');
  assert.equal(out.expiresAt, 0);
  assert.deepEqual(Object.keys(out).sort(), ['code', 'expiresAt', 'joinLocked', 'players', 'status']);
  assert.ok(out.players.length <= 2);
  for (const p of out.players) {
    assert.ok(p.nickname.length <= 20 && p.playerId.length <= 64);
    assert.deepEqual(Object.keys(p).sort(), ['card', 'connected', 'host', 'nickname', 'playerId', 'ready', 'side']);
    assert.deepEqual(Object.keys(p.card).sort(), ['plate', 'title'], 'a card is two ids and nothing else');
    for (const id of Object.values(p.card)) assert.match(id, /^[a-z0-9_-]{1,24}$/i);
    assert.ok(typeof p.connected === 'boolean' && typeof p.host === 'boolean');
    assert.ok(p.side === 'left' || p.side === 'right');
  }
  assert.equal(out.players[0].connected, false, '"true" is not true');
  assert.deepEqual(out.players[0].card, { title: 'default', plate: 'default' }, 'markup and oversized ids fall back to the default');
  assert.deepEqual(clean.card({ title: 'netrunner', plate: 'gold', extra: 1 }), { title: 'netrunner', plate: 'gold' }, 'well-formed ids pass through');
  for (const junk of [null, 5, 'gold', [], { title: 7, plate: {} }]) assert.deepEqual(clean.card(junk), { title: 'default', plate: 'default' });
  assert.equal({}.polluted, undefined);
  for (const bad of [null, undefined, 5, 'x', [], {}, { players: 'no' }, { players: {} }]) assert.equal(clean.lobby(bad), null);
});

it('a real server snapshot passes untouched, all the way through a match', () => {
  const state = sim.initialState();
  state.status = 'playing';
  sim.resetBall(state, 1);
  let now = 1000, checked = 0, longest = 0;
  for (let i = 0; i < 400000 && state.status === 'playing'; i++, now += 17) {
    sim.step(state, 1 / 60, now);
    if (i % 25 === 0 || state.status !== 'playing') {
      const snap = sim.snapshot(state);
      const out = clean.snapshot(snap);
      assert.ok(out, `snapshot ${i} was rejected: ${JSON.stringify(snap)}`);
      assert.equal(out.ball.x, snap.ball.x); assert.equal(out.paddles.left.y, snap.paddles.left.y);
      assert.deepEqual(out.scores, snap.scores); assert.equal(out.winner, snap.winner); assert.equal(out.heat, snap.heat);
      longest = Math.max(longest, Math.abs(snap.ball.vx));
      checked++;
    }
  }
  assert.ok(checked > 20 && state.status === 'ended', `checked ${checked} snapshots`);
  assert.ok(clean.snapshot({ ...goodSnapshot(), ball: { x: 400, y: 200, vx: 90000, vy: 400 } }), 'a very long rally (a fast ball) is still valid');
});

it('a snapshot with a number that is not a sane number is dropped whole', () => {
  const evil = (patch) => { const s = goodSnapshot(); patch(s); return clean.snapshot(wire(JSON.stringify(s).replace(/"__INF__"/g, '1e999'))); };
  assert.ok(evil(() => {}), 'control: the unmodified snapshot is fine');
  const cases = {
    'infinite score': (s) => { s.scores.left = '__INF__'; },
    'negative score': (s) => { s.scores.left = -1; },
    'huge score': (s) => { s.scores.right = 1e9; },
    'fractional becomes a whole number': null,
    'string position': (s) => { s.ball.x = '400'; },
    'null position': (s) => { s.ball.y = null; },
    'infinite ball': (s) => { s.ball.vx = '__INF__'; },
    'zero width (division by zero)': (s) => { s.width = 0; },
    'huge height': (s) => { s.height = 1e9; },
    'missing paddles': (s) => { delete s.paddles; },
    'paddle not an object': (s) => { s.paddles.left = 5; },
    'missing scores': (s) => { delete s.scores; },
    'array for ball': (s) => { s.ball = [1, 2]; }
  };
  for (const [name, patch] of Object.entries(cases)) {
    if (!patch) continue;
    assert.equal(evil((s) => { patch(s); if (name === 'infinite score') s.scores.left = '__INF__'; }), null, name);
  }
  for (const bad of [null, undefined, 5, 'x', [], {}]) assert.equal(clean.snapshot(bad), null);
  const odd = clean.snapshot({ ...goodSnapshot(), status: '<script>', lastHit: 'both', winner: 'me', heat: 5000, scores: { left: 3.7, right: 0 }, extra: { huge: 'x'.repeat(100000) } });
  assert.equal(odd.status, 'waiting'); assert.equal(odd.lastHit, 'neutral'); assert.equal(odd.winner, null); assert.equal(odd.heat, 0);
  assert.equal(odd.scores.left, 3);
  assert.equal('extra' in odd, false);
});

it('a join reply must have exactly the expected shape', () => {
  const sessions = new SessionManager();
  const host = createOnlineHost({ sessions, io: { to: () => ({ emit() {} }) } });
  const created = host.api.create('A');
  const good = clean.session(JSON.parse(JSON.stringify(created)));
  assert.ok(good);
  assert.equal(good.joinCode, created.joinCode);
  for (const patch of [
    (r) => { r.side = 'x'; }, (r) => { r.joinCode = 'abc'; }, (r) => { r.joinCode = '12345'; }, (r) => { r.joinTicket = 7; },
    (r) => { r.joinTicket = 'x'.repeat(201); }, (r) => { delete r.resumeToken; }, (r) => { r.lobbyState = 'lobby'; }, (r) => { r.sessionId = ''; }
  ]) { const r = JSON.parse(JSON.stringify(created)); patch(r); assert.equal(clean.session(r), null); }
  assert.equal(clean.session(null), null);
  assert.deepEqual(Object.keys(clean.session({ ...created, evil: '<script>' })).sort(), ['joinCode', 'joinTicket', 'joinUrl', 'lobbyState', 'playerId', 'resumeToken', 'sessionId', 'side']);
});

// ── a hostile host, played by a fake peer ────────────────────────────────────
function guestBrowser(net) {
  const Peer = makePeerClass(net);
  const browser = createP2P({
    load: async () => ({ Peer, SessionManager, createOnlineHost }), peerOptions: () => ({}),
    timeouts: { open: 400, connect: 400, rpc: 400, auth: 250 },
    setTimeout, clearTimeout, setInterval, clearInterval, now: () => performance.now()
  });
  live.push(browser);
  return browser;
}
function hostileHost(net, behaviour) {
  const Peer = makePeerClass(net);
  const peer = new Peer(ID_PREFIX + '654321');
  const conns = [];
  peer.on('connection', (conn) => { conns.push(conn); conn.on('data', (m) => behaviour(conn, m)); });
  live.push({ close() { peer.destroy(); } });
  return { peer, conns };
}
async function until(check, ms = 2000, what = 'condition') {
  const start = Date.now();
  while (Date.now() - start < ms) { if (check()) return; await new Promise((r) => setTimeout(r, 5)); }
  assert.fail(`timed out waiting for ${what}`);
}

it('a host that answers a join with junk is refused, not believed', async () => {
  for (const reply of [{ ok: true, d: 'hello' }, { ok: true, d: { side: 'left' } }, { ok: true, d: { joinCode: '654321', side: 'sideways' } }, { ok: true, d: null }]) {
    const net = new FakeNet();
    hostileHost(net, (conn, m) => { if (m.t === 'rpc') conn.send({ t: 'res', id: m.id, ...reply }); });
    const guest = guestBrowser(net);
    await assert.rejects(guest.api('/api/join', { code: '654321', nickname: 'g' }), /sent something unexpected/);
    guest.close();
  }
});

it('a host\'s error text is bounded and cannot carry markup length', async () => {
  const net = new FakeNet();
  hostileHost(net, (conn, m) => { if (m.t === 'rpc') conn.send({ t: 'res', id: m.id, ok: false, error: '<img src=x onerror=alert(1)>' + 'A'.repeat(5_000_000) }); });
  const guest = guestBrowser(net);
  let message = null;
  try { await guest.api('/api/join', { code: '654321', nickname: 'g' }); } catch (error) { message = error.message; }
  assert.ok(message && message.length <= 200, `message length ${message && message.length}`);
});

it('a host cannot make a guest\'s socket fire events it never legitimately sends', async () => {
  const net = new FakeNet();
  const sent = new Promise((resolve) => {
    hostileHost(net, (conn, m) => {
      if (m.t === 'rpc') {
        // a perfectly valid-looking reply, so the guest proceeds to open its socket
        conn.send({ t: 'res', id: m.id, ok: true, d: { sessionId: 's1', joinCode: '654321', joinUrl: '/?join=654321', playerId: 'p2', side: 'right', joinTicket: 'ticket', resumeToken: 'resume', lobbyState: { code: '654321', status: 'lobby', joinLocked: false, expiresAt: 1, players: [] } } });
      } else if (m.t === 'sock') {
        for (const e of ['disconnect', 'connect_error', 'connect', '__proto__', 'constructor', 'toString', 'input:move', 'host:start']) conn.send({ t: 'ev', e, p: 'reason' });
        conn.send({ t: 'ev', e: 'lobby:player_list', p: { fine: true } });
        conn.send({ t: 'err', error: 'x'.repeat(10000) });
        resolve();
      }
    });
  });
  const guest = guestBrowser(net);
  const joined = await guest.api('/api/join', { code: '654321', nickname: 'g' });
  const socket = guest.io({ auth: { joinTicket: joined.joinTicket } });
  const got = [];
  for (const name of ['disconnect', 'connect_error', 'connect', 'input:move', 'host:start', 'lobby:player_list']) socket.on(name, (p) => got.push([name, p]));
  await sent;
  await until(() => got.some(([n]) => n === 'connect_error'), 1000, 'the error to arrive');
  const names = got.map(([n]) => n);
  assert.ok(!names.includes('disconnect'), 'a forged "disconnect" did not reach the client');
  assert.ok(!names.includes('connect'), 'nor a forged "connect"');
  assert.ok(!names.includes('input:move') && !names.includes('host:start'), 'nor client-to-server events');
  assert.ok(names.includes('lobby:player_list'), 'but the real kind of event is delivered');
  assert.ok(got.find(([n]) => n === 'connect_error')[1].message.length <= 200);
});

it('a host that never answers a join is given up on', async () => {
  const net = new FakeNet();
  hostileHost(net, () => {});
  const guest = guestBrowser(net);
  await assert.rejects(guest.api('/api/join', { code: '654321', nickname: 'g' }), /didn't answer/);
});
