"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { locales, localeLabels, localeFlags, type Locale } from "@/i18n/config";
import { persistUserLocale } from "@/actions/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import type { PlatformLanguageOption } from "@/lib/languages";

export function LanguageSwitcher({
  locale,
  languages,
}: {
  locale: string;
  languages?: PlatformLanguageOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tNav = useTranslations("nav");

  const options =
    languages?.length
      ? languages
      : locales.map((l) => ({
          code: l,
          name: localeLabels[l],
          flagIcon: localeFlags[l],
          isActive: true,
        }));

  function switchLocale(next: Locale) {
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;sameSite=lax`;
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }
    void persistUserLocale(next);
    router.push(segments.join("/") || `/${next}`);
  }

  const current = options.find((l) => l.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tNav("language")} className="dark-reader-lock">
          <span className="text-base leading-none" aria-hidden>
            {current?.flagIcon ?? "🌐"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass max-h-72 overflow-y-auto dark-reader-lock min-w-[11rem]">
        {options.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => switchLocale(l.code as Locale)}
            className={locale === l.code ? "text-neon-purple font-medium" : ""}
          >
            <span className="mr-2 text-base leading-none" aria-hidden>
              {l.flagIcon}
            </span>
            {l.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
