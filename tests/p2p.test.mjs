import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createP2P, ID_PREFIX } = require('../glitchpong-p2p.js');
const { SessionManager } = require('../server/session-manager.js');
const { createOnlineHost } = require('../server/online-host.js');

import { FakeNet, makePeerClass } from './helpers/fake-peer.mjs';

// Every browser a test makes is closed afterwards, pass or fail: a host's match loop
// is a timer, and one left running would keep the whole test process alive.
const live = [];
afterEach(() => { live.splice(0).forEach((b) => b.close()); });
// A test that gets stuck fails after a while instead of hanging the run.
const it = (name, fn) => test(name, { timeout: 15000 }, fn);

function makeBrowser(net, timeouts = { open: 400, connect: 400, rpc: 400, auth: 250 }) {
  const Peer = makePeerClass(net);
  const browser = createP2P({
    load: async () => ({ Peer, SessionManager, createOnlineHost }),
    peerOptions: () => ({}),
    timeouts,
    setTimeout, clearTimeout, setInterval, clearInterval,
    now: () => performance.now()
  });
  live.push(browser);
  return browser;
}

// Records what a socket receives.
function log(socket) {
  const events = [];
  const record = (name) => socket.on(name, (payload) => events.push([name, payload]));
  ['connect_error', 'error:message', 'lobby:joined', 'lobby:player_list', 'lobby:locked', 'state:snapshot', 'match:start', 'match:end', 'player:disconnected', 'player:reconnected', 'disconnect'].forEach(record);
  return { events, has: (n) => events.some(([e]) => e === n), all: (n) => events.filter(([e]) => e === n).map(([, p]) => p), last: (n) => events.filter(([e]) => e === n).at(-1)?.[1] };
}
async function until(check, ms = 2000, what = 'condition') {
  const start = Date.now();
  while (Date.now() - start < ms) { if (check()) return; await new Promise((r) => setTimeout(r, 5)); }
  assert.fail(`timed out waiting for ${what}`);
}
async function rejects(promise, pattern) {
  try { await promise; } catch (error) { assert.match(error.message, pattern); return; }
  assert.fail('expected a rejection');
}

// A host and a guest in their own "browsers", already in a lobby together.
async function pair(net) {
  const hostB = makeBrowser(net), guestB = makeBrowser(net);
  const created = await hostB.api('/api/sessions', { nickname: 'Host' });
  const hostSocket = hostB.io({ auth: { joinTicket: created.joinTicket } });
  const hostLog = log(hostSocket);
  await until(() => hostLog.has('lobby:joined'), 2000, 'the host to join its own lobby');
  const joined = await guestB.api('/api/join', { code: created.joinCode, nickname: 'Guest' });
  const guestSocket = guestB.io({ auth: { joinTicket: joined.joinTicket } });
  const guestLog = log(guestSocket);
  await until(() => guestLog.has('lobby:joined'), 2000, 'the guest to join');
  return { hostB, guestB, created, joined, hostSocket, guestSocket, hostLog, guestLog, closeAll() { hostB.close(); guestB.close(); } };
}

