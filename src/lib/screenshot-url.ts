import {
  buildAssetPublicUrl,
  encodeAssetPath,
  resolveAssetUrl,
} from "@/lib/assets";
import { getAppUrl } from "@/lib/app-url";
import {
  extractStoragePathFromUrl,
  isLikelyStorageKey,
  normalizeStoragePath,
} from "@/lib/media-files";

/** App-origin proxy URL — always works when R2 credentials are configured server-side. */
export function getAppAssetProxyUrl(storagePath: string): string {
  const normalized = normalizeStoragePath(storagePath);
  return `${getAppUrl()}/api/assets/${encodeAssetPath(normalized)}`;
}

/**
 * Resolve any stored screenshot reference (key, partial path, or URL) to a browser-loadable URL.
 * Use this everywhere screenshots are rendered.
 */
export function getScreenshotUrl(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;

  const trimmed = stored.trim();

  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  if (trimmed.startsWith("/api/assets/")) {
    return `${getAppUrl()}${trimmed}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return resolveAssetUrl(trimmed);
  }

  const storagePath = isLikelyStorageKey(trimmed)
    ? normalizeStoragePath(trimmed)
    : extractStoragePathFromUrl(trimmed);

  if (storagePath) {
    return buildAssetPublicUrl(storagePath);
  }

  return resolveAssetUrl(trimmed);
}

/** Proxy fallback when a CDN URL may be unreachable from the browser. */
export function getScreenshotProxyFallback(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;

  const trimmed = stored.trim();
  const storagePath =
    isLikelyStorageKey(trimmed) ? normalizeStoragePath(trimmed) : extractStoragePathFromUrl(trimmed);

  if (storagePath) return getAppAssetProxyUrl(storagePath);
  return null;
}

export const SCREENSHOT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export function isValidScreenshotMime(mime: string): boolean {
  return (SCREENSHOT_MIME_TYPES as readonly string[]).includes(mime);
}
