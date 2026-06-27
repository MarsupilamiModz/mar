import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type Attachment,
} from "discord.js";
import { prisma } from "@/lib/db";
import { inferImportTypeFromChannelName } from "@/lib/discord-import/parser";
import { processDiscordImportMessage } from "@/lib/discord-import/processor";
import type { DiscordImportType } from "@prisma/client";

function attachmentInput(att: Attachment) {
  return {
    id: att.id,
    url: att.url,
    fileName: att.name ?? `file-${att.id}`,
    contentType: att.contentType,
    size: att.size,
  };
}

async function loadWatchedChannels() {
  return prisma.discordImportChannel.findMany({
    where: { enabled: true, guild: { enabled: true, botConnected: true } },
    include: { guild: true },
  });
}

async function handleMessage(message: Message) {
  if (message.author.bot) return;
  if (!message.guildId) return;

  const channels = await loadWatchedChannels();
  const config = channels.find(
    (c) => c.channelId === message.channelId && c.guild.guildId === message.guildId
  );
  if (!config) return;

  const importType: DiscordImportType =
    config.importType ??
    inferImportTypeFromChannelName(config.channelName) ??
    (message.channel.isTextBased() && "name" in message.channel
      ? inferImportTypeFromChannelName(message.channel.name ?? "")
      : null) ??
    "MOD";

  if (!message.content.trim() && message.attachments.size === 0) return;

  await processDiscordImportMessage({
    messageId: message.id,
    guildId: message.guildId,
    channelId: message.channelId,
    channelName:
      config.channelName ||
      (message.channel.isTextBased() && "name" in message.channel
        ? message.channel.name ?? "unknown"
        : "unknown"),
    content: message.content,
    authorId: message.author.id,
    authorName: message.author.username,
    attachments: Array.from(message.attachments.values()).map(attachmentInput),
    importType,
    gameSlug: config.gameSlug,
    gameId: config.gameId,
    modeId: config.modeId,
  });

  await prisma.discordImportChannel.update({
    where: { id: config.id },
    data: { lastMessageId: message.id },
  });
}

export async function startDiscordImportBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN missing");
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once("ready", async () => {
    console.log(`[discord-import-bot] Logged in as ${client.user?.tag}`);
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      await prisma.discordImportGuild.upsert({
        where: { guildId },
        create: {
          guildId,
          guildName: client.guilds.cache.get(guildId)?.name ?? "Discord Server",
          botConnected: true,
          enabled: true,
        },
        update: {
          botConnected: true,
          guildName: client.guilds.cache.get(guildId)?.name ?? undefined,
        },
      });
    }
  });

  client.on("messageCreate", (msg) => {
    void handleMessage(msg).catch((err) => {
      console.error("[discord-import-bot] message handler error", err);
    });
  });

  await client.login(token);
  return client;
}
