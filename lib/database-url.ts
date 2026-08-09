/**
 * Single place that resolves the MongoDB connection string, so the app,
 * the Prisma CLI (prisma.config.ts) and the seed script cannot drift apart.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a MongoDB instance, e.g. " +
        "mongodb://localhost:27017/salepage",
    );
  }

  if (!url.startsWith("mongodb://") && !url.startsWith("mongodb+srv://")) {
    throw new Error(
      `DATABASE_URL ("${url}") is not a MongoDB connection string. ` +
        "This app runs on MongoDB — use mongodb:// or mongodb+srv://.",
    );
  }

  return url;
}
