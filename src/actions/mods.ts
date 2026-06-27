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
import { modFileKey, uploadToR2, copyObjectInR2, deleteFromR2, hashObjectFromR2 } from "@/lib/r2";
import { getMalwareScannerSettingsRaw } from "@/lib/malware-settings";
import { serializeModForEdit } from "@/lib/media-serialize";
import { enqueueScan, getCreatorScanPriority } from "@/lib/security/scan-queue";
import { logSecurityEvent } from "@/lib/security/audit";
import { createHash } from "crypto";
import { slugify } from "@/lib/utils";
import { parseUploadFileName } from "@/lib/archive-meta";
import { CACHE_TAGS } from "@/lib/cache";
import { ensureModMediaSynced } from "@/lib/mod-media";
import { fileSizeBigInt, fileSizeNumber } from "@/lib/file-size";
import { isWithinUploadLimit, uploadLimitLabel } from "@/lib/upload-limits";
import { z } from "zod";

function invalidateModCaches(slug?: string) {
  revalidateTag(CACHE_TAGS.mods);
  revalidateTag(CACHE_TAGS.featured);
  revalidateTag(CACHE_TAGS.discovery);
  if (slug) revalidateTag(CACHE_TAGS.mod(slug));
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

  if (parsed.data.productType === "MOD" && !parsed.data.categoryId) {
    return fail("Game category is required for mods");
  }

  const activeModes = await prisma.gameMode.count({
    where: { gameId: parsed.data.gameId, isActive: true },
  });
  if (parsed.data.productType === "MOD" && activeModes > 0 && !parsed.data.modeId) {
    return fail("Game mode is required for this title");
  }

  if (parsed.data.modeId) {
    const mode = await prisma.gameMode.findUnique({
      where: { id: parsed.data.modeId },
      select: { gameId: true, isActive: true },
    });
    if (!mode || mode.gameId !== parsed.data.gameId || !mode.isActive) {
      return fail("Game mode does not belong to the selected game");
    }
  }

  if (parsed.data.categoryId) {
    const category = await prisma.gameCategory.findUnique({
      where: { id: parsed.data.categoryId },
      select: { gameId: true },
    });
    if (!category || category.gameId !== parsed.data.gameId) {
      return fail("Category does not belong to the selected game");
    }
  }

  const authorId = isStaff && input.authorId ? input.authorId : user.id;
  const modSlug = await uniqueSlug(parsed.data.title);

  const mod = await prisma.mod.create({
    data: {
      slug: modSlug,
      title: parsed.data.title,
      description: parsed.data.description,
      shortDescription: parsed.data.shortDescription,
      gameId: parsed.data.gameId,
      modeId: parsed.data.modeId,
      categoryId: parsed.data.categoryId,
      authorId,
      productType: parsed.data.productType,
      pricing: parsed.data.pricing as ModPricing,
      priceCents: parsed.data.priceCents,
      supportedVersions: parsed.data.supportedVersions ?? [],
      status: isStaff && parsed.data.productType !== "SOUND" ? "PUBLISHED" : "PENDING",
      publishedAt: isStaff && parsed.data.productType !== "SOUND" ? new Date() : null,
      tags: parsed.data.tags
        ? { create: parsed.data.tags.map((name) => ({ name })) }
        : undefined,
      soundProfile:
        parsed.data.productType === "SOUND" && parsed.data.sound
          ? {
              create: {
                artist: parsed.data.sound.artist,
                audioCategory: parsed.data.sound.audioCategory,
                durationSeconds: parsed.data.sound.durationSeconds,
                bpm: parsed.data.sound.bpm,
                genre: parsed.data.sound.genre,
                previewType: parsed.data.sound.previewType,
                previewCustomSeconds: parsed.data.sound.previewCustomSeconds,
              },
            }
          : undefined,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "mod.create",
    entityType: "Mod",
    entityId: mod.id,
  });

  invalidateModCaches(mod.slug);
  revalidatePath("/mods");
  revalidatePath("/creator");
  revalidatePath("/designer");
  revalidatePath("/admin/mods");

  void import("@/lib/translation-worker").then(({ scheduleEntityTranslation }) =>
    scheduleEntityTranslation({
      entityType: "Mod",
      entityId: mod.id,
      fields: {
        title: mod.title,
        description: mod.description,
        shortDescription: mod.shortDescription,
      },
    })
  );

  return ok({ id: mod.id, slug: mod.slug });
}

const modUpdateSchema = modCreateSchema.partial().extend({
  categoryId: z.string().cuid().nullable().optional(),
  modeId: z.string().cuid().nullable().optional(),
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
  input: Omit<Partial<z.infer<typeof modCreateSchema>>, "categoryId" | "modeId"> & {
    status?: ModStatus;
    visibility?: ModVisibility;
    isFeatured?: boolean;
    authorId?: string;
    categoryId?: string | null;
    modeId?: string | null;
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

  const nextModeId =
    input.modeId === null || input.modeId === ""
      ? null
      : input.modeId !== undefined
        ? input.modeId
        : data.modeId !== undefined
          ? data.modeId
          : mod.modeId;

  if (nextModeId) {
    const mode = await prisma.gameMode.findUnique({
      where: { id: nextModeId },
      select: { gameId: true, isActive: true },
    });
    if (!mode || mode.gameId !== nextGameId || !mode.isActive) {
      return fail("Game mode does not belong to the selected game");
    }
  } else if (input.modeId !== undefined || data.gameId) {
    const activeModes = await prisma.gameMode.count({
      where: { gameId: nextGameId, isActive: true },
    });
    if (activeModes > 0 && mod.productType === "MOD") {
      return fail("Game mode is required for this title");
    }
  }

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
        ...(input.modeId !== undefined || data.modeId !== undefined || data.gameId
          ? { modeId: nextModeId }
          : {}),
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

    invalidateModCaches(updated.slug);
    revalidatePath(`/mods/${updated.slug}`);
    revalidatePath("/admin/mods");

    if (data.title || data.description || data.shortDescription !== undefined) {
      void import("@/lib/translation-worker").then(({ scheduleEntityTranslation }) =>
        scheduleEntityTranslation({
          entityType: "Mod",
          entityId: modId,
          fields: {
            title: updated.title,
            description: updated.description,
            shortDescription: updated.shortDescription,
          },
        })
      );
    }

    return ok(updated);
  } catch (err) {
    console.error("[updateMod]", err);
    return fail(prismaErrorMessage(err));
  }
}

function parseVersionChannel(raw: string): VersionChannel {
  return (["STABLE", "BETA", "ARCHIVED"].includes(raw) ? raw : "STABLE") as VersionChannel;
}

async function persistModVersion(input: {
  modId: string;
  modSlug: string;
  fileName: string;
  originalFileName: string;
  originalExtension: string;
  mimeType: string;
  fileSize: number;
  productionKey: string;
  version: string;
  changelog?: string;
  gameVersion?: string;
  channel: VersionChannel;
  sha256?: string;
  authorId?: string;
  userId?: string;
}) {
  const settings = await getMalwareScannerSettingsRaw();
  const initialStatus: FileScanStatus = settings.enabled ? "PENDING" : "CLEAN";
  const makePrimary = input.channel !== "ARCHIVED" && !settings.enabled;

  const created = await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.modVersion.updateMany({
        where: { modId: input.modId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const modVersion = await tx.modVersion.create({
      data: {
        modId: input.modId,
        version: input.version,
        changelog: input.changelog,
        gameVersion: input.gameVersion,
        fileKey: input.productionKey,
        fileSize: fileSizeBigInt(input.fileSize),
        fileName: input.fileName,
        originalFileName: input.originalFileName,
        originalExtension: input.originalExtension,
        mimeType: input.mimeType,
        sha256: input.sha256 || null,
        scanStatus: initialStatus,
        scanReport: settings.enabled
          ? ({ queued: true, source: "async_queue" } as Prisma.InputJsonValue)
          : ({ skipped: true, reason: "Scanner disabled" } as Prisma.InputJsonValue),
        scannedAt: settings.enabled ? null : new Date(),
        channel: input.channel,
        isPrimary: makePrimary,
        isArchived: input.channel === "ARCHIVED",
      },
    });

    if (!settings.enabled) {
      await tx.fileScanLog.create({
        data: {
          modVersionId: modVersion.id,
          modId: input.modId,
          fileName: input.fileName,
          fileSize: fileSizeBigInt(input.fileSize),
          sha256: input.sha256 || "n/a",
          status: "CLEAN",
          detections: 0,
          totalEngines: 0,
          report: { skipped: true },
          blocked: false,
        },
      });
    }

    await tx.modChangelog.create({
      data: {
        modId: input.modId,
        version: input.version,
        content: input.changelog ?? `Version ${input.version} released`,
      },
    });

    if (settings.enabled) {
      await tx.mod.update({
        where: { id: input.modId },
        data: { status: "PENDING" },
      });
    }

    return modVersion;
  });

  if (settings.enabled) {
    let priority = 0;
    if (input.authorId) {
      const author = await prisma.user.findUnique({
        where: { id: input.authorId },
        select: { creatorProfile: { select: { id: true } } },
      });
      priority = await getCreatorScanPriority(author?.creatorProfile?.id);
    }

    await enqueueScan({
      modVersionId: created.id,
      modId: input.modId,
      fileKey: input.productionKey,
      fileName: input.fileName,
      fileSize: fileSizeBigInt(input.fileSize),
      sha256: input.sha256,
      priority,
    });

    void import("@/lib/security/scan-worker").then(({ processScanQueue }) =>
      processScanQueue(1).catch(console.error)
    );
  }

  await logSecurityEvent({
    action: "UPLOAD",
    modVersionId: created.id,
    modId: input.modId,
    userId: input.userId,
    metadata: { fileName: input.fileName, version: input.version, sha256: input.sha256 },
  });

  revalidatePath(`/mods/${input.modSlug}`);
  revalidatePath("/admin/security");
  return { created, scanStatus: initialStatus };
}

async function processModVersionFromR2(input: {
  modId: string;
  modSlug: string;
  fileName: string;
  originalFileName: string;
  originalExtension: string;
  mimeType: string;
  fileSize: number;
  contentType: string;
  sourceKey: string;
  version: string;
  changelog?: string;
  gameVersion?: string;
  channel: VersionChannel;
  authorId?: string;
  userId?: string;
}) {
  const storageName = input.originalFileName || input.fileName;
  const productionKey = modFileKey(input.modSlug, input.version, storageName);
  const resolvedMime = input.mimeType || input.contentType;
  await copyObjectInR2(input.sourceKey, productionKey, resolvedMime, "private, max-age=86400");
  if (input.sourceKey !== productionKey) void deleteFromR2(input.sourceKey);

  let sha256: string | undefined;
  try {
    const hashed = await hashObjectFromR2(productionKey);
    sha256 = hashed.sha256;
  } catch {
    sha256 = undefined;
  }

  return persistModVersion({
    modId: input.modId,
    modSlug: input.modSlug,
    fileName: storageName,
    originalFileName: input.originalFileName || storageName,
    originalExtension: input.originalExtension,
    mimeType: resolvedMime,
    fileSize: input.fileSize,
    productionKey,
    version: input.version,
    changelog: input.changelog,
    gameVersion: input.gameVersion,
    channel: input.channel,
    sha256,
    authorId: input.authorId,
    userId: input.userId,
  });
}

async function processModVersionUpload(input: {
  modId: string;
  modSlug: string;
  fileName: string;
  originalFileName: string;
  originalExtension: string;
  mimeType: string;
  fileSize: number;
  contentType: string;
  buffer: Buffer;
  version: string;
  changelog?: string;
  gameVersion?: string;
  channel: VersionChannel;
  authorId?: string;
  userId?: string;
}) {
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");
  const storageName = input.originalFileName || input.fileName;
  const productionKey = modFileKey(input.modSlug, input.version, storageName);
  const resolvedMime = input.mimeType || input.contentType;
  await uploadToR2(productionKey, input.buffer, resolvedMime, "private, max-age=86400");

  return persistModVersion({
    modId: input.modId,
    modSlug: input.modSlug,
    fileName: storageName,
    originalFileName: input.originalFileName || storageName,
    originalExtension: input.originalExtension,
    mimeType: resolvedMime,
    fileSize: input.fileSize,
    productionKey,
    version: input.version,
    changelog: input.changelog,
    gameVersion: input.gameVersion,
    channel: input.channel,
    sha256,
    authorId: input.authorId,
    userId: input.userId,
  });
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
  const channel = parseVersionChannel((formData.get("channel") as string) || "STABLE");

  if (!file || !version) return fail("File and version required");
  if (!isWithinUploadLimit(file.size)) return fail(`Max ${uploadLimitLabel()}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseUploadFileName(file.name, file.type);
    const { created, scanStatus } = await processModVersionUpload({
      modId,
      modSlug: mod.slug,
      fileName: parsed.safeName,
      originalFileName: parsed.originalFileName,
      originalExtension: parsed.originalExtension,
      mimeType: parsed.mimeType,
      fileSize: file.size,
      contentType: parsed.mimeType,
      buffer,
      version,
      changelog,
      gameVersion,
      channel,
      authorId: mod.authorId,
      userId: user.id,
    });

    if (scanStatus !== "CLEAN") {
      return ok({
        versionId: created.id,
        scanStatus,
        message: "Upload complete — security scan in progress",
      });
    }

    return ok({ versionId: created.id, scanStatus });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Version upload failed");
  }
}

export async function finalizeModVersionUpload(
  sessionId: string,
  input: {
    version: string;
    changelog?: string;
    gameVersion?: string;
    channel?: string;
  }
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id || session.purpose !== "mod-version") {
    return fail("Invalid upload session");
  }
  if (session.status !== "IN_PROGRESS") return fail("Upload already processed");

  const modId = session.modId;
  if (!modId) return fail("Mod not linked to upload");

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  const channel = parseVersionChannel(input.channel ?? "STABLE");
  if (!input.version.trim()) return fail("Version required");

  try {
    const fileSize = fileSizeNumber(session.fileSize);
    const meta = (session.metadata ?? {}) as Record<string, string>;
    const parsed = parseUploadFileName(
      meta.originalFileName || session.fileName,
      session.contentType
    );
    const { created, scanStatus } = await processModVersionFromR2({
      modId,
      modSlug: mod.slug,
      fileName: parsed.safeName,
      originalFileName: parsed.originalFileName,
      originalExtension: meta.originalExtension || parsed.originalExtension,
      mimeType: parsed.mimeType,
      fileSize,
      contentType: parsed.mimeType,
      sourceKey: session.fileKey,
      version: input.version.trim(),
      changelog: input.changelog,
      gameVersion: input.gameVersion,
      channel,
      authorId: mod.authorId,
      userId: user.id,
    });

    await prisma.storageUploadSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED" },
    });

    if (scanStatus !== "CLEAN") {
      return ok({
        versionId: created.id,
        scanStatus,
        message: "Upload complete — security scan in progress",
      });
    }

    return ok({ versionId: created.id, scanStatus });
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

export async function deleteMod(modId: string, permanent = true) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  if (permanent) {
    await prisma.mod.delete({ where: { id: modId } });
    await createAuditLog({
      actorId: user.id,
      action: "mod.delete",
      entityType: "Mod",
      entityId: modId,
      metadata: { permanent: true },
    });
  } else {
    await prisma.mod.update({
      where: { id: modId },
      data: { status: "ARCHIVED" },
    });
    await createAuditLog({
      actorId: user.id,
      action: "mod.soft_delete",
      entityType: "Mod",
      entityId: modId,
    });
  }

  invalidateModCaches();
  revalidatePath("/admin/mods");
  revalidatePath("/mods");
  return ok(undefined);
}

export async function restoreMod(modId: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId }, select: { publishedAt: true } });
  if (!mod) return fail("Not found");

  await prisma.mod.update({
    where: { id: modId },
    data: {
      status: mod.publishedAt ? "PUBLISHED" : "DRAFT",
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "mod.restore",
    entityType: "Mod",
    entityId: modId,
  });

  invalidateModCaches();
  revalidatePath("/admin/mods");
  revalidatePath("/mods");
  return ok(undefined);
}

export async function bulkModAdminAction(input: {
  ids: string[];
  action: "approve" | "reject" | "archive" | "restore" | "delete";
}) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;
  if (!input.ids.length) return fail("No items selected");

  const { ids, action } = input;

  if (action === "delete") {
    await prisma.mod.updateMany({
      where: { id: { in: ids } },
      data: { status: "ARCHIVED", visibility: "PRIVATE" },
    });
  } else if (action === "archive") {
    await prisma.mod.updateMany({ where: { id: { in: ids } }, data: { status: "ARCHIVED" } });
  } else if (action === "restore") {
    const mods = await prisma.mod.findMany({
      where: { id: { in: ids } },
      select: { id: true, publishedAt: true },
    });
    await prisma.$transaction(
      mods.map((m) =>
        prisma.mod.update({
          where: { id: m.id },
          data: { status: m.publishedAt ? "PUBLISHED" : "DRAFT" },
        })
      )
    );
  } else {
    const status = action === "approve" ? "PUBLISHED" : "REJECTED";
    await prisma.mod.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        ...(action === "approve" ? { publishedAt: new Date() } : {}),
      },
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: `mod.bulk_${action}`,
    entityType: "Mod",
    metadata: { ids, count: ids.length },
  });

  invalidateModCaches();
  revalidatePath("/admin/mods");
  revalidatePath("/mods");
  return ok(undefined);
}

export async function bulkReassignMods(input: {
  ids: string[];
  gameId?: string;
  modeId?: string | null;
  categoryId?: string | null;
}) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;
  if (!input.ids.length) return fail("No items selected");
  if (!input.gameId && input.modeId === undefined && input.categoryId === undefined) {
    return fail("Select at least one field to reassign");
  }

  const { ids } = input;

  if (input.gameId) {
    const game = await prisma.game.findUnique({ where: { id: input.gameId }, select: { id: true } });
    if (!game) return fail("Game not found");
  }

  if (input.modeId) {
    const mode = await prisma.gameMode.findUnique({
      where: { id: input.modeId },
      select: { gameId: true, isActive: true },
    });
    if (!mode || !mode.isActive) return fail("Invalid hover category");
    if (input.gameId && mode.gameId !== input.gameId) {
      return fail("Hover category does not belong to the selected game");
    }
  }

  if (input.categoryId) {
    const category = await prisma.gameCategory.findUnique({
      where: { id: input.categoryId },
      select: { gameId: true },
    });
    if (!category) return fail("Invalid category");
    if (input.gameId && category.gameId !== input.gameId) {
      return fail("Category does not belong to the selected game");
    }
  }

  const mods = await prisma.mod.findMany({
    where: { id: { in: ids } },
    select: { id: true, gameId: true },
  });

  await prisma.$transaction(
    mods.map((m) =>
      prisma.mod.update({
        where: { id: m.id },
        data: {
          ...(input.gameId ? { gameId: input.gameId } : {}),
          ...(input.modeId !== undefined
            ? { modeId: input.modeId }
            : input.gameId
              ? { modeId: null }
              : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : input.gameId
              ? { categoryId: null }
              : {}),
        },
      })
    )
  );

  await createAuditLog({
    actorId: user.id,
    action: "mod.bulk_reassign",
    entityType: "Mod",
    metadata: { ...input, count: ids.length },
  });

  invalidateModCaches();
  revalidatePath("/admin/mods");
  revalidatePath("/mods");
  return ok(undefined);
}

export async function getAdminMods(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: ModStatus;
  gameId?: string;
  productType?: "MOD" | "SOUND" | "ALL";
  pricing?: "FREE" | "PREMIUM" | "ALL";
  featured?: boolean;
  scheduled?: boolean;
  sort?: "newest" | "oldest" | "downloads" | "rating" | "alpha";
}) {
  const { error } = await requireActionPermission("mods.read");
  if (error) return error;

  const page = params.page ?? 1;
  const limit = Math.min(Math.max(params.limit ?? 25, 10), 250);
  const skip = (page - 1) * limit;

  const orderBy =
    params.sort === "oldest"
      ? { createdAt: "asc" as const }
      : params.sort === "downloads"
        ? { downloadCount: "desc" as const }
        : params.sort === "rating"
          ? { averageRating: "desc" as const }
          : params.sort === "alpha"
            ? { title: "asc" as const }
            : { updatedAt: "desc" as const };

  const where = {
    ...(params.status && { status: params.status }),
    ...(params.gameId && { gameId: params.gameId }),
    ...(params.productType && params.productType !== "ALL" && { productType: params.productType }),
    ...(params.pricing === "FREE" && { pricing: "FREE" as const }),
    ...(params.pricing === "PREMIUM" && {
      pricing: { in: ["PREMIUM", "PAID"] as ModPricing[] },
    }),
    ...(params.featured && { isFeatured: true }),
    ...(params.scheduled && {
      publishedAt: { gt: new Date() },
      status: { in: ["DRAFT", "PENDING"] as ModStatus[] },
    }),
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
      orderBy,
      include: {
        game: { select: { name: true } },
        mode: { select: { name: true } },
        category: { select: { name: true } },
        author: { select: { username: true } },
        soundProfile: { select: { audioCategory: true, artist: true } },
        _count: { select: { versions: true, screenshots: true } },
      },
    }),
    prisma.mod.count({ where }),
  ]);

  return ok({ mods, total, pages: Math.ceil(total / limit) || 1, page, limit });
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
        soundProfile: true,
        media: { orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }] },
        screenshots: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        versions: { orderBy: { createdAt: "desc" } },
        changelog: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!withMedia) return fail("Not found");
    return ok(serializeModForEdit(withMedia));
  } catch (err) {
    console.error("[getModForEdit] media include failed", err);
    const fallback = await prisma.mod.findUnique({
      where: { id: modId },
      include: {
        game: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        author: { select: { id: true, username: true } },
        tags: true,
        soundProfile: true,
        screenshots: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        versions: { orderBy: { createdAt: "desc" } },
        changelog: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!fallback) return fail("Not found");
    return ok(serializeModForEdit({ ...fallback, media: [] }));
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
