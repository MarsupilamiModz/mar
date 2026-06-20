"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser, requireActionPermission } from "@/lib/action-utils";
import { hasPermission } from "@/lib/permissions";
import { uploadAsset } from "@/lib/asset-storage";
import { registerMediaFile } from "@/lib/media-files";
import { getMediaSettings, updateMediaSettings, type MediaSettings } from "@/lib/media-settings";
import { modImageStoragePath } from "@/lib/mod-media";
import { extractYouTubeId, youTubeThumbnailUrl } from "@/lib/youtube";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { CACHE_TAGS } from "@/lib/cache";
import { locales } from "@/i18n/config";
import type { UserRole } from "@prisma/client";

async function canEditMod(userId: string, role: UserRole, modAuthorId: string) {
  if (modAuthorId === userId) return true;
  return hasPermission(role, "mods.write") || hasPermission(role, "mods.moderate");
}

async function getModForMedia(modId: string) {
  return prisma.mod.findUnique({
    where: { id: modId },
    select: { id: true, slug: true, authorId: true },
  });
}

function revalidateModPaths(slug: string) {
  revalidateTag(CACHE_TAGS.mod(slug));
  revalidateTag(CACHE_TAGS.mods);
  revalidateTag(CACHE_TAGS.featured);
  for (const locale of locales) {
    revalidatePath(`/${locale}/mods/${slug}`);
  }
}

export async function uploadModMediaImages(modId: string, formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  try {
    const mod = await getModForMedia(modId);
    if (!mod) return fail("Mod not found");
    if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

    const settings = await getMediaSettings();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return fail("No files provided");

    const currentCount = await prisma.modMedia.count({
      where: { modId, mediaType: "IMAGE" },
    });
    if (currentCount + files.length > settings.maxScreenshots) {
      return fail(`Maximum ${settings.maxScreenshots} screenshots allowed`);
    }

    const uploaded: string[] = [];
    let orderIndex = await prisma.modMedia.count({ where: { modId } });
    const hasFeatured = await prisma.modMedia.count({ where: { modId, isFeatured: true } });

    for (const file of files) {
      const validation = validateUploadFile(file, {
        allowedTypes: settings.allowedTypes,
        maxSizeMb: settings.maxFileSizeMb,
        label: "Screenshot",
      });
      if (!validation.valid) return fail(validation.error);

      const ext = extensionForMime(validation.mime);
      const relativePath = `${mod.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const result = await uploadAsset({
        bucket: "mod-images",
        relativePath,
        body: buffer,
        contentType: validation.mime,
      });

      const publicUrl = result.url;
      if (result.key) {
        await registerMediaFile({
          storagePath: result.key,
          originalName: file.name,
          mimeType: validation.mime,
          fileSize: buffer.length,
          entityType: "MOD_SCREENSHOT",
          entityId: modId,
          uploadedById: user.id,
        }).catch(() => undefined);
      }

      const media = await prisma.modMedia.create({
        data: {
          modId,
          mediaType: "IMAGE",
          imageUrl: publicUrl,
          orderIndex: orderIndex++,
          isFeatured: hasFeatured === 0 && uploaded.length === 0,
        },
      });
      uploaded.push(media.id);
    }

    revalidateModPaths(mod.slug);
    return ok({ uploaded });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return fail(message);
  }
}

export async function addModYouTubeVideo(modId: string, formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  try {
    const mod = await getModForMedia(modId);
    if (!mod) return fail("Mod not found");
    if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

    const url = (formData.get("url") as string)?.trim();
    if (!url) return fail("Video URL required");

    const youtubeVideoId = extractYouTubeId(url);
    if (!youtubeVideoId) return fail("Invalid YouTube URL");

    const orderIndex = await prisma.modMedia.count({ where: { modId } });
    await prisma.modMedia.create({
      data: {
        modId,
        mediaType: "YOUTUBE",
        videoUrl: url,
        youtubeVideoId,
        orderIndex,
        isFeatured: false,
      },
    });

    revalidateModPaths(mod.slug);
    return ok({ youtubeVideoId, thumbnail: youTubeThumbnailUrl(youtubeVideoId) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add video";
    return fail(message);
  }
}

export async function deleteModMedia(mediaId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  try {
    const media = await prisma.modMedia.findUnique({
      where: { id: mediaId },
      include: { mod: { select: { slug: true, authorId: true } } },
    });
    if (!media) return fail("Not found");
    if (!(await canEditMod(user.id, user.role, media.mod.authorId))) return fail("Forbidden");

    const wasFeatured = media.isFeatured;
    await prisma.modMedia.delete({ where: { id: mediaId } });

    if (wasFeatured) {
      const next = await prisma.modMedia.findFirst({
        where: { modId: media.modId, mediaType: "IMAGE" },
        orderBy: { orderIndex: "asc" },
      });
      if (next) {
        await prisma.modMedia.update({ where: { id: next.id }, data: { isFeatured: true } });
      }
    }

    revalidateModPaths(media.mod.slug);
    return ok(undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return fail(message);
  }
}

export async function reorderModMedia(modId: string, orderedIds: string[]) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  try {
    const mod = await getModForMedia(modId);
    if (!mod) return fail("Mod not found");
    if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.modMedia.update({ where: { id, modId }, data: { orderIndex: index } })
      )
    );

    revalidateModPaths(mod.slug);
    return ok(undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reorder failed";
    return fail(message);
  }
}

export async function setFeaturedModMedia(mediaId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  try {
    const media = await prisma.modMedia.findUnique({
      where: { id: mediaId },
      include: { mod: { select: { slug: true, authorId: true } } },
    });
    if (!media) return fail("Not found");
    if (media.mediaType !== "IMAGE") return fail("Only images can be featured thumbnails");
    if (!(await canEditMod(user.id, user.role, media.mod.authorId))) return fail("Forbidden");

    await prisma.$transaction([
      prisma.modMedia.updateMany({ where: { modId: media.modId }, data: { isFeatured: false } }),
      prisma.modMedia.update({ where: { id: mediaId }, data: { isFeatured: true } }),
    ]);

    revalidateModPaths(media.mod.slug);
    return ok(undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return fail(message);
  }
}

export async function getAdminMediaSettings() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getMediaSettings());
}

export async function saveAdminMediaSettings(settings: MediaSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  if (settings.maxScreenshots < 1 || settings.maxScreenshots > 50) {
    return fail("Max screenshots must be between 1 and 50");
  }
  if (settings.minScreenshots < 0 || settings.minScreenshots > settings.maxScreenshots) {
    return fail("Invalid min screenshots");
  }

  await updateMediaSettings(settings);
  return ok(undefined);
}

export async function uploadModScreenshot(modId: string, formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return fail("No file");
  const fd = new FormData();
  fd.append("files", file);
  return uploadModMediaImages(modId, fd);
}

export async function uploadModVideo(modId: string, formData: FormData) {
  return addModYouTubeVideo(modId, formData);
}

export { modImageStoragePath };
