"use client";

import { classifyFetchError, parseApiErrorResponse } from "@/lib/upload-errors";
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
  init?: RequestInit & { context?: string }
): Promise<Response> {
  const context = init?.context ?? path;
  const { context: _ctx, ...requestInit } = init ?? {};

  try {
    logUploadDiagnostic("upload_fetch_start", { path, method: requestInit.method ?? "GET" });
    const res = await fetch(uploadApiUrl(path), {
      ...requestInit,
      credentials: "include",
      headers: {
        ...(requestInit.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...requestInit.headers,
      },
    });
    logUploadDiagnostic("upload_fetch_response", { path, status: res.status, ok: res.ok });
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
  init?: RequestInit & { context?: string }
): Promise<T> {
  const res = await uploadFetch(path, init);
  if (!res.ok) {
    throw await parseApiErrorResponse(res, "Request failed");
  }
  return (await res.json()) as T;
}
