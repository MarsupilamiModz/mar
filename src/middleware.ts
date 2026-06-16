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

const SESSION_COOKIE_HINTS = ["sb-", "auth-token"];

function hasSessionCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) =>
    SESSION_COOKIE_HINTS.some((hint) => c.name.includes(hint))
  );
}

/** High-frequency API routes — auth validated in route handlers, skip Supabase refresh. */
function isStatelessApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/r2/") ||
    pathname.startsWith("/api/security/") ||
    pathname.startsWith("/api/assets/") ||
    pathname.startsWith("/api/platform/")
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api")) {
    if (pathname.startsWith("/api/auth/callback") || isStatelessApi(pathname)) {
      return NextResponse.next();
    }
    if (!hasSessionCookies(request)) {
      return NextResponse.next();
    }
    return updateSession(request);
  }

  const hasSession = hasSessionCookies(request);
  const sessionResponse = hasSession ? await updateSession(request) : null;

  const localeMatch = pathname.match(localeRegex);
  const locale = localeMatch?.[1] ?? defaultLocale;
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtected = protectedPrefixes.some((p) => pathWithoutLocale.startsWith(p));

  if (isProtected && !hasSession) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const intlResponse = intlMiddleware(request);

  sessionResponse?.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
