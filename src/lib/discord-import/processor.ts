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
import {
  downloadFromUrl,
  identifyLinkProvider,
  resolveDownloadUrl,
} from "@/lib/discord-import/link-resolver";
import { getDiscordImportSettings } from "@/lib/discord-import/settings";
import { resolveCategoryForImport, resolveGameModeForChannel } from "@/lib/discord-import/categories";
import { isImageFileName, isImageMime, optimizeImageToWebp } from "@/lib/discord-import/image-optimize";
import {
  notifyDiscordImportStaff,
  notifyDiscordVirusDetected,
} from "@/lib/discord-import/notifications";

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

type StoredFile = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  r2Key: string;
  publicUrl: string;
  role: string;
  size?: number;
  sourceUrl?: string;
  sourceProvider?: string;
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

async function storeScreenshot(buffer: Buffer, fileName: string, mimeType: string, entryId: string) {
  if (isImageFileName(fileName) || isImageMime(mimeType)) {
    return optimizeImageToWebp(buffer, entryId, fileName);
  }
  const safeName = fileName.replace(/[^\w.-]/g, "_");
  const r2Key = `xumari/discord-imports/${entryId}/screenshots/${safeName}`;
  await uploadToR2(r2Key, buffer, mimeType);
  const { buildAssetPublicUrl } = await import("@/lib/assets");
  return { buffer, fileName: safeName, mimeType, r2Key, publicUrl: buildAssetPublicUrl(r2Key) };
}

