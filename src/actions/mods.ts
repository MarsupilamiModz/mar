"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  FileScanStatus,
  ModPricing,
  ModStatus,
  ModVisibility,
  Prisma,
  UserRole,
  VersionChannel,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionUser, requireActionPermission } from "@/lib/action-utils";
import { hasPermission } from "@/lib/permissions";
import { modCreateSchema } from "@/lib/validations";
import { modFileKey, quarantineKey, uploadToR2 } from "@/lib/r2";
import { getMalwareScannerSettings, isScannableFileName } from "@/lib/malware-settings";
import { resolvePostScanModStatus, scanFileBuffer } from "@/lib/malware-scanner";
import { createHash } from "crypto";
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

const modUpdateSchema = modCreateSchema.partial().extend({
  categoryId: z.string().cuid().nullable().optional(),
  status: z.enum(["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  isFeatured: z.boolean().optional(),
  authorId: z.string().cuid().optional(),
});

function dedupeTags(tags: string[]) {
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
}

function prismaErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") return "Invalid game, category, or author reference";
    if (err.code === "P2002") return "Duplicate value — check tags or slug";
  }
  return err instanceof Error ? err.message : "Update failed";
}

export async function updateMod(
  modId: string,
  input: Omit<Partial<z.infer<typeof modCreateSchema>>, "categoryId"> & {
    status?: ModStatus;
    visibility?: ModVisibility;
    isFeatured?: boolean;
    authorId?: string;
    categoryId?: string | null;
  }
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  const parsed = modUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const data = parsed.data;
  const isStaff = hasPermission(user.role, "mods.write");
  const nextGameId = data.gameId ?? mod.gameId;
  const nextCategoryId =
    input.categoryId === null || input.categoryId === ""
      ? null
      : input.categoryId !== undefined
        ? input.categoryId
        : data.categoryId;

  if (nextCategoryId) {
    const category = await prisma.gameCategory.findFirst({
      where: { id: nextCategoryId, gameId: nextGameId },
    });
    if (!category) return fail("Category does not belong to the selected game");
  }

  const status = data.status ?? mod.status;
  const publishedAt =
    status === "PUBLISHED" && !mod.publishedAt ? new Date() : mod.publishedAt;

  const priceCents =
    data.pricing === "PAID"
      ? data.priceCents ?? mod.priceCents ?? 0
      : data.pricing
        ? null
        : data.priceCents;

  try {
    const updated = await prisma.mod.update({
      where: { id: modId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
        ...(data.gameId && { gameId: data.gameId }),
        ...(input.categoryId !== undefined || data.categoryId !== undefined
          ? { categoryId: nextCategoryId }
          : {}),
        ...(data.pricing && { pricing: data.pricing as ModPricing }),
        ...(priceCents !== undefined && { priceCents }),
        ...(isStaff && data.status && { status, publishedAt }),
        ...(isStaff && data.visibility && { visibility: data.visibility as ModVisibility }),
        ...(isStaff && data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        ...(isStaff && data.authorId && { authorId: data.authorId }),
      },
    });

    if (data.tags) {
      const tags = dedupeTags(data.tags);
      await prisma.modTag.deleteMany({ where: { modId } });
      if (tags.length) {
        await prisma.modTag.createMany({
          data: tags.map((name) => ({ modId, name })),
          skipDuplicates: true,
        });
      }
    }

    if (status === "PUBLISHED" && mod.status !== "PUBLISHED") {
      const { notifyCreatorFollowers } = await import("@/lib/follows");
      void notifyCreatorFollowers(updated.authorId, {
        title: "New mod published",
        body: `${updated.title} is now live`,
        link: `/mods/${updated.slug}`,
      });
    }

    await createAuditLog({
      actorId: user.id,
      action: "mod.update",
      entityType: "Mod",
      entityId: modId,
    });

    invalidateModCaches();
    revalidatePath(`/mods/${updated.slug}`);
    revalidatePath("/admin/mods");
    return ok(updated);
  } catch (err) {
    console.error("[updateMod]", err);
    return fail(prismaErrorMessage(err));
  }
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
  const channelRaw = (formData.get("channel") as string) || "STABLE";
  const channel = (["STABLE", "BETA", "ARCHIVED"].includes(channelRaw)
    ? channelRaw
    : "STABLE") as VersionChannel;

  if (!file || !version) return fail("File and version required");
  if (file.size > 500 * 1024 * 1024) return fail("Max 500MB");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const settings = await getMalwareScannerSettings();
    const qKey = quarantineKey(mod.slug, version, file.name);

    await uploadToR2(qKey, buffer, file.type || "application/octet-stream", "private, max-age=86400");

    let scanResult = {
      status: "CLEAN" as FileScanStatus,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      detections: 0,
      totalEngines: 0,
      report: {} as Record<string, unknown>,
      blocked: false,
    };

    if (settings.enabled && isScannableFileName(file.name)) {
      scanResult = await scanFileBuffer(buffer, file.name);
    } else if (settings.enabled) {
      scanResult = {
        status: "MANUAL_REVIEW",
        sha256: "",
        detections: 0,
        totalEngines: 0,
        report: { reason: "Unsupported extension for automated scan" },
        blocked: false,
      };
    }

    if (scanResult.blocked || scanResult.status === "MALWARE") {
      await prisma.fileScanLog.create({
        data: {
          modId,
          fileName: file.name,
          fileSize: file.size,
          sha256: scanResult.sha256,
          status: scanResult.status,
          detections: scanResult.detections,
          totalEngines: scanResult.totalEngines,
          report: scanResult.report as Prisma.InputJsonValue,
          blocked: true,
        },
      });
      return fail("Upload blocked: malware detected");
    }

    const productionKey = modFileKey(mod.slug, version, file.name);
    await uploadToR2(productionKey, buffer, file.type || "application/octet-stream");

    const modStatusOverride = resolvePostScanModStatus(scanResult.status, settings.autoApproveClean);
    const makePrimary = channel !== "ARCHIVED" && scanResult.status === "CLEAN";

    const created = await prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.modVersion.updateMany({
          where: { modId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const modVersion = await tx.modVersion.create({
        data: {
          modId,
          version,
          changelog,
          gameVersion,
          fileKey: productionKey,
          fileSize: file.size,
          fileName: file.name,
          sha256: scanResult.sha256 || null,
          scanStatus: scanResult.status,
          scanReport: scanResult.report as Prisma.InputJsonValue,
          scannedAt: new Date(),
          channel,
          isPrimary: makePrimary,
          isArchived: channel === "ARCHIVED",
        },
      });

      await tx.fileScanLog.create({
        data: {
          modVersionId: modVersion.id,
          modId,
          fileName: file.name,
          fileSize: file.size,
          sha256: scanResult.sha256 || "pending",
          status: scanResult.status,
          detections: scanResult.detections,
          totalEngines: scanResult.totalEngines,
          report: scanResult.report as Prisma.InputJsonValue,
          blocked: false,
        },
      });

      await tx.modChangelog.create({
        data: { modId, version, content: changelog ?? `Version ${version} released` },
      });

      if (modStatusOverride) {
        await tx.mod.update({
          where: { id: modId },
          data: { status: modStatusOverride },
        });
      }

      return modVersion;
    });

    revalidatePath(`/mods/${mod.slug}`);
    revalidatePath("/admin/security");

    if (scanResult.status === "SUSPICIOUS" || scanResult.status === "MANUAL_REVIEW") {
      return ok({
        versionId: created.id,
        scanStatus: scanResult.status,
        message: "Upload queued for security review",
      });
    }

    return ok({ versionId: created.id, scanStatus: scanResult.status });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Version upload failed");
  }
}

export async function archiveModVersion(versionId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");
  if (!(await canEditMod(user.id, user.role, version.mod.authorId))) return fail("Forbidden");

  await prisma.modVersion.update({
    where: { id: versionId },
    data: { isArchived: true, channel: "ARCHIVED", isPrimary: false },
  });

  const nextPrimary = await prisma.modVersion.findFirst({
    where: { modId: version.modId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  if (nextPrimary && version.isPrimary) {
    await prisma.modVersion.update({
      where: { id: nextPrimary.id },
      data: { isPrimary: true },
    });
  }

  revalidatePath(`/mods/${version.mod.slug}`);
  return ok(undefined);
}

export async function restoreModVersion(versionId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");
  if (!(await canEditMod(user.id, user.role, version.mod.authorId))) return fail("Forbidden");

  await prisma.modVersion.update({
    where: { id: versionId },
    data: { isArchived: false, channel: "STABLE" },
  });

  revalidatePath(`/mods/${version.mod.slug}`);
  return ok(undefined);
}

export async function setModVersionPrimary(versionId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");
  if (version.isArchived) return fail("Archived versions cannot be primary");
  if (!(await canEditMod(user.id, user.role, version.mod.authorId))) return fail("Forbidden");

  await prisma.$transaction([
    prisma.modVersion.updateMany({
      where: { modId: version.modId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.modVersion.update({
      where: { id: versionId },
      data: { isPrimary: true, channel: "STABLE" },
    }),
  ]);

  revalidatePath(`/mods/${version.mod.slug}`);
  return ok(undefined);
}

export async function setModVersionChannel(versionId: string, channel: VersionChannel) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");
  if (!(await canEditMod(user.id, user.role, version.mod.authorId))) return fail("Forbidden");

  await prisma.modVersion.update({
    where: { id: versionId },
    data: {
      channel,
      isArchived: channel === "ARCHIVED",
      ...(channel === "ARCHIVED" ? { isPrimary: false } : {}),
    },
  });

  revalidatePath(`/mods/${version.mod.slug}`);
  return ok(undefined);
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

  await ensureModMediaSynced(modId).catch(() => undefined);

  try {
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
    if (!withMedia) return fail("Not found");
    return ok(withMedia);
  } catch (err) {
    console.error("[getModForEdit] media include failed", err);
    const fallback = await prisma.mod.findUnique({
      where: { id: modId },
      include: {
        game: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        author: { select: { id: true, username: true } },
        tags: true,
        screenshots: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        versions: { orderBy: { createdAt: "desc" } },
        changelog: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!fallback) return fail("Not found");
    return ok({ ...fallback, media: [] });
  }
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
