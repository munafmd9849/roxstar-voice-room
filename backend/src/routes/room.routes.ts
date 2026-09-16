import { Router } from "express";

import {
  createRoomController,
  getRoomController,
  joinRoomController,
  leaveRoomController
} from "../controllers/room.controller.js";

const roomRouter = Router();

roomRouter.post("/", createRoomController);
roomRouter.post("/:roomCode/join", joinRoomController);
roomRouter.post("/:roomId/leave", leaveRoomController);
roomRouter.get("/:roomId", getRoomController);

export default roomRouter;