export async function processDiscordImportEntry(entryId: string, payload: DiscordMessagePayload) {
  const parsed = parseDiscordMessageContent(payload.content, payload.importType);
  const slugFromChannel = channelNameToGameSlug(payload.channelName);
  const authorUserId = (await resolveAuthorUserId(payload.authorId)) ?? (await resolveFallbackAuthorId());
  const game = await resolveGame(payload.gameId, payload.gameSlug ?? slugFromChannel);
  if (!game) throw new Error("No active game found for import");

  const modeId =
    payload.modeId ?? (await resolveGameModeForChannel(game.id, payload.channelName)) ?? null;
  const categoryId = await resolveCategoryForImport({
    gameId: game.id,
    channelName: payload.channelName,
    tags: parsed.tags,
    modeId,
  });

  await prisma.discordImportEntry.update({
    where: { id: entryId },
    data: {
      importType: parsed.importType,
      title: parsed.title,
      description: parsed.description || null,
      tags: parsed.tags,
      authorUserId,
      gameId: game.id,
      modeId,
      categoryId,
      metadata: {
        links: parsed.links,
        referencedFiles: parsed.referencedFiles,
        channelName: payload.channelName,
      },
    },
  });

  const settings = await getDiscordImportSettings();
  const storedFiles: StoredFile[] = [];
  let needsLinkReview = false;

  try {
    for (const att of payload.attachments) {
      const stored = await downloadDiscordAttachment(att, entryId);
      const role = classifyAttachment(stored.fileName, parsed.importType);
      if (role === "screenshot" && (isImageFileName(stored.fileName) || isImageMime(stored.mimeType))) {
        const optimized = await storeScreenshot(stored.buffer, stored.fileName, stored.mimeType, entryId);
        storedFiles.push({
          ...optimized,
          role,
          size: att.size,
          sourceProvider: "discord",
        });
      } else {
        storedFiles.push({
          ...stored,
          role,
          size: att.size,
          sourceProvider: "discord",
        });
      }
    }

    for (const link of parsed.links) {
      const provider = identifyLinkProvider(link);
      if (provider === "linkvertise" && !settings.allowLinkvertise) {
        needsLinkReview = true;
        continue;
      }
      if (!settings.allowedProviders.includes(provider) && provider !== "direct") {
        needsLinkReview = true;
        continue;
      }

      const resolved = resolveDownloadUrl(link, provider);
      if (!resolved.ok) {
        if (resolved.needsReview) needsLinkReview = true;
        continue;
      }

      try {
        const maxBytes = settings.maxLinkDownloadMb * 1024 * 1024;
        const dl = await downloadFromUrl(resolved.downloadUrl, maxBytes);
        const role = classifyAttachment(dl.fileName, parsed.importType);
        if (role === "screenshot" && (isImageFileName(dl.fileName) || isImageMime(dl.mimeType))) {
          const optimized = await storeScreenshot(dl.buffer, dl.fileName, dl.mimeType, entryId);
          storedFiles.push({
            ...optimized,
            role,
            size: dl.buffer.length,
            sourceUrl: resolved.originalUrl,
            sourceProvider: resolved.provider,
          });
        } else {
          const { storageKey } = await import("@/lib/storage");
          const { buildAssetPublicUrl } = await import("@/lib/assets");
          const safeName = dl.fileName.replace(/[^\w.-]/g, "_");
          const r2Key = storageKey("discord-imports", entryId, `link-${safeName}`);
          await uploadToR2(r2Key, dl.buffer, dl.mimeType);
          storedFiles.push({
            buffer: dl.buffer,
            fileName: dl.fileName,
            mimeType: dl.mimeType,
            r2Key,
            publicUrl: buildAssetPublicUrl(r2Key),
            role,
            size: dl.buffer.length,
            sourceUrl: resolved.originalUrl,
            sourceProvider: resolved.provider,
          });
        }
      } catch {
        needsLinkReview = true;
      }
    }

    if (storedFiles.length === 0 && parsed.links.length > 0) {
      needsLinkReview = true;
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
          gameId: game.id,
          modeId,
          categoryId,
          authorId: authorUserId,
          productType,
          status: ModStatus.DRAFT,
          tags: parsed.tags.length
            ? { create: parsed.tags.map((name) => ({ name })) }
            : undefined,
        },
      });
      modId = mod.id;

      const primary = storedFiles.find((f) => f.role === "primary") ?? storedFiles.find((f) => f.role !== "screenshot");
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

    if (storedFiles.length) {
      await prisma.discordImportFile.createMany({
        data: storedFiles.map((f) => ({
          entryId,
          fileName: f.fileName,
          mimeType: f.mimeType,
          fileSize: f.size != null ? fileSizeBigInt(f.size) : fileSizeBigInt(f.buffer.length),
          r2Key: f.r2Key,
          publicUrl: f.publicUrl,
          role: f.role,
          sourceUrl: f.sourceUrl ?? null,
          sourceProvider: f.sourceProvider ?? null,
          scanStatus: "PENDING" as const,
        })),
      });
    }

    const finalStatus = needsLinkReview ? "NEEDS_LINK_REVIEW" : "PENDING_REVIEW";

    const updated = await prisma.discordImportEntry.update({
      where: { id: entryId },
      data: {
        modId,
        status: finalStatus,
        scanStatus,
      },
    });

    await createAuditLog({
      actorId: authorUserId,
      action: "discord.import.created",
      entityType: "DiscordImportEntry",
      entityId: entryId,
      metadata: {
        messageId: payload.messageId,
        importType: parsed.importType,
        discordAuthorId: payload.authorId,
        needsLinkReview,
      },
    });

    void notifyDiscordImportStaff({
      entryId,
      title: parsed.title,
      importType: parsed.importType,
      success: true,
      needsReview: finalStatus === "NEEDS_LINK_REVIEW" || finalStatus === "PENDING_REVIEW",
    });

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    await prisma.discordImportEntry.update({
      where: { id: entryId },
      data: { status: "FAILED", errorMessage: message, scanStatus: "SUSPICIOUS" },
    });
    void notifyDiscordImportStaff({
      entryId,
      title: parsed.title,
      importType: parsed.importType,
      success: false,
      error: message,
    });
    void notifyDiscordVirusDetected({ entryId, title: parsed.title, fileName: "import" });
    throw err;
  }
}
