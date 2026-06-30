"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, fail, requireActionUser } from "@/lib/action-utils";
import { slugify } from "@/lib/utils";
import { fetchYouTubeMetadata, parseYouTubeUrl } from "@/lib/tutorials/youtube";
import { TutorialLevel, TutorialStatus, TutorialType } from "@prisma/client";
import { z } from "zod";

async function requireTutorialAdmin() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return { user: null as never, error: fail("Admin access required") };
  }
  return { user, error: null };
}

async function requireTutorialAuthor() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (!["OWNER", "ADMIN", "CREATOR"].includes(user.role)) {
    return { user: null as never, error: fail("Not authorized to manage tutorials") };
  }
  return { user, error: null };
}

export async function getTutorialsAdminData() {
  const { error } = await requireTutorialAuthor();
  if (error) return error;

  const [tutorials, categories] = await Promise.all([
    prisma.tutorial.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { name: true } },
        author: { select: { username: true } },
      },
    }),
    prisma.tutorialCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return ok({ tutorials, categories });
}

const _categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function saveTutorialCategory(input: z.infer<typeof _categorySchema> & { id?: string }) {
  const { error } = await requireTutorialAdmin();
  if (error) return error;

  const slug = input.slug?.trim() || slugify(input.name);
  const data = {
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    sortOrder: input.sortOrder ?? 0,
  };

  const record = input.id
    ? await prisma.tutorialCategory.update({ where: { id: input.id }, data })
    : await prisma.tutorialCategory.create({ data });

  revalidatePath("/admin/tutorials");
  revalidatePath("/tutorials");
  return ok(record);
}

const tutorialSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  type: z.nativeEnum(TutorialType),
  level: z.nativeEnum(TutorialLevel),
  status: z.nativeEnum(TutorialStatus),
  categoryId: z.string().optional().nullable(),
  youtubeUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  videoFileKey: z.string().optional().nullable(),
});

export async function saveTutorial(input: z.infer<typeof tutorialSchema> & { id?: string }) {
  const { user, error } = await requireTutorialAuthor();
  if (error) return error;

  const parsed = tutorialSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid input");

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
  let youtubeMeta: Awaited<ReturnType<typeof fetchYouTubeMetadata>> = null;

  if (
    (parsed.data.type === "YOUTUBE" || parsed.data.type === "MIXED") &&
    parsed.data.youtubeUrl
  ) {
    const { videoId } = parseYouTubeUrl(parsed.data.youtubeUrl);
    if (!videoId) return fail("Invalid YouTube URL");
    youtubeMeta = await fetchYouTubeMetadata(parsed.data.youtubeUrl);
  }

  const data = {
    title: parsed.data.title.trim(),
    slug,
    description: parsed.data.description?.trim() || null,
    content: parsed.data.content?.trim() || null,
    type: parsed.data.type,
    level: parsed.data.level,
    status: parsed.data.status,
    categoryId: parsed.data.categoryId || null,
    authorId: user.id,
    youtubeUrl: parsed.data.youtubeUrl?.trim() || null,
    youtubeVideoId: youtubeMeta?.videoId ?? null,
    youtubeTitle: youtubeMeta?.title ?? null,
    youtubeThumbnail: youtubeMeta?.thumbnail ?? null,
    youtubeDurationSec: youtubeMeta?.durationSec ?? null,
    youtubeChannel: youtubeMeta?.channel ?? null,
    videoUrl: parsed.data.videoUrl?.trim() || null,
    videoFileKey: parsed.data.videoFileKey?.trim() || null,
    publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
  };

  const record = input.id
    ? await prisma.tutorial.update({ where: { id: input.id }, data })
    : await prisma.tutorial.create({ data });

  revalidatePath("/admin/tutorials");
  revalidatePath("/tutorials");
  return ok(record);
}

export async function deleteTutorial(id: string) {
  const { error } = await requireTutorialAdmin();
  if (error) return error;
  await prisma.tutorial.delete({ where: { id } });
  revalidatePath("/admin/tutorials");
  revalidatePath("/tutorials");
  return ok(true);
}

export async function seedDefaultTutorialCategories() {
  const { error } = await requireTutorialAdmin();
  if (error) return error;

  const defaults = [
    "RageMP",
    "FiveM",
    "Singleplayer",
    "Mapping",
    "Modding",
    "Fahrzeuge",
    "Waffen",
    "Sound Design",
    "Installation",
    "Fehlerbehebung",
  ];

  for (let i = 0; i < defaults.length; i++) {
    const name = defaults[i]!;
    await prisma.tutorialCategory.upsert({
      where: { slug: slugify(name) },
      create: { name, slug: slugify(name), sortOrder: i },
      update: { sortOrder: i },
    });
  }

  revalidatePath("/admin/tutorials");
  return ok(true);
}

const TUTORIAL_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);
const MAX_TUTORIAL_VIDEO_BYTES = 250 * 1024 * 1024;

export async function uploadTutorialVideo(formData: FormData) {
  const { error } = await requireTutorialAuthor();
  if (error) return error;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("No video file selected");
  }
  if (file.size > MAX_TUTORIAL_VIDEO_BYTES) {
    return fail("Video must be under 250 MB");
  }
  const contentType = file.type || "video/mp4";
  if (!TUTORIAL_VIDEO_TYPES.has(contentType) && !file.name.match(/\.(mp4|webm|mov)$/i)) {
    return fail("Supported formats: mp4, webm, mov");
  }

  const { randomUUID } = await import("crypto");
  const { uploadToR2, getPublicAssetUrl } = await import("@/lib/r2");
  const { storageKey } = await import("@/lib/storage");

  const fileId = randomUUID().replace(/-/g, "").slice(0, 16);
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const key = storageKey("tutorials", fileId, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  const resolvedType = contentType.startsWith("video/") ? contentType : "video/mp4";

  await uploadToR2(key, buffer, resolvedType);
  const videoUrl = getPublicAssetUrl(key);

  return ok({ fileKey: key, videoUrl });
}
