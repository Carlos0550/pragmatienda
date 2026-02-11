import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

type GlobalForPrisma = typeof globalThis & {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

const globalForPrisma = globalThis as GlobalForPrisma;

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: env.DATABASE_URL
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"]
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}

export const disconnectPrisma = async () => {
  await prisma.$disconnect();
  await pool.end();
};
