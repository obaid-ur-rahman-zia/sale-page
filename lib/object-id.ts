/**
 * MongoDB primary keys are 24-character hex ObjectIds. Prisma throws a raw
 * "Malformed ObjectID" error when handed anything else, so ids coming from query
 * strings and request bodies are checked here first.
 */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

export function parseObjectId(value: unknown): string | null {
  if (isObjectId(value)) {
    return value;
  }
  return null;
}
