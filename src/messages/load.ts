import { unstable_cache } from "next/cache";
import type { Locale } from "@/i18n/config";
import { deepMergeMessages } from "@/lib/i18n-utils";
import { getMessageOverrides } from "@/lib/message-overrides";

const modules = [
  "common",
  "landing",
  "catalog",
  "premium",
  "auth",
  "dashboard",
  "admin",
  "designer",
  "creator",
  "support",
  "licenses",
  "toast",
  "ecosystem",
  "media",
  "shop",
  "security",
  "sounds",
] as const;

async function loadLocaleModules(locale: Locale) {
  return Promise.all(
    modules.map(async (name) => {
      const mod = await import(`./${locale}/${name}.json`);
      return mod.default as Record<string, unknown>;
    })
  );
}

function mergeParts(parts: Record<string, unknown>[]) {
  return parts.reduce<Record<string, unknown>>(
    (acc, part) => deepMergeMessages(acc, part),
    {}
  );
}

async function loadMessagesUncached(locale: Locale) {
  const enParts = await loadLocaleModules("en");
  const english = mergeParts(enParts);

  if (locale === "en") {
    const overrides = await getMessageOverrides("en");
    return deepMergeMessages(english, overrides) as Record<string, string>;
  }

  const localeParts = await loadLocaleModules(locale);
  const localized = mergeParts(localeParts);
  const merged = deepMergeMessages(english, localized);
  const overrides = await getMessageOverrides(locale);
  return deepMergeMessages(merged, overrides) as Record<string, string>;
}

const cachedMessages = unstable_cache(
  async (locale: Locale) => loadMessagesUncached(locale),
  ["i18n-messages-v1"],
  { revalidate: 300, tags: ["i18n-messages"] }
);

export function loadMessages(locale: Locale) {
  return cachedMessages(locale);
}
