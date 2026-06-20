export type UploadErrorCode =
  | "NETWORK"
  | "CORS"
  | "AUTH"
  | "FORBIDDEN"
  | "VALIDATION"
  | "STORAGE"
  | "TIMEOUT"
  | "ABORTED"
  | "UNKNOWN";

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly status?: number;
  readonly detail?: string;

  constructor(message: string, code: UploadErrorCode = "UNKNOWN", status?: number, detail?: string) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export function formatUploadErrorMessage(err: unknown): string {
  if (err instanceof UploadError) return err.message;
  if (err instanceof Error) return normalizeErrorMessage(err);
  return "Upload failed: unexpected error";
}

function normalizeErrorMessage(err: Error): string {
  const msg = err.message.trim();
  if (!msg || msg === "Failed to fetch" || msg === "Load failed" || msg === "NetworkError when attempting to fetch resource.") {
    return "Upload failed: network connection error. Check your connection, sign in again, and ensure Cloudflare R2 CORS allows PUT from this site.";
  }
  if (msg.startsWith("Upload failed:")) return msg;
  return `Upload failed: ${msg}`;
}

export function classifyFetchError(err: unknown, context: string): UploadError {
  if (err instanceof UploadError) return err;

  if (err instanceof DOMException && err.name === "AbortError") {
    return new UploadError("Upload cancelled", "ABORTED");
  }

  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("load failed") || msg.includes("networkerror")) {
      if (context.includes("part") || context.includes("r2")) {
        return new UploadError(
          "Upload failed: Cloudflare R2 blocked the upload (CORS or network). Configure bucket CORS to allow PUT from your app origin and expose ETag.",
          "CORS"
        );
      }
      return new UploadError(
        "Upload failed: could not reach the upload API. Check your connection, session, and that the site is not blocked by Cloudflare.",
        "NETWORK"
      );
    }
  }

  if (err instanceof Error) {
    return new UploadError(normalizeErrorMessage(err), "UNKNOWN");
  }

  return new UploadError("Upload failed: unexpected error", "UNKNOWN");
}

export async function parseApiErrorResponse(res: Response, fallback: string): Promise<UploadError> {
  let body: { error?: string; code?: string; message?: string; recoveryHint?: string; category?: string } | null = null;
  try {
    body = (await res.json()) as { error?: string; code?: string; message?: string };
  } catch {
    body = null;
  }

  const raw = body?.error ?? body?.message ?? fallback;
  const code = mapStatusToCode(res.status, body?.code);
  const hint = body?.recoveryHint ? ` ${body.recoveryHint}` : "";

  if (res.status === 401) {
    return new UploadError(`Upload failed: missing or expired authentication. Sign in and try again.${hint}`, "AUTH", 401, raw);
  }
  if (res.status === 403) {
    return new UploadError(`Upload failed: permission denied${raw ? ` — ${raw}` : ""}`, "FORBIDDEN", 403, raw);
  }
  if (res.status === 413) {
    return new UploadError("Upload failed: file exceeds configured limit", "VALIDATION", 413, raw);
  }
  if (res.status === 429) {
    return new UploadError("Upload failed: rate limit exceeded. Wait a moment and retry.", "VALIDATION", 429, raw);
  }
  if (res.status >= 500) {
    if (raw.toLowerCase().includes("r2") || raw.toLowerCase().includes("cloudflare")) {
      return new UploadError(`Upload failed: ${raw}`, "STORAGE", res.status, raw);
    }
    return new UploadError(`Upload failed: server error — ${raw}`, "STORAGE", res.status, raw);
  }

  return new UploadError(`Upload failed: ${raw}`, code, res.status, raw);
}

function mapStatusToCode(status: number, bodyCode?: string): UploadErrorCode {
  if (bodyCode === "AUTH") return "AUTH";
  if (bodyCode === "STORAGE") return "STORAGE";
  if (status === 401) return "AUTH";
  if (status === 403) return "FORBIDDEN";
  if (status >= 500) return "STORAGE";
  if (status >= 400) return "VALIDATION";
  return "UNKNOWN";
}
