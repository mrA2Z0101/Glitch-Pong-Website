"use strict";

// Lobbies, join codes, tickets and the match loop. Runs unchanged in Node (the
// socket.io server) and in a browser (the player hosting a peer-to-peer game runs
// it as window.GlitchSessions), so it only uses Web Crypto.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./authoritative-pong"), require("crypto").webcrypto);
  else root.GlitchSessions = factory(root.GlitchPongSim, root.crypto);
})(typeof self !== "undefined" ? self : this, function (sim, cryptoApi) {
const { initialState, resetBall, step, snapshot } = sim;

const LOBBY_TTL_MS = 15 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;
const RECONNECT_GRACE_MS = 45 * 1000;

function randomBytes(n) { const bytes = new Uint8Array(n); cryptoApi.getRandomValues(bytes); return bytes; }
function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function id() { return cryptoApi.randomUUID(); }
function token() { return toBase64Url(randomBytes(32)); }
// A uniformly random six-digit code (rejection sampling, so no digit is favoured).
// A player's card: the ids of the title and nameplate they chose in the Store.
// Only ids are kept, never display text; each client looks them up in its own
// catalog (glitchpong-cosmetics.js) and ignores any it does not know.
const CARD_ID = /^[a-z0-9_-]{1,24}$/i;
function cleanCard(card) {
  const pick = value => (typeof value === "string" && CARD_ID.test(value) ? value : "default");
  return { title: pick(card && card.title), plate: pick(card && card.plate) };
}
function randomCode() {
  const limit = 4294967296 - (4294967296 % 1000000);
  const word = new Uint32Array(1);
  do { cryptoApi.getRandomValues(word); } while (word[0] >= limit);
  return String(word[0] % 1000000).padStart(6, "0");
}

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.codes = new Map();
    this.joinAttempts = new Map();
  }

  create(hostName = "Host", card) {
    const sessionId = id();
    let joinCode;
    do { joinCode = randomCode(); } while (this.codes.has(joinCode));
    const host = this.makePlayer(hostName, "left", true, card);
    const session = {
      sessionId, joinCode, status: "lobby", joinLocked: false, maxPlayers: 2,
      createdAt: Date.now(), expiresAt: Date.now() + LOBBY_TTL_MS,
      players: [host], tickets: new Map(), gameState: initialState(), interval: null
    };
    this.sessions.set(sessionId, session);
    this.codes.set(joinCode, sessionId);
    return { session, host, ticket: this.issueTicket(session, host) };
  }

  makePlayer(nickname, side, host = false, card) {
    return { playerId: id(), nickname: String(nickname || "Player").trim().slice(0, 20) || "Player", card: cleanCard(card), side, host, connected: false, ready: false, resumeToken: token(), disconnectedAt: null, socketId: null };
  }

  publicLobby(session) {
    return { code: session.joinCode, status: session.status, joinLocked: session.joinLocked, expiresAt: session.expiresAt, players: session.players.map(({ playerId, nickname, card, side, host, connected, ready }) => ({ playerId, nickname, card, side, host, connected, ready })) };
  }

  getByCode(code) {
    const session = this.sessions.get(this.codes.get(String(code || "").trim()));
    if (!session || session.expiresAt < Date.now()) return null;
    return session;
  }

  rateLimited(ip) {
    const now = Date.now();
    const recent = (this.joinAttempts.get(ip) || []).filter(time => now - time < 60 * 1000);
    recent.push(now); this.joinAttempts.set(ip, recent);
    return recent.length > 12;
  }

  join(code, nickname, ip, card) {
    if (this.rateLimited(ip)) throw new Error("Too many attempts. Please wait a moment.");
    const session = this.getByCode(code);
    if (!session || session.status !== "lobby" || session.joinLocked || session.players.length >= session.maxPlayers) throw new Error("Invalid or expired code.");
    const player = this.makePlayer(nickname, "right", false, card);
    session.players.push(player);
    return { session, player, ticket: this.issueTicket(session, player) };
  }

  rejoin(code, resumeToken) {
    const session = this.getByCode(code);
    const player = session && session.players.find(item => item.resumeToken === resumeToken);
    if (!player || (player.disconnectedAt && Date.now() - player.disconnectedAt > RECONNECT_GRACE_MS)) throw new Error("Unable to restore this session.");
    return { session, player, ticket: this.issueTicket(session, player) };
  }

  issueTicket(session, player) {
    const joinTicket = token();
    session.tickets.set(joinTicket, { playerId: player.playerId, expiresAt: Date.now() + TICKET_TTL_MS });
    return joinTicket;
  }

  consumeTicket(ticket) {
    for (const session of this.sessions.values()) {
      const record = session.tickets.get(ticket);
      if (!record) continue;
      session.tickets.delete(ticket);
      if (record.expiresAt < Date.now()) return null;
      const player = session.players.find(item => item.playerId === record.playerId);
      return player ? { session, player } : null;
    }
    return null;
  }

  hostAction(sessionId, playerId, action) {
    const session = this.sessions.get(sessionId);
    const player = session && session.players.find(item => item.playerId === playerId && item.host);
    if (!session || !player) throw new Error("Host permission required.");
    if (action === "lock") { session.joinLocked = true; return session; }
    if (action === "start") {
      if (session.players.length !== 2 || !session.players.every(item => item.connected)) throw new Error("Waiting for opponent connection.");
      session.joinLocked = true; session.status = "playing"; session.gameState = initialState(); session.gameState.status = "playing"; resetBall(session.gameState, Math.random() < 0.5 ? -1 : 1);
      return session;
    }
    throw new Error("Unsupported host action.");
  }

  setInput(session, player, direction) {
    if (session.status !== "playing" || !["up", "down", "stop"].includes(direction)) return;
    session.gameState.paddles[player.side].direction = direction;
  }

  // Advance every live match by `steps` sixtieths of a second and send one snapshot.
  // The socket.io server calls it once per 1/60 s; a browser host that fell behind
  // passes more than one to catch up without flooding its opponent.
  tick(io, steps = 1) {
    const now = Date.now();
    for (const session of Array.from(this.sessions.values())) {
      if (session.expiresAt < now && session.status === "lobby") { this.destroy(session); continue; }
      if (session.status === "playing") {
        for (let i = 0; i < steps && session.gameState.status === "playing"; i++) step(session.gameState, 1 / 60, now);
        io.to(session.sessionId).emit("state:snapshot", snapshot(session.gameState));
        if (session.gameState.status === "ended") {
          session.status = "ended";
          io.to(session.sessionId).emit("match:end", { winner: session.gameState.winner, state: snapshot(session.gameState) });
        }
      }
    }
  }

  destroy(session) {
    if (session.interval) clearInterval(session.interval);
    this.sessions.delete(session.sessionId); this.codes.delete(session.joinCode);
  }
}

return { SessionManager, cleanCard };
});
