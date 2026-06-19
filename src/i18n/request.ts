import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, detectLocaleFromHeader, isValidLocale, type Locale } from "./config";
import { getSafeLocale } from "@/lib/i18n/safe-locale";
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
  let locale: Locale = getSafeLocale(requested);
  if (!requested || !isValidLocale(requested)) {
    locale = getSafeLocale(await detectLocale());
  }

  let messages: Awaited<ReturnType<typeof loadMessages>>;
  try {
    messages = await loadMessages(locale);
  } catch (err) {
    console.error("[i18n] loadMessages failed, falling back to en", err);
    try {
      messages = await loadMessages("en");
    } catch {
      messages = {} as Awaited<ReturnType<typeof loadMessages>>;
    }
    locale = defaultLocale;
  }

  return {
    locale,
    messages,
    timeZone: "UTC",
    onError: intlOnError,
    getMessageFallback: intlGetMessageFallback,
  };
});
