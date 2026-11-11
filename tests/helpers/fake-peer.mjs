// A fake PeerJS: an in-memory broker with asynchronous delivery, for testing the
// peer-to-peer layer without a network. Shared by the p2p tests.
// ── a fake PeerJS: an in-memory broker with asynchronous delivery ──────────
export class FakeNet {
  constructor() { this.peers = new Map(); this.failRegistrations = 0; this.down = false; this.silent = false; }
}
class FakeConn {
  constructor(owner, peerId) { this.owner = owner; this.peer = peerId; this.open = false; this.remote = null; this.handlers = {}; }
  on(event, fn) { (this.handlers[event] ||= []).push(fn); return this; }
  _emit(event, ...args) { for (const fn of this.handlers[event] || []) fn(...args); }
  send(message) {
    if (!this.open) throw new Error('connection is closed');
    const data = JSON.parse(JSON.stringify(message));          // what the wire would do
    setTimeout(() => { if (this.remote && this.remote.open) this.remote._emit('data', data); }, 0);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    const remote = this.remote;
    setTimeout(() => { this._emit('close'); if (remote && remote.open) { remote.open = false; remote._emit('close'); } }, 0);
  }
}
export function makePeerClass(net) {
  return class FakePeer {
    constructor(a) {
      const named = typeof a === 'string';
      this.id = named ? a : 'anon-' + Math.random().toString(36).slice(2, 10);
      this.handlers = {}; this.conns = new Set(); this.destroyed = false; this.disconnected = false;
      setTimeout(() => {
        if (this.destroyed || net.silent) return;
        if (net.down) return this._emit('error', { type: 'network' });
        if (named && (net.peers.has(this.id) || net.failRegistrations-- > 0)) return this._emit('error', { type: 'unavailable-id' });
        net.peers.set(this.id, this);
        this._emit('open', this.id);
      }, 1);
    }
    on(event, fn) { (this.handlers[event] ||= []).push(fn); return this; }
    _emit(event, ...args) { for (const fn of this.handlers[event] || []) fn(...args); }
    connect(id) {
      const conn = new FakeConn(this, id);
      this.conns.add(conn);
      setTimeout(() => {
        const target = net.peers.get(id);
        if (!target || target.destroyed) return this._emit('error', { type: 'peer-unavailable' });
        const remote = new FakeConn(target, this.id);
        target.conns.add(remote);
        conn.remote = remote; remote.remote = conn; conn.open = remote.open = true;
        target._emit('connection', remote);
        conn._emit('open');
        remote._emit('open');
      }, 1);
      return conn;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const conn of this.conns) conn.close();
      if (net.peers.get(this.id) === this) net.peers.delete(this.id);
    }
  };
}

