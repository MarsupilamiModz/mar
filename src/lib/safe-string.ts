import { z } from "zod";

/** Safely trim unknown form/JSON values — never throws on null. */
export function safeTrim(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") return String(value).trim();
  return value.trim();
}

export function optionalTrim(value: unknown): string | undefined {
  const trimmed = safeTrim(value);
  return trimmed || undefined;
}

export function nullableTrim(value: unknown): string | null {
  const trimmed = safeTrim(value);
  return trimmed || null;
}

export function safeFormString(formData: FormData, key: string): string {
  return safeTrim(formData.get(key));
}

export function safeFormOptional(formData: FormData, key: string): string | undefined {
  return optionalTrim(formData.get(key));
}

export function parseTags(value: unknown): string[] {
  const raw = safeTrim(value);
  if (!raw) return [];
  return Array.from(new Set(raw.split(",").map((t) => t.trim()).filter(Boolean)));
}

export function parseLines(value: unknown): string[] {
  const raw = safeTrim(value);
  if (!raw) return [];
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Stripe Price IDs: empty/null → null, never trim null. */
export function safeStripePriceId(value: unknown): string | null {
  const trimmed = safeTrim(value);
  if (!trimmed) return null;
  return trimmed;
}

export const zTrimmedString = z.preprocess(
  (v) => safeTrim(v),
  z.string()
);

export const zOptionalTrimmedString = z.preprocess(
  (v) => optionalTrim(v),
  z.string().optional()
);

export const zNullableStripePriceId = z.preprocess(
  (v) => safeStripePriceId(v),
  z
    .string()
    .regex(/^price_[a-zA-Z0-9]+$/, "Invalid Stripe Price ID (expected price_…)")
    .nullable()
);

export const zOptionalStripePriceId = z.preprocess(
  (v) => safeStripePriceId(v) ?? undefined,
  z
    .string()
    .regex(/^price_[a-zA-Z0-9]+$/, "Invalid Stripe Price ID (expected price_…)")
    .optional()
);
