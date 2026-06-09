import { readFileSync } from "fs";
import { join } from "path";
import { locales, type Locale } from "@/i18n/config";

const MESSAGE_MODULES = [
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

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadLocaleKeys(locale: Locale): Set<string> {
  const root = join(process.cwd(), "src", "messages", locale);
  const merged: Record<string, unknown> = {};
  for (const mod of MESSAGE_MODULES) {
    try {
      const raw = readFileSync(join(root, `${mod}.json`), "utf8");
      Object.assign(merged, JSON.parse(raw) as Record<string, unknown>);
    } catch {
      /* missing module file */
    }
  }
  return new Set(flattenKeys(merged));
}

export type TranslationAuditResult = {
  referenceLocale: Locale;
  totalReferenceKeys: number;
  locales: {
    locale: Locale;
    keyCount: number;
    missing: string[];
    extra: string[];
  }[];
  summary: string;
};

export function auditTranslationKeys(referenceLocale: Locale = "en"): TranslationAuditResult {
  const reference = loadLocaleKeys(referenceLocale);
  const refArr = Array.from(reference).sort();

  const localeResults = locales
    .filter((l) => l !== referenceLocale)
    .map((locale) => {
      const keys = loadLocaleKeys(locale);
      const missing = refArr.filter((k) => !keys.has(k));
      const extra = Array.from(keys)
        .filter((k) => !reference.has(k))
        .sort();
      return { locale, keyCount: keys.size, missing, extra };
    });

  const totalMissing = localeResults.reduce((n, r) => n + r.missing.length, 0);

  return {
    referenceLocale,
    totalReferenceKeys: reference.size,
    locales: localeResults,
    summary:
      totalMissing === 0
        ? `All ${locales.length} locales match ${referenceLocale} (${reference.size} keys).`
        : `${totalMissing} missing key(s) across non-reference locales.`,
  };
}
