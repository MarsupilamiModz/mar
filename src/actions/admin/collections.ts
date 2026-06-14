"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CollectionModerationStatus, CollectionVisibility } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { CACHE_TAGS } from "@/lib/cache";
import { resolveSlug, ensureUniqueSlug } from "@/lib/slug";

function invalidateCollections() {
  revalidateTag(CACHE_TAGS.collections);
  revalidatePath("/collections");
  revalidatePath("/admin/collections");
}

export async function listCollectionsAdmin(params?: {
  page?: number;
  status?: CollectionModerationStatus;
  search?: string;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(params?.status && { moderationStatus: params.status }),
    ...(params?.search && {
      OR: [
        { title: { contains: params.search, mode: "insensitive" as const } },
        { slug: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.modCollection.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        owner: { select: { username: true, displayName: true } },
        _count: { select: { items: true, followers: true } },
      },
    }),
    prisma.modCollection.count({ where }),
  ]);

  return ok({ items, total, pages: Math.ceil(total / limit), page });
}

export async function updateCollectionAdmin(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    coverUrl: string;
    bannerUrl: string;
    visibility: CollectionVisibility;
    moderationStatus: CollectionModerationStatus;
    isFeatured: boolean;
    sortOrder: number;
    adminNotes: string;
  }>
) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const updated = await prisma.modCollection.update({
    where: { id },
    data: {
      ...input,
      ...(input.isFeatured !== undefined && {
        visibility: input.isFeatured ? "FEATURED" : input.visibility ?? "PUBLIC",
      }),
    },
  });

  invalidateCollections();
  return ok(updated);
}

export async function deleteCollectionAdmin(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.modCollection.delete({ where: { id } });
  invalidateCollections();
  return ok(undefined);
}

export async function createCollectionAdmin(input: {
  title: string;
  ownerId: string;
  ownerUsername?: string;
  description?: string;
  coverUrl?: string;
  bannerUrl?: string;
  visibility?: CollectionVisibility;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  let ownerId = input.ownerId;
  if (input.ownerUsername?.trim()) {
    const owner = await prisma.user.findFirst({
      where: { username: input.ownerUsername.trim() },
      select: { id: true },
    });
    if (!owner) return fail("Owner user not found");
    ownerId = owner.id;
  }

  const resolved = resolveSlug({ title: input.title, fallbackPrefix: "collection" });
  const slug = await ensureUniqueSlug(resolved.slug, async (s) =>
    Boolean(await prisma.modCollection.findUnique({ where: { slug: s } }))
  );

  const collection = await prisma.modCollection.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      coverUrl: input.coverUrl,
      bannerUrl: input.bannerUrl,
      visibility: input.visibility ?? "PUBLIC",
      ownerId,
      moderationStatus: "APPROVED",
    },
  });

  invalidateCollections();
  return ok(collection);
}

export async function reorderCollectionsAdmin(ids: string[]) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.modCollection.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  invalidateCollections();
  return ok(undefined);
}

export async function getCollectionAnalyticsAdmin(id: string) {
  const { error } = await requireActionPermission("analytics.read");
  if (error) return error;

  const collection = await prisma.modCollection.findUnique({
    where: { id },
    select: {
      title: true,
      viewCount: true,
      downloadCount: true,
      followerCount: true,
      items: { select: { modId: true } },
    },
  });
  if (!collection) return fail("Not found");

  const conversionRate =
    collection.viewCount > 0
      ? ((collection.downloadCount / collection.viewCount) * 100).toFixed(1)
      : "0";

  return ok({
    ...collection,
    modCount: collection.items.length,
    conversionRate,
  });
}
