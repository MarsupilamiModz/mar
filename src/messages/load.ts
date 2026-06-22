import { unstable_cache } from "next/cache";
import type { Locale } from "@/i18n/config";
import { deepMergeMessages } from "@/lib/i18n-utils";
import { getMessageOverrides } from "@/lib/message-overrides";
import enSearch from "./en/search.json";
import deSearch from "./de/search.json";
import frSearch from "./fr/search.json";
import esSearch from "./es/search.json";
import trSearch from "./tr/search.json";
import plSearch from "./pl/search.json";

const searchByLocale: Record<Locale, Record<string, unknown>> = {
  en: enSearch,
  de: deSearch,
  fr: frSearch,
  es: esSearch,
  tr: trSearch,
  pl: plSearch,
};

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
  "email",
  "chat",
] as const;

async function loadLocaleModules(locale: Locale) {
  const parts = await Promise.all(
    modules.map(async (name) => {
      const mod = await import(`./${locale}/${name}.json`);
      return mod.default as Record<string, unknown>;
    })
  );
  return [...parts, { search: searchByLocale[locale] }];
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
  ["i18n-messages-v2"],
  { revalidate: 300, tags: ["i18n-messages"] }
);

export function loadMessages(locale: Locale) {
  return cachedMessages(locale);
}
