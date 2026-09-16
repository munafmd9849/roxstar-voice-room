import { Router } from "express";

import {
  createRoomController,
  getRoomController,
  joinRoomController,
  leaveRoomController
} from "../controllers/room.controller.js";
import { getSpinController, startSpinController } from "../controllers/spin.controller.js";
import { shareDraftController } from "../controllers/draft.controller.js";

const roomRouter = Router();

roomRouter.post("/", createRoomController);
roomRouter.post("/:roomCode/join", joinRoomController);
roomRouter.post("/:roomId/leave", leaveRoomController);
roomRouter.post("/:roomId/spin/start", startSpinController);
roomRouter.post("/:roomId/drafts/share", shareDraftController);
roomRouter.get("/:roomId/spin", getSpinController);
roomRouter.get("/:roomId", getRoomController);

export default roomRouter;
