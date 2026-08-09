/**
 * Single place that resolves the PostgreSQL connection string, so the app and the
 * seed script fail with the same readable message when it is missing.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a PostgreSQL instance, e.g. " +
        "postgresql://user:password@localhost:5432/salepage?schema=public",
    );
  }

  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      `DATABASE_URL ("${url}") is not a PostgreSQL connection string. ` +
        "This app runs on PostgreSQL — use postgresql://.",
    );
  }

  return url;
}
