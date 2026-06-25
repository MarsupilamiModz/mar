export type PartnerDiscordConfig = {
  inviteUrl: string | null;
  serverId: string | null;
  widgetUrl: string | null;
  widgetEnabled: boolean;
  description: string | null;
};

export function resolvePartnerDiscord(profile: {
  discordInviteUrl?: string | null;
  discordServerId?: string | null;
  discordWidgetUrl?: string | null;
  discordWidgetEnabled?: boolean | null;
  discordDescription?: string | null;
}): PartnerDiscordConfig | null {
  const inviteUrl = profile.discordInviteUrl?.trim() || null;
  const serverId = profile.discordServerId?.trim() || null;
  const widgetEnabled = profile.discordWidgetEnabled !== false;
  const widgetUrl =
    profile.discordWidgetUrl?.trim() ||
    (serverId && widgetEnabled
      ? `https://discord.com/widget?id=${serverId}&theme=dark`
      : null);
  const description = profile.discordDescription?.trim() || null;

  if (!inviteUrl && !widgetUrl && !description) return null;
  return { inviteUrl, serverId, widgetUrl, widgetEnabled, description };
}
