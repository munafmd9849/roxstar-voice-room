import { getPrismaClient } from "../config/database.js";
import type { CreateUserInput } from "../validation/user.schemas.js";

export async function createUser(input: CreateUserInput) {
  const user = await getPrismaClient().user.create({
    data: { name: input.name },
    select: {
      id: true,
      name: true,
      createdAt: true
    }
  });

  return user;
}
