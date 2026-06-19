"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "@/i18n/config";
import { getSafeLocale } from "@/lib/i18n/safe-locale";
import { intlGetMessageFallback, intlOnError } from "@/lib/i18n-utils";

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale | string | null | undefined;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  const safeLocale = getSafeLocale(locale);
  const safeMessages = messages && typeof messages === "object" ? messages : {};

  return (
    <NextIntlClientProvider
      locale={safeLocale}
      messages={safeMessages}
      timeZone="UTC"
      onError={intlOnError}
      getMessageFallback={intlGetMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
