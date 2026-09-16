import { z } from "zod";

export const createUserSchema = z.object({
  name: z
    .string({ error: "Name must be a string." })
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must not exceed 100 characters.")
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
