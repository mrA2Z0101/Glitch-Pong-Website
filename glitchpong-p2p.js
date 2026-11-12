// ═══════════════════════════════════════════════════════════════════════════
// GLITCH PONG PEER-TO-PEER — the "no server" way to play online.
//
// Kahoot-style: one player hosts and gets a six-digit code, the other types it in.
// There is no game server. The host's own browser runs the lobby and the match
// (the same session manager and simulation the socket.io server uses) and the
// guest talks to it over a WebRTC data channel. PeerJS' free public broker only
// introduces the two browsers, using the code as the host's id; the game itself
// never passes through it.
//
// It stands in for the two things the client already uses, so the lobby and the
// game need no changes:
//   · onlineApi("/api/sessions" | "/api/join" | "/api/rejoin", body) → GlitchP2P.api(path, body)
//   · window.io({ auth: { joinTicket } })                             → GlitchP2P.io({ auth })
//
// Loaded lazily: PeerJS and the server modules are only fetched when someone
// actually opens multiplayer without a socket.io server to talk to.
// See docs/multiplayer.md.
// ═══════════════════════════════════════════════════════════════════════════
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlitchP2P = api.createBrowser();
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  const ID_PREFIX = "glitchpong-";           // namespaces our ids on the shared public broker
  const STEP_MS = 1000 / 60;
  const TIMEOUTS = {
    open: 12000,                             // reaching the broker
    connect: 15000,                          // reaching the host through it
    rpc: 10000,
    auth: 20000                              // a connection that never says who it is gets dropped
  };
  const limit = (env, name) => (env.timeouts && env.timeouts[name]) || TIMEOUTS[name];
  const MAX_CONNECTIONS = 6;                 // two players, with room for a reconnect to overlap
  const MAX_ID_TRIES = 8;                    // a six-digit code can collide with someone else's room
  const MAX_MESSAGES_PER_SECOND = 400;       // a client sends well under 100; this only catches abuse
  const RPC_METHODS = ["join", "rejoin"];

  // PeerJS error types → what the player reads.
  const MESSAGES = {
    "browser-incompatible": "This browser can't do peer-to-peer play.",
    "peer-unavailable": "Invalid or expired code.",
    "unavailable-id": "That code is already in use. Try again.",
    network: "Can't reach the matchmaking service. Check your connection and try again.",
    "server-error": "Can't reach the matchmaking service. Check your connection and try again.",
    "socket-error": "Can't reach the matchmaking service. Check your connection and try again.",
    "socket-closed": "Can't reach the matchmaking service. Check your connection and try again.",
    timeout: "Can't reach the matchmaking service. Check your connection and try again.",
    "connect-timeout": "Couldn't connect to the host. Some networks (school, work, some mobile data) block direct connections. Try another network.",
    webrtc: "The connection to the host failed. Try another network."
  };
  function friendly(error, fallback) {
    if (error && error.type && MESSAGES[error.type]) return new Error(MESSAGES[error.type]);
    if (error instanceof Error && error.message) return error;
    return new Error(fallback || "Unable to connect.");
  }

  // ── Everything a host sends a guest is untrusted ─────────────────────────────
  // With a server the other end was ours. Here it is a stranger's browser, free to
  // send anything: markup in a nickname, a score of Infinity (JSON.parse("1e999")),
  // a ten-megabyte string. These rebuild each kind of message from scratch, keeping
  // only the expected fields, with their types and ranges checked. A message that
  // can't be made valid is dropped (null). Text is length-limited here and must still
  // be escaped (escapeHtml) or set with textContent wherever it reaches the page.
  const SERVER_EVENTS = ["lobby:joined", "lobby:player_list", "lobby:locked", "state:snapshot", "match:start", "match:end", "player:disconnected", "player:reconnected", "error:message"];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"'`]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[ch]));
  }
  function cleanText(value, max, fallback = "") {
    if (typeof value !== "string" && typeof value !== "number") return fallback;
    // Control characters, line breaks, zero-width characters and the Unicode direction
    // overrides (which can flip a name's displayed order to spoof another) have no
    // place in a name or a message.
    return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g, " ").trim().slice(0, max) || fallback;
  }
  function inRange(value, min, max) { return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null; }

  // A player's title and nameplate travel as catalog ids, never as text to show.
  function cleanCard(card) {
    const pick = (value) => (typeof value === "string" && /^[a-z0-9_-]{1,24}$/i.test(value) ? value : "default");
    return { title: pick(card && card.title), plate: pick(card && card.plate) };
  }

  function cleanLobby(lobby) {
    if (!lobby || typeof lobby !== "object" || !Array.isArray(lobby.players)) return null;
    return {
      code: String(lobby.code === undefined || lobby.code === null ? "" : lobby.code).replace(/\D/g, "").slice(0, 6),
      status: ["lobby", "playing", "ended"].includes(lobby.status) ? lobby.status : "lobby",
      joinLocked: lobby.joinLocked === true,
      expiresAt: inRange(lobby.expiresAt, 0, 1e15) || 0,
      players: lobby.players.slice(0, 2).filter((p) => p && typeof p === "object").map((p) => ({
        playerId: cleanText(p.playerId, 64),
        nickname: cleanText(p.nickname, 20, "Player"),
        card: cleanCard(p.card),
        side: p.side === "right" ? "right" : "left",
        host: p.host === true, connected: p.connected === true, ready: p.ready === true
      }))
    };
  }

  function cleanSnapshot(snap) {
    if (!snap || typeof snap !== "object" || !snap.ball || !snap.paddles || !snap.paddles.left || !snap.paddles.right || !snap.scores) return null;
    const width = inRange(snap.width, 100, 4000), height = inRange(snap.height, 100, 4000);
    const ball = { x: inRange(snap.ball.x, -4000, 8000), y: inRange(snap.ball.y, -4000, 8000), vx: inRange(snap.ball.vx, -1e6, 1e6), vy: inRange(snap.ball.vy, -1e6, 1e6) };
    const left = inRange(snap.paddles.left.y, -4000, 8000), right = inRange(snap.paddles.right.y, -4000, 8000);
    const scoreL = inRange(snap.scores.left, 0, 99), scoreR = inRange(snap.scores.right, 0, 99);
    if ([width, height, ball.x, ball.y, ball.vx, ball.vy, left, right, scoreL, scoreR].some((v) => v === null)) return null;
    return {
      width, height, ball,
      paddles: { left: { y: left }, right: { y: right } },
      scores: { left: Math.floor(scoreL), right: Math.floor(scoreR) },
      status: ["waiting", "playing", "ended"].includes(snap.status) ? snap.status : "waiting",
      heat: inRange(snap.heat, 0, 100) || 0,
      lastHit: ["left", "right", "neutral"].includes(snap.lastHit) ? snap.lastHit : "neutral",
      winner: snap.winner === "left" || snap.winner === "right" ? snap.winner : null
    };
  }

  // What a guest accepts as the host's reply to a join or rejoin.
  function cleanSession(r) {
    if (!r || typeof r !== "object") return null;
    const lobbyState = cleanLobby(r.lobbyState);
    const joinCode = typeof r.joinCode === "string" && /^\d{6}$/.test(r.joinCode) ? r.joinCode : null;
    const str = (v, max) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
    const out = {
      sessionId: str(r.sessionId, 80), joinCode, joinUrl: joinCode ? `/?join=${joinCode}` : null,
      playerId: str(r.playerId, 80), side: r.side === "left" || r.side === "right" ? r.side : null,
      joinTicket: str(r.joinTicket, 200), resumeToken: str(r.resumeToken, 200), lobbyState
    };
    return Object.values(out).some((v) => v === null) ? null : out;
  }

  const clean = { escapeHtml, text: cleanText, card: cleanCard, lobby: cleanLobby, snapshot: cleanSnapshot, session: cleanSession, SERVER_EVENTS };

  // Wait for `check` events and a timeout; always resolves or rejects exactly once.
  function waitFor(env, timeoutMs, timeoutType, attach) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timer = env.setTimeout(() => finish(null, { type: timeoutType }), timeoutMs);
      function finish(value, error) {
        if (finished) return;
        finished = true;
        env.clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      }
      attach((value) => finish(value), (error) => finish(null, error));
    });
  }

  function openPeer(env, Peer, id) {
    const options = env.peerOptions();
    const peer = id ? new Peer(id, options) : new Peer(options);
    return waitFor(env, limit(env, "open"), "timeout", (ok, fail) => {
      peer.on("open", () => ok(peer));
      peer.on("error", fail);
    }).catch((error) => { try { peer.destroy(); } catch (e) {} throw error; });
  }

  // ── sockets: the same surface socket.io gives the client and the server ──────
  // The client's side of a connection.
  function createClientSocket(send, close) {
    const handlers = new Map();
    let done = false;
    const socket = {
      id: null,
      connected: true,
      on(event, fn) { if (!handlers.has(event)) handlers.set(event, []); handlers.get(event).push(fn); return socket; },
      emit(event, payload) { if (!done) send(event, payload); },
      // a deliberate local disconnect, the same reason socket.io gives
      disconnect() { if (done) return; socket._end("io client disconnect"); close(); },
      _dispatch(event, ...args) {
        for (const fn of handlers.get(event) || []) { try { fn(...args); } catch (error) { if (root.console) root.console.error(error); } }
      },
      _end(reason) { if (done) return; done = true; socket.connected = false; socket._dispatch("disconnect", reason); }
    };
    return socket;
  }

  // The hosting browser's side of one player's connection, as the shared lobby
  // code expects it. `deliver(event, payload)` sends to that player.
  let serverSocketSeq = 0;
  function createServerSocket(hub, auth, deliver, close) {
    const handlers = new Map();
    let done = false;
    const socket = {
      id: "p2p-" + (++serverSocketSeq),
      data: { session: auth.session, player: auth.player },
      rooms: new Set(),
      emit(event, payload) { if (!done) deliver(event, payload); },
      on(event, fn) { handlers.set(event, fn); },
      join(room) { socket.rooms.add(room); },
      disconnect() { finish("server namespace disconnect"); close(); },
      _receive(event, payload) {
        const fn = handlers.get(event);
        if (!fn || done) return;
        try { fn(payload); } catch (error) { if (root.console) root.console.error(error); }
      },
      _closed(reason) { finish(reason); }
    };
    function finish(reason) {
      if (done) return;
      done = true;
      hub.sockets.delete(socket);
      const fn = handlers.get("disconnect");
      if (fn) { try { fn(reason); } catch (error) { if (root.console) root.console.error(error); } }
    }
    hub.sockets.add(socket);
    return socket;
  }

  // io.to(room).emit(...) for the shared lobby code.
  function createHub() {
    const hub = {
      sockets: new Set(),
      to(room) { return { emit(event, payload) { hub.sockets.forEach((s) => { if (s.rooms.has(room)) s.emit(event, payload); }); } }; }
    };
    return hub;
  }

  // ── a hosted room: the lobby, the match loop and the peer that guests dial ──
  function createRoom(env, libs) {
    const sessions = new libs.SessionManager();
    const hub = createHub();
    const core = libs.createOnlineHost({ sessions, io: hub });
    const conns = new Set();
    let peer = null;
    let timer = null;
    let closed = false;
    const room = {
      sessions, core, hub,
      get closed() { return closed; },
      get code() { return room._code; },
      _code: null,
      onClose: null,

      // Create the lobby and register its code with the broker. A six-digit code can
      // collide with another room on the shared broker, so try again with a new one.
      async open(nickname, card) {
        let lastError = null;
        for (let attempt = 0; attempt < MAX_ID_TRIES; attempt++) {
          const response = core.api.create(nickname, card);
          try {
            peer = await openPeer(env, libs.Peer, ID_PREFIX + response.joinCode);
          } catch (error) {
            lastError = error;
            const session = sessions.getByCode(response.joinCode);
            if (session) sessions.destroy(session);
            if (error && error.type === "unavailable-id") continue;
            throw friendly(error);
          }
          room._code = response.joinCode;
          peer.on("connection", acceptConnection);
          // Losing the broker only stops *new* guests arriving; carry on and try to get it back.
          peer.on("disconnected", () => { if (!closed) env.setTimeout(() => { if (!closed && peer && peer.disconnected) { try { peer.reconnect(); } catch (e) {} } }, 2000); });
          peer.on("error", () => {});
          startLoop();
          return response;
        }
        throw friendly(lastError, "Couldn't find a free code. Try again.");
      },

      // The hosting player's own connection: no network, just an in-process pipe.
      attachLocal(ticket) {
        const auth = core.authenticate(ticket);
        if (!auth) return null;
        let client = null;
        const server = createServerSocket(hub, auth, (event, payload) => env.setTimeout(() => client && client._dispatch(event, payload), 0), () => { if (client) client._end("io server disconnect"); });
        client = createClientSocket(
          (event, payload) => { if (core.CLIENT_EVENTS.includes(event)) env.setTimeout(() => server._receive(event, payload), 0); },
          () => { server._closed("client namespace disconnect"); room.close(); }   // the host leaving ends the game: nothing else holds it
        );
        client.id = server.id;
        env.setTimeout(() => core.onConnection(server), 0);
        return client;
      },

      close() {
        if (closed) return;
        closed = true;
        if (timer) env.clearInterval(timer);
        for (const conn of Array.from(conns)) { try { conn.close(); } catch (e) {} }
        conns.clear();
        for (const session of Array.from(sessions.sessions.values())) sessions.destroy(session);
        if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
        if (room.onClose) room.onClose();
      }
    };

    // Fixed 60 Hz steps from a real clock. A tab that got throttled catches up in a
    // few steps and sends one snapshot, rather than running the match slow.
    function startLoop() {
      let last = env.now();
      let acc = 0;
      timer = env.setInterval(() => {
        const t = env.now();
        acc += Math.min(250, t - last);
        last = t;
        const steps = Math.floor(acc / STEP_MS);
        if (!steps) return;
        acc -= steps * STEP_MS;
        sessions.tick(hub, Math.min(steps, 6));
        if (sessions.sessions.size === 0) room.close();    // the lobby expired
      }, 8);
    }

    // A guest dialled in. It is a stranger until it presents a ticket from a join.
    function acceptConnection(conn) {
      if (closed || conns.size >= MAX_CONNECTIONS) { try { conn.close(); } catch (e) {} return; }
      conns.add(conn);
      let socket = null;
      let windowStart = env.now();
      let count = 0;
      const authTimer = env.setTimeout(() => { if (!socket) { try { conn.close(); } catch (e) {} } }, limit(env, "auth"));
      const send = (message) => { if (conn.open) { try { conn.send(message); } catch (e) {} } };
      const peerKey = String(conn.peer || "unknown");

      conn.on("data", (message) => {
        const now = env.now();
        if (now - windowStart > 1000) { windowStart = now; count = 0; }
        if (++count > MAX_MESSAGES_PER_SECOND) return;
        if (!message || typeof message !== "object" || typeof message.t !== "string") return;

        if (message.t === "rpc") {
          const id = message.id;
          if (typeof id !== "number" || !RPC_METHODS.includes(message.m)) return;
          const body = message.b && typeof message.b === "object" ? message.b : {};
          try {
            const data = message.m === "join"
              ? core.api.join(body.code, body.nickname, peerKey, body.card)
              : core.api.rejoin(body.code, body.resumeToken);
            send({ t: "res", id, ok: true, d: data });
          } catch (error) {
            send({ t: "res", id, ok: false, error: String((error && error.message) || "Request failed.") });
          }
        } else if (message.t === "sock") {
          if (socket || typeof message.ticket !== "string" || message.ticket.length > 200) return;
          const auth = core.authenticate(message.ticket);
          if (!auth) { send({ t: "err", error: "Invalid connection ticket." }); return; }
          socket = createServerSocket(hub, auth, (event, payload) => send({ t: "ev", e: event, p: payload }), () => env.setTimeout(() => { try { conn.close(); } catch (e) {} }, 0));
          core.onConnection(socket);
        } else if (message.t === "ev") {
          if (socket && typeof message.e === "string" && core.CLIENT_EVENTS.includes(message.e)) socket._receive(message.e, message.p);
        }
      });
      conn.on("close", () => { env.clearTimeout(authTimer); conns.delete(conn); if (socket) socket._closed("transport close"); });
      conn.on("error", () => {});
    }

    return room;
  }

  // ── the P2P object the client uses ────────────────────────────────────────
  function createP2P(env) {
    let libs = null;
    let room = null;                 // set while this browser hosts
    let guest = null;                // { peer, conn, pending, nextId } while connected to a host
    const localTickets = new Set();  // join tickets that belong to this browser's own room

    async function ready() {
      if (!libs) libs = await env.load();
      return libs;
    }

    function closeGuest() {
      if (!guest) return;
      const g = guest;
      guest = null;
      for (const entry of g.pending.values()) entry.reject(new Error("Connection closed."));
      g.pending.clear();
      try { g.conn.close(); } catch (e) {}
      try { g.peer.destroy(); } catch (e) {}
    }

    function closeRoom() {
      if (room) { const r = room; room = null; r.close(); }
      localTickets.clear();
    }

    function tag(response) { return Object.assign({}, response, { p2p: true }); }

    // Dial a host by its code and keep the connection for the socket that follows.
    async function dial(code) {
      if (!/^\d{6}$/.test(String(code || "").trim())) throw new Error("Invalid or expired code.");
      closeGuest();
      const { Peer } = await ready();
      const peer = await openPeer(env, Peer, null).catch((error) => { throw friendly(error); });
      const conn = peer.connect(ID_PREFIX + String(code).trim(), { reliable: true, serialization: "json" });
      try {
        await waitFor(env, limit(env, "connect"), "connect-timeout", (ok, fail) => {
          conn.on("open", () => ok(true));
          conn.on("error", fail);
          peer.on("error", fail);
        });
      } catch (error) {
        try { peer.destroy(); } catch (e) {}
        throw friendly(error);
      }
      peer.on("error", () => {});     // later broker hiccups must not surface as unhandled errors
      const g = { peer, conn, pending: new Map(), nextId: 1, socket: null };
      guest = g;
      conn.on("data", (message) => {
        if (!message || typeof message !== "object") return;
        if (message.t === "res") {
          const entry = g.pending.get(message.id);
          if (!entry) return;
          g.pending.delete(message.id);
          if (message.ok) entry.resolve(message.d); else entry.reject(new Error(cleanText(message.error, 200, "Request failed.")));
        } else if (g.socket) {
          // only the events a host legitimately sends; a hostile one can't, say, fake a disconnect
          if (message.t === "ev" && SERVER_EVENTS.includes(message.e)) g.socket._dispatch(message.e, message.p);
          else if (message.t === "err") g.socket._dispatch("connect_error", new Error(cleanText(message.error, 200, "Connection failed.")));
        }
      });
      conn.on("close", () => {
        if (guest === g) guest = null;
        for (const entry of g.pending.values()) entry.reject(new Error("The host closed the game."));
        g.pending.clear();
        if (g.socket) g.socket._end("transport close");
        try { peer.destroy(); } catch (e) {}
      });
      return g;
    }

    function rpc(g, method, body) {
      return new Promise((resolve, reject) => {
        const id = g.nextId++;
        const timer = env.setTimeout(() => { g.pending.delete(id); reject(new Error("The host didn't answer. Try again.")); }, limit(env, "rpc"));
        g.pending.set(id, { resolve: (v) => { env.clearTimeout(timer); resolve(v); }, reject: (e) => { env.clearTimeout(timer); reject(e); } });
        try { g.conn.send({ t: "rpc", id, m: method, b: body }); } catch (error) { g.pending.delete(id); env.clearTimeout(timer); reject(error); }
      });
    }

    const p2p = {
      // Replaces the three REST calls the client makes.
      async api(path, body) {
        body = body || {};
        await ready();
        if (path === "/api/sessions") {
          closeRoom();
          closeGuest();
          const r = createRoom(env, libs);
          r.onClose = () => { if (room === r) room = null; };
          const response = await r.open(body.nickname, body.card);
          room = r;
          localTickets.add(response.joinTicket);
          return tag(response);
        }
        if (path === "/api/join" || path === "/api/rejoin") {
          const code = String(body.code || "").trim();
          // The host reattaching to its own game needs no network.
          if (path === "/api/rejoin" && room && room.code === code) {
            const response = room.core.api.rejoin(code, body.resumeToken);
            localTickets.add(response.joinTicket);
            return tag(response);
          }
          const g = await dial(code);
          try {
            const reply = await rpc(g, path === "/api/join" ? "join" : "rejoin", path === "/api/join" ? { code, nickname: body.nickname, card: cleanCard(body.card) } : { code, resumeToken: body.resumeToken });
            const response = cleanSession(reply);
            if (!response) throw new Error("That host sent something unexpected. Try another game.");
            return tag(response);
          } catch (error) {
            closeGuest();
            throw error;
          }
        }
        throw new Error("Unsupported request.");
      },

      // Replaces window.io({ auth: { joinTicket } }).
      io(options) {
        const ticket = options && options.auth && options.auth.joinTicket;
        if (room && localTickets.has(ticket)) {
          localTickets.delete(ticket);
          const client = room.attachLocal(ticket);
          if (client) return client;
        }
        const g = guest;
        const socket = createClientSocket(
          (event, payload) => { if (g && g.conn.open) { try { g.conn.send({ t: "ev", e: event, p: payload }); } catch (e) {} } },
          () => { if (guest === g) closeGuest(); }
        );
        if (!g || !g.conn.open) {
          env.setTimeout(() => socket._dispatch("connect_error", new Error("Not connected to a host.")), 0);
          return socket;
        }
        g.socket = socket;
        env.setTimeout(() => { try { g.conn.send({ t: "sock", ticket }); } catch (e) {} }, 0);
        return socket;
      },

      // Is this browser currently hosting, and for whom?
      get hosting() { return Boolean(room); },
      close() { closeRoom(); closeGuest(); },
      // tests and the console
      _debug: { get room() { return room; }, get guest() { return guest; } }
    };
    return p2p;
  }

  // ── the browser build: fetch PeerJS and the server modules on first use ──────
  function createBrowser() {
    const doc = root.document;
    const base = doc && doc.currentScript && doc.currentScript.src ? new URL(".", doc.currentScript.src).href : "";
    const version = doc && doc.currentScript && /[?&]v=([^&]+)/.exec(doc.currentScript.src) ? /[?&]v=([^&]+)/.exec(doc.currentScript.src)[1] : "1";
    function loadScript(path) {
      return new Promise((resolve, reject) => {
        const script = doc.createElement("script");
        script.src = `${base}${path}?v=${version}`;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Couldn't load the multiplayer files. Check your connection."));
        doc.head.appendChild(script);
      });
    }
    let loading = null;
    function load() {
      if (!loading) {
        loading = (async () => {
          if (typeof root.Peer !== "function") await loadScript("vendor/peerjs.min.js");
          if (!root.GlitchPongSim) await loadScript("server/authoritative-pong.js?v=sim-2");
          if (!root.GlitchSessions) await loadScript("server/session-manager.js");
          if (!root.GlitchOnlineHost) await loadScript("server/online-host.js");
          return { Peer: root.Peer, SessionManager: root.GlitchSessions.SessionManager, createOnlineHost: root.GlitchOnlineHost.createOnlineHost };
        })().catch((error) => { loading = null; throw error; });
      }
      return loading;
    }
    // Where PeerJS finds its broker. The default is its free public one, which also
    // hands out STUN and TURN servers. To change that, define window.GLITCH_P2P_CONFIG
    // before this loads, for example { host, port, path, secure, config: { iceServers } }.
    // On localhost only, ?peerserver=host:port points at a local broker for testing.
    function peerOptions() {
      const options = Object.assign({}, root.GLITCH_P2P_CONFIG || {});
      const loc = root.location;
      if (loc && /^(localhost|127\.0\.0\.1)$/.test(loc.hostname)) {
        const wanted = new URLSearchParams(loc.search).get("peerserver");
        const match = wanted && /^([\w.-]+):(\d{2,5})$/.exec(wanted);
        if (match) Object.assign(options, { host: match[1], port: Number(match[2]), path: "/", secure: false, config: { iceServers: [] } });
      }
      options.debug = 0;
      return options;
    }
    const p2p = createP2P({
      load, peerOptions,
      setTimeout: (fn, ms) => root.setTimeout(fn, ms), clearTimeout: (t) => root.clearTimeout(t),
      setInterval: (fn, ms) => root.setInterval(fn, ms), clearInterval: (t) => root.clearInterval(t),
      now: () => (root.performance ? root.performance.now() : Date.now())
    });
    // leave nothing registered with the broker when the tab goes away
    if (root.addEventListener) root.addEventListener("pagehide", () => p2p.close());
    p2p.clean = clean;
    return p2p;
  }

  return { createP2P, createBrowser, ID_PREFIX, MESSAGES, clean };
});
