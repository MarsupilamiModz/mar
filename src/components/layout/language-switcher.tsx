"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { persistUserLocale } from "@/actions/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const tNav = useTranslations("nav");

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
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tNav("language")} className="dark-reader-lock">
          <Globe className="h-4 w-4" data-neon-lock />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass max-h-72 overflow-y-auto dark-reader-lock">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={locale === l ? "text-neon-purple font-medium" : ""}
          >
            {localeLabels[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
