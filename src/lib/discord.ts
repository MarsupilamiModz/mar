const DISCORD_API = "https://discord.com/api/v10";

export function getDiscordOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/discord/callback`,
    response_type: "code",
    scope: "identify email guilds.join",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function syncDiscordRoles(discordUserId: string, roles: string[]) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) return;

  const roleIds = roles
    .map((r) => {
      if (r === "premium") return process.env.DISCORD_ROLE_PREMIUM;
      if (r === "creator") return process.env.DISCORD_ROLE_CREATOR;
      if (r === "moderator") return process.env.DISCORD_ROLE_MODERATOR;
      return null;
    })
    .filter(Boolean) as string[];

  for (const roleId of roleIds) {
    await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}` },
    }).catch(() => null);
  }
}

export async function logToDiscordWebhook(payload: {
  title: string;
  description: string;
  color?: number;
}) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: payload.title,
          description: payload.description,
          color: payload.color ?? 0xa855f7,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch(() => null);
}
