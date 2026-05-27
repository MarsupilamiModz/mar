import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { locales, defaultLocale, localeRegex } from "@/i18n/config";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "always",
});

const protectedPrefixes = ["/dashboard", "/admin", "/creator", "/designer", "/banned"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(localeRegex);
  const locale = localeMatch?.[1] ?? defaultLocale;
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtected = protectedPrefixes.some((p) => pathWithoutLocale.startsWith(p));

  if (isProtected) {
    await updateSession(request);
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.includes("auth-token") || c.name.includes("sb-"));

    if (!hasSession) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return intlMiddleware(request);
  }

  const response = intlMiddleware(request);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
