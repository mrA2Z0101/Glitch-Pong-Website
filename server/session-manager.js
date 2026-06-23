"use strict";

const crypto = require("crypto");
const { initialState, resetBall, step, snapshot } = require("./authoritative-pong");

const LOBBY_TTL_MS = 15 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;
const RECONNECT_GRACE_MS = 45 * 1000;

function id() { return crypto.randomUUID(); }
function token() { return crypto.randomBytes(32).toString("base64url"); }

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.codes = new Map();
    this.joinAttempts = new Map();
  }

  create(hostName = "Host") {
    const sessionId = id();
    let joinCode;
    do { joinCode = String(crypto.randomInt(0, 1000000)).padStart(6, "0"); } while (this.codes.has(joinCode));
    const host = this.makePlayer(hostName, "left", true);
    const session = {
      sessionId, joinCode, status: "lobby", joinLocked: false, maxPlayers: 2,
      createdAt: Date.now(), expiresAt: Date.now() + LOBBY_TTL_MS,
      players: [host], tickets: new Map(), gameState: initialState(), interval: null
    };
    this.sessions.set(sessionId, session);
    this.codes.set(joinCode, sessionId);
    return { session, host, ticket: this.issueTicket(session, host) };
  }

  makePlayer(nickname, side, host = false) {
    return { playerId: id(), nickname: String(nickname || "Player").trim().slice(0, 20) || "Player", side, host, connected: false, ready: false, resumeToken: token(), disconnectedAt: null, socketId: null };
  }

  publicLobby(session) {
    return { code: session.joinCode, status: session.status, joinLocked: session.joinLocked, expiresAt: session.expiresAt, players: session.players.map(({ playerId, nickname, side, host, connected, ready }) => ({ playerId, nickname, side, host, connected, ready })) };
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

  join(code, nickname, ip) {
    if (this.rateLimited(ip)) throw new Error("Too many attempts. Please wait a moment.");
    const session = this.getByCode(code);
    if (!session || session.status !== "lobby" || session.joinLocked || session.players.length >= session.maxPlayers) throw new Error("Invalid or expired code.");
    const player = this.makePlayer(nickname, "right", false);
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

  tick(io) {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.expiresAt < now && session.status === "lobby") { this.destroy(session); continue; }
      if (session.status === "playing") {
        step(session.gameState, 1 / 60, now);
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

module.exports = { SessionManager };
