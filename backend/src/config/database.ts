import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured to use the database.");
  }

  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });

  return prisma;
}
