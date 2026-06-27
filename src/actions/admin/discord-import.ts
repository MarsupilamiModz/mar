"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, fail, requireActionUser } from "@/lib/action-utils";
import { createAuditLog } from "@/lib/audit";
import {
  DiscordImportStatus,
  ModStatus,
} from "@prisma/client";
import {
  fetchDiscordGuild,
  fetchDiscordGuildChannels,
} from "@/lib/discord-import/api";
import { notifyDiscordImportReviewed } from "@/lib/discord-import/notifications";
import { z } from "zod";

async function requireOwnerAction() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (user.role !== "OWNER") return { user: null as never, error: fail("Owner access only") };
  return { user, error: null };
}

export async function getDiscordImportCenterData() {
  const { error } = await requireOwnerAction();
  if (error) return error;

  const [
    guilds,
    channels,
    rules,
    queue,
    stats,
    mappings,
    games,
  ] = await Promise.all([
    prisma.discordImportGuild.findMany({ orderBy: { guildName: "asc" } }),
    prisma.discordImportChannel.findMany({
      include: { guild: true },
      orderBy: { channelName: "asc" },
    }),
    prisma.discordImportRule.findMany({ include: { guild: true }, orderBy: { name: "asc" } }),
    prisma.discordImportEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        authorUser: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        mod: { select: { id: true, slug: true, title: true, status: true } },
        files: true,
        reviewedBy: { select: { username: true } },
      },
    }),
    getImportStats(),
    prisma.user.findMany({
      where: { discordId: { not: null } },
      select: {
        id: true,
        username: true,
        displayName: true,
        discordId: true,
        discordUsername: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: { username: "asc" },
      take: 200,
    }),
    prisma.game.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  let discordChannels: { id: string; name: string }[] = [];
  const guildId = process.env.DISCORD_GUILD_ID;
  if (guildId && process.env.DISCORD_BOT_TOKEN) {
    try {
      discordChannels = await fetchDiscordGuildChannels(guildId);
    } catch {
      discordChannels = [];
    }
  }

  return ok({ guilds, channels, rules, queue, stats, mappings, games, discordChannels, guildId });
}

async function getImportStats() {
  const [total, mods, sounds, collections, news, failed, last, approved] = await Promise.all([
    prisma.discordImportEntry.count(),
    prisma.discordImportEntry.count({ where: { importType: "MOD" } }),
    prisma.discordImportEntry.count({ where: { importType: "SOUND" } }),
    prisma.discordImportEntry.count({ where: { importType: "COLLECTION" } }),
    prisma.discordImportEntry.count({ where: { importType: "NEWS" } }),
    prisma.discordImportEntry.count({ where: { status: "FAILED" } }),
    prisma.discordImportEntry.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.discordImportEntry.count({ where: { status: "APPROVED" } }),
  ]);

  const successRate = total > 0 ? Math.round((approved / total) * 100) : 100;

  return {
    total,
    mods,
    sounds,
    collections,
    news,
    failed,
    lastImportAt: last?.createdAt ?? null,
    successRate,
    pending: await prisma.discordImportEntry.count({ where: { status: "PENDING_REVIEW" } }),
  };
}

export async function connectDiscordGuild() {
  const { user, error } = await requireOwnerAction();
  if (error) return error;

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return fail("DISCORD_GUILD_ID not configured");

  try {
    const guild = await fetchDiscordGuild(guildId);
    const iconUrl = guild.icon
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
      : null;

    const record = await prisma.discordImportGuild.upsert({
      where: { guildId },
      create: {
        guildId,
        guildName: guild.name,
        iconUrl,
        botConnected: true,
        enabled: true,
      },
      update: { guildName: guild.name, iconUrl, botConnected: true },
    });

    await createAuditLog({
      actorId: user.id,
      action: "discord.import.guild.connect",
      entityType: "DiscordImportGuild",
      entityId: record.id,
    });

    revalidatePath("/owner/discord-import");
    return ok(record);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to connect guild");
  }
}

const channelSchema = z.object({
  guildRecordId: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  importType: z.enum(["MOD", "SOUND", "COLLECTION", "NEWS", "GALLERY"]),
  gameSlug: z.string().optional(),
  gameId: z.string().optional(),
  modeId: z.string().optional(),
  enabled: z.boolean().optional(),
});

export async function saveDiscordImportChannel(input: z.infer<typeof channelSchema>) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;
  const parsed = channelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const record = await prisma.discordImportChannel.upsert({
    where: {
      guildRecordId_channelId: {
        guildRecordId: parsed.data.guildRecordId,
        channelId: parsed.data.channelId,
      },
    },
    create: parsed.data,
    update: parsed.data,
  });

  await createAuditLog({
    actorId: user.id,
    action: "discord.import.channel.save",
    entityType: "DiscordImportChannel",
    entityId: record.id,
  });

  revalidatePath("/owner/discord-import");
  return ok(record);
}

