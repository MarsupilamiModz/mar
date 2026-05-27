import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { detectLocaleFromHeader, isValidLocale, type Locale } from "./config";
import { loadMessages } from "../messages/load";

async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale;
  return detectLocaleFromHeader((await headers()).get("accept-language"));
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !isValidLocale(locale)) {
    locale = await detectLocale();
  }

  return {
    locale,
    messages: await loadMessages(locale as Locale),
  };
});
