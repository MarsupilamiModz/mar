import type { HostingClickContext, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getHostingPartnerSettings } from "@/lib/hosting/settings";

export type ResolvedHostingPartner = {
  partnerId: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  affiliateUrl: string;
  bannerUrl: string | null;
  bannerWebpUrl: string | null;
  bannerAvifUrl: string | null;
  apiProvider: string | null;
  oneClickEnabled: boolean;
  source: "mod" | "collection" | "creator" | "game" | "global";
};

type ResolveInput = {
  mod?: {
    id: string;
    gameId: string;
    serverPartnerEnabled: boolean;
    serverPartnerId: string | null;
    serverPartnerLink: string | null;
    serverPartnerBanner: string | null;
    authorId: string;
  } | null;
  collection?: {
    id: string;
    ownerId: string;
    creatorId: string | null;
    serverPartnerEnabled: boolean;
    serverPartnerId: string | null;
    serverPartnerLink: string | null;
    serverPartnerBanner: string | null;
  } | null;
  gameId?: string | null;
};

function appendTracking(url: string, trackingId?: string | null, extra?: Record<string, string>) {
  try {
    const u = new URL(url);
    if (trackingId) u.searchParams.set("ref", trackingId);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v) u.searchParams.set(k, v);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function partnerToResolved(
  partner: {
    id: string;
    name: string;
    logoUrl: string | null;
    description: string | null;
    affiliateUrl: string;
    trackingId: string | null;
    apiProvider: string | null;
  },
  source: ResolvedHostingPartner["source"],
  overrides?: { link?: string | null; banner?: string | null },
  extraParams?: Record<string, string>
): Promise<ResolvedHostingPartner> {
  const settings = await getHostingPartnerSettings();
  const banner = await prisma.hostingPartnerBanner.findFirst({
    where: { partnerId: partner.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return {
    partnerId: partner.id,
    name: partner.name,
    logoUrl: partner.logoUrl,
    description: partner.description,
    affiliateUrl: appendTracking(
      overrides?.link ?? partner.affiliateUrl,
      partner.trackingId,
      extraParams
    ),
    bannerUrl: overrides?.banner ?? banner?.imageUrl ?? null,
    bannerWebpUrl: banner?.webpUrl ?? null,
    bannerAvifUrl: banner?.avifUrl ?? null,
    apiProvider: partner.apiProvider,
    oneClickEnabled: settings.oneClickInstallEnabled && Boolean(partner.apiProvider),
    source,
  };
}

export async function resolveHostingPartner(
  input: ResolveInput
): Promise<ResolvedHostingPartner | null> {
  const settings = await getHostingPartnerSettings();

  if (input.mod?.serverPartnerEnabled && input.mod.serverPartnerId) {
    const partner = await prisma.hostingPartner.findFirst({
      where: { id: input.mod.serverPartnerId, isActive: true },
    });
    if (partner) {
      return partnerToResolved(
        partner,
        "mod",
        { link: input.mod.serverPartnerLink, banner: input.mod.serverPartnerBanner },
        { modId: input.mod.id, gameId: input.mod.gameId }
      );
    }
  }

  if (input.collection?.serverPartnerEnabled && input.collection.serverPartnerId) {
    const partner = await prisma.hostingPartner.findFirst({
      where: { id: input.collection.serverPartnerId, isActive: true },
    });
    if (partner) {
      return partnerToResolved(
        partner,
        "collection",
        {
          link: input.collection.serverPartnerLink,
          banner: input.collection.serverPartnerBanner,
        },
        { collectionId: input.collection.id }
      );
    }
  }

  const gameId = input.gameId ?? input.mod?.gameId ?? null;

  if (gameId && !settings.creatorOnlyGlobal) {
    const gameLink = await prisma.gameHostingPartner.findUnique({
      where: { gameId },
      include: { partner: true },
    });
    if (gameLink?.partner.isActive) {
      return partnerToResolved(gameLink.partner, "game", undefined, { gameId });
    }
  }

  if (settings.allowCreatorLinks) {
    const creatorUserId = input.mod?.authorId ?? input.collection?.ownerId;
    if (creatorUserId) {
      const creator = await prisma.creatorProfile.findFirst({
        where: {
          userId: creatorUserId,
          hostingPartnerEnabled: true,
          hostingAffiliateLink: { not: null },
        },
      });
      if (creator?.hostingAffiliateLink) {
        return {
          partnerId: `creator:${creator.id}`,
          name: "Creator hosting",
          logoUrl: null,
          description: creator.hostingDescription,
          affiliateUrl: creator.hostingAffiliateLink,
          bannerUrl: creator.hostingBannerUrl,
          bannerWebpUrl: null,
          bannerAvifUrl: null,
          apiProvider: null,
          oneClickEnabled: false,
          source: "creator",
        };
      }
    }
  }

  if (settings.useGlobalPartner && settings.globalPartnerId) {
    const partner = await prisma.hostingPartner.findFirst({
      where: { id: settings.globalPartnerId, isActive: true },
    });
    if (partner) {
      return partnerToResolved(partner, "global", undefined, gameId ? { gameId } : undefined);
    }
  }

  const globalPartner = await prisma.hostingPartner.findFirst({
    where: { isGlobal: true, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (globalPartner) {
    return partnerToResolved(globalPartner, "global", undefined, gameId ? { gameId } : undefined);
  }

  return null;
}

export async function recordHostingClick(input: {
  partnerId: string;
  userId?: string | null;
  modId?: string | null;
  collectionId?: string | null;
  gameId?: string | null;
  context: HostingClickContext;
  countryCode?: string | null;
  referrer?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  if (input.partnerId.startsWith("creator:")) {
    return null;
  }

  const click = await prisma.hostingClick.create({
    data: {
      partnerId: input.partnerId,
      userId: input.userId ?? undefined,
      modId: input.modId ?? undefined,
      collectionId: input.collectionId ?? undefined,
      gameId: input.gameId ?? undefined,
      context: input.context,
      countryCode: input.countryCode ?? undefined,
      referrer: input.referrer ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });

  await prisma.hostingPartner.update({
    where: { id: input.partnerId },
    data: { totalClicks: { increment: 1 } },
  });

  return click;
}

export async function getHostingAnalyticsSummary() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [today, week, month, conversions, revenue, topPartners, topMods, topCollections] =
    await Promise.all([
      prisma.hostingClick.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.hostingClick.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.hostingClick.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.hostingClick.count({ where: { converted: true, createdAt: { gte: monthAgo } } }),
      prisma.hostingClick.aggregate({
        where: { createdAt: { gte: monthAgo } },
        _sum: { revenueCents: true },
      }),
      prisma.hostingClick.groupBy({
        by: ["partnerId"],
        where: { createdAt: { gte: monthAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      prisma.hostingClick.groupBy({
        by: ["modId"],
        where: { modId: { not: null }, createdAt: { gte: monthAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      prisma.hostingClick.groupBy({
        by: ["collectionId"],
        where: { collectionId: { not: null }, createdAt: { gte: monthAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

  const partnerIds = topPartners.map((p) => p.partnerId);
  const modIds = topMods.map((m) => m.modId).filter(Boolean) as string[];
  const collectionIds = topCollections.map((c) => c.collectionId).filter(Boolean) as string[];

  const [partners, mods, collections] = await Promise.all([
    prisma.hostingPartner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true },
    }),
    prisma.mod.findMany({ where: { id: { in: modIds } }, select: { id: true, title: true, slug: true } }),
    prisma.modCollection.findMany({
      where: { id: { in: collectionIds } },
      select: { id: true, title: true, slug: true },
    }),
  ]);

  const partnerMap = new Map(partners.map((p) => [p.id, p.name]));
  const modMap = new Map(mods.map((m) => [m.id, m]));
  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  return {
    clicksToday: today,
    clicks7d: week,
    clicks30d: month,
    conversions30d: conversions,
    revenueCents30d: revenue._sum.revenueCents ?? 0,
    topPartners: topPartners.map((p) => ({
      partnerId: p.partnerId,
      name: partnerMap.get(p.partnerId) ?? p.partnerId,
      clicks: p._count.id,
    })),
    topMods: topMods
      .filter((m) => m.modId)
      .map((m) => ({
        modId: m.modId!,
        mod: modMap.get(m.modId!) ?? null,
        clicks: m._count.id,
      })),
    topCollections: topCollections
      .filter((c) => c.collectionId)
      .map((c) => ({
        collectionId: c.collectionId!,
        collection: collectionMap.get(c.collectionId!) ?? null,
        clicks: c._count.id,
      })),
  };
}
