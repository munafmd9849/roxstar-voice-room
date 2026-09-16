import { getPrismaClient } from "../config/database.js";
import { AppError } from "../errors/app-error.js";
import { broadcastDraftShared } from "../socket/rooms/draft-broadcast.js";

const selectDraft = { id: true, name: true, filePath: true, durationMs: true, createdAt: true } as const;
async function requireUser(userId: string) { const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { id: true, name: true } }); if (!user) throw new AppError(404, "USER_NOT_FOUND", "User was not found."); return user; }
export async function createDraft(input: { userId: string; name: string; filePath: string; durationMs: number }) { await requireUser(input.userId); return getPrismaClient().draft.create({ data: input, select: selectDraft }); }
export async function listDrafts(userId: string) { await requireUser(userId); return getPrismaClient().draft.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: selectDraft }); }
export async function getDraft(draftId: string) { const draft = await getPrismaClient().draft.findUnique({ where: { id: draftId }, select: selectDraft }); if (!draft) throw new AppError(404, "DRAFT_NOT_FOUND", "Draft was not found."); return draft; }
export async function deleteDraft(draftId: string) { await getDraft(draftId); await getPrismaClient().draft.delete({ where: { id: draftId } }); }
export async function shareDraft(roomId: string, userId: string, draftId: string) {
  const prisma = getPrismaClient(); const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId }, select: { status: true } }); if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found."); if (room.status !== "ACTIVE") throw new AppError(409, "ROOM_CLOSED", "Room is closed.");
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }); if (!user) throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
    const member = await tx.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } }, select: { status: true } }); if (member?.status !== "ACTIVE") throw new AppError(403, "NOT_A_ROOM_MEMBER", "User is not an active room member.");
    const draft = await tx.draft.findUnique({ where: { id: draftId }, select: { ...selectDraft, userId: true } }); if (!draft) throw new AppError(404, "DRAFT_NOT_FOUND", "Draft was not found."); if (draft.userId !== userId) throw new AppError(403, "DRAFT_NOT_OWNED", "Draft does not belong to this user.");
    const existing = await tx.sharedDraft.findFirst({ where: { roomId, draftId, sharedById: userId }, select: { id: true, sharedAt: true } });
    if (existing) return { sharedDraft: existing, draft, user, duplicate: true };
    const sharedDraft = await tx.sharedDraft.create({ data: { roomId, draftId, sharedById: userId }, select: { id: true, sharedAt: true } }); return { sharedDraft, draft, user, duplicate: false };
  });
  const payload = { roomId, draftId, sharedBy: { id: result.user.id, name: result.user.name }, draft: result.draft, sharedAt: result.sharedDraft.sharedAt };
  if (!result.duplicate) broadcastDraftShared(roomId, payload);
  return { ...payload, duplicate: result.duplicate };
}
