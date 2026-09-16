import type { Server, Socket } from "socket.io";

import type { SpinState } from "../../services/spin-state.js";

export type RoomStatePayload = {
  room: {
    id: string;
    code: string;
    ownerId: string;
    status: "ACTIVE" | "CLOSED";
    createdAt: Date;
    updatedAt: Date;
  };
  participants: Array<{
    userId: string;
    name: string;
    status: "ACTIVE";
  }>;
  spin: SpinState | null;
};

export function socketRoomName(roomId: string): string {
  return `room:${roomId}`;
}

export function emitRoomState(socket: Socket, roomState: RoomStatePayload) {
  socket.emit("room_state", roomState);
}

export function broadcastUserJoined(socket: Socket, roomId: string, userId: string, name: string, joinedAt: string) {
  socket.to(socketRoomName(roomId)).emit("user_joined", { roomId, userId, name, joinedAt });
}

export function broadcastUserLeft(io: Server, roomId: string, userId: string, leftAt: string) {
  io.to(socketRoomName(roomId)).emit("user_left", { roomId, userId, leftAt });
}
