import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { assertR2Configured, getR2ConfigStatus, logUploadServer } from "@/lib/r2-config";
import {
  initiateMultipartUpload,
  computePartCount,
  PART_SIZE,
} from "@/lib/r2-multipart";
import { storageKey } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { fileSizeBigInt } from "@/lib/file-size";
import { getMediaSettings } from "@/lib/media-settings";
import { assertCollectionCoverAccess } from "@/lib/api-auth";
import { isAudioFileName, MAX_PREVIEW_BYTES } from "@/lib/sound";
import { parseUploadFileName } from "@/lib/archive-meta";
import { createSoundFileId, mimeFromFileName, soundPreviewStorageKey } from "@/lib/sound-storage";

const purposeSchema = z.enum([
  "mod-version",
  "mod-screenshot",
  "sound-preview",
  "sound-cover",
  "creator-portfolio",
  "creator-banner",
  "creator-avatar",
  "collection-cover",
  "user-avatar",
  "partner-avatar",
  "partner-banner",
  "partner-logo",
  "designer-avatar",
  "designer-banner",
  "game-asset",
  "ticket-attachment",
  "chat-attachment",
  "branding-asset",
  "team-avatar",
  "team-banner",
]);

const initiateSchema = z.object({
  purpose: purposeSchema,
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  contentType: z.string().min(1),
  modId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

async function canEditMod(userId: string, role: string, authorId: string) {
  if (authorId === userId) return true;
  return hasPermission(role as never, "mods.write") || hasPermission(role as never, "mods.moderate");
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Missing authentication token", 401, "AUTH");
  }

  try {
    assertR2Configured();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloudflare R2 is not configured";
    logUploadServer("initiate_config_error", { userId: user.id, message });
    return jsonError(message, 503, "STORAGE");
  }

  const body = await req.json().catch(() => null);
  const parsed = initiateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "VALIDATION");
  }

  const { purpose, fileName, fileSize, contentType, modId, metadata } = parsed.data;

  try {
    if (purpose === "mod-version" || purpose === "mod-screenshot" || purpose === "sound-preview" || purpose === "sound-cover") {
      if (!modId) return jsonError("modId required for mod uploads", 400, "VALIDATION");
      const mod = await prisma.mod.findUnique({ where: { id: modId } });
      if (!mod) return jsonError("Mod not found", 404, "VALIDATION");
      if (!(await canEditMod(user.id, user.role, mod.authorId))) {
        return jsonError("Permission denied for this mod", 403, "AUTH");
      }
      if (purpose === "mod-screenshot") {
        const settings = await getMediaSettings();
        const count = await prisma.modMedia.count({ where: { modId, mediaType: "IMAGE" } });
        if (count >= settings.maxScreenshots) {
          return jsonError(`Maximum ${settings.maxScreenshots} screenshots`, 400, "VALIDATION");
        }
      }
      if (purpose === "sound-preview") {
        if (mod.productType !== "SOUND") {
          return jsonError("Preview upload only for sound products", 400, "VALIDATION");
        }
        if (!isAudioFileName(fileName)) {
          return jsonError("Invalid audio format for preview", 400, "VALIDATION");
        }
        if (fileSize > MAX_PREVIEW_BYTES) {
          return jsonError("Preview audio exceeds size limit", 400, "VALIDATION");
        }
      }
      if (purpose === "sound-cover" && mod.productType !== "SOUND") {
        return jsonError("Cover upload only for sound products", 400, "VALIDATION");
      }
    }

    if (purpose === "game-asset") {
      if (!hasPermission(user.role, "games.write")) {
        return jsonError("Permission denied for game assets", 403, "AUTH");
      }
      if (!metadata?.gameId || !metadata?.assetType) {
        return jsonError("gameId and assetType required in metadata", 400, "VALIDATION");
      }
    }

    if (purpose === "branding-asset") {
      if (!hasPermission(user.role, "settings.write")) {
        return jsonError("Permission denied for branding assets", 403, "AUTH");
      }
      if (!metadata?.assetType) {
        return jsonError("assetType required in metadata", 400, "VALIDATION");
      }
    }

    if (purpose === "collection-cover") {
      if (!metadata?.collectionId) {
        return jsonError("collectionId required in metadata", 400, "VALIDATION");
      }
      const access = await assertCollectionCoverAccess(user, metadata.collectionId);
      if (!access.ok) {
        return jsonError(access.message, access.status, "AUTH");
      }
    }

    if (purpose === "team-avatar" || purpose === "team-banner") {
      if (!hasPermission(user.role, "users.write")) {
        return jsonError("Permission denied for team media uploads", 403, "AUTH");
      }
      if (metadata?.teamMemberId) {
        const member = await prisma.teamMember.findUnique({
          where: { id: metadata.teamMemberId },
          select: { id: true },
        });
        if (!member) return jsonError("Team member not found", 404, "VALIDATION");
      }
    }

    const parsedFile = parseUploadFileName(fileName, contentType);
    const { safeName, originalFileName, originalExtension } = parsedFile;
    let resolvedMime = parsedFile.mimeType;
    if (purpose === "sound-preview" || purpose === "sound-cover") {
      const audioMime = mimeFromFileName(fileName);
      if (audioMime !== "application/octet-stream") {
        resolvedMime = audioMime;
      } else if (contentType.startsWith("audio/")) {
        resolvedMime = contentType;
      }
    }
    let fileKey: string;
    let soundFileId: string | undefined;

    if (purpose === "sound-preview" && modId) {
      soundFileId = createSoundFileId();
      fileKey = soundPreviewStorageKey(modId, soundFileId, safeName);
    } else {
      const relativePath = `${user.id}/${Date.now()}-${safeName}`;
      fileKey = storageKey(`uploads/${purpose}/${relativePath}`);
    }

    logUploadServer("initiate_start", {
      userId: user.id,
      purpose,
      fileName: safeName,
      originalFileName,
      fileSize,
      modId,
    });

    const { uploadId, key } = await initiateMultipartUpload(fileKey, resolvedMime);
    const partCount = computePartCount(fileSize);

    const session = await prisma.storageUploadSession.create({
      data: {
        userId: user.id,
        purpose,
        fileKey: key,
        uploadId,
        fileName: safeName,
        fileSize: fileSizeBigInt(fileSize),
        contentType: resolvedMime,
        modId,
        metadata: {
          ...(metadata ?? {}),
          ...(soundFileId ? { soundFileId } : {}),
          originalFileName,
          originalExtension,
        },
        completedParts: [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logUploadServer("initiate_ok", { sessionId: session.id, partCount, key });

    return NextResponse.json({
      sessionId: session.id,
      uploadId,
      key,
      partSize: PART_SIZE,
      partCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate upload";
    logUploadServer("initiate_failed", { userId: user.id, purpose, message });
    if (message.toLowerCase().includes("r2") || message.toLowerCase().includes("cloudflare")) {
      return jsonError(`Cloudflare R2 connection error: ${message}`, 503, "STORAGE");
    }
    return jsonError(message, 500, "STORAGE");
  }
}

export async function GET() {
  const status = getR2ConfigStatus();
  return NextResponse.json(status);
}
