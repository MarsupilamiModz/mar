import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDiscordOAuthUrl } from "@/lib/discord";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";
  const state = randomBytes(16).toString("hex");
  const oauthUrl = getDiscordOAuthUrl(state);
  const res = NextResponse.redirect(oauthUrl);
  res.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  });
  res.cookies.set("discord_oauth_locale", locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  });
  return res;
}
