import type { Server } from "socket.io";
import { socketRoomName } from "./room-broadcast.js";
let io: Server | undefined;
export function registerDraftBroadcaster(server: Server) { io = server; }
export function broadcastDraftShared(roomId: string, payload: unknown) { io?.to(socketRoomName(roomId)).emit("draft_shared", payload); }
