import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sim = require('../server/authoritative-pong.js');
const { SessionManager } = require('../server/session-manager.js');
const { createOnlineHost } = require('../server/online-host.js');

// A stand-in for socket.io: a hub with rooms, and sockets that record what they
// are sent and let a test act as the client.
class Hub {
  constructor() { this.sockets = new Set(); }
  to(room) { return { emit: (event, payload) => this.sockets.forEach((s) => { if (s.rooms.has(room)) s.sent.push([event, payload]); }) }; }
}
let nextId = 1;
function makeSocket(hub, auth) {
  const handlers = new Map();
  const socket = {
    id: 's' + nextId++, data: { session: auth.session, player: auth.player }, rooms: new Set(), sent: [], closed: false,
    emit(event, payload) { this.sent.push([event, payload]); },
    on(event, fn) { handlers.set(event, fn); },
    join(room) { this.rooms.add(room); },
    disconnect() { this.closed = true; hub.sockets.delete(this); handlers.get('disconnect')?.(); },
    // the client sends an event
    receive(event, payload) { const fn = handlers.get(event); if (fn) fn(payload); },
    events(name) { return this.sent.filter(([e]) => e === name).map(([, p]) => p); }
  };
  hub.sockets.add(socket);
  return socket;
}

function setup() {
  const hub = new Hub();
  const sessions = new SessionManager();
  const host = createOnlineHost({ sessions, io: hub });
  const connect = (response) => {
    const auth = host.authenticate(response.joinTicket);
    assert.ok(auth, 'ticket accepted');
    const socket = makeSocket(hub, auth);
    host.onConnection(socket);
    return socket;
  };
  return { hub, sessions, host, connect };
}

test('a lobby runs from create to a started match', () => {
  const { hub, sessions, host, connect } = setup();
  const created = host.api.create('Alice');
  assert.match(created.joinCode, /^\d{6}$/);
  assert.equal(created.side, 'left');
  assert.equal(created.joinUrl, `/?join=${created.joinCode}`);
  const a = connect(created);
  assert.equal(a.events('lobby:joined')[0].side, 'left');

  a.receive('host:start');
  assert.deepEqual(a.events('error:message'), ['Waiting for opponent connection.'], 'cannot start alone');

  const joined = host.api.join(created.joinCode, 'Bob', '1.1.1.1');
  assert.equal(joined.side, 'right');
  const b = connect(joined);
  assert.equal(a.events('lobby:player_list').at(-1).players.length, 2, 'the host hears about the opponent');
  assert.ok(b.events('lobby:player_list').length >= 1);

  a.receive('host:start');
  const startA = a.events('match:start').at(-1), startB = b.events('match:start').at(-1);
  assert.equal(startA.state.status, 'playing');
  assert.ok(startB);

  b.receive('input:move', { direction: 'up' });
  a.receive('input:move', { direction: 'down' });
  const before = sessions.getByCode(created.joinCode).gameState.paddles.right.y;
  sessions.tick(hub);
  const snap = a.events('state:snapshot').at(-1);
  assert.ok(snap.paddles.right.y < before, 'the right paddle moved up');
  assert.ok(snap.paddles.left.y > (sim.HEIGHT - 118) / 2, 'the left paddle moved down');
});

test('a join ticket works once', () => {
  const { host } = setup();
  const created = host.api.create('A');
  assert.ok(host.authenticate(created.joinTicket));
  assert.equal(host.authenticate(created.joinTicket), null);
  assert.equal(host.authenticate('nonsense'), null);
  assert.equal(host.authenticate(undefined), null);
});

test('bad, locked and full lobbies refuse a join with the same message', () => {
  const { host } = setup();
  const created = host.api.create('A');
  assert.throws(() => host.api.join('000000', 'B', 'ip'), /Invalid or expired code/);
  assert.throws(() => host.api.join(undefined, 'B', 'ip'), /Invalid or expired code/);
  host.api.join(created.joinCode, 'B', 'ip');
  assert.throws(() => host.api.join(created.joinCode, 'C', 'ip'), /Invalid or expired code/, 'a third player is turned away');
  const second = host.api.create('A2');
  host.api.action(second.sessionId, 'lock', second.playerId);
  assert.throws(() => host.api.join(second.joinCode, 'B', 'ip'), /Invalid or expired code/, 'locked');
});

