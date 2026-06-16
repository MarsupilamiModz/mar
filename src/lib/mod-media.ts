import type { ModMediaType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { extractYouTubeId, youTubeThumbnailUrl } from "@/lib/youtube";
import { resolveAssetUrl } from "@/lib/assets";
import { storageKey } from "@/lib/storage";

export type ModMediaItem = {
  id: string;
  mediaType: ModMediaType;
  imageUrl: string | null;
  videoUrl: string | null;
  youtubeVideoId: string | null;
  orderIndex: number;
  isFeatured: boolean;
};

export function modImageStoragePath(modSlug: string, filename: string) {
  return storageKey("mod-images", modSlug, filename);
}

export function getMediaDisplayUrl(item: Pick<ModMediaItem, "mediaType" | "imageUrl" | "youtubeVideoId">) {
  if (item.mediaType === "IMAGE" && item.imageUrl) return resolveAssetUrl(item.imageUrl);
  if (item.mediaType === "YOUTUBE" && item.youtubeVideoId) {
    return youTubeThumbnailUrl(item.youtubeVideoId, "hq");
  }
  return null;
}

export function getFeaturedMediaUrl(
  media: ModMediaItem[],
  legacyScreenshots?: { url: string; sortOrder: number }[]
) {
  const featured = media.find((m) => m.isFeatured && m.mediaType === "IMAGE" && m.imageUrl);
  if (featured?.imageUrl) return resolveAssetUrl(featured.imageUrl);

  const featuredYt = media.find((m) => m.isFeatured && m.mediaType === "YOUTUBE" && m.youtubeVideoId);
  if (featuredYt?.youtubeVideoId) return youTubeThumbnailUrl(featuredYt.youtubeVideoId, "hq");

  const firstImage = media.find((m) => m.mediaType === "IMAGE" && m.imageUrl);
  if (firstImage?.imageUrl) return resolveAssetUrl(firstImage.imageUrl);

  const firstYt = media.find((m) => m.mediaType === "YOUTUBE" && m.youtubeVideoId);
  if (firstYt?.youtubeVideoId) return youTubeThumbnailUrl(firstYt.youtubeVideoId, "hq");

  return resolveAssetUrl(legacyScreenshots?.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null);
}

export function getGalleryImages(media: ModMediaItem[]) {
  return media
    .filter((m) => m.mediaType === "IMAGE" && m.imageUrl)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((m) => {
      const url = resolveAssetUrl(m.imageUrl!);
      return url ? { id: m.id, url } : null;
    })
    .filter((item): item is { id: string; url: string } => item !== null);
}

export function getYouTubeVideos(media: ModMediaItem[]) {
  return media
    .filter((m) => m.mediaType === "YOUTUBE" && m.youtubeVideoId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function ensureModMediaSynced(modId: string) {
  try {
    const existing = await prisma.modMedia.count({ where: { modId } });
    if (existing > 0) return;
  } catch {
    return;
  }

  try {
    const mod = await prisma.mod.findUnique({
      where: { id: modId },
      include: {
        screenshots: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!mod) return;

    const items: {
      modId: string;
      mediaType: ModMediaType;
      imageUrl?: string;
      videoUrl?: string;
      youtubeVideoId?: string;
      orderIndex: number;
      isFeatured: boolean;
    }[] = [];

    mod.screenshots.forEach((s, i) => {
      items.push({
        modId,
        mediaType: "IMAGE",
        imageUrl: s.url,
        orderIndex: i,
        isFeatured: i === 0,
      });
    });

    mod.videos.forEach((v, i) => {
      const youtubeVideoId = extractYouTubeId(v.url);
      items.push({
        modId,
        mediaType: "YOUTUBE",
        videoUrl: v.url,
        youtubeVideoId: youtubeVideoId ?? undefined,
        orderIndex: mod.screenshots.length + i,
        isFeatured: false,
      });
    });

    if (items.length > 0) {
      await prisma.modMedia.createMany({ data: items });
    }
  } catch {
    // mod_media table may not exist yet — run prisma db push
  }
}

export function mapModMedia(
  media: Array<{
    id: string;
    mediaType: ModMediaType;
    imageUrl: string | null;
    videoUrl: string | null;
    youtubeVideoId: string | null;
    orderIndex: number;
    isFeatured: boolean;
  }>
): ModMediaItem[] {
  return media.map((m) => ({
    id: m.id,
    mediaType: m.mediaType,
    imageUrl: m.imageUrl,
    videoUrl: m.videoUrl,
    youtubeVideoId: m.youtubeVideoId,
    orderIndex: m.orderIndex,
    isFeatured: m.isFeatured,
  }));
}
