"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { SessionManager } = require("./session-manager");
const { createOnlineHost } = require("./online-host");

const PORT = Number(process.env.PORT || 3000);
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(",") : true, methods: ["GET", "POST"] } });
const sessions = new SessionManager();
const host = createOnlineHost({ sessions, io });

app.use(express.json({ limit: "8kb" }));
app.use(express.static(path.join(__dirname, "..")));

function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim(); }
function apiError(res, error) { res.status(400).json({ error: error.message || "Request failed." }); }

app.post("/api/sessions", (req, res) => {
  try { res.status(201).json(host.api.create(req.body && req.body.nickname)); } catch (error) { apiError(res, error); }
});
app.post("/api/join", (req, res) => {
  try { res.json(host.api.join(req.body && req.body.code, req.body && req.body.nickname, clientIp(req))); } catch (error) { apiError(res, error); }
});
app.post("/api/rejoin", (req, res) => {
  try { res.json(host.api.rejoin(req.body && req.body.code, req.body && req.body.resumeToken)); } catch (error) { apiError(res, error); }
});
app.post("/api/sessions/:sessionId/:action", (req, res) => {
  try { res.json(host.api.action(req.params.sessionId, req.params.action, req.body && req.body.playerId)); } catch (error) { apiError(res, error); }
});

io.use((socket, next) => {
  const auth = host.authenticate(socket.handshake.auth && socket.handshake.auth.joinTicket);
  if (!auth) return next(new Error("Invalid connection ticket."));
  socket.data.session = auth.session; socket.data.player = auth.player;
  next();
});
io.on("connection", host.onConnection);

setInterval(() => sessions.tick(io), 1000 / 60);
httpServer.listen(PORT, () => console.log(`Glitch Pong multiplayer server listening on http://localhost:${PORT}`));
