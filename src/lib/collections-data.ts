import { prisma } from "@/lib/db";

export async function getCollectionBySlug(slug: string) {
  try {
    return await prisma.modCollection.findUnique({
      where: { slug },
      include: {
        owner: { select: { username: true, displayName: true, avatarUrl: true } },
        creator: { select: { slug: true, user: { select: { displayName: true, username: true } } } },
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
                game: { select: { name: true, slug: true } },
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
    });
  } catch {
    return null;
  }
}

export async function listPublicCollections(page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.modCollection.findMany({
        where: { visibility: { in: ["PUBLIC", "FEATURED"] } },
        orderBy: [{ isFeatured: "desc" }, { downloadCount: "desc" }],
        skip,
        take: limit,
        include: {
          owner: { select: { username: true, displayName: true } },
          _count: { select: { items: true, followers: true } },
        },
      }),
      prisma.modCollection.count({ where: { visibility: { in: ["PUBLIC", "FEATURED"] } } }),
    ]);

    return { items, total, pages: Math.ceil(total / limit), page };
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
