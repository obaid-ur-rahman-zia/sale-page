export type CategoryInput = {
  name: string;
  imageUrl: string;
  number?: number;
  isActive?: boolean;
};

export type ValidationResult =
  | { ok: true; value: CategoryInput }
  | { ok: false; message: string };

const MAX_NAME_LENGTH = 60;

/**
 * `next/image` needs an absolute https URL (matched against next.config
 * remotePatterns) or a root-relative path served from /public.
 */
export function normaliseImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function validateCategoryInput(body: unknown, { partial = false } = {}): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be an object" };
  }

  const input = body as Record<string, unknown>;
  const value: CategoryInput = { name: "", imageUrl: "" };

  const nameProvided = input.name !== undefined;
  if (nameProvided || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length === 0) {
      return { ok: false, message: "Category name is required" };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return { ok: false, message: `Category name must be ${MAX_NAME_LENGTH} characters or fewer` };
    }
    value.name = name;
  }

  const imageProvided = input.imageUrl !== undefined;
  if (imageProvided || !partial) {
    const imageUrl = normaliseImageUrl(input.imageUrl);
    if (!imageUrl) {
      return {
        ok: false,
        message: "Image URL must be an https:// link or a path starting with /",
      };
    }
    value.imageUrl = imageUrl;
  }

  if (input.number !== undefined && input.number !== null && input.number !== "") {
    const number = Number(input.number);
    if (!Number.isInteger(number) || number <= 0) {
      return { ok: false, message: "Category number must be a positive whole number" };
    }
    value.number = number;
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") {
      return { ok: false, message: "isActive must be true or false" };
    }
    value.isActive = input.isActive;
  }

  return { ok: true, value };
}
