import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type Attachment,
} from "discord.js";
import { prisma } from "@/lib/db";
import { inferImportTypeFromChannelName } from "@/lib/discord-import/parser";
import { queueDiscordImportMessage, startImportQueuePoller } from "@/lib/discord-import/queue";
import { syncAllGuildsFromBot } from "@/lib/discord-import/guild-sync";
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
  if (!config) {
    console.info(
      `[discord-import-bot] skip channel ${message.channelId} — not in import list. ` +
        `Add it in Owner → Discord Import → Import channels.`
    );
    return;
  }

  const importType: DiscordImportType =
    config.importType ??
    inferImportTypeFromChannelName(config.channelName) ??
    (message.channel.isTextBased() && "name" in message.channel
      ? inferImportTypeFromChannelName(message.channel.name ?? "")
      : null) ??
    "MOD";

  const hasContent = message.content.trim().length > 0;
  const hasAttachments = message.attachments.size > 0;
  if (!hasContent && !hasAttachments) return;

  await queueDiscordImportMessage({
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

  let readyHandled = false;
  const onReady = async () => {
    if (readyHandled) return;
    readyHandled = true;
    console.log(`[discord-import-bot] Logged in as ${client.user?.tag}`);

    const synced = await syncAllGuildsFromBot(client.guilds.cache.values());
    if (synced.length) {
      console.log(`[discord-import-bot] Synced guild(s): ${synced.join(", ")}`);
      console.log(
        `[discord-import-bot] Set DISCORD_GUILD_ID=${client.guilds.cache.first()?.id ?? "?"} in .env if not set`
      );
    } else {
      console.warn("[discord-import-bot] Bot is not in any Discord server — invite the bot first");
    }

    startImportQueuePoller(3000);
    console.log("[discord-import-bot] Import queue poller started");
  };

  client.once("ready", () => {
    void onReady().catch((err) => console.error("[discord-import-bot] ready handler", err));
  });
  client.once("clientReady", () => {
    void onReady().catch((err) => console.error("[discord-import-bot] clientReady handler", err));
  });

  client.on("messageCreate", (msg) => {
    void handleMessage(msg).catch((err) => {
      console.error("[discord-import-bot] message handler error", err);
    });
  });

  process.on("unhandledRejection", (err) => {
    console.error("[discord-import-bot] unhandledRejection", err);
  });

  await client.login(token);
  return client;
}
