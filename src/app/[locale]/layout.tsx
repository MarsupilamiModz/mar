import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { AsyncHeader } from "@/components/layout/async-header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/toaster";
import { AuthSync } from "@/components/auth/auth-sync";
import { SnakeEasterEgg } from "@/components/easter-egg/snake-game";
import { AdProviderScripts } from "@/components/ads/ad-provider-scripts";
import { AdPopupSlot } from "@/components/ads/ad-popup-slot";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
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
    <NextIntlClientProvider messages={messages}>
      <AdProviderScripts />
      <AdPopupSlot />
      <AuthSync />
      <div className="flex min-h-screen flex-col">
        <AsyncHeader locale={locale} />
        <main className="flex-1">{children}</main>
        <AdLocationSlot location="footer" className="mx-auto max-w-7xl px-4 pb-4 sm:px-6" />
        <Footer locale={locale} />
      </div>
      <Toaster />
      <SnakeEasterEgg />
    </NextIntlClientProvider>
  );
}