it('a host gets a code, a guest joins with it, and a match plays', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    assert.match(t.created.joinCode, /^\d{6}$/);
    assert.ok(net.peers.has(ID_PREFIX + t.created.joinCode), 'the code is the host\'s id on the broker');
    assert.equal(t.created.p2p, true);
    assert.equal(t.created.side, 'left');
    assert.equal(t.joined.side, 'right');
    await until(() => t.hostLog.last('lobby:player_list')?.players.length === 2 && t.hostLog.last('lobby:player_list').players.every((p) => p.connected), 2000, 'both players connected');

    t.hostSocket.emit('host:start');
    await until(() => t.hostLog.has('match:start') && t.guestLog.has('match:start'), 2000, 'the match to start');
    assert.equal(t.guestLog.last('match:start').state.status, 'playing');

    t.guestSocket.emit('input:move', { direction: 'up' });
    t.hostSocket.emit('input:move', { direction: 'down' });
    await until(() => t.guestLog.all('state:snapshot').length > 12, 2000, 'snapshots to arrive');
    const snap = t.guestLog.last('state:snapshot');
    assert.ok(snap.paddles.right.y < (540 - 118) / 2, 'the guest\'s paddle moved up');
    assert.ok(snap.paddles.left.y > (540 - 118) / 2, 'the host\'s paddle moved down');
    assert.deepEqual(t.hostLog.last('state:snapshot').scores, snap.scores, 'both see the same game');

    // finish the match: put the ball just past the right edge with the score at 10
    const state = t.hostB._debug.room.sessions.getByCode(t.created.joinCode).gameState;
    state.scores.left = 10; state.ball.x = 975; state.ball.vx = 315;
    await until(() => t.hostLog.has('match:end') && t.guestLog.has('match:end'), 2000, 'the match to end');
    assert.equal(t.guestLog.last('match:end').winner, 'left');
  } finally { t.closeAll(); }
});

it('the host cannot be started alone, and a guest cannot start', async () => {
  const net = new FakeNet();
  const hostB = makeBrowser(net);
  const created = await hostB.api('/api/sessions', { nickname: 'Host' });
  const hostSocket = hostB.io({ auth: { joinTicket: created.joinTicket } });
  const hostLog = log(hostSocket);
  await until(() => hostLog.has('lobby:joined'));
  hostSocket.emit('host:start');
  await until(() => hostLog.has('error:message'));
  assert.equal(hostLog.last('error:message'), 'Waiting for opponent connection.');
  hostB.close();

  const t = await pair(new FakeNet());
  try {
    t.guestSocket.emit('host:start');
    t.guestSocket.emit('host:lock');
    await until(() => t.guestLog.all('error:message').length === 2);
    assert.equal(t.guestLog.last('error:message'), 'Host permission required.');
    assert.ok(!t.hostLog.has('match:start'));
  } finally { t.closeAll(); }
});

it('bad codes are refused without a network round trip, and unknown ones the same way', async () => {
  const net = new FakeNet();
  const guest = makeBrowser(net);
  for (const bad of ['', 'abc', '12345', '1234567', '12 456', undefined]) await rejects(guest.api('/api/join', { code: bad, nickname: 'x' }), /Invalid or expired code/);
  assert.equal(net.peers.size, 0, 'no peer was even created for a malformed code');
  await rejects(guest.api('/api/join', { code: '123456', nickname: 'x' }), /Invalid or expired code/);
  guest.close();
});

it('a taken code is retried with a new one, and the abandoned lobbies are cleaned up', async () => {
  const net = new FakeNet();
  net.failRegistrations = 3;
  const hostB = makeBrowser(net);
  const created = await hostB.api('/api/sessions', { nickname: 'Host' });
  assert.ok(net.peers.has(ID_PREFIX + created.joinCode));
  assert.equal(hostB._debug.room.sessions.sessions.size, 1, 'only the live lobby remains');
  hostB.close();
});

it('an unreachable broker is reported plainly and leaves nothing behind', async () => {
  const net = new FakeNet();
  net.down = true;
  const hostB = makeBrowser(net);
  await rejects(hostB.api('/api/sessions', { nickname: 'Host' }), /matchmaking service/);
  assert.equal(hostB.hosting, false);
  const guest = makeBrowser(net);
  await rejects(guest.api('/api/join', { code: '123456', nickname: 'x' }), /matchmaking service/);

  const quiet = new FakeNet();
  quiet.silent = true;                                    // never answers at all
  await rejects(makeBrowser(quiet).api('/api/sessions', { nickname: 'Host' }), /matchmaking service/);
});

it('a lobby that is full or locked refuses a third player the same way', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    const third = makeBrowser(net);
    await rejects(third.api('/api/join', { code: t.created.joinCode, nickname: 'C' }), /Invalid or expired code/);
    third.close();
  } finally { t.closeAll(); }
});