test('only the host can lock or start', () => {
  const { host, connect } = setup();
  const created = host.api.create('A');
  const a = connect(created);
  const joined = host.api.join(created.joinCode, 'B', 'ip');
  const b = connect(joined);
  b.receive('host:lock');
  b.receive('host:start');
  assert.deepEqual(b.events('error:message'), ['Host permission required.', 'Host permission required.']);
  assert.equal(a.events('match:start').length, 0);
});

test('a dropped player can rejoin inside the grace period, not after it', () => {
  const { sessions, host, connect } = setup();
  const created = host.api.create('A');
  const a = connect(created);
  const joined = host.api.join(created.joinCode, 'B', 'ip');
  const b = connect(joined);
  b.disconnect();
  assert.equal(a.events('player:disconnected').length, 1);
  const again = host.api.rejoin(created.joinCode, joined.resumeToken);
  assert.equal(again.side, 'right');
  connect(again);
  assert.equal(a.events('player:reconnected').length, 1);

  const player = sessions.getByCode(created.joinCode).players[1];
  player.disconnectedAt = Date.now() - 46 * 1000;
  assert.throws(() => host.api.rejoin(created.joinCode, joined.resumeToken), /Unable to restore/);
  assert.throws(() => host.api.rejoin(created.joinCode, 'wrong'), /Unable to restore/);
});

test('join attempts from one address are rate limited', () => {
  const { host } = setup();
  for (let i = 0; i < 12; i++) assert.throws(() => host.api.join('111111', 'x', 'same'), /Invalid or expired code/);
  assert.throws(() => host.api.join('111111', 'x', 'same'), /Too many attempts/);
  assert.throws(() => host.api.join('111111', 'x', 'other'), /Invalid or expired code/, 'another address is unaffected');
});

test('a tick that catches up still sends a single snapshot', () => {
  const { hub, sessions, host, connect } = setup();
  const created = host.api.create('A');
  const a = connect(created);
  connect(host.api.join(created.joinCode, 'B', 'ip'));
  a.receive('host:start');
  const before = a.events('state:snapshot').length;
  sessions.tick(hub, 5);
  assert.equal(a.events('state:snapshot').length, before + 1);
});

test('the simulation plays a match to a winner at eleven points', () => {
  const state = sim.initialState();
  state.status = 'playing';
  sim.resetBall(state, 1);
  let now = 1000;
  for (let i = 0; i < 400000 && state.status === 'playing'; i++) { sim.step(state, 1 / 60, now); now += 17; }
  assert.equal(state.status, 'ended');
  assert.equal(Math.max(state.scores.left, state.scores.right), 11);
  assert.equal(state.winner, state.scores.left === 11 ? 'left' : 'right');
});

test('join codes are six digits, unique, and not biased toward any digit', () => {
  const sessions = new SessionManager();
  const codes = new Set();
  const counts = Array(10).fill(0);
  for (let i = 0; i < 3000; i++) {
    const { session } = sessions.create('x');
    assert.match(session.joinCode, /^\d{6}$/);
    assert.ok(!codes.has(session.joinCode), 'no duplicate code among live lobbies');
    codes.add(session.joinCode);
    for (const ch of session.joinCode) counts[+ch]++;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  for (const c of counts) assert.ok(Math.abs(c / total - 0.1) < 0.012, `digit shares look uniform: ${counts}`);
});

test('tokens are url-safe and long enough to be unguessable', () => {
  const sessions = new SessionManager();
  const { host, ticket } = sessions.create('x');
  for (const t of [host.resumeToken, ticket]) assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(host.resumeToken, ticket);
});
