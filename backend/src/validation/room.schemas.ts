import { z } from "zod";

const idSchema = z
  .string({ error: "ID must be a string." })
  .trim()
  .min(1, "ID is required.")
  .max(191, "ID is too long.");

export const userIdBodySchema = z.object({
  userId: idSchema
});

export const roomIdParamsSchema = z.object({
  roomId: idSchema
});

export const roomCodeParamsSchema = z.object({
  roomCode: z
    .string({ error: "Room code must be a string." })
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NP-Z2-9]{6}$/, "Room code must be six uppercase, non-ambiguous characters.")
});

export type UserIdInput = z.infer<typeof userIdBodySchema>;
