/** Max direct-to-R2 upload size (10 GB). Chunks never pass through Next.js server. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 * 1024;

/** VirusTotal file upload API limit — larger files use hash lookup only. */
export const VIRUSTOTAL_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;

export const MULTIPART_PART_SIZE = 10 * 1024 * 1024;

export function isWithinUploadLimit(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_UPLOAD_BYTES;
}

export function uploadLimitLabel(): string {
  return "10 GB";
}
