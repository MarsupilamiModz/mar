"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import type { ModStatus, ProductType } from "@prisma/client";

export type MediaSection =
  | "mods"
  | "sounds"
  | "collections"
  | "modpacks"
  | "screenshots"
  | "videos"
  | "downloads";

export async function getAdminMediaCenter(input: {
  section?: MediaSection;
  page?: number;
  status?: string;
  q?: string;
}) {
  const { error } = await requireActionPermission("mods.read");
  if (error) return error;

  const section = input.section ?? "mods";
  const page = Math.max(1, input.page ?? 1);
  const limit = 25;
  const skip = (page - 1) * limit;
  const q = input.q?.trim();

  if (section === "mods" || section === "sounds") {
    const productType: ProductType = section === "sounds" ? "SOUND" : "MOD";
    const where = {
      productType,
      ...(input.status ? { status: input.status as ModStatus } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { slug: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.mod.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          game: { select: { name: true } },
          author: { select: { username: true } },
        },
      }),
      prisma.mod.count({ where }),
    ]);
    return ok({ section, items, total, pages: Math.ceil(total / limit), page });
  }

  if (section === "collections") {
    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { slug: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.modCollection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: { owner: { select: { username: true } }, _count: { select: { items: true } } },
      }),
      prisma.modCollection.count({ where }),
    ]);
    return ok({ section, items, total, pages: Math.ceil(total / limit), page });
  }

  if (section === "screenshots") {
    const [items, total] = await Promise.all([
      prisma.modMedia.findMany({
        where: { mediaType: "IMAGE" },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { mod: { select: { id: true, title: true, slug: true } } },
      }),
      prisma.modMedia.count({ where: { mediaType: "IMAGE" } }),
    ]);
    return ok({ section, items, total, pages: Math.ceil(total / limit), page });
  }

  if (section === "videos") {
    const [items, total] = await Promise.all([
      prisma.modVideo.findMany({
        skip,
        take: limit,
        orderBy: { id: "desc" },
        include: { mod: { select: { id: true, title: true, slug: true } } },
      }),
      prisma.modVideo.count(),
    ]);
    return ok({ section, items, total, pages: Math.ceil(total / limit), page });
  }

  if (section === "downloads") {
    const [items, total] = await Promise.all([
      prisma.download.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { username: true } },
          version: { include: { mod: { select: { title: true, slug: true } } } },
        },
      }),
      prisma.download.count(),
    ]);
    return ok({ section, items, total, pages: Math.ceil(total / limit), page });
  }

  return ok({ section: "modpacks" as const, items: [], total: 0, pages: 0, page: 1 });
}

export async function bulkMediaAction(input: {
  section: MediaSection;
  ids: string[];
  action: "approve" | "reject" | "feature" | "archive" | "delete";
}) {
  const { error } = await requireActionPermission("mods.write");
  if (error) return error;
  if (!input.ids.length) return fail("No items selected");

  const { section, ids, action } = input;

  if (section === "mods" || section === "sounds") {
    if (action === "delete") {
      await prisma.mod.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", visibility: "PRIVATE" },
      });
    } else {
      const data =
        action === "approve"
          ? { status: "PUBLISHED" as ModStatus }
          : action === "reject"
            ? { status: "REJECTED" as ModStatus }
            : action === "archive"
              ? { status: "ARCHIVED" as ModStatus }
              : { isFeatured: true };
      await prisma.mod.updateMany({ where: { id: { in: ids } }, data });
    }
  } else if (section === "collections") {
    if (action === "delete") {
      await prisma.modCollection.deleteMany({ where: { id: { in: ids } } });
    } else if (action === "approve") {
      await prisma.modCollection.updateMany({
        where: { id: { in: ids } },
        data: { moderationStatus: "APPROVED" },
      });
    } else if (action === "reject") {
      await prisma.modCollection.updateMany({
        where: { id: { in: ids } },
        data: { moderationStatus: "REJECTED" },
      });
    } else if (action === "feature") {
      await prisma.modCollection.updateMany({ where: { id: { in: ids } }, data: { isFeatured: true } });
    }
  } else if (section === "screenshots") {
    if (action === "delete") await prisma.modScreenshot.deleteMany({ where: { id: { in: ids } } });
  } else if (section === "videos") {
    if (action === "delete") await prisma.modVideo.deleteMany({ where: { id: { in: ids } } });
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin/mods");
  return ok(undefined);
}
