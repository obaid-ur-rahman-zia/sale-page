import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Validated here rather than at module scope so `next build` can collect page
  // data without a database URL — the Docker image is built before DATABASE_URL
  // is injected by the deployment.
  getDatabaseUrl();

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// The client is created on first use, not on import, for the same reason.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
