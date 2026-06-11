import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";
import type { Locale } from "@/i18n/config";
import { deepMergeMessages } from "@/lib/i18n-utils";
import { unstable_cache } from "next/cache";

export type MessageOverrideStore = Partial<Record<Locale, Record<string, unknown>>>;

const OVERRIDES_KEY = "message_overrides";

const getCachedOverrides = unstable_cache(
  async () => getSiteSetting<MessageOverrideStore>(OVERRIDES_KEY, {}),
  ["message-overrides"],
  { revalidate: 60, tags: ["message-overrides"] }
);

export async function getMessageOverrides(locale: Locale): Promise<Record<string, unknown>> {
  try {
    const store = await getCachedOverrides();
    return (store[locale] ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getAllMessageOverrides(): Promise<MessageOverrideStore> {
  try {
    return await getCachedOverrides();
  } catch {
    return {};
  }
}

export async function setMessageOverride(
  locale: Locale,
  path: string,
  value: string
): Promise<void> {
  const store = await getAllMessageOverrides();
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return;

  const localeTree = { ...(store[locale] ?? {}) } as Record<string, unknown>;
  let cursor: Record<string, unknown> = localeTree;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const next = cursor[seg];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]!] = value;
  store[locale] = localeTree;
  await setSiteSetting(OVERRIDES_KEY, store);
}

export async function importMessageOverrides(
  locale: Locale,
  payload: Record<string, unknown>,
  mode: "merge" | "replace" = "merge"
) {
  const store = await getAllMessageOverrides();
  store[locale] =
    mode === "replace"
      ? payload
      : deepMergeMessages((store[locale] ?? {}) as Record<string, unknown>, payload);
  await setSiteSetting(OVERRIDES_KEY, store);
}

export function flattenMessageTree(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenMessageTree(value as Record<string, unknown>, path));
    } else if (typeof value === "string") {
      out[path] = value;
    }
  }
  return out;
}
