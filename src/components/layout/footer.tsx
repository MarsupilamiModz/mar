"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { SITE } from "@/lib/site";

/** Footer nav items that must always display in English */
const FOOTER_EN_LINKS = {
  support: "Support",
  faq: "FAQ",
  contact: "Contact",
} as const;

export function Footer({ locale }: { locale: string }) {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">{t("tagline")}</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">{t("platform")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href={`/${locale}/mods`} prefetch className="hover:text-foreground transition-colors">{t("browseMods")}</Link></li>
            <li><Link href={`/${locale}/games`} prefetch className="hover:text-foreground transition-colors">{t("games")}</Link></li>
            <li><Link href={`/${locale}/creators`} prefetch className="hover:text-foreground transition-colors">{t("creators")}</Link></li>
            <li><Link href={`/${locale}/leaderboards`} prefetch className="hover:text-foreground transition-colors">{t("leaderboards")}</Link></li>
            <li><Link href={`/${locale}/premium`} prefetch className="hover:text-foreground transition-colors">{t("premium")}</Link></li>
            <li><Link href={`/${locale}/custom-orders`} prefetch className="hover:text-foreground transition-colors">{t("customWork")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">{FOOTER_EN_LINKS.support}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href={`/${locale}/dashboard/support`} prefetch className="hover:text-foreground transition-colors">{FOOTER_EN_LINKS.support}</Link></li>
            <li><Link href={`/${locale}/faq`} prefetch className="hover:text-foreground transition-colors">{FOOTER_EN_LINKS.faq}</Link></li>
            <li><Link href={`/${locale}/contact`} prefetch className="hover:text-foreground transition-colors">{FOOTER_EN_LINKS.contact}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">{t("legal")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href={`/${locale}/legal/terms`} className="hover:text-foreground transition-colors">{t("terms")}</Link></li>
            <li><Link href={`/${locale}/legal/privacy`} className="hover:text-foreground transition-colors">{t("privacy")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/40 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {SITE.name}. {t("rights")}
      </div>
    </footer>
  );
}
