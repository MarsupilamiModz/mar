import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { buildAssetPublicUrl } from "@/lib/assets";
import { storageKey } from "@/lib/storage";
import { uploadToR2 } from "@/lib/r2";
import { mimeFromFileName } from "@/lib/sound-storage";

export const API_UPLOAD_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp3",
  ".wav",
  ".ogg",
  ".zip",
  ".rar",
  ".7z",
  ".dll",
  ".asi",
] as const;

export const API_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".dll": "application/octet-stream",
  ".asi": "application/octet-stream",
};

export function isAllowedApiUploadFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return API_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function resolveApiUploadMime(fileName: string, clientMime?: string | null): string {
  const lower = fileName.toLowerCase();
  for (const [ext, mime] of Object.entries(MIME_BY_EXT)) {
    if (lower.endsWith(ext)) return mime;
  }
  if (clientMime?.trim()) return clientMime.trim();
  return mimeFromFileName(fileName);
}

export function buildApiUploadKey(fileName: string): string {
  const safeName = fileName.replace(/[^\w.-]/g, "_");
  return storageKey("api-uploads", randomUUID(), safeName);
}

export async function processApiUpload(file: File): Promise<{
  url: string;
  fileName: string;
  size: number;
  sha256: string;
  contentType: string;
  storageKey: string;
  virusTotalStatus: string;
}> {
  if (!isAllowedApiUploadFileName(file.name)) {
    throw new Error(`Unsupported file type. Allowed: ${API_UPLOAD_EXTENSIONS.join(", ")}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) throw new Error("Empty file");
  if (buffer.length > API_UPLOAD_MAX_BYTES) {
    throw new Error(`File exceeds ${API_UPLOAD_MAX_BYTES / (1024 * 1024)}MB limit`);
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const contentType = resolveApiUploadMime(file.name, file.type);
  const key = buildApiUploadKey(file.name);
  const storedKey = await uploadToR2(key, buffer, contentType);
  const url = buildAssetPublicUrl(storedKey);

  let virusTotalStatus = "SKIPPED";
  try {
    const { scanFileBuffer } = await import("@/lib/security/virustotal");
    const scan = await scanFileBuffer(buffer, file.name);
    virusTotalStatus = scan.status;
  } catch {
    virusTotalStatus = "ERROR";
  }

  return {
    url,
    fileName: file.name,
    size: buffer.length,
    sha256,
    contentType,
    storageKey: storedKey,
    virusTotalStatus,
  };
}
