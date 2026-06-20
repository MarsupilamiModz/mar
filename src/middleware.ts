import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { locales, defaultLocale, localeRegex } from "@/i18n/config";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "always",
  // URL locale is authoritative — prevents Accept-Language redirect loops on /de/… paths.
  localeDetection: false,
});

const protectedPrefixes = [
  "/dashboard",
  "/admin",
  "/creator",
  "/designer",
  "/partner",
  "/team-chat",
  "/banned",
];

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

function withPathnameHeader(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return new NextRequest(request.url, { headers: requestHeaders });
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

  if (isServerAction(request)) {
    if (!hasSessionCookies(request)) return NextResponse.next();
    const { response } = await updateSession(request);
    return response;
  }

  const cookieHint = hasSessionCookies(request);

  const localeMatch = pathname.match(localeRegex);
  const locale = localeMatch?.[1] ?? defaultLocale;
  let pathWithoutLocale = pathname.replace(localeRegex, "") || "/";
  if (!pathWithoutLocale.startsWith("/")) {
    pathWithoutLocale = `/${pathWithoutLocale}`;
  }

  const isProtected = protectedPrefixes.some((p) => pathWithoutLocale.startsWith(p));

  const sessionResult = cookieHint ? await updateSession(request) : null;
  const authenticated = Boolean(sessionResult?.userId);

  // Auth entry redirect handled in login/register page SSR (avoids Supabase/Prisma mismatch loops).

  // Only redirect to login when there are no session cookies at all.
  // If cookies exist but getUser() failed, defer to SSR requireAuth (with Prisma recovery).
  if (isProtected && !authenticated && !cookieHint) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    mergeSessionCookies(redirect, sessionResult?.response ?? null);
    return redirect;
  }

  const intlResponse = intlMiddleware(withPathnameHeader(request, pathname));
  mergeSessionCookies(intlResponse, sessionResult?.response ?? null);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
