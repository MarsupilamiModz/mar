import { getMediaUrl, getMediaProxyFallback } from "@/lib/media-url";

type AvatarUser = {
  avatar64Url?: string | null;
  avatar128Url?: string | null;
  avatar256Url?: string | null;
  avatarUrl?: string | null;
  avatarOriginalUrl?: string | null;
};

function pickStoredAvatar(user: AvatarUser, size: 64 | 128 | 256): string | null {
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

/** Prefer same-origin /api/assets proxy — reliable when CDN blocks hotlinking. */
export function resolveAvatarDisplayUrl(
  stored: string | null | undefined,
  user?: AvatarUser,
  size: 64 | 128 | 256 = 128
): string | null {
  const raw = (user ? pickStoredAvatar(user, size) : null) ?? stored ?? null;
  if (!raw?.trim()) return null;
  return getMediaProxyFallback(raw) ?? getMediaUrl(raw);
}

export function bustAvatarUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const base = url.split("?")[0];
  return `${base}?v=${Date.now()}`;
}
