import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";

export type SocketErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export function toSocketError(error: unknown): SocketErrorPayload {
  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code
      }))
    };
  }

  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details })
    };
  }

  return { code: "INTERNAL_ERROR", message: "An unexpected socket error occurred." };
}
