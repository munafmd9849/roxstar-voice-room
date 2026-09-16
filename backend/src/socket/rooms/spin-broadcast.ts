import type { Server } from "socket.io";

import type { SpinState } from "../../services/spin-state.js";
import { socketRoomName } from "./room-broadcast.js";

let socketServer: Server | undefined;

export function registerSpinBroadcaster(io: Server) {
  socketServer = io;
}

export function broadcastSpinStarted(roomId: string, spin: SpinState) {
  socketServer?.to(socketRoomName(roomId)).emit("spin_started", { roomId, spin });
}

export function broadcastUserEliminated(roomId: string, spinId: string, userId: string, sequence: number, eliminatedAt: Date) {
  socketServer?.to(socketRoomName(roomId)).emit("user_eliminated", {
    roomId,
    spinId,
    userId,
    sequence,
    eliminatedAt
  });
}

export function broadcastWinnerAnnounced(roomId: string, spinId: string, userId: string, sequence: number, completedAt: Date) {
  socketServer?.to(socketRoomName(roomId)).emit("winner_announced", {
    roomId,
    spinId,
    userId,
    sequence,
    completedAt
  });
}

export function broadcastSpinRoomState(roomId: string, roomState: unknown) {
  socketServer?.to(socketRoomName(roomId)).emit("room_state", roomState);
}
