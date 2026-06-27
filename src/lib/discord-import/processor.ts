import "server-only";

import {
  DiscordImportScanStatus,
  DiscordImportType,
  ModStatus,
  ProductType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { fileSizeBigInt } from "@/lib/file-size";
import { modFileKey, hashObjectFromR2, uploadToR2 } from "@/lib/r2";
import { enqueueScan, getCreatorScanPriority } from "@/lib/security/scan-queue";
import { probeAudioFromStorage } from "@/lib/audio-probe";
import { createAuditLog } from "@/lib/audit";
import {
  classifyAttachment,
  parseDiscordMessageContent,
  channelNameToGameSlug,
} from "@/lib/discord-import/parser";
import {
  downloadDiscordAttachment,
  generateRoughWaveformPeaks,
  type DiscordAttachmentInput,
} from "@/lib/discord-import/storage";
import { notifyDiscordImportStaff } from "@/lib/discord-import/notifications";

export type DiscordMessagePayload = {
  messageId: string;
  guildId: string;
  channelId: string;
  channelName: string;
  content: string;
  authorId: string;
  authorName: string;
  attachments: DiscordAttachmentInput[];
  importType: DiscordImportType;
  gameSlug?: string | null;
  gameId?: string | null;
  modeId?: string | null;
};

async function resolveAuthorUserId(discordAuthorId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { discordId: discordAuthorId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolveFallbackAuthorId(): Promise<string> {
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER", deletedAt: null },
    select: { id: true },
  });
  if (owner) return owner.id;
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  if (!anyUser) throw new Error("No users in database for Discord import fallback author");
  return anyUser.id;
}

async function resolveGame(gameId?: string | null, gameSlug?: string | null) {
  if (gameId) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (game) return game;
  }
  if (gameSlug) {
    const game = await prisma.game.findFirst({ where: { slug: gameSlug, isActive: true } });
    if (game) return game;
  }
  return prisma.game.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

async function uniqueModSlug(base: string) {
  let s = slugify(base) || "import";
  let i = 0;
  while (await prisma.mod.findUnique({ where: { slug: s } })) {
    s = `${slugify(base) || "import"}-${++i}`;
  }
  return s;
}

export async function processDiscordImportMessage(payload: DiscordMessagePayload) {
  const existing = await prisma.discordImportEntry.findUnique({
    where: { messageId: payload.messageId },
  });
  if (existing) return existing;

  const parsed = parseDiscordMessageContent(payload.content, payload.importType);
  const slugFromChannel = channelNameToGameSlug(payload.channelName);
  const authorUserId = (await resolveAuthorUserId(payload.authorId)) ?? (await resolveFallbackAuthorId());
  const game = await resolveGame(payload.gameId, payload.gameSlug ?? slugFromChannel);

  const entry = await prisma.discordImportEntry.create({
    data: {
      guildId: payload.guildId,
      channelId: payload.channelId,
      messageId: payload.messageId,
      importType: parsed.importType,
      status: "PROCESSING",
      scanStatus: "PENDING",
      title: parsed.title,
      description: parsed.description || null,
      tags: parsed.tags,
      discordAuthorId: payload.authorId,
      discordAuthorName: payload.authorName,
      authorUserId,
      gameId: game?.id ?? null,
      modeId: payload.modeId ?? null,
      metadata: {
        links: parsed.links,
        referencedFiles: parsed.referencedFiles,
        channelName: payload.channelName,
      },
    },
  });

  try {
    const storedFiles = [];
    for (const att of payload.attachments) {
      const stored = await downloadDiscordAttachment(att, entry.id);
      storedFiles.push({
        ...stored,
        role: classifyAttachment(stored.fileName, parsed.importType),
        size: att.size,
      });
    }

    let modId: string | null = null;
    let scanStatus: DiscordImportScanStatus = "PENDING";

    if (parsed.importType === "MOD" || parsed.importType === "SOUND") {
      const productType: ProductType = parsed.importType === "SOUND" ? "SOUND" : "MOD";
      const modSlug = await uniqueModSlug(parsed.title);

      const mod = await prisma.mod.create({
        data: {
          slug: modSlug,
          title: parsed.title,
          description: parsed.description || "Imported from Discord — pending review.",
          shortDescription: parsed.description?.slice(0, 280) ?? null,
          gameId: game!.id,
          modeId: payload.modeId ?? null,
          authorId: authorUserId,
          productType,
          status: ModStatus.DRAFT,
          tags: parsed.tags.length
            ? { create: parsed.tags.map((name) => ({ name })) }
            : undefined,
        },
      });
      modId = mod.id;

      const primary = storedFiles.find((f) => f.role === "primary") ?? storedFiles[0];
      if (primary && productType === "MOD") {
        const versionKey = modFileKey(mod.slug, "1.0.0", primary.fileName);
        await uploadToR2(versionKey, primary.buffer, primary.mimeType);
        const sha256Result = await hashObjectFromR2(versionKey);
        const version = await prisma.modVersion.create({
          data: {
            modId: mod.id,
            version: "1.0.0",
            fileKey: versionKey,
            fileSize: fileSizeBigInt(primary.size ?? primary.buffer.length),
            fileName: primary.fileName,
            originalFileName: primary.fileName,
            mimeType: primary.mimeType,
            sha256: sha256Result.sha256,
            isPrimary: true,
            scanStatus: "PENDING",
          },
        });
        const creatorProfile = await prisma.creatorProfile.findUnique({
          where: { userId: authorUserId },
          select: { id: true },
        });
        await enqueueScan({
          modVersionId: version.id,
          modId: mod.id,
          fileKey: versionKey,
          fileName: primary.fileName,
          fileSize: version.fileSize,
          sha256: sha256Result.sha256,
          priority: await getCreatorScanPriority(creatorProfile?.id),
        });
        scanStatus = "SCANNING";
      }

      if (productType === "SOUND") {
        const audioFile =
          storedFiles.find((f) => f.role === "primary" || f.role === "audio") ?? storedFiles[0];
        if (audioFile) {
          const previewKey = modFileKey(mod.slug, "preview", audioFile.fileName);
          await uploadToR2(previewKey, audioFile.buffer, audioFile.mimeType);
          const meta = await probeAudioFromStorage(
            previewKey,
            audioFile.fileName,
            audioFile.mimeType,
            audioFile.size ?? audioFile.buffer.length
          );
          const waveformPeaks = generateRoughWaveformPeaks(audioFile.buffer);
          await prisma.soundProfile.create({
            data: {
              modId: mod.id,
              previewFileKey: previewKey,
              previewFileName: audioFile.fileName,
              previewFileSize: fileSizeBigInt(audioFile.size ?? audioFile.buffer.length),
              previewDurationSeconds: meta.durationSeconds,
              durationSeconds: meta.durationSeconds,
              previewMimeType: meta.mimeType ?? audioFile.mimeType,
              previewBitrateKbps: meta.bitrateKbps,
              waveformPeaks,
              audioCategory: "CUSTOM_AUDIO",
            },
          });
        }
      }

      const screenshots = storedFiles.filter((f) => f.role === "screenshot");
      for (let i = 0; i < screenshots.length; i++) {
        await prisma.modMedia.create({
          data: {
            modId: mod.id,
            mediaType: "IMAGE",
            imageUrl: screenshots[i].publicUrl,
            orderIndex: i,
            isFeatured: i === 0,
          },
        });
      }
    }

    await prisma.discordImportFile.createMany({
      data: storedFiles.map((f) => ({
        entryId: entry.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        fileSize: f.size != null ? fileSizeBigInt(f.size) : fileSizeBigInt(f.buffer.length),
        r2Key: f.r2Key,
        publicUrl: f.publicUrl,
        role: f.role,
        scanStatus: "PENDING" as const,
      })),
    });

    const updated = await prisma.discordImportEntry.update({
      where: { id: entry.id },
      data: {
        modId,
        status: "PENDING_REVIEW",
        scanStatus,
      },
    });

    await createAuditLog({
      actorId: authorUserId,
      action: "discord.import.created",
      entityType: "DiscordImportEntry",
      entityId: entry.id,
      metadata: {
        messageId: payload.messageId,
        importType: parsed.importType,
        discordAuthorId: payload.authorId,
      },
    });

    void notifyDiscordImportStaff({
      entryId: entry.id,
      title: parsed.title,
      importType: parsed.importType,
      success: true,
    });

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    await prisma.discordImportEntry.update({
      where: { id: entry.id },
      data: { status: "FAILED", errorMessage: message, scanStatus: "SUSPICIOUS" },
    });
    void notifyDiscordImportStaff({
      entryId: entry.id,
      title: parsed.title,
      importType: parsed.importType,
      success: false,
      error: message,
    });
    throw err;
  }
}
