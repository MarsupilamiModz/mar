import { NextResponse } from "next/server";
import { normalizeDiscordServerId, validateDiscordWidget } from "@/lib/discord-validation";

export const revalidate = 60;

export async function GET(req: Request) {
  const serverId = normalizeDiscordServerId(new URL(req.url).searchParams.get("serverId"));
  if (!serverId) {
    return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
  }

  const result = await validateDiscordWidget(serverId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  try {
    const res = await fetch(`https://discord.com/api/guilds/${serverId}/widget.json`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Widget unavailable" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ error: "Widget fetch failed" }, { status: 502 });
  }
}
