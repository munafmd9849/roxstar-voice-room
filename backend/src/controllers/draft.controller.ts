import type { NextFunction, Request, Response } from "express";
import { createDraft, deleteDraft, getDraft, listDrafts, shareDraft } from "../services/draft.service.js";
import { createDraftSchema, draftIdParamsSchema, listDraftsQuerySchema, shareDraftSchema } from "../validation/draft.schemas.js";
import { roomIdParamsSchema } from "../validation/room.schemas.js";
export async function createDraftController(r: Request, s: Response, n: NextFunction) { try { s.status(201).json(await createDraft(createDraftSchema.parse(r.body))); } catch (e) { n(e); } }
export async function listDraftsController(r: Request, s: Response, n: NextFunction) { try { s.json(await listDrafts(listDraftsQuerySchema.parse(r.query).userId)); } catch (e) { n(e); } }
export async function getDraftController(r: Request, s: Response, n: NextFunction) { try { s.json(await getDraft(draftIdParamsSchema.parse(r.params).draftId)); } catch (e) { n(e); } }
export async function deleteDraftController(r: Request, s: Response, n: NextFunction) { try { await deleteDraft(draftIdParamsSchema.parse(r.params).draftId); s.status(204).send(); } catch (e) { n(e); } }
export async function shareDraftController(r: Request, s: Response, n: NextFunction) { try { const { roomId } = roomIdParamsSchema.parse(r.params); const input = shareDraftSchema.parse(r.body); s.status(201).json(await shareDraft(roomId, input.userId, input.draftId)); } catch (e) { n(e); } }
