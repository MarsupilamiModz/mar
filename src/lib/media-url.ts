import { getAppUrl } from "@/lib/app-url";
import {
  extractStoragePathFromUrl,
  isLikelyStorageKey,
  normalizeStoragePath,
} from "@/lib/media-files";

function encodeAssetPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function publicCdnBase(): string | null {
  const base =
    process.env.NEXT_PUBLIC_CDN_URL ??
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ??
    process.env.R2_PUBLIC_URL;
  if (!base?.trim()) return null;
  return base.replace(/\/$/, "");
}

function buildPublicUrl(storageKey: string): string {
  const cdn = publicCdnBase();
  const normalized = stripLeadingSlash(storageKey);
  if (cdn) return `${cdn}/${normalized}`;
  return `${getAppUrl()}/api/assets/${encodeAssetPath(normalized)}`;
}

function rewriteStaleHostUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".local");

    if (!isLocal) return url;

    const path = parsed.pathname;
    if (path.startsWith("/api/assets/")) {
      return `${getAppUrl()}${path}${parsed.search}`;
    }

    const key = decodeURIComponent(path.replace(/^\//, ""));
    if (key.startsWith("xumari/")) {
      return buildPublicUrl(key);
    }
  } catch {
    /* keep original */
  }
  return url;
}

/** App-origin proxy URL — always works when R2 credentials are configured server-side. */
export function getAppAssetProxyUrl(storagePath: string): string {
  const normalized = normalizeStoragePath(storagePath);
  return `${getAppUrl()}/api/assets/${encodeAssetPath(normalized)}`;
}

/**
 * Resolve any stored media reference (key, partial path, or URL) to a browser-loadable URL.
 * Use for avatars, banners, screenshots, logos, and team images.
 */
export function getMediaUrl(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;

  const trimmed = stored.trim();

  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  if (trimmed.startsWith("/api/assets/")) {
    return `${getAppUrl()}${trimmed}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return rewriteStaleHostUrl(trimmed);
  }

  const storagePath = isLikelyStorageKey(trimmed)
    ? normalizeStoragePath(trimmed)
    : extractStoragePathFromUrl(trimmed);

  if (storagePath) {
    return buildPublicUrl(storagePath);
  }

  return null;
}

/** Proxy fallback when a CDN URL may be unreachable from the browser. */
export function getMediaProxyFallback(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;

  const trimmed = stored.trim();
  const storagePath =
    isLikelyStorageKey(trimmed) ? normalizeStoragePath(trimmed) : extractStoragePathFromUrl(trimmed);

  if (storagePath) return getAppAssetProxyUrl(storagePath);
  return null;
}

/** @deprecated Use getMediaUrl */
export const getScreenshotUrl = getMediaUrl;

/** @deprecated Use getMediaProxyFallback */
export const getScreenshotProxyFallback = getMediaProxyFallback;

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export const SCREENSHOT_MIME_TYPES = IMAGE_MIME_TYPES;

export function isValidImageMime(mime: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isValidScreenshotMime(mime: string): boolean {
  return isValidImageMime(mime);
}
