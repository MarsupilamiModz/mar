"use client";

import { useCallback, useRef, useState } from "react";

type MultipartInitResponse = {
  sessionId: string;
  uploadId: string;
  key: string;
  partSize: number;
  partCount: number;
  partUrls: { partNumber: number; url: string }[];
};

export function useR2MultipartUpload() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (input: {
      file: File;
      purpose: string;
      modId?: string;
      metadata?: Record<string, string>;
    }) => {
      setUploading(true);
      setError(null);
      setProgress(0);
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

        const parts: { PartNumber: number; ETag: string }[] = [];
        let uploaded = 0;

        for (const part of init.partUrls) {
          const start = (part.partNumber - 1) * init.partSize;
          const end = Math.min(start + init.partSize, input.file.size);
          const chunk = input.file.slice(start, end);

          const res = await fetch(part.url, {
            method: "PUT",
            body: chunk,
            signal: abortRef.current.signal,
          });
          if (!res.ok) throw new Error(`Part ${part.partNumber} failed`);
          const etag = res.headers.get("ETag")?.replace(/"/g, "");
          if (!etag) throw new Error(`Missing ETag for part ${part.partNumber}`);
          parts.push({ PartNumber: part.partNumber, ETag: etag });

          uploaded += chunk.size;
          setProgress(Math.round((uploaded / input.file.size) * 100));
        }

        const completeRes = await fetch("/api/r2/multipart/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: init.sessionId, parts }),
        });
        if (!completeRes.ok) throw new Error((await completeRes.json()).error ?? "Complete failed");
        return completeRes.json();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const abort = useCallback(async (sessionId?: string) => {
    abortRef.current?.abort();
    if (sessionId) {
      await fetch(`/api/r2/multipart/complete?sessionId=${sessionId}`, { method: "DELETE" });
    }
  }, []);

  return { upload, abort, progress, uploading, error };
}
