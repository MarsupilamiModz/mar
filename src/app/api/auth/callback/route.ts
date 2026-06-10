import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensurePrismaUser } from "@/lib/user-sync";
import { logPlatformError } from "@/lib/platform-log";
import { getAppUrl } from "@/lib/app-url";
import { syncDiscordRoles } from "@/lib/discord";
import { hasPremiumAccess } from "@/lib/auth";
import { logAuthEvent } from "@/lib/auth-log";
import { warmDbConnection, withDbRetry } from "@/lib/db";
import { getCachedUserBySupabaseId } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeNextPath(next: string | null, locale: string): string {
  const fallback = `/${locale}/dashboard`;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const locale = url.searchParams.get("locale") ?? "en";
  const origin = getAppUrl();
  const destination = safeNextPath(next, locale);

  if (!code) {
    logAuthEvent("callback_missing_code", { locale }, "warn");
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_missing_code`);
  }

  try {
    await warmDbConnection();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      logAuthEvent("callback_exchange_failed", { message: error?.message }, "error");
      return NextResponse.redirect(`${origin}/${locale}/login?error=auth_exchange`);
    }

    logAuthEvent("callback_exchange_ok", { userId: data.user.id });

    let dbUser = null;
    try {
      dbUser = await withDbRetry(
        () => ensurePrismaUser(data.user),
        { retries: 5, delayMs: 300, label: "auth:callback-sync" }
      );
    } catch (syncErr) {
      void logPlatformError("auth:callback-sync", syncErr);
      logAuthEvent("callback_sync_failed", { userId: data.user.id }, "error");

      dbUser = await withDbRetry(
        () => getCachedUserBySupabaseId(data.user.id),
        { retries: 2, label: "auth:callback-fallback" }
      );

      if (!dbUser) {
        return NextResponse.redirect(`${origin}/${locale}/login?error=db_sync`);
      }
      logAuthEvent("callback_sync_recovered", { userId: data.user.id }, "warn");
    }

    if (dbUser?.discordId) {
      const roles: string[] = [];
      if (hasPremiumAccess(dbUser)) roles.push("premium");
      if (dbUser.role === "CREATOR") roles.push("creator");
      if (["MODERATOR", "ADMIN", "OWNER"].includes(dbUser.role)) roles.push("moderator");
      void syncDiscordRoles(dbUser.discordId, roles);
    }

    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    void logPlatformError("auth:callback", err);
    logAuthEvent("callback_fatal", { message: err instanceof Error ? err.message : String(err) }, "error");
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_callback`);
  }
}