it('the host leaving ends the game for the guest, and frees the code', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  t.hostSocket.disconnect();
  await until(() => t.guestLog.has('disconnect'), 2000, 'the guest to be dropped');
  assert.equal(t.guestLog.last('disconnect'), 'transport close');
  assert.equal(net.peers.has(ID_PREFIX + t.created.joinCode), false, 'the code is released');
  assert.equal(t.hostB.hosting, false);
  await rejects(t.guestB.api('/api/rejoin', { code: t.created.joinCode, resumeToken: t.joined.resumeToken }), /Invalid or expired code/);
  t.closeAll();
});

it('a guest who drops can come back with the code and their resume token', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    t.guestSocket.disconnect();
    await until(() => t.hostLog.has('player:disconnected'), 2000, 'the host to notice');
    const again = await t.guestB.api('/api/rejoin', { code: t.created.joinCode, resumeToken: t.joined.resumeToken });
    assert.equal(again.side, 'right');
    const socket = t.guestB.io({ auth: { joinTicket: again.joinTicket } });
    const l = log(socket);
    await until(() => l.has('lobby:joined') && t.hostLog.has('player:reconnected'), 2000, 'the reconnect');
  } finally { t.closeAll(); }
});

it('the host reattaches to its own game without the network', async () => {
  const net = new FakeNet();
  const hostB = makeBrowser(net);
  const created = await hostB.api('/api/sessions', { nickname: 'Host' });
  const first = hostB.io({ auth: { joinTicket: created.joinTicket } });
  const l1 = log(first);
  await until(() => l1.has('lobby:joined'));
  const peersBefore = net.peers.size;
  const again = await hostB.api('/api/rejoin', { code: created.joinCode, resumeToken: created.resumeToken });
  assert.equal(again.side, 'left');
  assert.equal(net.peers.size, peersBefore);
  hostB.close();
});

it('a stranger on the data channel can do nothing but present a ticket', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    const Peer = makePeerClass(net);
    const stranger = new Peer();
    await until(() => net.peers.has(stranger.id));
    const conn = stranger.connect(ID_PREFIX + t.created.joinCode);
    const got = [];
    conn.on('data', (m) => got.push(m));
    await until(() => conn.open);
    for (const junk of [null, 5, 'x', [], {}, { t: 7 }, { t: 'ev', e: 'host:start' }, { t: 'ev', e: 'input:move', p: { direction: 'up' } },
      { t: 'rpc', id: 'a', m: 'join' }, { t: 'rpc', id: 1, m: 'create' }, { t: 'rpc', id: 2, m: '__proto__' }, { t: 'sock', ticket: 'x'.repeat(500) }, { t: 'sock', ticket: { a: 1 } }]) conn.send(junk);
    conn.send({ t: 'sock', ticket: 'not-a-real-ticket' });
    conn.send({ t: 'rpc', id: 3, m: 'join', b: { code: '000000', nickname: 'z' } });
    await until(() => got.some((m) => m.t === 'err') && got.some((m) => m.t === 'res'), 2000, 'replies');
    assert.deepEqual(got.find((m) => m.t === 'err'), { t: 'err', error: 'Invalid connection ticket.' });
    const replies = got.filter((m) => m.t === 'res');
    assert.equal(replies.length, 1, 'only the one valid request (join) was answered; unknown methods and bad ids got nothing');
    assert.equal(replies[0].id, 3);
    assert.equal(replies[0].ok, false);
    assert.ok(!t.hostLog.has('match:start'), 'the strangers\' events did nothing');
    // the real players are untouched
    assert.equal(t.hostB._debug.room.sessions.getByCode(t.created.joinCode).players.length, 2);
    stranger.destroy();
  } finally { t.closeAll(); }
});

it('a connection that never identifies itself is dropped', async () => {
  const net = new FakeNet();
  const hostB = makeBrowser(net);
  const created = await hostB.api('/api/sessions', { nickname: 'Host' });
  const Peer = makePeerClass(net);
  const stranger = new Peer();
  await until(() => net.peers.has(stranger.id));
  const conn = stranger.connect(ID_PREFIX + created.joinCode);
  let closed = false;
  conn.on('close', () => { closed = true; });
  await until(() => conn.open);
  await until(() => closed, 1500, 'the silent connection to be closed');
  hostB.close();
});

