"use client";

import { classifyFetchError, parseApiErrorResponse, UploadError } from "@/lib/upload-errors";
import { fetchWithRetry } from "@/lib/api-retry";
import { attemptSessionRecovery } from "@/lib/session-recovery";
import { logUploadDiagnostic } from "@/lib/upload-limits";

export function getUploadApiBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function uploadApiUrl(path: string): string {
  const base = getUploadApiBase();
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function uploadFetch(
  path: string,
  init?: RequestInit & { context?: string; retry?: boolean }
): Promise<Response> {
  const context = init?.context ?? path;
  const { context: _ctx, retry = true, ...requestInit } = init ?? {};
  const url = uploadApiUrl(path);

  const doFetch = async () => {
    logUploadDiagnostic("upload_fetch_start", { path, method: requestInit.method ?? "GET" });
    const res = await fetch(url, {
      ...requestInit,
      credentials: "include",
      headers: {
        ...(requestInit.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...requestInit.headers,
      },
    });
    logUploadDiagnostic("upload_fetch_response", { path, status: res.status, ok: res.ok });
    return res;
  };

  try {
    const res = retry
      ? await fetchWithRetry(url, {
          ...requestInit,
          credentials: "include",
          headers: {
            ...(requestInit.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
            ...requestInit.headers,
          },
        })
      : await doFetch();

    if (res.status === 401) {
      const recovered = await attemptSessionRecovery();
      if (recovered) {
        const retryRes = await doFetch();
        if (retryRes.ok || retryRes.status !== 401) return retryRes;
      }
    }

    return res;
  } catch (err) {
    logUploadDiagnostic("upload_fetch_error", {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    throw classifyFetchError(err, context);
  }
}

export async function uploadFetchJson<T>(
  path: string,
  init?: RequestInit & { context?: string; retry?: boolean }
): Promise<T> {
  const res = await uploadFetch(path, init);
  if (!res.ok) {
    throw await parseApiErrorResponse(res, "Request failed");
  }
  return (await res.json()) as T;
}

export function isRetriableUploadError(err: unknown): boolean {
  if (!(err instanceof UploadError)) return false;
  return ["NETWORK", "STORAGE", "CORS", "TIMEOUT"].includes(err.code);
}
