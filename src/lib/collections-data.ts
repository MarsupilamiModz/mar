import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";

export async function getCollectionBySlug(slug: string) {
  try {
    return await unstable_cache(
      async () =>
        prisma.modCollection.findFirst({
          where: { slug, moderationStatus: "APPROVED" },
          include: {
            owner: { select: { username: true, displayName: true, avatarUrl: true } },
            creator: {
              select: { slug: true, user: { select: { displayName: true, username: true } } },
            },
            items: {
              orderBy: { sortOrder: "asc" },
              include: {
                mod: {
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    pricing: true,
                    downloadCount: true,
                    averageRating: true,
                    game: { select: { id: true, name: true, slug: true } },
                    versions: {
                      where: { isPrimary: true },
                      take: 1,
                      select: { version: true, gameVersion: true, fileSize: true },
                    },
                  },
                },
              },
            },
          },
        }),
      [`collection-${slug}`],
      { revalidate: REVALIDATE.collections, tags: [CACHE_TAGS.collections] }
    )();
  } catch {
    return null;
  }
}

export async function listPublicCollections(page = 1, limit = 20) {
  try {
    return await unstable_cache(
      async () => {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
          prisma.modCollection.findMany({
            where: {
              visibility: { in: ["PUBLIC", "FEATURED"] },
              moderationStatus: "APPROVED",
            },
            orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { downloadCount: "desc" }],
            skip,
            take: limit,
            include: {
              owner: { select: { username: true, displayName: true } },
              _count: { select: { items: true, followers: true } },
            },
          }),
          prisma.modCollection.count({
            where: {
              visibility: { in: ["PUBLIC", "FEATURED"] },
              moderationStatus: "APPROVED",
            },
          }),
        ]);

        return { items, total, pages: Math.ceil(total / limit), page };
      },
      [`collections-list-${page}-${limit}`],
      { revalidate: REVALIDATE.collections, tags: [CACHE_TAGS.collections] }
    )();
  } catch {
    return { items: [], total: 0, pages: 0, page };
  }
}

export async function incrementCollectionView(collectionId: string) {
  try {
    await prisma.modCollection.update({
      where: { id: collectionId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    /* table may not exist yet */
  }
}
