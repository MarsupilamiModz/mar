import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { locales, defaultLocale, localeRegex } from "@/i18n/config";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
});

const protectedPrefixes = ["/dashboard", "/admin", "/creator", "/designer", "/banned"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api")) {
    if (pathname.startsWith("/api/auth/callback")) {
      return NextResponse.next();
    }
    return updateSession(request);
  }

  const sessionResponse = await updateSession(request);
  const localeMatch = pathname.match(localeRegex);
  const locale = localeMatch?.[1] ?? defaultLocale;
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtected = protectedPrefixes.some((p) => pathWithoutLocale.startsWith(p));

  if (isProtected) {
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.includes("auth-token") || c.name.includes("sb-"));

    if (!hasSession) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const intlResponse = intlMiddleware(request);

  sessionResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
