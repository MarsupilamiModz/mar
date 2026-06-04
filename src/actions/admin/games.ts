"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission, actionTry, formatZodError } from "@/lib/action-utils";
import { uploadAsset } from "@/lib/asset-storage";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { CACHE_TAGS } from "@/lib/cache";
import { slugify } from "@/lib/utils";
import type { BannerAlign, BannerDisplayType } from "@prisma/client";

const gameSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(300).optional(),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function getAdminGames() {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  return actionTry(
    () =>
      prisma.game.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { mods: true, categories: true } } },
      }),
    "games:list"
  );
}

export async function getAdminGame(id: string) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  if (!game) return fail("Game not found");
  return ok(game);
}

export async function createGame(input: z.infer<typeof gameSchema>) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    const exists = await prisma.game.findUnique({ where: { slug } });
    if (exists) throw new Error("Slug already exists");

    const game = await prisma.game.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        shortDescription: parsed.data.shortDescription,
        seoTitle: parsed.data.seoTitle ?? parsed.data.name,
        seoDescription: parsed.data.seoDescription ?? parsed.data.description?.slice(0, 160),
        isFeatured: parsed.data.isFeatured ?? false,
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: "game.create",
      entityType: "Game",
      entityId: game.id,
    });

    revalidatePath("/");
    revalidatePath("/games");
    revalidatePath("/admin/games");
    return game;
  }, "games:create");
}

export async function updateGame(id: string, input: z.infer<typeof gameSchema>) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const game = await prisma.game.update({
      where: { id },
      data: {
        name: parsed.data.name,
        ...(parsed.data.slug && { slug: parsed.data.slug }),
        description: parsed.data.description,
        shortDescription: parsed.data.shortDescription,
        seoTitle: parsed.data.seoTitle,
        seoDescription: parsed.data.seoDescription,
        isFeatured: parsed.data.isFeatured,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: "game.update",
      entityType: "Game",
      entityId: id,
    });

    revalidatePath("/");
    revalidatePath("/games");
    revalidatePath(`/games/${game.slug}`);
    revalidatePath("/admin/games");
    return game;
  }, "games:update");
}

export async function deleteGame(id: string) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  return actionTry(async () => {
    const modCount = await prisma.mod.count({ where: { gameId: id } });
    if (modCount > 0) throw new Error("Cannot delete game with existing mods");

    await prisma.game.delete({ where: { id } });

    await createAuditLog({
      actorId: user.id,
      action: "game.delete",
      entityType: "Game",
      entityId: id,
    });

    revalidatePath("/");
    revalidatePath("/admin/games");
  }, "games:delete");
}

export async function uploadGameAsset(
  gameId: string,
  type: "icon" | "banner" | "cover",
  formData: FormData
) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  try {
    const file = formData.get("file") as File;
    const validation = validateUploadFile(file, {
      maxSizeMb: 5,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      label: "Game asset",
    });
    if (!validation.valid) return fail(validation.error);

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return fail("Game not found");

    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = `${game.slug}/${type}-${Date.now()}.${extensionForMime(validation.mime)}`;
    const result = await uploadAsset({
      bucket: "games",
      relativePath,
      body: buffer,
      contentType: validation.mime,
    });

    const field = type === "icon" ? "iconUrl" : type === "banner" ? "bannerUrl" : "coverUrl";

    await prisma.game.update({
      where: { id: gameId },
      data: { [field]: result.url },
    });

    await createAuditLog({
      actorId: user.id,
      action: `game.upload_${type}`,
      entityType: "Game",
      entityId: gameId,
    });

    revalidatePath(`/games/${game.slug}`);
    revalidatePath("/admin/games");
    return ok({ url: result.url });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Upload failed");
  }
}

