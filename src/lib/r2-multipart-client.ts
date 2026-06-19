"use client";

import { classifyFetchError, UploadError } from "@/lib/upload-errors";
import { uploadFetch, uploadFetchJson } from "@/lib/upload-fetch";
import { logUploadDiagnostic, MAX_UPLOAD_BYTES, MULTIPART_PART_SIZE } from "@/lib/upload-limits";

export type MultipartPurpose =
  | "mod-version"
  | "mod-screenshot"
  | "sound-preview"
  | "sound-cover"
  | "creator-portfolio"
  | "creator-banner"
  | "creator-avatar"
  | "collection-cover"
  | "user-avatar"
  | "partner-avatar"
  | "partner-banner"
  | "partner-logo"
  | "designer-avatar"
  | "designer-banner"
  | "game-asset"
  | "ticket-attachment"
  | "branding-asset";

export type CompletedPart = { PartNumber: number; ETag: string };

type MultipartInitResponse = {
  sessionId: string;
  uploadId: string;
  key: string;
  partSize: number;
  partCount: number;
};

export type ResumeState = {
  sessionId: string;
  fileName: string;
  fileSize: number;
  purpose: MultipartPurpose;
  modId?: string;
  metadata?: Record<string, string>;
  parts: CompletedPart[];
};

export type MultipartUploadProgress = {
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number | null;
  completedParts: number;
  totalParts: number;
  currentParts: number[];
};

export type MultipartUploadCallbacks = {
  onProgress?: (state: MultipartUploadProgress) => void;
  onPartComplete?: (partNumber: number, etag: string) => void;
  onPartFailed?: (partNumber: number, error: string) => void;
  signal?: AbortSignal;
  isPaused?: () => boolean;
};

export type MultipartUploadInput = {
  file: File;
  purpose: MultipartPurpose;
  modId?: string;
  metadata?: Record<string, string>;
} & MultipartUploadCallbacks;

export type MultipartUploadResult = {
  ok: boolean;
  sessionId: string;
  key: string;
  purpose: string;
  url?: string;
  mediaId?: string;
  needsFinalize?: boolean;
};

const STORAGE_KEY = "xumari-multipart-resume";
const CONCURRENT_PARTS = 4;
const PART_RETRIES = 3;

export function getStoredResumeState(): ResumeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResumeState;
  } catch {
    return null;
  }
}

export function clearStoredResumeState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

