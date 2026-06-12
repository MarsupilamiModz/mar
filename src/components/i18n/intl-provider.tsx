"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "@/i18n/config";
import { intlGetMessageFallback, intlOnError } from "@/lib/i18n-utils";

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      onError={intlOnError}
      getMessageFallback={intlGetMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
