import { getAppUrl } from "@/lib/app-url";

/** Resolve stored asset keys or partial paths into browser-loadable URLs. */
export function resolveAssetUrl(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey?.trim()) return null;

  const value = urlOrKey.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/api/assets/")) return `${appBase()}${value}`;

  const cdn = publicCdnBase();
  if (cdn) return `${cdn}/${stripLeadingSlash(value)}`;

  return `${appBase()}/api/assets/${encodeAssetPath(value)}`;
}

/** Build a permanent public URL at upload time (stored in the database). */
export function buildAssetPublicUrl(storageKey: string): string {
  const cdn = publicCdnBase();
  if (cdn) return `${cdn}/${stripLeadingSlash(storageKey)}`;
  return `${appBase()}/api/assets/${encodeAssetPath(storageKey)}`;
}

export function encodeAssetPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function appBase(): string {
  return getAppUrl();
}

function publicCdnBase(): string | null {
  const base = process.env.NEXT_PUBLIC_CDN_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base?.trim()) return null;
  return base.replace(/\/$/, "");
}

/** Normalize legacy DB values that stored bare keys without CDN base. */
export function normalizeStoredAssetUrl(stored: string | null | undefined): string | null {
  return resolveAssetUrl(stored);
}
