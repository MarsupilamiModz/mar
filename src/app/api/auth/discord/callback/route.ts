import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withDbRetry, warmDbConnection } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { syncDiscordRoles } from "@/lib/discord";
import { hasPremiumAccess } from "@/lib/auth";
import { logAuthEvent } from "@/lib/auth-log";
import { logPlatformError } from "@/lib/platform-log";

const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_USER = "https://discord.com/api/users/@me";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const cookieStore = await cookies();
    const savedState = cookieStore.get("discord_oauth_state")?.value;
    const locale = cookieStore.get("discord_oauth_locale")?.value ?? "en";

    if (!code || !state || state !== savedState) {
      logAuthEvent("discord_link_invalid_state", {}, "warn");
      return NextResponse.redirect(`${appUrl}/${locale}/login?error=discord`);
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
      return NextResponse.redirect(`${appUrl}/${locale}/login?error=discord_token`);
    }

    const tokens = await tokenRes.json();
    const userRes = await fetch(DISCORD_USER, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/${locale}/login?error=discord_user`);
    }

    const discordUser = await userRes.json();
    await warmDbConnection();

    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (sessionUser) {
      const dbUser = await withDbRetry(
        () => prisma.user.findUnique({ where: { supabaseId: sessionUser.id } }),
        { label: "discord:link-find" }
      );
      if (dbUser) {
        await withDbRetry(
          () =>
            prisma.user.update({
              where: { id: dbUser.id },
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
      }
      logAuthEvent("discord_linked", { supabaseId: sessionUser.id });
      return NextResponse.redirect(`${appUrl}/${locale}/dashboard/settings?discord=linked`);
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

    return NextResponse.redirect(
      `${appUrl}/${locale}/login?discord=linked&hint=${discordUser.email ?? ""}`
    );
  } catch (err) {
    void logPlatformError("auth:discord-callback", err);
    logAuthEvent("discord_callback_error", { message: err instanceof Error ? err.message : String(err) }, "error");
    const locale = (await cookies()).get("discord_oauth_locale")?.value ?? "en";
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?error=discord`);
  }
}
