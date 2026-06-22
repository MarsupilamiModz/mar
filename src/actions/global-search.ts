"use server";

import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/action-utils";

export type GlobalSearchItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  href: string;
};

export type GlobalSearchGroups = {
  mods: GlobalSearchItem[];
  sounds: GlobalSearchItem[];
  collections: GlobalSearchItem[];
  modpacks: GlobalSearchItem[];
  creators: GlobalSearchItem[];
  partners: GlobalSearchItem[];
  games: GlobalSearchItem[];
  categories: GlobalSearchItem[];
};

const TAKE = 6;

function textOr(q: string) {
  return { contains: q, mode: "insensitive" as const };
}

export async function globalSearchAction(query: string, locale: string) {
  const q = query.trim();
  if (q.length < 2) {
    return ok<GlobalSearchGroups>({
      mods: [],
      sounds: [],
      collections: [],
      modpacks: [],
      creators: [],
      partners: [],
      games: [],
      categories: [],
    });
  }

  try {
    const [
      mods,
      sounds,
      collections,
      modpacks,
      creators,
      partners,
      games,
      categories,
    ] = await Promise.all([
      prisma.mod.findMany({
        where: {
          productType: "MOD",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          OR: [{ title: textOr(q) }, { slug: textOr(q) }],
        },
        take: TAKE,
        orderBy: { downloadCount: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          category: { select: { name: true } },
          media: {
            where: { imageUrl: { not: null } },
            orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }],
            take: 1,
            select: { imageUrl: true },
          },
        },
      }),
      prisma.mod.findMany({
        where: {
          productType: "SOUND",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          OR: [{ title: textOr(q) }, { slug: textOr(q) }],
        },
        take: TAKE,
        orderBy: { downloadCount: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          category: { select: { name: true } },
          media: {
            where: { imageUrl: { not: null } },
            take: 1,
            select: { imageUrl: true },
          },
        },
      }),
      prisma.modCollection.findMany({
        where: {
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
          OR: [{ title: textOr(q) }, { slug: textOr(q) }],
        },
        take: TAKE,
        orderBy: { followerCount: "desc" },
        select: { id: true, slug: true, title: true, coverUrl: true },
      }),
      prisma.modCollection.findMany({
        where: {
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
          OR: [{ title: textOr(q) }, { slug: textOr(q) }],
          items: { some: { mod: { productType: "MOD" } } },
        },
        take: TAKE,
        orderBy: { downloadCount: "desc" },
        select: { id: true, slug: true, title: true, coverUrl: true },
      }),
      prisma.creatorProfile.findMany({
        where: {
          isPublic: true,
          isSuspended: false,
          OR: [
            { slug: textOr(q) },
            { tagline: textOr(q) },
            { user: { username: textOr(q) } },
            { user: { displayName: textOr(q) } },
          ],
        },
        take: TAKE,
        orderBy: { totalDownloads: "desc" },
        select: {
          id: true,
          slug: true,
          tagline: true,
          user: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.partnerProfile.findMany({
        where: {
          isPublic: true,
          isSuspended: false,
          isBanned: false,
          OR: [
            { slug: textOr(q) },
            { tagline: textOr(q) },
            { user: { username: textOr(q) } },
          ],
        },
        take: TAKE,
        orderBy: { totalConversions: "desc" },
        select: {
          id: true,
          slug: true,
          tagline: true,
          logoUrl: true,
          user: { select: { username: true } },
        },
      }),
      prisma.game.findMany({
        where: {
          isActive: true,
          OR: [{ name: textOr(q) }, { slug: textOr(q) }],
        },
        take: TAKE,
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, coverUrl: true },
      }),
      prisma.gameCategory.findMany({
        where: {
          isVisible: true,
          OR: [{ name: textOr(q) }, { slug: textOr(q) }],
        },
        take: TAKE,
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          thumbnailUrl: true,
          game: { select: { slug: true, name: true } },
        },
      }),
    ]);

    const prefix = `/${locale}`;

    return ok<GlobalSearchGroups>({
      mods: mods.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        subtitle: m.category?.name ?? null,
        thumbnailUrl: m.media[0]?.imageUrl ?? null,
        href: `${prefix}/mods/${m.slug}`,
      })),
      sounds: sounds.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        subtitle: m.category?.name ?? "Sound",
        thumbnailUrl: m.media[0]?.imageUrl ?? null,
        href: `${prefix}/mods/${m.slug}`,
      })),
      collections: collections.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        subtitle: "Collection",
        thumbnailUrl: c.coverUrl,
        href: `${prefix}/collections/${c.slug}`,
      })),
      modpacks: modpacks.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        subtitle: "Modpack",
        thumbnailUrl: c.coverUrl,
        href: `${prefix}/collections/${c.slug}`,
      })),
      creators: creators.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.user.displayName ?? c.user.username,
        subtitle: c.tagline,
        thumbnailUrl: c.user.avatarUrl,
        href: `${prefix}/creators/${c.slug}`,
      })),
      partners: partners.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.user.username,
        subtitle: p.tagline,
        thumbnailUrl: p.logoUrl,
        href: `${prefix}/partners/${p.slug}`,
      })),
      games: games.map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.name,
        subtitle: "Game",
        thumbnailUrl: g.coverUrl,
        href: `${prefix}/games/${g.slug}`,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.name,
        subtitle: c.game.name,
        thumbnailUrl: c.thumbnailUrl,
        href: `${prefix}/games/${c.game.slug}`,
      })),
    });
  } catch (err) {
    console.error("[globalSearchAction]", err);
    return fail("Search failed");
  }
}
