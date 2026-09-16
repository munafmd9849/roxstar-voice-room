import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { registerRoomHandlers } from "./handlers/room.handler.js";
import { PresenceTracker } from "./rooms/presence-tracker.js";
import { registerSpinBroadcaster } from "./rooms/spin-broadcast.js";
import { registerDraftBroadcaster } from "./rooms/draft-broadcast.js";

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const presenceTracker = new PresenceTracker();
  registerSpinBroadcaster(io);
  registerDraftBroadcaster(io);

  io.on("connection", (socket) => {
    console.info("Socket connected", { socketId: socket.id });
    registerRoomHandlers(io, socket, presenceTracker);
  });

  return io;
}
