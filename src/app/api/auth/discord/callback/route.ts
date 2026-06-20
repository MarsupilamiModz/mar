import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withDbRetry, warmDbConnection } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { syncDiscordRoles } from "@/lib/discord";
import { hasPremiumAccess } from "@/lib/auth";
import { logAuthEvent } from "@/lib/auth-log";
import { logPlatformError } from "@/lib/platform-log";
import { getAppUrl } from "@/lib/app-url";
import { invalidateUserSessionCache } from "@/lib/auth-cache";
import { findAppUserBySupabaseId, ensurePrismaUser } from "@/lib/user-sync";
import { persistAuthAudit } from "@/lib/auth-audit";

const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_USER = "https://discord.com/api/users/@me";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clearDiscordOAuthCookies(response: NextResponse) {
  response.cookies.set("discord_oauth_state", "", { maxAge: 0, path: "/" });
  response.cookies.set("discord_oauth_locale", "", { maxAge: 0, path: "/" });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appUrl = getAppUrl();

  try {
    const cookieStore = await cookies();
    const savedState = cookieStore.get("discord_oauth_state")?.value;
    const locale = cookieStore.get("discord_oauth_locale")?.value ?? "en";

    if (!code || !state || state !== savedState) {
      logAuthEvent("discord_link_invalid_state", {}, "warn");
      void persistAuthAudit("auth.discord_invalid_state");
      const res = NextResponse.redirect(`${appUrl}/${locale}/login?error=discord`);
      clearDiscordOAuthCookies(res);
      return res;
    }

    const tokenRes = await fetch(DISCORD_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${appUrl}/api/auth/discord/callback`,
      }),
    });

    if (!tokenRes.ok) {
      void persistAuthAudit("auth.discord_token_failed");
      const res = NextResponse.redirect(`${appUrl}/${locale}/login?error=discord_token`);
      clearDiscordOAuthCookies(res);
      return res;
    }

    const tokens = await tokenRes.json();
    const userRes = await fetch(DISCORD_USER, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      void persistAuthAudit("auth.discord_user_failed");
      const res = NextResponse.redirect(`${appUrl}/${locale}/login?error=discord_user`);
      clearDiscordOAuthCookies(res);
      return res;
    }

    const discordUser = await userRes.json();
    await warmDbConnection();

    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (sessionUser) {
      invalidateUserSessionCache(sessionUser.id);

      let dbUser = await withDbRetry(
        () => findAppUserBySupabaseId(sessionUser.id),
        { label: "discord:link-find" }
      );
      if (!dbUser) {
        dbUser = await withDbRetry(
          () => ensurePrismaUser(sessionUser),
          { label: "discord:link-sync" }
        );
      }

      if (!dbUser) {
        logAuthEvent("discord_link_no_prisma_user", { supabaseId: sessionUser.id }, "error");
        void persistAuthAudit("auth.discord_link_no_user", { supabaseId: sessionUser.id });
        const res = NextResponse.redirect(`${appUrl}/${locale}/dashboard/settings?discord=failed`);
        clearDiscordOAuthCookies(res);
        return res;
      }

      await withDbRetry(
        () =>
          prisma.user.update({
            where: { id: dbUser!.id },
            data: {
              discordId: discordUser.id,
              discordUsername: discordUser.username,
            },
          }),
        { label: "discord:link-update" }
      );
      const roles: string[] = [];
      if (hasPremiumAccess({ role: dbUser.role, subscriptions: [] })) roles.push("premium");
      if (dbUser.role === "CREATOR") roles.push("creator");
      if (["MODERATOR", "ADMIN", "OWNER"].includes(dbUser.role)) roles.push("moderator");
      void syncDiscordRoles(discordUser.id, roles);

      logAuthEvent("discord_linked", { supabaseId: sessionUser.id });
      void persistAuthAudit("auth.discord_linked", { userId: dbUser.id });
      const res = NextResponse.redirect(`${appUrl}/${locale}/dashboard/settings?discord=linked`);
      clearDiscordOAuthCookies(res);
      return res;
    }

    let dbUser = await withDbRetry(
      () => prisma.user.findUnique({ where: { discordId: discordUser.id } }),
      { label: "discord:find-id" }
    );
    if (!dbUser && discordUser.email) {
      dbUser = await withDbRetry(
        () => prisma.user.findUnique({ where: { email: discordUser.email } }),
        { label: "discord:find-email" }
      );
    }

    if (dbUser) {
      await withDbRetry(
        () =>
          prisma.user.update({
            where: { id: dbUser!.id },
            data: {
              discordId: discordUser.id,
              discordUsername: discordUser.username,
            },
          }),
        { label: "discord:update-anon" }
      );
    }

    const res = NextResponse.redirect(
      `${appUrl}/${locale}/login?discord=linked&hint=${encodeURIComponent(discordUser.email ?? "")}`
    );
    clearDiscordOAuthCookies(res);
    return res;
  } catch (err) {
    void logPlatformError("auth:discord-callback", err);
    logAuthEvent("discord_callback_error", { message: err instanceof Error ? err.message : String(err) }, "error");
    void persistAuthAudit("auth.discord_callback_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    const locale = (await cookies()).get("discord_oauth_locale")?.value ?? "en";
    const res = NextResponse.redirect(`${getAppUrl()}/${locale}/login?error=discord`);
    clearDiscordOAuthCookies(res);
    return res;
  }
}
