import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { locales, type Locale } from "@/i18n/config";
import {
  enrichLanguageOption,
  getLanguageDisplayCatalog,
  type LanguageDisplayOption,
} from "@/lib/language-catalog";

export type PlatformLanguageOption = LanguageDisplayOption;
export { getLanguageDisplayCatalog };

function fallbackLanguages(): PlatformLanguageOption[] {
  return getLanguageDisplayCatalog([...locales]).filter((l) => l.isActive);
}

async function fetchPlatformLanguages(): Promise<PlatformLanguageOption[]> {
  try {
    const rows = await prisma.platformLanguage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { code: true, name: true, flagIcon: true, isActive: true },
    });
    if (rows.length === 0) return fallbackLanguages();
    return rows
      .filter((row) => locales.includes(row.code as Locale))
      .map((row) => enrichLanguageOption(row));
  } catch {
    return fallbackLanguages();
  }
}

export const getPlatformLanguages = unstable_cache(
  fetchPlatformLanguages,
  ["platform-languages-v2"],
  { revalidate: 300, tags: ["platform-languages"] }
);

export function getExtendedLanguageCatalog(): PlatformLanguageOption[] {
  return getLanguageDisplayCatalog();
}