export async function createGameCategory(
  gameId: string,
  input: { name: string; slug?: string; description?: string; isVisible?: boolean; parentId?: string | null }
) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  let slug = input.slug ?? slugify(input.name);
  if (input.parentId) {
    const parent = await prisma.gameCategory.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.gameId !== gameId) return fail("Invalid parent category");
    slug = `${parent.slug}-${slug}`;
  }

  const exists = await prisma.gameCategory.findUnique({
    where: { gameId_slug: { gameId, slug } },
  });
  if (exists) return fail("Slug already exists for this game");

  const siblings = await prisma.gameCategory.count({
    where: { gameId, parentId: input.parentId ?? null },
  });

  const category = await prisma.gameCategory.create({
    data: {
      gameId,
      parentId: input.parentId ?? null,
      name: input.name,
      slug,
      description: input.description,
      isVisible: input.isVisible ?? true,
      sortOrder: siblings,
    },
  });

  revalidatePath("/admin/games");
  revalidateTag(CACHE_TAGS.games);
  return ok(category);
}

export async function updateGameCategory(
  categoryId: string,
  input: {
    name?: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
    isVisible?: boolean;
    parentId?: string | null;
  }
) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  const category = await prisma.gameCategory.update({
    where: { id: categoryId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.slug && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isVisible !== undefined && { isVisible: input.isVisible }),
    },
    include: { game: { select: { slug: true } } },
  });

  revalidatePath("/admin/games");
  revalidatePath(`/games/${category.game.slug}`);
  revalidateTag(CACHE_TAGS.games);
  return ok(category);
}

export async function deleteGameCategory(categoryId: string) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  const childCount = await prisma.gameCategory.count({ where: { parentId: categoryId } });
  if (childCount > 0) return fail("Delete subcategories first");

  const modCount = await prisma.mod.count({ where: { categoryId } });
  if (modCount > 0) return fail("Category has mods — reassign them first");

  const category = await prisma.gameCategory.delete({
    where: { id: categoryId },
    include: { game: { select: { slug: true } } },
  });

  revalidatePath("/admin/games");
  revalidatePath(`/games/${category.game.slug}`);
  revalidateTag(CACHE_TAGS.games);
  return ok(undefined);
}

export async function reorderCategories(gameId: string, categoryIds: string[]) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  await prisma.$transaction(
    categoryIds.map((id, index) =>
      prisma.gameCategory.update({ where: { id, gameId }, data: { sortOrder: index } })
    )
  );

  revalidatePath("/admin/games");
  revalidateTag(CACHE_TAGS.games);
  return ok(undefined);
}

export async function reorderGames(ids: string[]) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  return actionTry(async () => {
    await prisma.$transaction(
      ids.map((id, index) => prisma.game.update({ where: { id }, data: { sortOrder: index } }))
    );

    await createAuditLog({
      actorId: user.id,
      action: "game.reorder",
      entityType: "Game",
      entityId: "bulk",
    });

    revalidatePath("/");
    revalidatePath("/admin/games");
    revalidateTag(CACHE_TAGS.games);
  }, "games:reorder");
}

const bannerSettingsSchema = z.object({
  bannerDisplayType: z.enum(["SMALL", "FEATURED", "CUSTOM"]),
  bannerHeightPx: z.number().int().min(120).max(800).nullable().optional(),
  bannerFocusX: z.number().min(0).max(100),
  bannerFocusY: z.number().min(0).max(100),
  bannerZoom: z.number().min(1).max(2),
  bannerAlign: z.enum(["CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]),
});

export async function updateGameBannerSettings(
  id: string,
  input: z.infer<typeof bannerSettingsSchema>
) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const parsed = bannerSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const game = await prisma.game.update({
      where: { id },
      data: {
        bannerDisplayType: parsed.data.bannerDisplayType as BannerDisplayType,
        bannerHeightPx: parsed.data.bannerHeightPx ?? null,
        bannerFocusX: parsed.data.bannerFocusX,
        bannerFocusY: parsed.data.bannerFocusY,
        bannerZoom: parsed.data.bannerZoom,
        bannerAlign: parsed.data.bannerAlign as BannerAlign,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: "game.banner_settings",
      entityType: "Game",
      entityId: id,
    });

    revalidatePath("/admin/games");
    revalidatePath(`/games/${game.slug}`);
    revalidateTag(CACHE_TAGS.games);
    return game;
  }, "games:banner-settings");
}
