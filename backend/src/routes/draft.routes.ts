import { Router } from "express";
import { createDraftController, deleteDraftController, getDraftController, listDraftsController } from "../controllers/draft.controller.js";
const router = Router(); router.post("/", createDraftController); router.get("/", listDraftsController); router.get("/:draftId", getDraftController); router.delete("/:draftId", deleteDraftController); export default router;
