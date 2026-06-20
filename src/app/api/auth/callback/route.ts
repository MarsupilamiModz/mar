import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient, redirectWithCookies } from "@/lib/supabase/route-handler";
import { ensurePrismaUser } from "@/lib/user-sync";
import { logPlatformError } from "@/lib/platform-log";
import { getAppUrl } from "@/lib/app-url";
import { syncDiscordRoles } from "@/lib/discord";
import { hasPremiumAccess } from "@/lib/auth";
import { logAuthEvent } from "@/lib/auth-log";
import { warmDbConnection, withDbRetry } from "@/lib/db";
import { findAppUserBySupabaseId } from "@/lib/user-sync";
import { persistAuthAudit } from "@/lib/auth-audit";
import { logSecurityEvent } from "@/lib/user-security";
import { createHash } from "crypto";
import { isGenericDashboardPath, resolveRoleHomePath } from "@/lib/auth-redirect";
import { invalidateUserSessionCache } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeNextPath(next: string | null, locale: string): string {
  const fallback = `/${locale}/dashboard`;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("/login") || next.includes("/register")) return fallback;
  return next;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const locale = url.searchParams.get("locale") ?? "en";
  const origin = getAppUrl();
  const destination = safeNextPath(next, locale);

  if (!code) {
    logAuthEvent("callback_missing_code", { locale }, "warn");
    void persistAuthAudit("auth.callback_missing_code", { locale });
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_missing_code`);
  }

  const { supabase, getResponse } = createRouteHandlerClient(req);

  try {
    await warmDbConnection();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      logAuthEvent("callback_exchange_failed", { message: error?.message }, "error");
      void persistAuthAudit("auth.callback_exchange_failed", { message: error?.message });
      return redirectWithCookies(
        `${origin}/${locale}/login?error=auth_exchange`,
        getResponse()
      );
    }

    logAuthEvent("callback_exchange_ok", { userId: data.user.id });

    invalidateUserSessionCache(data.user.id);

    let dbUser = null;
    try {
      dbUser = await withDbRetry(
        () => ensurePrismaUser(data.user),
        { retries: 5, delayMs: 300, label: "auth:callback-sync" }
      );
    } catch (syncErr) {
      void logPlatformError("auth:callback-sync", syncErr);
      logAuthEvent("callback_sync_failed", { userId: data.user.id }, "error");
      void persistAuthAudit("auth.callback_sync_failed", { userId: data.user.id });

      dbUser = await withDbRetry(
        () => findAppUserBySupabaseId(data.user.id),
        { retries: 2, label: "auth:callback-fallback" }
      );

      if (!dbUser) {
        return redirectWithCookies(
          `${origin}/${locale}/login?error=db_sync`,
          getResponse()
        );
      }
      logAuthEvent("callback_sync_recovered", { userId: data.user.id }, "warn");
    }

    void persistAuthAudit("auth.login", {
      userId: dbUser!.id,
      provider: data.user.app_metadata?.provider ?? "oauth",
    });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    void logSecurityEvent({
      userId: dbUser!.id,
      eventType: "LOGIN_SUCCESS",
      ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 16),
      userAgent: req.headers.get("user-agent") ?? undefined,
      metadata: { provider: data.user.app_metadata?.provider ?? "oauth" },
    });

    if (dbUser?.discordId) {
      const roles: string[] = [];
      if (hasPremiumAccess(dbUser)) roles.push("premium");
      if (dbUser.role === "CREATOR") roles.push("creator");
      if (["MODERATOR", "ADMIN", "OWNER"].includes(dbUser.role)) roles.push("moderator");
      void syncDiscordRoles(dbUser.discordId, roles);
    }

    const finalDestination = isGenericDashboardPath(destination, locale)
      ? resolveRoleHomePath(locale, dbUser!)
      : destination;

    return redirectWithCookies(`${origin}${finalDestination}`, getResponse());
  } catch (err) {
    void logPlatformError("auth:callback", err);
    logAuthEvent("callback_fatal", { message: err instanceof Error ? err.message : String(err) }, "error");
    void persistAuthAudit("auth.callback_fatal", {
      message: err instanceof Error ? err.message : String(err),
    });
    return redirectWithCookies(
      `${origin}/${locale}/login?error=auth_callback`,
      getResponse()
    );
  }
}
