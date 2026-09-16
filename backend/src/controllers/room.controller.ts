import type { NextFunction, Request, Response } from "express";

import { createRoom, getRoomState, joinRoom, leaveRoom } from "../services/room.service.js";
import { roomCodeParamsSchema, roomIdParamsSchema, userIdBodySchema } from "../validation/room.schemas.js";

export async function createRoomController(request: Request, response: Response, next: NextFunction) {
  try {
    const { userId } = userIdBodySchema.parse(request.body);
    const roomState = await createRoom(userId);
    response.status(201).json(roomState);
  } catch (error) {
    next(error);
  }
}

export async function joinRoomController(request: Request, response: Response, next: NextFunction) {
  try {
    const { roomCode } = roomCodeParamsSchema.parse(request.params);
    const { userId } = userIdBodySchema.parse(request.body);
    const result = await joinRoom(roomCode, userId);
    response.status(200).json({
      room: result.room,
      participants: result.participants,
      message: result.alreadyMember ? "User is already an active room member." : "Joined room."
    });
  } catch (error) {
    next(error);
  }
}

export async function leaveRoomController(request: Request, response: Response, next: NextFunction) {
  try {
    const { roomId } = roomIdParamsSchema.parse(request.params);
    const { userId } = userIdBodySchema.parse(request.body);
    const result = await leaveRoom(roomId, userId);
    response.status(200).json({
      room: result.room,
      participants: result.participants,
      message: result.alreadyLeft ? "User has already left the room." : "Left room."
    });
  } catch (error) {
    next(error);
  }
}

export async function getRoomController(request: Request, response: Response, next: NextFunction) {
  try {
    const { roomId } = roomIdParamsSchema.parse(request.params);
    response.status(200).json(await getRoomState(roomId));
  } catch (error) {
    next(error);
  }
}
