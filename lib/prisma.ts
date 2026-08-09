import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma reads DATABASE_URL itself (see the datasource block in schema.prisma);
// this call is here so a missing or non-MongoDB URL fails with a clear message
// instead of a generic connector error on the first query.
if (!globalForPrisma.prisma) {
  getDatabaseUrl();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
