import "server-only";

import { prisma } from "@/lib/db";
import { getObjectBufferFromR2 } from "@/lib/r2";
import { generateAvatarVariants } from "@/lib/avatar-processing";
import { revalidateProfileMedia } from "@/lib/media-revalidate";
import { resolveAvatarDisplayUrl } from "@/lib/avatar-url";
import { buildAssetPublicUrl } from "@/lib/assets";

export async function persistUserAvatarFromBuffer(
  userId: string,
  buffer: Buffer,
  contentType: string
) {
  const variants = await generateAvatarVariants(buffer, userId, contentType);

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl: variants.avatar128,
      avatar64Url: variants.avatar64,
      avatar128Url: variants.avatar128,
      avatar256Url: variants.avatar256,
      avatarOriginalUrl: variants.original,
    },
  });

  await revalidateProfileMedia(userId);
  return {
    variants,
    displayUrl: resolveAvatarDisplayUrl(variants.avatar128),
  };
}

export async function persistUserAvatarFromStorageKey(
  userId: string,
  fileKey: string,
  contentType: string
) {
  const buffer = await getObjectBufferFromR2(fileKey);
  return persistUserAvatarFromBuffer(userId, buffer, contentType);
}

export async function verifyAvatarStorage(userId: string): Promise<{
  ok: boolean;
  detail: string;
  displayUrl: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarUrl: true,
      avatar128Url: true,
      avatarOriginalUrl: true,
    },
  });

  if (!user?.avatarUrl && !user?.avatar128Url) {
    return { ok: false, detail: "No avatar URL stored in profile", displayUrl: null };
  }

  const displayUrl = resolveAvatarDisplayUrl(user.avatarUrl, user, 128);
  if (!displayUrl) {
    return { ok: false, detail: "Avatar URL could not be resolved", displayUrl: null };
  }

  try {
    const res = await fetch(displayUrl, { method: "HEAD", cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        detail: `Avatar not reachable (HTTP ${res.status})`,
        displayUrl,
      };
    }
    return { ok: true, detail: "Avatar reachable", displayUrl };
  } catch {
    return { ok: false, detail: "Avatar URL fetch failed", displayUrl };
  }
}

/** Fallback when sharp unavailable — store single public URL on all fields. */
export async function persistUserAvatarSimple(
  userId: string,
  fileKey: string,
  contentType: string
) {
  const url = buildAssetPublicUrl(fileKey);
  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl: url,
      avatar64Url: url,
      avatar128Url: url,
      avatar256Url: url,
      avatarOriginalUrl: url,
    },
  });
  await revalidateProfileMedia(userId);
  return { displayUrl: resolveAvatarDisplayUrl(url) };
}
