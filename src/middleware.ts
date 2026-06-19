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

const protectedPrefixes = [
  "/dashboard",
  "/admin",
  "/creator",
  "/designer",
  "/partner",
  "/banned",
];

const authEntryPaths = ["/login", "/register"];

const SESSION_COOKIE_HINTS = ["sb-", "auth-token"];

function hasSessionCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) =>
    SESSION_COOKIE_HINTS.some((hint) => c.name.includes(hint))
  );
}

function isServerAction(request: NextRequest): boolean {
  return request.method === "POST" && request.headers.has("next-action");
}

function isStatelessApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/r2/") ||
    pathname.startsWith("/api/security/") ||
    pathname.startsWith("/api/assets/") ||
    pathname.startsWith("/api/platform/")
  );
}

function mergeSessionCookies(target: NextResponse, sessionResponse: NextResponse | null) {
  sessionResponse?.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });
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
    const { response } = await updateSession(request);
    return response;
  }

  // Server Actions: refresh session only — skip intl rewrites that break action forwarding.
  if (isServerAction(request)) {
    if (!hasSessionCookies(request)) return NextResponse.next();
    const { response } = await updateSession(request);
    return response;
  }

  const cookieHint = hasSessionCookies(request);

  const localeMatch = pathname.match(localeRegex);
  const locale = localeMatch?.[1] ?? defaultLocale;
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtected = protectedPrefixes.some((p) => pathWithoutLocale.startsWith(p));
  const isAuthEntry = authEntryPaths.some((p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`));

  const shouldRefreshSession = cookieHint && (isProtected || isAuthEntry);
  const sessionResult = shouldRefreshSession ? await updateSession(request) : null;
  const authenticated = Boolean(sessionResult?.userId);

  if (isAuthEntry && authenticated) {
    const authError = request.nextUrl.searchParams.get("error");
    const recoverableErrors = new Set([
      "db_sync",
      "auth_exchange",
      "auth_callback",
      "auth_missing_code",
      "discord",
      "discord_token",
      "discord_user",
    ]);
    if (!authError || !recoverableErrors.has(authError)) {
      const dashboard = new URL(`/${locale}/dashboard`, request.url);
      return NextResponse.redirect(dashboard);
    }
  }

  if (isProtected && !authenticated) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const intlResponse = intlMiddleware(request);
  mergeSessionCookies(intlResponse, sessionResult?.response ?? null);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
