import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { syncDiscordRoles } from "@/lib/discord";
import { hasPremiumAccess } from "@/lib/auth";

const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_USER = "https://discord.com/api/users/@me";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("discord_oauth_state")?.value;
  const locale = cookieStore.get("discord_oauth_locale")?.value ?? "en";

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?error=discord`);
  }

  const tokenRes = await fetch(DISCORD_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/discord/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?error=discord_token`);
  }

  const tokens = await tokenRes.json();
  const userRes = await fetch(DISCORD_USER, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?error=discord_user`);
  }

  const discordUser = await userRes.json();
  const supabase = await createClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (sessionUser) {
    const dbUser = await prisma.user.findUnique({ where: { supabaseId: sessionUser.id } });
    if (dbUser) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          discordId: discordUser.id,
          discordUsername: discordUser.username,
        },
      });
      const roles: string[] = [];
      if (hasPremiumAccess({ role: dbUser.role, subscriptions: [] })) roles.push("premium");
      if (dbUser.role === "CREATOR") roles.push("creator");
      if (["MODERATOR", "ADMIN", "OWNER"].includes(dbUser.role)) roles.push("moderator");
      await syncDiscordRoles(discordUser.id, roles);
    }
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/dashboard/settings?discord=linked`);
  }

  let dbUser = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
  if (!dbUser && discordUser.email) {
    dbUser = await prisma.user.findUnique({ where: { email: discordUser.email } });
  }

  if (dbUser) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
      },
    });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?discord=linked&hint=${discordUser.email ?? ""}`
  );
}
