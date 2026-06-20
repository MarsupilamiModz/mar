import { getAppUrl } from "@/lib/app-url";
import { getMediaUrl } from "@/lib/media-url";

/** Resolve stored asset keys or partial paths into browser-loadable URLs. */
export function resolveAssetUrl(urlOrKey: string | null | undefined): string | null {
  return getMediaUrl(urlOrKey);
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
  const base =
    process.env.NEXT_PUBLIC_CDN_URL ??
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ??
    process.env.R2_PUBLIC_URL;
  if (!base?.trim()) return null;
  return base.replace(/\/$/, "");
}

/** Normalize legacy DB values that stored bare keys without CDN base. */
export function normalizeStoredAssetUrl(stored: string | null | undefined): string | null {
  return resolveAssetUrl(stored);
}

/** Default avatar SVG data URI — never broken. */
export const DEFAULT_AVATAR_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="32" fill="#1e1b4b"/><circle cx="32" cy="26" r="12" fill="#6366f1"/><path d="M12 56c4-12 12-18 20-18s16 6 20 18" fill="#6366f1"/></svg>`
  );

function pickAvatarUrl(
  user: {
    avatar64Url?: string | null;
    avatar128Url?: string | null;
    avatar256Url?: string | null;
    avatarUrl?: string | null;
    avatarOriginalUrl?: string | null;
  },
  size: 64 | 128 | 256 = 128
): string | null {
  switch (size) {
    case 64:
      return user.avatar64Url ?? user.avatar128Url ?? user.avatarUrl ?? user.avatarOriginalUrl ?? null;
    case 128:
      return user.avatar128Url ?? user.avatar256Url ?? user.avatarUrl ?? user.avatarOriginalUrl ?? null;
    case 256:
      return user.avatar256Url ?? user.avatarUrl ?? user.avatarOriginalUrl ?? null;
    default:
      return user.avatarUrl ?? null;
  }
}

export function resolveAvatarUrl(
  urlOrKey: string | null | undefined,
  user?: {
    avatar64Url?: string | null;
    avatar128Url?: string | null;
    avatar256Url?: string | null;
    avatarUrl?: string | null;
    avatarOriginalUrl?: string | null;
  },
  size: 64 | 128 | 256 = 128
): string {
  if (user) {
    const picked = pickAvatarUrl(user, size);
    if (picked) return getMediaUrl(picked) ?? DEFAULT_AVATAR_DATA_URI;
  }
  return getMediaUrl(urlOrKey) ?? DEFAULT_AVATAR_DATA_URI;
}
