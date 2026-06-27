import "server-only";

import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import { getAppUrl } from "@/lib/app-url";
import { getMediaUrl } from "@/lib/media-url";
import { SITE } from "@/lib/site";

export type DiscordChannelId =
  | "revo"
  | "gta5"
  | "ragemp"
  | "fivem"
  | "minecraft"
  | "news"
  | "general";

export type DiscordWebhookChannel = {
  id: DiscordChannelId;
  label: string;
  webhookUrl: string;
  embedColor: number;
  enabled: boolean;
};

export type DiscordAutomationTriggers = {
  modUpload: boolean;
  soundUpload: boolean;
  collectionUpload: boolean;
  news: boolean;
  premiumPurchase: boolean;
};

export type DiscordAutomationSettings = {
  defaultChannelId: DiscordChannelId;
  channels: DiscordWebhookChannel[];
  triggers: DiscordAutomationTriggers;
};

export const DISCORD_CHANNEL_PRESETS: { id: DiscordChannelId; label: string }[] = [
  { id: "revo", label: "Revo" },
  { id: "gta5", label: "GTA V" },
  { id: "ragemp", label: "RageMP" },
  { id: "fivem", label: "FiveM" },
  { id: "minecraft", label: "Minecraft" },
  { id: "news", label: "News" },
  { id: "general", label: "General" },
];

const SETTINGS_KEY = "discord_automation";

const DEFAULT_SETTINGS: DiscordAutomationSettings = {
  defaultChannelId: "general",
  channels: DISCORD_CHANNEL_PRESETS.map((c) => ({
    id: c.id,
    label: c.label,
    webhookUrl: "",
    embedColor: 0xa855f7,
    enabled: false,
  })),
  triggers: {
    modUpload: true,
    soundUpload: true,
    collectionUpload: true,
    news: true,
    premiumPurchase: true,
  },
};

export async function getDiscordAutomationSettings(): Promise<DiscordAutomationSettings> {
  return getSiteSetting(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export async function saveDiscordAutomationSettings(settings: DiscordAutomationSettings) {
  return setSiteSettingSafe(SETTINGS_KEY, settings);
}

function resolveWebhook(settings: DiscordAutomationSettings, channelId?: DiscordChannelId) {
  const id = channelId ?? settings.defaultChannelId;
  const channel = settings.channels.find((c) => c.id === id && c.enabled && c.webhookUrl.trim());
  if (channel) return channel;
  const fallback = settings.channels.find((c) => c.enabled && c.webhookUrl.trim());
  if (fallback) return fallback;
  const envUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (envUrl) {
    return {
      id: "general" as DiscordChannelId,
      label: "Env fallback",
      webhookUrl: envUrl,
      embedColor: 0xa855f7,
      enabled: true,
    };
  }
  return null;
}

export async function sendDiscordEmbed(
  payload: {
    title: string;
    description: string;
    url?: string;
    color?: number;
    thumbnailUrl?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
  },
  channelId?: DiscordChannelId
) {
  const settings = await getDiscordAutomationSettings();
  const channel = resolveWebhook(settings, channelId);
  if (!channel) return { ok: false as const, error: "No Discord webhook configured" };

  const res = await fetch(channel.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: payload.title,
          description: payload.description,
          url: payload.url,
          color: payload.color ?? channel.embedColor,
          thumbnail: payload.thumbnailUrl ? { url: payload.thumbnailUrl } : undefined,
          fields: payload.fields,
          timestamp: new Date().toISOString(),
          footer: { text: SITE.name },
        },
      ],
    }),
  }).catch(() => null);

  if (!res?.ok) {
    return { ok: false as const, error: `Discord webhook failed (${res?.status ?? "network"})` };
  }
  return { ok: true as const };
}

export async function notifyDiscordModPublished(modId: string) {
  const settings = await getDiscordAutomationSettings();
  if (!settings.triggers.modUpload) return;

  const { prisma } = await import("@/lib/db");
  const mod = await prisma.mod.findUnique({
    where: { id: modId },
    select: {
      title: true,
      slug: true,
      shortDescription: true,
      productType: true,
      game: { select: { name: true } },
      author: { select: { username: true, displayName: true } },
      media: { where: { isFeatured: true }, take: 1, select: { imageUrl: true } },
    },
  });
  if (!mod) return;

  const appUrl = getAppUrl();
  const thumb = getMediaUrl(mod.media[0]?.imageUrl ?? null) ?? undefined;
  const creator = mod.author.displayName ?? mod.author.username;
  const typeLabel = mod.productType === "SOUND" ? "Sound" : "Mod";

  await sendDiscordEmbed({
    title: `New ${typeLabel}: ${mod.title}`,
    description: mod.shortDescription ?? "Now available on the platform.",
    url: `${appUrl}/mods/${mod.slug}`,
    thumbnailUrl: thumb,
    fields: [
      { name: "Game", value: mod.game?.name ?? "—", inline: true },
      { name: "Creator", value: creator, inline: true },
      { name: "Category", value: typeLabel, inline: true },
    ],
  });
}

export async function notifyDiscordPremiumPurchase(input: {
  username: string;
  planName: string;
  amountCents?: number;
}) {
  const settings = await getDiscordAutomationSettings();
  if (!settings.triggers.premiumPurchase) return;

  const amount =
    input.amountCents != null ? `$${(input.amountCents / 100).toFixed(2)}` : "—";

  await sendDiscordEmbed(
    {
      title: "Premium purchase",
      description: `${input.username} subscribed to **${input.planName}**`,
      fields: [{ name: "Amount", value: amount, inline: true }],
      color: 0x22c55e,
    },
    "news"
  );
}

export async function probeDiscordWebhookHealth(): Promise<{ ok: boolean; detail: string }> {
  const settings = await getDiscordAutomationSettings();
  const channel = resolveWebhook(settings);
  if (!channel) {
    return { ok: false, detail: "No webhook URL configured" };
  }

  try {
    const parsed = new URL(channel.webhookUrl);
    if (!parsed.hostname.includes("discord.com")) {
      return { ok: false, detail: "Invalid Discord webhook host" };
    }
    return { ok: true, detail: `Configured (${channel.label})` };
  } catch {
    return { ok: false, detail: "Invalid webhook URL" };
  }
}

export type MediaTemplateSettings = {
  required: { image: boolean; video: boolean; downloadFile: boolean };
  optional: { trailer: boolean; screenshots: boolean; gallery: boolean };
};

const MEDIA_TEMPLATE_KEY = "media_templates";

export async function getMediaTemplateSettings(): Promise<MediaTemplateSettings> {
  return getSiteSetting(MEDIA_TEMPLATE_KEY, {
    required: { image: true, video: false, downloadFile: true },
    optional: { trailer: true, screenshots: true, gallery: true },
  });
}

export async function saveMediaTemplateSettings(settings: MediaTemplateSettings) {
  return setSiteSettingSafe(MEDIA_TEMPLATE_KEY, settings);
}
