import type { Locale } from "@/i18n/config";

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
] as const;

async function loadLocaleModules(locale: Locale) {
  return Promise.all(
    modules.map(async (name) => {
      const mod = await import(`./${locale}/${name}.json`);
      return mod.default as Record<string, unknown>;
    })
  );
}

export async function loadMessages(locale: Locale) {
  const parts = await loadLocaleModules(locale);
  return Object.assign({}, ...parts);
}
