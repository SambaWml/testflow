import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : false,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
