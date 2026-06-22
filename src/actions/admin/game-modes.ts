"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission, formatZodError } from "@/lib/action-utils";
import { uploadAsset } from "@/lib/asset-storage";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { CACHE_TAGS } from "@/lib/cache";
import { invalidatePlatformCacheKey, PLATFORM_CACHE_KEYS } from "@/lib/platform-cache";
import { resolveSlug, ensureUniqueSlug, zSlugInput } from "@/lib/slug";

const modeSchema = z.object({
  name: z.string().min(2).max(80),
  slug: zSlugInput,
  description: z.string().max(5000).optional(),
  accentColor: z.string().max(32).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function revalidateGamePaths(gameSlug: string, modeSlug?: string) {
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath(`/games/${gameSlug}`);
  if (modeSlug) revalidatePath(`/games/${gameSlug}/${modeSlug}`);
  revalidatePath("/admin/games");
  revalidateTag(CACHE_TAGS.games);
  void invalidatePlatformCacheKey(PLATFORM_CACHE_KEYS.navGames);
  void invalidatePlatformCacheKey(PLATFORM_CACHE_KEYS.gameModeBundles(gameSlug));
}

export async function createGameMode(
  gameId: string,
  input: z.infer<typeof modeSchema>
) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const parsed = modeSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { slug: true } });
  if (!game) return fail("Game not found");

  const resolved = resolveSlug({ name: parsed.data.name, slug: parsed.data.slug });
  const slug = await ensureUniqueSlug(resolved.slug, async (s) =>
    Boolean(
      await prisma.gameMode.findUnique({
        where: { gameId_slug: { gameId, slug: s } },
      })
    )
  );

  const siblings = await prisma.gameMode.count({ where: { gameId } });

  const mode = await prisma.gameMode.create({
    data: {
      gameId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      accentColor: parsed.data.accentColor,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? siblings,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "game_mode.create",
    entityType: "GameMode",
    entityId: mode.id,
  });

  revalidateGamePaths(game.slug, mode.slug);
  return ok(mode);
}

export async function updateGameMode(
  modeId: string,
  input: Partial<z.infer<typeof modeSchema>>
) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const parsed = modeSchema.partial().safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const existing = await prisma.gameMode.findUnique({
    where: { id: modeId },
    include: { game: { select: { slug: true, id: true } } },
  });
  if (!existing) return fail("Game mode not found");

  let slug: string | undefined;
  if (parsed.data.slug || parsed.data.name) {
    const resolved = resolveSlug({
      name: parsed.data.name ?? existing.name,
      slug: parsed.data.slug ?? existing.slug,
    });
    slug = await ensureUniqueSlug(resolved.slug, async (s) => {
      const hit = await prisma.gameMode.findUnique({
        where: { gameId_slug: { gameId: existing.gameId, slug: s } },
      });
      return Boolean(hit && hit.id !== modeId);
    });
  }

  const mode = await prisma.gameMode.update({
    where: { id: modeId },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(slug && { slug }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.accentColor !== undefined && { accentColor: parsed.data.accentColor }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "game_mode.update",
    entityType: "GameMode",
    entityId: modeId,
  });

  revalidateGamePaths(existing.game.slug, mode.slug);
  return ok(mode);
}

export async function deleteGameMode(modeId: string) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const modCount = await prisma.mod.count({ where: { modeId } });
  if (modCount > 0) return fail("Game mode has mods — reassign them first");

  const mode = await prisma.gameMode.delete({
    where: { id: modeId },
    include: { game: { select: { slug: true } } },
  });

  await createAuditLog({
    actorId: user.id,
    action: "game_mode.delete",
    entityType: "GameMode",
    entityId: modeId,
  });

  revalidateGamePaths(mode.game.slug);
  return ok(undefined);
}

export async function duplicateGameMode(modeId: string) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  const source = await prisma.gameMode.findUnique({
    where: { id: modeId },
    include: { game: { select: { slug: true } } },
  });
  if (!source) return fail("Game mode not found");

  const baseSlug = `${source.slug}-copy`;
  const slug = await ensureUniqueSlug(baseSlug, async (s) =>
    Boolean(
      await prisma.gameMode.findUnique({
        where: { gameId_slug: { gameId: source.gameId, slug: s } },
      })
    )
  );

  const siblings = await prisma.gameMode.count({ where: { gameId: source.gameId } });

  const mode = await prisma.gameMode.create({
    data: {
      gameId: source.gameId,
      slug,
      name: `${source.name} (Copy)`,
      description: source.description,
      thumbnailUrl: source.thumbnailUrl,
      bannerUrl: source.bannerUrl,
      backgroundUrl: source.backgroundUrl,
      logoUrl: source.logoUrl,
      iconUrl: source.iconUrl,
      accentColor: source.accentColor,
      isActive: false,
      sortOrder: siblings,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "game_mode.duplicate",
    entityType: "GameMode",
    entityId: mode.id,
  });

  revalidateGamePaths(source.game.slug, mode.slug);
  return ok(mode);
}

export async function reorderGameModes(gameId: string, modeIds: string[]) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { slug: true } });
  if (!game) return fail("Game not found");

  await prisma.$transaction(
    modeIds.map((id, index) =>
      prisma.gameMode.update({ where: { id, gameId }, data: { sortOrder: index } })
    )
  );

  revalidateGamePaths(game.slug);
  return ok(undefined);
}

export async function uploadGameModeAsset(
  modeId: string,
  type: "thumbnail" | "banner" | "background" | "logo" | "icon",
  formData: FormData
) {
  const { user, error } = await requireActionPermission("games.write");
  if (error) return error;

  try {
    const file = formData.get("file") as File;
    const validation = validateUploadFile(file, {
      maxSizeMb: 5,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      label: "Game mode asset",
    });
    if (!validation.valid) return fail(validation.error);

    const mode = await prisma.gameMode.findUnique({
      where: { id: modeId },
      include: { game: { select: { slug: true } } },
    });
    if (!mode) return fail("Game mode not found");

    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = `${mode.game.slug}/modes/${mode.slug}-${type}-${Date.now()}.${extensionForMime(validation.mime)}`;
    const result = await uploadAsset({
      bucket: "games",
      relativePath,
      body: buffer,
      contentType: validation.mime,
    });

    const field =
      type === "thumbnail"
        ? "thumbnailUrl"
        : type === "banner"
          ? "bannerUrl"
          : type === "background"
            ? "backgroundUrl"
            : type === "logo"
              ? "logoUrl"
              : "iconUrl";

    await prisma.gameMode.update({
      where: { id: modeId },
      data: { [field]: result.url },
    });

    await createAuditLog({
      actorId: user.id,
      action: `game_mode.upload_${type}`,
      entityType: "GameMode",
      entityId: modeId,
    });

    revalidateGamePaths(mode.game.slug, mode.slug);
    return ok({ url: result.url });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Upload failed");
  }
}