export async function deleteDiscordImportChannel(id: string) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;
  await prisma.discordImportChannel.delete({ where: { id } });
  await createAuditLog({
    actorId: user.id,
    action: "discord.import.channel.delete",
    entityType: "DiscordImportChannel",
    entityId: id,
  });
  revalidatePath("/owner/discord-import");
  return ok(undefined);
}

const ruleSchema = z.object({
  guildRecordId: z.string(),
  name: z.string().min(1),
  pattern: z.string().min(1),
  importType: z.enum(["MOD", "SOUND", "COLLECTION", "NEWS", "GALLERY"]).optional(),
  gameSlug: z.string().optional(),
  enabled: z.boolean().optional(),
});

export async function saveDiscordImportRule(input: z.infer<typeof ruleSchema>) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const record = await prisma.discordImportRule.create({ data: parsed.data });
  await createAuditLog({
    actorId: user.id,
    action: "discord.import.rule.save",
    entityType: "DiscordImportRule",
    entityId: record.id,
  });
  revalidatePath("/owner/discord-import");
  return ok(record);
}

export async function deleteDiscordImportRule(id: string) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;
  await prisma.discordImportRule.delete({ where: { id } });
  revalidatePath("/owner/discord-import");
  return ok(undefined);
}

const reviewSchema = z.object({
  entryId: z.string(),
  action: z.enum(["approve", "reject"]),
  title: z.string().optional(),
  description: z.string().optional(),
  authorUserId: z.string().optional(),
  gameId: z.string().optional(),
  modeId: z.string().optional(),
});

export async function reviewDiscordImport(input: z.infer<typeof reviewSchema>) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const entry = await prisma.discordImportEntry.findUnique({
    where: { id: parsed.data.entryId },
    include: { mod: true },
  });
  if (!entry) return fail("Import entry not found");

  const approved = parsed.data.action === "approve";
  const status: DiscordImportStatus = approved ? "APPROVED" : "REJECTED";

  await prisma.discordImportEntry.update({
    where: { id: entry.id },
    data: {
      status,
      reviewedById: user.id,
      reviewedAt: new Date(),
      title: parsed.data.title ?? entry.title,
      description: parsed.data.description ?? entry.description,
      authorUserId: parsed.data.authorUserId ?? entry.authorUserId,
      gameId: parsed.data.gameId ?? entry.gameId,
      modeId: parsed.data.modeId ?? entry.modeId,
    },
  });

  if (entry.modId && entry.mod) {
    await prisma.mod.update({
      where: { id: entry.modId },
      data: {
        status: approved ? ModStatus.PENDING : ModStatus.REJECTED,
        title: parsed.data.title ?? entry.mod.title,
        description: parsed.data.description ?? entry.mod.description,
        authorId: parsed.data.authorUserId ?? entry.mod.authorId,
        gameId: parsed.data.gameId ?? entry.mod.gameId,
        modeId: parsed.data.modeId ?? entry.mod.modeId,
      },
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: approved ? "discord.import.approve" : "discord.import.reject",
    entityType: "DiscordImportEntry",
    entityId: entry.id,
  });

  void notifyDiscordImportReviewed({
    entryId: entry.id,
    title: parsed.data.title ?? entry.title ?? "Import",
    approved,
    authorUserId: parsed.data.authorUserId ?? entry.authorUserId,
  });

  revalidatePath("/owner/discord-import");
  return ok(undefined);
}

export async function updateDiscordImportScanStatus(
  entryId: string,
  scanStatus: "CLEAN" | "SUSPICIOUS" | "MANUAL_REVIEW"
) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;

  await prisma.discordImportEntry.update({
    where: { id: entryId },
    data: { scanStatus },
  });

  await createAuditLog({
    actorId: user.id,
    action: "discord.import.scan.override",
    entityType: "DiscordImportEntry",
    entityId: entryId,
    metadata: { scanStatus },
  });

  revalidatePath("/owner/discord-import");
  return ok(undefined);
}

export async function assignDiscordImportAuthor(entryId: string, authorUserId: string) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;

  const entry = await prisma.discordImportEntry.update({
    where: { id: entryId },
    data: { authorUserId },
    include: { mod: true },
  });

  if (entry.modId) {
    await prisma.mod.update({ where: { id: entry.modId }, data: { authorId: authorUserId } });
  }

  await createAuditLog({
    actorId: user.id,
    action: "discord.import.author.assign",
    entityType: "DiscordImportEntry",
    entityId: entryId,
    metadata: { authorUserId },
  });

  revalidatePath("/owner/discord-import");
  return ok(undefined);
}
