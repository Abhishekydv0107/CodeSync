import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

import { getRoom, setUser, removeUser, listUsers } from "./rooms.js";
import { runInSandbox } from "./sandbox/run.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.get("/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || "*" } });

async function start() {
  // Redis pub/sub adapter: without this, events only reach clients connected
  // to the SAME server process. With it, you can run multiple server
  // instances behind a load balancer and everyone still sees each other.
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Connected to Redis, Socket.io adapter attached");

  io.on("connection", (socket) => {
    let currentRoom = null;

    socket.on("join-room", ({ roomId, name }) => {
      currentRoom = roomId;
      socket.join(roomId);
      setUser(roomId, socket.id, name || "Anonymous");

      const room = getRoom(roomId);
      // Send the new joiner the current document state immediately.
      socket.emit("init", { code: room.code, language: room.language, users: listUsers(roomId) });
      // Tell everyone else who just joined.
      socket.to(roomId).emit("user-joined", { id: socket.id, name });
    });

    // Full-document sync on every change. Simple and reliable for a starter
    // project; swap for a CRDT (e.g. Yjs) if you want true conflict-free
    // concurrent editing instead of last-write-wins.
    socket.on("edit", ({ roomId, code }) => {
      const room = getRoom(roomId);
      room.code = code;
      socket.to(roomId).emit("edit", { code, from: socket.id });
    });

    socket.on("language-change", ({ roomId, language }) => {
      getRoom(roomId).language = language;
      socket.to(roomId).emit("language-change", { language });
    });

    socket.on("cursor", ({ roomId, position }) => {
      socket.to(roomId).emit("cursor", { id: socket.id, position });
    });

    socket.on("run-code", async ({ roomId, code, language }) => {
      io.to(roomId).emit("run-started");
      try {
        const output = await runInSandbox(code, language);
        io.to(roomId).emit("run-result", { output, error: null });
      } catch (err) {
        io.to(roomId).emit("run-result", { output: "", error: err.message });
      }
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        removeUser(currentRoom, socket.id);
        socket.to(currentRoom).emit("user-left", { id: socket.id });
      }
    });
  });

  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => console.log(`CodeSync server running on :${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
