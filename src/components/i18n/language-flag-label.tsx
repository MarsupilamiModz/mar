"use client";

import type { PlatformLanguageOption } from "@/lib/languages";
import { cn } from "@/lib/utils";

type Props = {
  language: Pick<PlatformLanguageOption, "code" | "name" | "flagIcon" | "nativeName" | "countryName">;
  showCountry?: boolean;
  compact?: boolean;
  className?: string;
};

export function LanguageFlagLabel({ language, showCountry, compact, className }: Props) {
  const label = language.nativeName ?? language.name;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-base leading-none" aria-hidden>
        {language.flagIcon}
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span>{label}</span>
          {showCountry && language.countryName ? (
            <span className="text-[10px] text-muted-foreground">{language.countryName}</span>
          ) : null}
        </span>
      )}
    </span>
  );
}
