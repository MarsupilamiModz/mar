"use client";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getLanguageDisplayCatalog } from "@/lib/language-catalog";

export function AuthLanguagePicker({ locale }: { locale: string }) {
  return (
    <div className="flex justify-end mb-4">
      <LanguageSwitcher locale={locale} languages={getLanguageDisplayCatalog()} />
    </div>
  );
}
