import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { detectLocaleFromHeader, isValidLocale, resolveLocale, type Locale } from "./config";
import { loadMessages } from "../messages/load";
import { intlGetMessageFallback, intlOnError } from "@/lib/i18n-utils";

async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale;
  return detectLocaleFromHeader((await headers()).get("accept-language"));
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: Locale = resolveLocale(requested);
  if (!requested || !isValidLocale(requested)) {
    locale = resolveLocale(await detectLocale());
  }

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "UTC",
    onError: intlOnError,
    getMessageFallback: intlGetMessageFallback,
  };
});