function saveResumeState(state: ResumeState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchPartUrl(sessionId: string, partNumber: number): Promise<string> {
  const json = await uploadFetchJson<{ url: string }>(
    `/api/r2/multipart/part?sessionId=${encodeURIComponent(sessionId)}&partNumber=${partNumber}`,
    { context: "multipart-part-url" }
  );
  return json.url;
}

async function uploadPartWithRetry(
  url: string,
  chunk: Blob,
  partNumber: number,
  signal: AbortSignal,
  onFailed?: (partNumber: number, error: string) => void
): Promise<string> {
  let lastErr: UploadError | null = null;
  for (let attempt = 0; attempt < PART_RETRIES; attempt++) {
    try {
      logUploadDiagnostic("upload_part_start", { partNumber, attempt: attempt + 1, bytes: chunk.size });
      const res = await fetch(url, { method: "PUT", body: chunk, signal });
      if (!res.ok) {
        throw new UploadError(
          `Upload failed: chunk ${partNumber} rejected by storage (${res.status})`,
          "STORAGE",
          res.status
        );
      }
      const etag = res.headers.get("ETag")?.replace(/"/g, "");
      if (!etag) {
        throw new UploadError(
          `Upload failed: chunk ${partNumber} missing ETag — verify R2 CORS exposes ETag header`,
          "CORS"
        );
      }
      logUploadDiagnostic("upload_part_complete", { partNumber, etag: etag.slice(0, 12) });
      return etag;
    } catch (err) {
      lastErr = err instanceof UploadError ? err : classifyFetchError(err, "r2-part-upload");
      onFailed?.(partNumber, lastErr.message);
      if (signal.aborted) throw new UploadError("Upload cancelled", "ABORTED");
      if (attempt < PART_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr ?? new UploadError(`Upload failed: chunk ${partNumber} failed after retries`, "STORAGE");
}

export async function performMultipartUpload(input: MultipartUploadInput): Promise<MultipartUploadResult> {
  const { file, purpose, modId, metadata, onProgress, onPartComplete, onPartFailed, signal, isPaused } =
    input;

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Upload failed: file exceeds 5 GB limit", "VALIDATION");
  }

  logUploadDiagnostic("upload_start", {
    purpose,
    fileName: file.name,
    fileSize: file.size,
    modId,
  });

  const existing = getStoredResumeState();
  let init: MultipartInitResponse;
  const completedParts = new Map<number, string>();

  if (
    existing &&
    existing.fileName === file.name &&
    existing.fileSize === file.size &&
    existing.purpose === purpose &&
    existing.modId === modId
  ) {
    try {
      const session = await uploadFetchJson<{
        sessionId: string;
        partSize: number;
        partCount: number;
        completedParts: CompletedPart[];
        status: string;
      }>(`/api/r2/multipart/session?sessionId=${encodeURIComponent(existing.sessionId)}`, {
        context: "multipart-resume",
      });
      if (session.status === "IN_PROGRESS") {
        init = {
          sessionId: session.sessionId,
          uploadId: "",
          key: "",
          partSize: session.partSize,
          partCount: session.partCount,
        };
        for (const p of session.completedParts.length ? session.completedParts : existing.parts) {
          completedParts.set(p.PartNumber, p.ETag);
        }
        logUploadDiagnostic("upload_resume", {
          sessionId: session.sessionId,
          completedParts: completedParts.size,
        });
      } else {
        clearStoredResumeState();
        init = await initiateUpload({ purpose, file, modId, metadata, signal });
      }
    } catch {
      init = await initiateUpload({ purpose, file, modId, metadata, signal });
    }
  } else {
    init = await initiateUpload({ purpose, file, modId, metadata, signal });
  }

  const partsMap = completedParts;
  let uploaded = Array.from(partsMap.keys()).reduce((sum, n) => {
    const start = (n - 1) * init.partSize;
    const end = Math.min(start + init.partSize, file.size);
    return sum + (end - start);
  }, 0);
  const startedAt = Date.now();
  const pendingParts = Array.from({ length: init.partCount }, (_, i) => i + 1).filter(
    (n) => !partsMap.has(n)
  );

  const reportProgress = (activeParts: number[]) => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const bps = elapsed > 0 ? uploaded / elapsed : 0;
    onProgress?.({
      progress: Math.round((uploaded / file.size) * 100),
      uploadedBytes: uploaded,
      totalBytes: file.size,
      speedBps: bps,
      etaSeconds: bps > 0 ? Math.ceil((file.size - uploaded) / bps) : null,
      completedParts: partsMap.size,
      totalParts: init.partCount,
      currentParts: activeParts,
    });
  };

  reportProgress([]);

  const uploadOnePart = async (partNumber: number) => {
    while (isPaused?.()) {
      await new Promise((r) => setTimeout(r, 200));
      if (signal?.aborted) throw new UploadError("Upload cancelled", "ABORTED");
    }

    const start = (partNumber - 1) * init.partSize;
    const end = Math.min(start + init.partSize, file.size);
    const chunk = file.slice(start, end);
    const url = await fetchPartUrl(init.sessionId, partNumber);
    const etag = await uploadPartWithRetry(url, chunk, partNumber, signal ?? new AbortController().signal, onPartFailed);
    partsMap.set(partNumber, etag);
    uploaded += chunk.size;
    onPartComplete?.(partNumber, etag);

    saveResumeState({
      sessionId: init.sessionId,
      fileName: file.name,
      fileSize: file.size,
      purpose,
      modId,
      metadata,
      parts: Array.from(partsMap.entries()).map(([PartNumber, ETag]) => ({ PartNumber, ETag })),
    });

    reportProgress([partNumber]);
  };

  for (let i = 0; i < pendingParts.length; i += CONCURRENT_PARTS) {
    const batch = pendingParts.slice(i, i + CONCURRENT_PARTS);
    reportProgress(batch);
    await Promise.all(batch.map((n) => uploadOnePart(n)));
  }

  const sortedParts = Array.from(partsMap.entries())
    .map(([PartNumber, ETag]) => ({ PartNumber, ETag }))
    .sort((a, b) => a.PartNumber - b.PartNumber);

  logUploadDiagnostic("upload_complete_request", { sessionId: init.sessionId, parts: sortedParts.length });

  const result = await uploadFetchJson<MultipartUploadResult>("/api/r2/multipart/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId: init.sessionId, parts: sortedParts }),
    context: "multipart-complete",
    signal,
  });

  clearStoredResumeState();
  logUploadDiagnostic("upload_complete_ok", { sessionId: init.sessionId, purpose });
  return result;
}

async function initiateUpload(input: {
  purpose: MultipartPurpose;
  file: File;
  modId?: string;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<MultipartInitResponse> {
  return uploadFetchJson<MultipartInitResponse>("/api/r2/multipart/initiate", {
    method: "POST",
    body: JSON.stringify({
      purpose: input.purpose,
      fileName: input.file.name,
      fileSize: input.file.size,
      contentType: input.file.type || "application/octet-stream",
      modId: input.modId,
      metadata: input.metadata,
    }),
    context: "multipart-initiate",
    signal: input.signal,
  });
}

export async function abortMultipartSession(sessionId: string) {
  await uploadFetch(`/api/r2/multipart/complete?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    context: "multipart-abort",
  });
  clearStoredResumeState();
}

export { CONCURRENT_PARTS, MULTIPART_PART_SIZE as PART_SIZE, STORAGE_KEY };
