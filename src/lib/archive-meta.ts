/** Preserve original archive filenames and MIME types for mod/sound downloads. */

const EXTENSION_MIME: Record<string, string> = {
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tgz": "application/gzip",
  ".tar.gz": "application/gzip",
  ".gz": "application/gzip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dll": "application/octet-stream",
  ".asi": "application/octet-stream",
  ".gfx": "application/octet-stream",
  ".rpf": "application/octet-stream",
};

export function extractFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tar.gz")) return ".tar.gz";
  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return "";
  return lower.slice(dot);
}

export function mimeFromFileExtension(fileName: string): string | null {
  const ext = extractFileExtension(fileName);
  return EXTENSION_MIME[ext] ?? null;
}

/** Prefer extension-derived MIME over browser guesses (e.g. RAR mislabeled as gzip). */
export function resolveUploadContentType(fileName: string, browserType?: string | null): string {
  const fromName = mimeFromFileExtension(fileName);
  if (fromName) return fromName;

  const type = browserType?.trim();
  if (type && type !== "application/octet-stream" && type !== "application/x-gzip") {
    return type;
  }

  return "application/octet-stream";
}

export function sanitizeUploadFileName(fileName: string): string {
  const trimmed = fileName.trim() || "upload.bin";
  return trimmed.replace(/[^\w.-]/g, "_");
}

export type ParsedUploadFile = {
  safeName: string;
  originalFileName: string;
  originalExtension: string;
  mimeType: string;
};

export function parseUploadFileName(rawFileName: string, browserType?: string | null): ParsedUploadFile {
  const originalFileName = rawFileName.trim() || "upload.bin";
  const safeName = sanitizeUploadFileName(originalFileName);
  const originalExtension = extractFileExtension(originalFileName) || extractFileExtension(safeName);
  const mimeType = resolveUploadContentType(originalFileName, browserType);
  return { safeName, originalFileName, originalExtension, mimeType };
}
