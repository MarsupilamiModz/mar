import type { Metadata } from "next";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { AsyncHeader } from "@/components/layout/async-header";
import { AsyncFooter } from "@/components/layout/async-footer";
import { Toaster } from "@/components/ui/toaster";
import { AuthSync } from "@/components/auth/auth-sync";
import { LocaleHtmlLang } from "@/components/layout/locale-html-lang";
import { ScrollRestoration } from "@/components/layout/scroll-restoration";
import { SnakeEasterEgg } from "@/components/easter-egg/snake-game";
import { AdProviderScripts } from "@/components/ads/ad-provider-scripts";
import { AdPopupSlot } from "@/components/ads/ad-popup-slot";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import { getCmsSeo } from "@/lib/page-content";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const seo = await getCmsSeo(locale);
  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      ...(seo.ogImageUrl ? { images: [{ url: seo.ogImageUrl }] } : {}),
    },
    twitter: {
      card: seo.twitterCard,
      title: seo.ogTitle,
      description: seo.ogDescription,
      ...(seo.ogImageUrl ? { images: [seo.ogImageUrl] } : {}),
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  if (!locales.includes(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <IntlProvider messages={messages}>
      <LocaleHtmlLang locale={locale} />
      <ScrollRestoration />
      <AdProviderScripts />
      <AdPopupSlot />
      <AuthSync />
      <div className="flex min-h-screen flex-col">
        <AsyncHeader locale={locale} />
        <main className="flex-1">{children}</main>
        <AdLocationSlot location="footer" className="mx-auto max-w-7xl px-4 pb-4 sm:px-6" />
        <AsyncFooter locale={locale} />
      </div>
      <Toaster />
      <SnakeEasterEgg />
    </IntlProvider>
  );
}
