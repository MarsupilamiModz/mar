"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo, type LogoBranding } from "@/components/brand/logo";
import type { FooterSettings } from "@/lib/branding-cms";
import { getLanguageDisplayCatalog } from "@/lib/language-catalog";
import { LanguageFlagLabel } from "@/components/i18n/language-flag-label";

function resolveHref(locale: string, href: string) {
  if (href.startsWith("http")) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `/${locale}${path === "/" ? "" : path}`;
}

export function Footer({
  locale,
  footer,
  branding,
}: {
  locale: string;
  footer?: FooterSettings | null;
  branding?: LogoBranding | null;
}) {
  const t = useTranslations("footer");
  const siteName = branding?.siteTitle ?? "Xumari Modz";
  const tagline = footer?.tagline?.trim() || t("tagline");
  const copyright = footer?.copyright?.trim() || t("rights");
  const sections = footer?.sections?.length
    ? [...footer.sections].sort((a, b) => a.order - b.order)
    : null;

  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <div>
          <Logo branding={branding} />
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">{tagline}</p>
          {footer?.socialLinks && (
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {footer.socialLinks.discord && (
                <a href={footer.socialLinks.discord} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  Discord
                </a>
              )}
              {footer.socialLinks.twitter && (
                <a href={footer.socialLinks.twitter} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  X / Twitter
                </a>
              )}
              {footer.socialLinks.youtube && (
                <a href={footer.socialLinks.youtube} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  YouTube
                </a>
              )}
            </div>
          )}
        </div>

        {sections ? (
          sections.map((section) => (
            <div key={section.id}>
              <h4 className="font-semibold mb-3">{section.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[...section.links]
                  .sort((a, b) => a.order - b.order)
                  .map((link) => (
                    <li key={link.id}>
                      <Link
                        href={resolveHref(locale, link.href)}
                        prefetch
                        className="hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))
        ) : (
          <>
            <div>
              <h4 className="font-semibold mb-3">{t("platform")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href={`/${locale}/mods`} prefetch className="hover:text-foreground transition-colors">{t("browseMods")}</Link></li>
                <li><Link href={`/${locale}/games`} prefetch className="hover:text-foreground transition-colors">{t("games")}</Link></li>
                <li><Link href={`/${locale}/premium`} prefetch className="hover:text-foreground transition-colors">{t("premium")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href={`/${locale}/dashboard/support`} prefetch className="hover:text-foreground transition-colors">Support</Link></li>
                <li><Link href={`/${locale}/faq`} prefetch className="hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href={`/${locale}/contact`} prefetch className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">{t("legal")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href={`/${locale}/legal/terms`} className="hover:text-foreground transition-colors">{t("terms")}</Link></li>
                <li><Link href={`/${locale}/legal/privacy`} className="hover:text-foreground transition-colors">{t("privacy")}</Link></li>
              </ul>
            </div>
          </>
        )}
      </div>
      <div className="border-t border-border/40 py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-wrap justify-center gap-3">
          {getLanguageDisplayCatalog()
            .filter((l) => l.isActive)
            .map((l) => (
              <Link
                key={l.code}
                href={`/${l.code}`}
                className={`rounded-md px-2 py-1 text-xs hover:bg-accent/30 transition-colors ${locale === l.code ? "text-neon-purple" : "text-muted-foreground"}`}
              >
                <LanguageFlagLabel language={l} compact />
              </Link>
            ))}
        </div>
      </div>
      <div className="border-t border-border/40 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {siteName}. {copyright}
      </div>
    </footer>
  );
}
