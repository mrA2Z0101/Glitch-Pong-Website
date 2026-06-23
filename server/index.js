"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { SessionManager } = require("./session-manager");

const PORT = Number(process.env.PORT || 3000);
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(",") : true, methods: ["GET", "POST"] } });
const sessions = new SessionManager();

app.use(express.json({ limit: "8kb" }));
app.use(express.static(path.join(__dirname, "..")));

function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim(); }
function apiError(res, error) { res.status(400).json({ error: error.message || "Request failed." }); }
function sessionResponse(session, player, ticket) {
  return { sessionId: session.sessionId, joinCode: session.joinCode, joinUrl: `/?join=${session.joinCode}`, playerId: player.playerId, side: player.side, joinTicket: ticket, resumeToken: player.resumeToken, lobbyState: sessions.publicLobby(session) };
}

app.post("/api/sessions", (req, res) => {
  try { const { session, host, ticket } = sessions.create(req.body && req.body.nickname); res.status(201).json(sessionResponse(session, host, ticket)); } catch (error) { apiError(res, error); }
});
app.post("/api/join", (req, res) => {
  try { const { session, player, ticket } = sessions.join(req.body && req.body.code, req.body && req.body.nickname, clientIp(req)); res.json(sessionResponse(session, player, ticket)); } catch (error) { apiError(res, error); }
});
app.post("/api/rejoin", (req, res) => {
  try { const { session, player, ticket } = sessions.rejoin(req.body && req.body.code, req.body && req.body.resumeToken); res.json(sessionResponse(session, player, ticket)); } catch (error) { apiError(res, error); }
});
app.post("/api/sessions/:sessionId/:action", (req, res) => {
  try { const session = sessions.hostAction(req.params.sessionId, req.body && req.body.playerId, req.params.action); io.to(session.sessionId).emit(req.params.action === "lock" ? "lobby:locked" : "match:start", sessions.publicLobby(session)); io.to(session.sessionId).emit("lobby:player_list", sessions.publicLobby(session)); res.json({ lobbyState: sessions.publicLobby(session) }); } catch (error) { apiError(res, error); }
});

io.use((socket, next) => {
  const auth = sessions.consumeTicket(socket.handshake.auth && socket.handshake.auth.joinTicket);
  if (!auth) return next(new Error("Invalid connection ticket."));
  socket.data.session = auth.session; socket.data.player = auth.player;
  next();
});
io.on("connection", socket => {
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
});

setInterval(() => sessions.tick(io), 1000 / 60);
httpServer.listen(PORT, () => console.log(`Glitch Pong multiplayer server listening on http://localhost:${PORT}`));
