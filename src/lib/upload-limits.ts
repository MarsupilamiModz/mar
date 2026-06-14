/** Max direct-to-R2 upload size (5 GB). Chunks never pass through Next.js server. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/** VirusTotal file upload API limit — larger files use hash lookup only. */
export const VIRUSTOTAL_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;

/** 50 MB parts — fewer requests for large files (5 GB ≈ 102 parts). */
export const MULTIPART_PART_SIZE = 50 * 1024 * 1024;

export function isWithinUploadLimit(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_UPLOAD_BYTES;
}

export function uploadLimitLabel(): string {
  return "5 GB";
}

/** Mod archive file types supported for direct R2 multipart upload. */
export const MOD_VERSION_FILE_ACCEPT =
  ".zip,.rar,.7z,.exe,.dll,.asi,.gfx,.rpf,application/zip,application/x-rar-compressed,application/x-7z-compressed,application/octet-stream";

export function logUploadDiagnostic(event: string, detail?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), event, ...detail };
  console.info("[upload]", entry);
  if (typeof window !== "undefined") {
    try {
      const key = "xumari-upload-diagnostics";
      const prev = JSON.parse(sessionStorage.getItem(key) ?? "[]") as unknown[];
      prev.unshift(entry);
      sessionStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
    } catch {
      /* ignore storage errors */
    }
  }
}