it('only a few connections are accepted at once', async () => {
  const net = new FakeNet();
  const hostB = makeBrowser(net, { open: 400, connect: 400, rpc: 400, auth: 5000 });
  const created = await hostB.api('/api/sessions', { nickname: 'Host' });
  const Peer = makePeerClass(net);
  const conns = [];
  for (let i = 0; i < 9; i++) { const p = new Peer(); await until(() => net.peers.has(p.id)); const c = p.connect(ID_PREFIX + created.joinCode); const state = { closed: false }; c.on('close', () => { state.closed = true; }); conns.push([c, state]); }
  await new Promise((r) => setTimeout(r, 80));
  const open = conns.filter(([, s]) => !s.closed).length;
  assert.equal(open, 6, `six stay open, the rest are turned away (got ${open})`);
  hostB.close();
});

it('an authenticated guest cannot fire the host\'s internal events', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    const raw = t.guestB._debug.guest.conn;
    // these have handlers on the host's side of the connection but are not the client's to send
    for (const e of ['disconnect', 'lobby:player_list', 'state:snapshot', 'error:message', '__proto__', 'constructor']) raw.send({ t: 'ev', e, p: {} });
    await new Promise((r) => setTimeout(r, 60));
    assert.ok(!t.hostLog.has('player:disconnected'), 'the guest was not marked as disconnected');
    const lobby = t.hostB._debug.room.sessions.getByCode(t.created.joinCode);
    assert.ok(lobby.players.every((p) => p.connected), 'both players are still connected');
  } finally { t.closeAll(); }
});

it('a connection that sends too fast has the excess dropped', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    t.hostSocket.emit('host:start');
    await until(() => t.guestLog.has('match:start'));
    const raw = t.guestB._debug.guest.conn;
    for (let i = 0; i < 450; i++) raw.send({ t: 'ev', e: 'input:move', p: { direction: 'down' } });
    raw.send({ t: 'ev', e: 'input:move', p: { direction: 'up' } });          // message 451 inside the same second
    await new Promise((r) => setTimeout(r, 120));
    const paddles = t.hostB._debug.room.sessions.getByCode(t.created.joinCode).gameState.paddles;
    assert.equal(paddles.right.direction, 'down', 'the 451st message was ignored');
  } finally { t.closeAll(); }
});

it('a flood of messages does not stop the match', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    t.hostSocket.emit('host:start');
    await until(() => t.guestLog.has('match:start'));
    for (let i = 0; i < 2000; i++) t.guestSocket.emit('input:move', { direction: i % 2 ? 'up' : 'down' });
    const before = t.hostLog.all('state:snapshot').length;
    await until(() => t.hostLog.all('state:snapshot').length > before + 10, 2000, 'snapshots to keep flowing');
  } finally { t.closeAll(); }
});

it('events a client may not send are ignored, on both the guest and the host side', async () => {
  const net = new FakeNet();
  const t = await pair(net);
  try {
    t.guestSocket.emit('state:snapshot', { hacked: true });
    t.guestSocket.emit('lobby:locked', {});
    t.hostSocket.emit('state:snapshot', { hacked: true });
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(!t.hostLog.has('lobby:locked'), 'the host never received a forged lobby event');
    assert.ok(!t.hostLog.all('state:snapshot').some((s) => s.hacked));
    assert.ok(!t.guestLog.all('state:snapshot').some((s) => s.hacked));
  } finally { t.closeAll(); }
});

it('a socket with no host behind it reports an error instead of hanging', async () => {
  const net = new FakeNet();
  const lonely = makeBrowser(net);
  const socket = lonely.io({ auth: { joinTicket: 'nothing' } });
  const l = log(socket);
  await until(() => l.has('connect_error'));
  assert.match(l.last('connect_error').message, /Not connected/);
});
