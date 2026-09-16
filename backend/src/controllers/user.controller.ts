import type { NextFunction, Request, Response } from "express";

import { createUser } from "../services/user.service.js";
import { createUserSchema } from "../validation/user.schemas.js";

export async function createUserController(request: Request, response: Response, next: NextFunction) {
  try {
    const input = createUserSchema.parse(request.body);
    const user = await createUser(input);
    response.status(201).json(user);
  } catch (error) {
    next(error);
  }
}
