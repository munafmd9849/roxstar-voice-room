import { z } from "zod";

const id = z.string().trim().min(1).max(191);
export const createDraftSchema = z.object({ userId: id, name: z.string().trim().min(1).max(160), filePath: z.string().trim().min(1).max(1024), durationMs: z.number().int().positive().max(86_400_000) });
export const draftIdParamsSchema = z.object({ draftId: id });
export const listDraftsQuerySchema = z.object({ userId: id });
export const shareDraftSchema = z.object({ userId: id, draftId: id });
