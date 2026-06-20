import type { MediaEntityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildAssetPublicUrl } from "@/lib/assets";
import { getScreenshotUrl } from "@/lib/screenshot-url";
import { STORAGE, storageKey } from "@/lib/storage";
import { fileSizeBigInt } from "@/lib/file-size";

export type RegisterMediaInput = {
  storagePath: string;
  originalName: string;
  mimeType: string;
  fileSize: bigint | number;
  entityType: MediaEntityType;
  entityId?: string | null;
  uploadedById: string;
};

export function normalizeStoragePath(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, "");
  if (trimmed.startsWith(`${STORAGE.prefix}/`)) return trimmed;
  if (trimmed.startsWith("uploads/")) return storageKey(trimmed);
  return storageKey(trimmed);
}

export { getScreenshotUrl };

/** Resolve any stored value (key, partial path, or URL) to a public URL. */
export function resolveMediaPublicUrl(stored: string | null | undefined): string | null {
  return getScreenshotUrl(stored);
}

/** Normalize stored DB value to canonical public URL for display. */
export function normalizeStoredMediaUrl(stored: string | null | undefined): string | null {
  return resolveMediaPublicUrl(stored);
}

function inferFileType(mimeType: string, fileName: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)) return "image";
  return "document";
}

export async function registerMediaFile(input: RegisterMediaInput) {
  const storagePath = normalizeStoragePath(input.storagePath);
  const publicUrl = buildAssetPublicUrl(storagePath);
  const fileName = storagePath.split("/").pop() ?? input.originalName;

  return prisma.mediaFile.upsert({
    where: { storagePath },
    create: {
      fileName,
      originalName: input.originalName,
      fileType: inferFileType(input.mimeType, input.originalName),
      mimeType: input.mimeType,
      fileSize: fileSizeBigInt(input.fileSize),
      storagePath,
      publicUrl,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      uploadedById: input.uploadedById,
    },
    update: {
      publicUrl,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      mimeType: input.mimeType,
      fileSize: fileSizeBigInt(input.fileSize),
    },
  });
}

export async function registerMediaFromSession(
  session: {
    fileKey: string;
    fileName: string;
    fileSize: bigint | number;
    contentType: string;
  },
  entityType: MediaEntityType,
  uploadedById: string,
  entityId?: string | null
) {
  return registerMediaFile({
    storagePath: session.fileKey,
    originalName: session.fileName,
    mimeType: session.contentType || "application/octet-stream",
    fileSize: session.fileSize,
    entityType,
    entityId,
    uploadedById,
  });
}

/** Returns public URL suitable for storing on entity records. */
export function mediaUrlForEntity(storagePath: string): string {
  return buildAssetPublicUrl(normalizeStoragePath(storagePath));
}

export function isLikelyStorageKey(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return false;
  if (v.startsWith("/api/assets/")) return false;
  return true;
}

export function extractStoragePathFromUrl(url: string): string | null {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith("/api/assets/")) {
        return decodeURIComponent(parsed.pathname.replace(/^\/api\/assets\//, ""));
      }
      const path = parsed.pathname.replace(/^\//, "");
      if (path.startsWith(`${STORAGE.prefix}/`)) return path;
      return null;
    }
    if (url.startsWith("/api/assets/")) {
      return decodeURIComponent(url.replace(/^\/api\/assets\//, ""));
    }
    return normalizeStoragePath(url);
  } catch {
    return null;
  }
}
