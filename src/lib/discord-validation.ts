import "server-only";

const INVITE_PATTERN = /^https?:\/\/(discord\.gg|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+$/i;
const SERVER_ID_PATTERN = /^\d{17,20}$/;

export function normalizeDiscordInviteUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!INVITE_PATTERN.test(value)) return null;
  return value;
}

export function normalizeDiscordServerId(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!SERVER_ID_PATTERN.test(value)) return null;
  return value;
}

export type DiscordWidgetValidation = {
  ok: boolean;
  error?: string;
  name?: string;
  presenceCount?: number;
};

export async function validateDiscordWidget(serverId: string): Promise<DiscordWidgetValidation> {
  const id = normalizeDiscordServerId(serverId);
  if (!id) {
    return { ok: false, error: "Invalid Discord Server ID (17–20 digits)" };
  }

  try {
    const res = await fetch(`https://discord.com/api/guilds/${id}/widget.json`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 403
            ? "Discord widget is disabled for this server. Enable it in Server Settings → Widget."
            : "Discord widget is not reachable for this server ID.",
      };
    }
    const data = (await res.json()) as { name?: string; presence_count?: number };
    return { ok: true, name: data.name, presenceCount: data.presence_count };
  } catch {
    return { ok: false, error: "Could not reach Discord widget API." };
  }
}

export async function validatePartnerDiscordInput(input: {
  discordInviteUrl?: string | null;
  discordServerId?: string | null;
  discordWidgetEnabled?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.discordInviteUrl) {
    const invite = normalizeDiscordInviteUrl(input.discordInviteUrl);
    if (!invite) {
      return { ok: false, error: "Invalid Discord invite link. Use https://discord.gg/… or discord.com/invite/…" };
    }
  }

  if (input.discordWidgetEnabled !== false && input.discordServerId) {
    const widget = await validateDiscordWidget(input.discordServerId);
    if (!widget.ok) return { ok: false, error: widget.error ?? "Discord widget validation failed" };
  }

  return { ok: true };
}
