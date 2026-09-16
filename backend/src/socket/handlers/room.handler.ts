import type { Server, Socket } from "socket.io";
import { z } from "zod";

import { AppError } from "../../errors/app-error.js";
import { setRoomMemberPresence } from "../../services/room-presence.service.js";
import { getRoomState, verifyActiveRoomMembership } from "../../services/room.service.js";
import { toSocketError } from "../socket-error.js";
import { PresenceTracker } from "../rooms/presence-tracker.js";
import { broadcastUserJoined, broadcastUserLeft, emitRoomState, socketRoomName } from "../rooms/room-broadcast.js";

const roomIdSchema = z
  .string({ error: "Room ID must be a string." })
  .trim()
  .min(1, "Room ID is required.")
  .max(191, "Room ID is too long.");

const roomJoinSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string({ error: "User ID must be a string." }).trim().min(1, "User ID is required.").max(191, "User ID is too long.")
});

const roomIdPayloadSchema = z.object({ roomId: roomIdSchema });

function emitSocketError(socket: Socket, event: string, error: unknown) {
  const payload = toSocketError(error);
  console.error(`Socket ${event} error`, { socketId: socket.id, code: payload.code });
  socket.emit("socket:error", payload);
}

export function registerRoomHandlers(io: Server, socket: Socket, presenceTracker: PresenceTracker) {
  socket.on("room:join", async (payload: unknown) => {
    try {
      const { roomId, userId } = roomJoinSchema.parse(payload);
      const previousUserId = presenceTracker.getUserForSocketRoom(socket.id, roomId);

      if (previousUserId && previousUserId !== userId) {
        throw new AppError(400, "VALIDATION_ERROR", "Socket is already joined to this room as another user.");
      }

      const { room, user } = await verifyActiveRoomMembership(roomId, userId);
      if (room.status !== "ACTIVE") {
        throw new AppError(409, "ROOM_CLOSED", "Room is closed and cannot be joined.");
      }

      await socket.join(socketRoomName(roomId));
      const presence = presenceTracker.add(socket.id, roomId, userId);

      if (presence.isFirstSocketForUser) {
        await setRoomMemberPresence(roomId, userId, true);
        broadcastUserJoined(socket, roomId, userId, user.name, new Date().toISOString());
      }

      emitRoomState(socket, await getRoomState(roomId));
      console.info("Socket joined room", { socketId: socket.id, roomId, userId, repeated: presence.alreadyPresent });
    } catch (error) {
      emitSocketError(socket, "room:join", error);
    }
  });

  socket.on("room:leave", async (payload: unknown) => {
    try {
      const { roomId } = roomIdPayloadSchema.parse(payload);
      const removed = presenceTracker.remove(socket.id, roomId);

      if (!removed) {
        throw new AppError(400, "SOCKET_NOT_IN_ROOM", "Socket is not joined to this room.");
      }

      await socket.leave(socketRoomName(roomId));
      if (removed.isLastSocketForUser) {
        await setRoomMemberPresence(roomId, removed.userId, false);
        broadcastUserLeft(io, roomId, removed.userId, new Date().toISOString());
      }

      console.info("Socket left room", { socketId: socket.id, roomId, userId: removed.userId });
    } catch (error) {
      emitSocketError(socket, "room:leave", error);
    }
  });

  socket.on("room:state", async (payload: unknown) => {
    try {
      const { roomId } = roomIdPayloadSchema.parse(payload);
      const userId = presenceTracker.getUserForSocketRoom(socket.id, roomId);

      if (!userId) {
        throw new AppError(400, "SOCKET_NOT_IN_ROOM", "Socket is not joined to this room.");
      }

      await verifyActiveRoomMembership(roomId, userId);
      emitRoomState(socket, await getRoomState(roomId));
    } catch (error) {
      emitSocketError(socket, "room:state", error);
    }
  });

  socket.on("disconnect", async (reason) => {
    const removedPresences = presenceTracker.removeSocket(socket.id);
    console.info("Socket disconnected", { socketId: socket.id, reason, roomCount: removedPresences.length });

    for (const removed of removedPresences) {
      try {
        if (removed.isLastSocketForUser) {
          await setRoomMemberPresence(removed.roomId, removed.userId, false);
          broadcastUserLeft(io, removed.roomId, removed.userId, new Date().toISOString());
        }
      } catch (error) {
        console.error("Socket disconnect cleanup error", { socketId: socket.id, code: toSocketError(error).code });
      }
    }
  });
}
