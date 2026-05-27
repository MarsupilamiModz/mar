"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ModPricing, ModStatus, ModVisibility, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionUser, requireActionPermission } from "@/lib/action-utils";
import { hasPermission } from "@/lib/permissions";
import { modCreateSchema } from "@/lib/validations";
import { uploadToR2 } from "@/lib/r2";
import { slugify } from "@/lib/utils";
import { CACHE_TAGS } from "@/lib/cache";
import { ensureModMediaSynced } from "@/lib/mod-media";
import { z } from "zod";

function invalidateModCaches() {
  revalidateTag(CACHE_TAGS.mods);
  revalidateTag(CACHE_TAGS.featured);
}

async function canEditMod(userId: string, role: UserRole, modAuthorId: string) {
  if (modAuthorId === userId) return true;
  return hasPermission(role, "mods.write") || hasPermission(role, "mods.moderate");
}

async function uniqueSlug(base: string) {
  let uniqueSlug = slugify(base);
  let i = 0;
  while (await prisma.mod.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slugify(base)}-${++i}`;
  }
  return uniqueSlug;
}

export async function createMod(input: z.infer<typeof modCreateSchema> & { authorId?: string }) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  const designerProfile = await prisma.designerProfile.findUnique({ where: { userId: user.id } });
  const isStaff = hasPermission(user.role, "mods.write");
  const canCreate =
    isStaff || user.role === "CREATOR" || user.role === "DESIGNER" || !!profile || !!designerProfile;
  if (!canCreate) return fail("Publisher access required");

  const parsed = modCreateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const authorId = isStaff && input.authorId ? input.authorId : user.id;
  const modSlug = await uniqueSlug(parsed.data.title);

  const mod = await prisma.mod.create({
    data: {
      slug: modSlug,
      title: parsed.data.title,
      description: parsed.data.description,
      shortDescription: parsed.data.shortDescription,
      gameId: parsed.data.gameId,
      categoryId: parsed.data.categoryId,
      authorId,
      pricing: parsed.data.pricing as ModPricing,
      priceCents: parsed.data.priceCents,
      supportedVersions: parsed.data.supportedVersions ?? [],
      status: isStaff ? "PUBLISHED" : "PENDING",
      publishedAt: isStaff ? new Date() : null,
      tags: parsed.data.tags
        ? { create: parsed.data.tags.map((name) => ({ name })) }
        : undefined,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "mod.create",
    entityType: "Mod",
    entityId: mod.id,
  });

  invalidateModCaches();
  revalidatePath("/mods");
  revalidatePath("/creator");
  revalidatePath("/designer");
  revalidatePath("/admin/mods");
  return ok({ id: mod.id, slug: mod.slug });
}

export async function updateMod(
  modId: string,
  input: Partial<z.infer<typeof modCreateSchema>> & {
    status?: ModStatus;
    visibility?: ModVisibility;
    isFeatured?: boolean;
    authorId?: string;
  }
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  const isStaff = hasPermission(user.role, "mods.write");
  const status = input.status ?? mod.status;
  const publishedAt =
    status === "PUBLISHED" && !mod.publishedAt ? new Date() : mod.publishedAt;

  const updated = await prisma.mod.update({
    where: { id: modId },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.description && { description: input.description }),
      ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
      ...(input.gameId && { gameId: input.gameId }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.pricing && { pricing: input.pricing as ModPricing }),
      ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
      ...(isStaff && input.status && { status, publishedAt }),
      ...(isStaff && input.visibility && { visibility: input.visibility }),
      ...(isStaff && input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(isStaff && input.authorId && { authorId: input.authorId }),
    },
  });

  if (input.tags) {
    await prisma.modTag.deleteMany({ where: { modId } });
    if (input.tags.length) {
      await prisma.modTag.createMany({
        data: input.tags.map((name) => ({ modId, name })),
      });
    }
  }

  invalidateModCaches();
  revalidatePath(`/mods/${updated.slug}`);
  revalidatePath("/admin/mods");
  return ok(updated);
}

export async function uploadModVersion(modId: string, formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  const file = formData.get("file") as File;
  const version = formData.get("version") as string;
  const changelog = (formData.get("changelog") as string) || undefined;
  const gameVersion = (formData.get("gameVersion") as string) || undefined;

  if (!file || !version) return fail("File and version required");
  if (file.size > 500 * 1024 * 1024) return fail("Max 500MB");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `mods/${mod.slug}/${version}/${file.name}`;
    await uploadToR2(key, buffer, file.type || "application/octet-stream");

    await prisma.$transaction([
      prisma.modVersion.updateMany({
        where: { modId, isPrimary: true },
        data: { isPrimary: false },
      }),
      prisma.modVersion.create({
        data: {
          modId,
          version,
          changelog,
          gameVersion,
          fileKey: key,
          fileSize: file.size,
          fileName: file.name,
          isPrimary: true,
        },
      }),
      prisma.modChangelog.create({
        data: { modId, version, content: changelog ?? `Version ${version} released` },
      }),
    ]);

    revalidatePath(`/mods/${mod.slug}`);
    return ok(undefined);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Version upload failed");
  }
}

export async function uploadModScreenshot(modId: string, formData: FormData) {
  const { uploadModScreenshot: upload } = await import("@/actions/mod-media");
  return upload(modId, formData);
}

export async function uploadModVideo(modId: string, formData: FormData) {
  const { uploadModVideo: upload } = await import("@/actions/mod-media");
  return upload(modId, formData);
}

export async function deleteMod(modId: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  await prisma.mod.delete({ where: { id: modId } });
  await createAuditLog({
    actorId: user.id,
    action: "mod.delete",
    entityType: "Mod",
    entityId: modId,
  });

  invalidateModCaches();
  revalidatePath("/admin/mods");
  revalidatePath("/mods");
  return ok(undefined);
}

export async function getAdminMods(params: {
  page?: number;
  search?: string;
  status?: ModStatus;
  gameId?: string;
}) {
  const { error } = await requireActionPermission("mods.read");
  if (error) return error;

  const page = params.page ?? 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(params.status && { status: params.status }),
    ...(params.gameId && { gameId: params.gameId }),
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: "insensitive" as const } },
        { slug: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [mods, total] = await Promise.all([
    prisma.mod.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        game: { select: { name: true } },
        author: { select: { username: true } },
        _count: { select: { versions: true, screenshots: true } },
      },
    }),
    prisma.mod.count({ where }),
  ]);

  return ok({ mods, total, pages: Math.ceil(total / limit), page });
}

export async function getModForEdit(modId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({
    where: { id: modId },
    select: { authorId: true },
  });

  if (!mod) return fail("Not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  await ensureModMediaSynced(modId);
  const withMedia = await prisma.mod.findUnique({
    where: { id: modId },
    include: {
      game: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      author: { select: { id: true, username: true } },
      tags: true,
      media: { orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }] },
      screenshots: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: { sortOrder: "asc" } },
      versions: { orderBy: { createdAt: "desc" } },
      changelog: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return ok(withMedia!);
}

export async function getUserMods(userId: string) {
  return prisma.mod.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      game: { select: { name: true } },
      _count: { select: { versions: true, downloads: true } },
    },
  });
}
