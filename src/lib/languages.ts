import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import {
  extendedLocaleCatalog,
  localeFlags,
  localeLabels,
  locales,
  type Locale,
} from "@/i18n/config";

export type PlatformLanguageOption = {
  code: string;
  name: string;
  flagIcon: string;
  isActive: boolean;
};

function fallbackLanguages(): PlatformLanguageOption[] {
  return locales.map((code) => ({
    code,
    name: localeLabels[code],
    flagIcon: localeFlags[code],
    isActive: true,
  }));
}

async function fetchPlatformLanguages(): Promise<PlatformLanguageOption[]> {
  try {
    const rows = await prisma.platformLanguage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { code: true, name: true, flagIcon: true, isActive: true },
    });
    if (rows.length === 0) return fallbackLanguages();
    return rows.filter((row) => locales.includes(row.code as Locale));
  } catch {
    return fallbackLanguages();
  }
}

export const getPlatformLanguages = unstable_cache(
  fetchPlatformLanguages,
  ["platform-languages"],
  { revalidate: 300, tags: ["platform-languages"] }
);

export function getExtendedLanguageCatalog(): PlatformLanguageOption[] {
  return Object.entries(extendedLocaleCatalog).map(([code, meta]) => ({
    code,
    name: meta.name,
    flagIcon: meta.flag,
    isActive: locales.includes(code as Locale),
  }));
}
