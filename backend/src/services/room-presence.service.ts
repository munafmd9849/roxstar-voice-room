import { getPrismaClient } from "../config/database.js";

/** Updates realtime presence only; membership status remains REST-authoritative. */
export async function setRoomMemberPresence(roomId: string, userId: string, isConnected: boolean) {
  await getPrismaClient().roomMember.updateMany({
    where: { roomId, userId, status: "ACTIVE" },
    data: { isConnected }
  });
}
