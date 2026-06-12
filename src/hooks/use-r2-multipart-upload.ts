"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

type CompletedPart = { PartNumber: number; ETag: string };

type MultipartInitResponse = {
  sessionId: string;
  uploadId: string;
  key: string;
  partSize: number;
  partCount: number;
};

type ResumeState = {
  sessionId: string;
  fileName: string;
  fileSize: number;
  purpose: string;
  modId?: string;
  parts: CompletedPart[];
};

const STORAGE_KEY = "xumari-multipart-resume";
const CONCURRENT_PARTS = 4;

export function useR2MultipartUpload() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const fetchPartUrl = useCallback(async (sessionId: string, partNumber: number) => {
    const res = await fetch(
      `/api/r2/multipart/part?sessionId=${encodeURIComponent(sessionId)}&partNumber=${partNumber}`
    );
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to get part URL");
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  const uploadPartWithRetry = useCallback(
    async (url: string, chunk: Blob, partNumber: number, signal: AbortSignal) => {
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, { method: "PUT", body: chunk, signal });
          if (!res.ok) throw new Error(`Part ${partNumber} failed (${res.status})`);
          const etag = res.headers.get("ETag")?.replace(/"/g, "");
          if (!etag) throw new Error(`Missing ETag for part ${partNumber}`);
          return etag;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          if (signal.aborted) throw lastErr;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      throw lastErr ?? new Error(`Part ${partNumber} failed`);
    },
    []
  );

  const upload = useCallback(
    async (input: {
      file: File;
      purpose: string;
      modId?: string;
      metadata?: Record<string, string>;
    }) => {
      if (input.file.size > MAX_UPLOAD_BYTES) {
        throw new Error("File exceeds 5 GB upload limit");
      }

      setUploading(true);
      setPaused(false);
      pausedRef.current = false;
      setError(null);
      setProgress(0);
      setSpeedBps(0);
      setEtaSeconds(null);
      abortRef.current = new AbortController();

      try {
        const initRes = await fetch("/api/r2/multipart/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: input.purpose,
            fileName: input.file.name,
            fileSize: input.file.size,
            contentType: input.file.type || "application/octet-stream",
            modId: input.modId,
            metadata: input.metadata,
          }),
          signal: abortRef.current.signal,
        });
        if (!initRes.ok) throw new Error((await initRes.json()).error ?? "Init failed");
        const init = (await initRes.json()) as MultipartInitResponse;
        sessionIdRef.current = init.sessionId;

        const parts: CompletedPart[] = [];
        let uploaded = 0;
        const startedAt = Date.now();
        const pendingParts = Array.from({ length: init.partCount }, (_, i) => i + 1);

        const uploadOnePart = async (partNumber: number) => {
          while (pausedRef.current) {
            await new Promise((r) => setTimeout(r, 200));
            if (abortRef.current?.signal.aborted) throw new Error("Upload aborted");
          }

          const start = (partNumber - 1) * init.partSize;
          const end = Math.min(start + init.partSize, input.file.size);
          const chunk = input.file.slice(start, end);
          const url = await fetchPartUrl(init.sessionId, partNumber);
          const etag = await uploadPartWithRetry(
            url,
            chunk,
            partNumber,
            abortRef.current!.signal
          );
          parts.push({ PartNumber: partNumber, ETag: etag });
          uploaded += chunk.size;

          const elapsed = (Date.now() - startedAt) / 1000;
          const bps = elapsed > 0 ? uploaded / elapsed : 0;
          setSpeedBps(bps);
          setProgress(Math.round((uploaded / input.file.size) * 100));
          if (bps > 0) setEtaSeconds(Math.ceil((input.file.size - uploaded) / bps));

          const resume: ResumeState = {
            sessionId: init.sessionId,
            fileName: input.file.name,
            fileSize: input.file.size,
            purpose: input.purpose,
            modId: input.modId,
            parts: [...parts],
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
        };

        for (let i = 0; i < pendingParts.length; i += CONCURRENT_PARTS) {
          const batch = pendingParts.slice(i, i + CONCURRENT_PARTS);
          await Promise.all(batch.map((n) => uploadOnePart(n)));
        }

        const completeRes = await fetch("/api/r2/multipart/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: init.sessionId,
            parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
          }),
        });
        if (!completeRes.ok) throw new Error((await completeRes.json()).error ?? "Complete failed");

        localStorage.removeItem(STORAGE_KEY);
        return completeRes.json();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        throw err;
      } finally {
        setUploading(false);
        setPaused(false);
        pausedRef.current = false;
      }
    },
    [fetchPartUrl, uploadPartWithRetry]
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const abort = useCallback(async (sessionId?: string) => {
    abortRef.current?.abort();
    pausedRef.current = false;
    setPaused(false);
    const id = sessionId ?? sessionIdRef.current;
    if (id) {
      await fetch(`/api/r2/multipart/complete?sessionId=${id}`, { method: "DELETE" });
    }
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    upload,
    abort,
    pause,
    resume,
    progress,
    uploading,
    paused,
    error,
    speedBps,
    etaSeconds,
  };
}

export function formatUploadSpeed(bps: number): string {
  if (bps <= 0) return "—";
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
