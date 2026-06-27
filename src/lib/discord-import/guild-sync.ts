import { prisma } from "@/lib/db";

export async function resolveActiveGuildId(): Promise<string | null> {
  const fromDb = await prisma.discordImportGuild.findFirst({
    where: { botConnected: true, enabled: true },
    orderBy: { updatedAt: "desc" },
    select: { guildId: true },
  });
  if (fromDb) return fromDb.guildId;

  const envId = process.env.DISCORD_GUILD_ID?.trim();
  return envId || null;
}

export async function syncDiscordGuildFromBot(input: {
  guildId: string;
  guildName: string;
  iconUrl?: string | null;
}) {
  return prisma.discordImportGuild.upsert({
    where: { guildId: input.guildId },
    create: {
      guildId: input.guildId,
      guildName: input.guildName,
      iconUrl: input.iconUrl ?? null,
      botConnected: true,
      enabled: true,
    },
    update: {
      guildName: input.guildName,
      iconUrl: input.iconUrl ?? undefined,
      botConnected: true,
    },
  });
}

export async function syncAllGuildsFromBot(
  guilds: { id: string; name: string; icon: string | null }[]
) {
  const synced: string[] = [];
  for (const guild of guilds) {
    const iconUrl = guild.icon
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
      : null;
    await syncDiscordGuildFromBot({
      guildId: guild.id,
      guildName: guild.name,
      iconUrl,
    });
    synced.push(`${guild.name} (${guild.id})`);
  }
  return synced;
}
