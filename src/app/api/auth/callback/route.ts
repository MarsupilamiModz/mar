import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensurePrismaUser } from "@/lib/user-sync";
import { logPlatformError } from "@/lib/platform-log";
import { getAppUrl } from "@/lib/app-url";
import { syncDiscordRoles } from "@/lib/discord";
import { hasPremiumAccess } from "@/lib/auth";

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
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_missing_code`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("[auth/callback] exchange failed", error);
      return NextResponse.redirect(`${origin}/${locale}/login?error=auth_exchange`);
    }

    try {
      const dbUser = await ensurePrismaUser(data.user);
      if (dbUser?.discordId) {
        const roles: string[] = [];
        if (hasPremiumAccess(dbUser)) roles.push("premium");
        if (dbUser.role === "CREATOR") roles.push("creator");
        if (["MODERATOR", "ADMIN", "OWNER"].includes(dbUser.role)) roles.push("moderator");
        void syncDiscordRoles(dbUser.discordId, roles);
      }
    } catch (syncErr) {
      void logPlatformError("auth:callback-sync", syncErr);
      console.error("[auth/callback] prisma sync failed", syncErr);
      return NextResponse.redirect(
        `${origin}/${locale}/login?error=db_sync`
      );
    }

    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    void logPlatformError("auth:callback", err);
    console.error("[auth/callback]", err);
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_callback`);
  }
}
