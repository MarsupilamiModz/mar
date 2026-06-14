"use client";

import { useCallback, useRef, useState } from "react";
import {
  abortMultipartSession,
  getStoredResumeState,
  performMultipartUpload,
  type MultipartPurpose,
  type MultipartUploadProgress,
} from "@/lib/r2-multipart-client";
import { formatUploadErrorMessage } from "@/lib/upload-errors";

export type { MultipartPurpose };

export function useR2MultipartUpload() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [chunkStatus, setChunkStatus] = useState<{ completed: number; total: number; failed: number[] }>({
    completed: 0,
    total: 0,
    failed: [],
  });
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const lastInputRef = useRef<{
    purpose: MultipartPurpose;
    modId?: string;
    metadata?: Record<string, string>;
  } | null>(null);

  const handleProgress = useCallback((state: MultipartUploadProgress) => {
    setProgress(state.progress);
    setSpeedBps(state.speedBps);
    setEtaSeconds(state.etaSeconds);
    setChunkStatus({
      completed: state.completedParts,
      total: state.totalParts,
      failed: [],
    });
  }, []);

  const upload = useCallback(
    async (input: {
      file: File;
      purpose: MultipartPurpose;
      modId?: string;
      metadata?: Record<string, string>;
    }) => {
      setUploading(true);
      setPaused(false);
      pausedRef.current = false;
      setError(null);
      setProgress(0);
      setSpeedBps(0);
      setEtaSeconds(null);
      setChunkStatus({ completed: 0, total: 0, failed: [] });
      abortRef.current = new AbortController();
      lastFileRef.current = input.file;
      lastInputRef.current = {
        purpose: input.purpose,
        modId: input.modId,
        metadata: input.metadata,
      };

      try {
        const result = await performMultipartUpload({
          ...input,
          signal: abortRef.current.signal,
          isPaused: () => pausedRef.current,
          onProgress: handleProgress,
          onPartFailed: (partNumber, errMsg) => {
            setChunkStatus((prev) => ({
              ...prev,
              failed: Array.from(new Set([...prev.failed, partNumber])),
            }));
            setError(errMsg);
          },
        });
        sessionIdRef.current = result.sessionId;
        return result;
      } catch (err) {
        const msg = formatUploadErrorMessage(err);
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setUploading(false);
        setPaused(false);
        pausedRef.current = false;
      }
    },
    [handleProgress]
  );

  const retry = useCallback(async () => {
    const file = lastFileRef.current;
    const input = lastInputRef.current;
    if (!file || !input) {
      setError("No upload to retry — select the file again.");
      return null;
    }
    return upload({ file, ...input });
  }, [upload]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resumeUpload = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const abort = useCallback(async (sessionId?: string) => {
    abortRef.current?.abort();
    pausedRef.current = false;
    setPaused(false);
    const id = sessionId ?? sessionIdRef.current ?? getStoredResumeState()?.sessionId;
    if (id) {
      await abortMultipartSession(id).catch(() => undefined);
    }
    sessionIdRef.current = null;
  }, []);

  const hasResumableUpload = Boolean(getStoredResumeState());

  return {
    upload,
    retry,
    abort,
    pause,
    resume: resumeUpload,
    progress,
    uploading,
    paused,
    error,
    speedBps,
    etaSeconds,
    chunkStatus,
    hasResumableUpload,
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
