/** Global language catalog — flags, native names, and country labels for UI. */
export type LanguageCatalogEntry = {
  code: string;
  name: string;
  nativeName: string;
  countryName: string;
  flag: string;
};

export const GLOBAL_LANGUAGE_CATALOG: LanguageCatalogEntry[] = [
  { code: "de", name: "German", nativeName: "Deutsch", countryName: "Germany", flag: "🇩🇪" },
  { code: "en", name: "English", nativeName: "English", countryName: "United States", flag: "🇺🇸" },
  { code: "fr", name: "French", nativeName: "Français", countryName: "France", flag: "🇫🇷" },
  { code: "es", name: "Spanish", nativeName: "Español", countryName: "Spain", flag: "🇪🇸" },
  { code: "it", name: "Italian", nativeName: "Italiano", countryName: "Italy", flag: "🇮🇹" },
  { code: "pl", name: "Polish", nativeName: "Polski", countryName: "Poland", flag: "🇵🇱" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", countryName: "Turkey", flag: "🇹🇷" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", countryName: "Netherlands", flag: "🇳🇱" },
  { code: "pt", name: "Portuguese", nativeName: "Português", countryName: "Portugal", flag: "🇵🇹" },
  { code: "ru", name: "Russian", nativeName: "Русский", countryName: "Russia", flag: "🇷🇺" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", countryName: "Ukraine", flag: "🇺🇦" },
  { code: "ar", name: "Arabic", nativeName: "العربية", countryName: "Saudi Arabia", flag: "🇸🇦" },
  { code: "zh", name: "Chinese", nativeName: "中文", countryName: "China", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", countryName: "Japan", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", countryName: "South Korea", flag: "🇰🇷" },
];

const byCode = new Map(GLOBAL_LANGUAGE_CATALOG.map((e) => [e.code, e]));

export function getLanguageCatalogEntry(code: string): LanguageCatalogEntry | undefined {
  return byCode.get(code);
}

export function enrichLanguageOption(input: {
  code: string;
  name: string;
  flagIcon: string;
  isActive: boolean;
}) {
  const meta = getLanguageCatalogEntry(input.code);
  return {
    ...input,
    name: meta?.nativeName ?? input.name,
    nativeName: meta?.nativeName ?? input.name,
    countryName: meta?.countryName ?? "",
    flagIcon: meta?.flag ?? input.flagIcon,
  };
}

export type LanguageDisplayOption = {
  code: string;
  name: string;
  nativeName: string;
  countryName: string;
  flagIcon: string;
  isActive: boolean;
};

/** Client-safe display catalog (no Prisma). */
export function getLanguageDisplayCatalog(activeCodes?: string[]): LanguageDisplayOption[] {
  const active = activeCodes ?? ["en", "de", "fr", "es", "tr", "pl"];
  return GLOBAL_LANGUAGE_CATALOG.map((entry) => ({
    code: entry.code,
    name: entry.nativeName,
    nativeName: entry.nativeName,
    countryName: entry.countryName,
    flagIcon: entry.flag,
    isActive: active.includes(entry.code),
  }));
}
