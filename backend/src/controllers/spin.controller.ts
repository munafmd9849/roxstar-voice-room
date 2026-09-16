import type { NextFunction, Request, Response } from "express";

import { getLatestSpin, startSpin } from "../services/spin.service.js";
import { roomIdParamsSchema, userIdBodySchema } from "../validation/room.schemas.js";

export async function startSpinController(request: Request, response: Response, next: NextFunction) {
  try {
    const { roomId } = roomIdParamsSchema.parse(request.params);
    const { userId } = userIdBodySchema.parse(request.body);
    response.status(201).json({ spin: await startSpin(roomId, userId) });
  } catch (error) {
    next(error);
  }
}

export async function getSpinController(request: Request, response: Response, next: NextFunction) {
  try {
    const { roomId } = roomIdParamsSchema.parse(request.params);
    response.status(200).json({ spin: await getLatestSpin(roomId) });
  } catch (error) {
    next(error);
  }
}
