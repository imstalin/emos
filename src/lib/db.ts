import { PrismaClient } from "@prisma/client";

import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const REQUIRED_MODELS = ["kpiSheetDocument", "planningDocument", "connect3030Session"] as const;

function isPrismaClientStale(client: PrismaClient): boolean {
  return REQUIRED_MODELS.some((model) => !(model in client));
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && !isPrismaClientStale(cached)) {
    return cached;
  }

  if (cached) {
    logger.warn("Recreating Prisma client — schema models changed");
    cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property, _receiver) {
    const client = getPrismaClient();
    const value = client[property as keyof PrismaClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.warn("Database connection unavailable", { error });
    return false;
  }
}
