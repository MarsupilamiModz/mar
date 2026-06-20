import { parseAppError } from "@/lib/error-diagnostics";

export type ApiRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  retryStatuses?: number[];
  signal?: AbortSignal;
  onRetry?: (attempt: number, reason: string) => void;
};

const DEFAULT_RETRY_STATUSES = [408, 429, 500, 502, 503, 504];

function isRetryableNetworkError(err: unknown): boolean {
  const diagnostics = parseAppError(err);
  return diagnostics.category === "network" || diagnostics.category === "database";
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ApiRetryOptions = {}
): Promise<Response> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !retryStatuses.includes(res.status) || attempt === retries) {
        return res;
      }
      lastError = new Error(`Request failed with status ${res.status}`);
      options.onRetry?.(attempt + 1, `HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (!isRetryableNetworkError(err) || attempt === retries) throw err;
      options.onRetry?.(attempt + 1, parseAppError(err).message);
    }

    await delay(baseDelayMs * (attempt + 1), options.signal);
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed after retries");
}
