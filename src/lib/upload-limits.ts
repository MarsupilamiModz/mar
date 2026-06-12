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
