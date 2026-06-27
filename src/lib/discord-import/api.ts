const DISCORD_API = "https://discord.com/api/v10";

function botHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN not configured");
  return { Authorization: `Bot ${token}` };
}

export type DiscordGuildChannel = {
  id: string;
  name: string;
  type: number;
};

export async function fetchDiscordGuild(guildId: string) {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: botHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error(
      `Discord guild fetch failed (404). Bot is not in this server or DISCORD_GUILD_ID is wrong. ` +
        `Set DISCORD_GUILD_ID to your server ID (Developer Mode → right-click server → Copy Server ID). ` +
        `Attempted: ${guildId}`
    );
  }
  if (!res.ok) throw new Error(`Discord guild fetch failed (${res.status})`);
  return res.json() as Promise<{ id: string; name: string; icon: string | null }>;
}

export async function fetchDiscordGuildChannels(guildId: string): Promise<DiscordGuildChannel[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: botHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error(
      `Discord channels fetch failed (404). Wrong guild ID or bot not in server. Guild: ${guildId}`
    );
  }
  if (!res.ok) throw new Error(`Discord channels fetch failed (${res.status})`);
  const channels = (await res.json()) as DiscordGuildChannel[];
  return channels.filter((c) => c.type === 0).sort((a, b) => a.name.localeCompare(b.name));
}

export async function probeDiscordImportBot(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, detail: "DISCORD_BOT_TOKEN missing" };
  }
  try {
    const res = await fetch(`${DISCORD_API}/users/@me`, {
      headers: botHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, detail: `Bot token rejected (${res.status})` };
    const data = (await res.json()) as { username: string };
    return { ok: true, detail: `Bot online (${data.username})` };
  } catch {
    return { ok: false, detail: "Discord API unreachable" };
  }
}
