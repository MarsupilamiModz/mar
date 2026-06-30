import { randomUUID } from "crypto";
import { storageKey } from "@/lib/storage";

export function mimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "application/octet-stream";
}

export function createSoundFileId() {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

/** Dedicated per-sound storage path: xumari/sounds/{modId}/{fileId}/{safeName} */
export function soundPreviewStorageKey(modId: string, fileId: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.-]/g, "_");
  return storageKey("sounds", modId, fileId, safeName);
}

export function estimateBitrateKbps(fileSizeBytes: number, durationSeconds: number): number | null {
  if (!fileSizeBytes || !durationSeconds || durationSeconds <= 0) return null;
  return Math.round((fileSizeBytes * 8) / durationSeconds / 1000);
}
