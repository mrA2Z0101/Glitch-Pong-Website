"use strict";

// The rules of an online lobby, independent of how players are connected: what each
// request does and how a connected player's events are handled. Two transports use
// it unchanged:
//   · server/index.js  - Express routes and socket.io, for a hosted server
//   · glitchpong-p2p.js - WebRTC data channels, with the hosting player's own
//                          browser acting as the server (window.GlitchOnlineHost)
//
// `io` is anything with io.to(room).emit(event, payload); a "socket" is anything
// with id, data, emit, on, join and disconnect (socket.io's, or the P2P shim).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlitchOnlineHost = api;
})(typeof self !== "undefined" ? self : this, function () {

function createOnlineHost({ sessions, io }) {
  function sessionResponse(session, player, ticket) {
    return { sessionId: session.sessionId, joinCode: session.joinCode, joinUrl: `/?join=${session.joinCode}`, playerId: player.playerId, side: player.side, joinTicket: ticket, resumeToken: player.resumeToken, lobbyState: sessions.publicLobby(session) };
  }

  // Each throws an Error whose message is shown to the player.
  const api = {
    create(nickname) {
      const { session, host, ticket } = sessions.create(nickname);
      return sessionResponse(session, host, ticket);
    },
    join(code, nickname, ip) {
      const { session, player, ticket } = sessions.join(code, nickname, ip);
      return sessionResponse(session, player, ticket);
    },
    rejoin(code, resumeToken) {
      const { session, player, ticket } = sessions.rejoin(code, resumeToken);
      return sessionResponse(session, player, ticket);
    },
    action(sessionId, action, playerId) {
      const session = sessions.hostAction(sessionId, playerId, action);
      io.to(session.sessionId).emit(action === "lock" ? "lobby:locked" : "match:start", sessions.publicLobby(session));
      io.to(session.sessionId).emit("lobby:player_list", sessions.publicLobby(session));
      return { lobbyState: sessions.publicLobby(session) };
    }
  };

  // A join ticket is single-use: { session, player } the first time, null after.
  function authenticate(ticket) { return sessions.consumeTicket(ticket); }

  // A player's authenticated connection. `socket.data` must hold { session, player }.
  function onConnection(socket) {
    const { session, player } = socket.data;
    const wasDisconnected = Boolean(player.disconnectedAt);
    player.connected = true; player.disconnectedAt = null; player.socketId = socket.id;
    socket.join(session.sessionId);
    socket.emit("lobby:joined", { side: player.side, lobbyState: sessions.publicLobby(session), state: session.gameState });
    io.to(session.sessionId).emit("lobby:player_list", sessions.publicLobby(session));
    if (wasDisconnected) io.to(session.sessionId).emit("player:reconnected", { playerId: player.playerId });
    if (session.status === "playing") socket.emit("match:start", { state: session.gameState });
    socket.on("input:move", payload => sessions.setInput(session, player, payload && payload.direction));
    socket.on("player:ready", () => { player.ready = true; io.to(session.sessionId).emit("lobby:player_list", sessions.publicLobby(session)); });
    socket.on("host:lock", () => { try { const updated = sessions.hostAction(session.sessionId, player.playerId, "lock"); io.to(session.sessionId).emit("lobby:locked", sessions.publicLobby(updated)); } catch (error) { socket.emit("error:message", error.message); } });
    socket.on("host:start", () => { try { const updated = sessions.hostAction(session.sessionId, player.playerId, "start"); io.to(session.sessionId).emit("match:start", { state: updated.gameState }); } catch (error) { socket.emit("error:message", error.message); } });
    socket.on("player:leave", () => socket.disconnect(true));
    socket.on("disconnect", () => { player.connected = false; player.disconnectedAt = Date.now(); player.socketId = null; io.to(session.sessionId).emit("player:disconnected", { playerId: player.playerId }); io.to(session.sessionId).emit("lobby:player_list", sessions.publicLobby(session)); });
  }

  // The events a connected client may send; a transport that takes messages from
  // strangers should drop anything else.
  const CLIENT_EVENTS = ["input:move", "player:ready", "host:lock", "host:start", "player:leave"];

  return { api, authenticate, onConnection, CLIENT_EVENTS, sessionResponse };
}

return { createOnlineHost };
});
