import type { IntlError } from "next-intl";

export function deepMergeMessages(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMergeMessages(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function humanizeMessageKey(key: string): string {
  const segment = key.split(".").pop() ?? key;
  return segment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function intlOnError(error: IntlError) {
  if (error.code === "MISSING_MESSAGE") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] ${error.message}`);
    }
    return;
  }
  if (error.code === "INSUFFICIENT_PATH" || error.code === "INVALID_MESSAGE") {
    console.warn(`[i18n] ${error.message}`);
  }
}

export function intlGetMessageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
  error?: IntlError;
}) {
  return humanizeMessageKey(namespace ? `${namespace}.${key}` : key);
}
