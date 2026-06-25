import type { SiteBannerType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type BannerContext = {
  type?: SiteBannerType;
  gameId?: string;
  gameCategoryId?: string;
  modId?: string;
  partnerProfileId?: string;
};

function isWithinSchedule(startsAt: Date, endsAt: Date | null) {
  const now = new Date();
  if (startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
}

export async function getActiveSiteBanners(context: BannerContext = {}) {
  try {
    const now = new Date();

    const banners = await prisma.siteBanner.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return banners.filter((banner) => {
      if (!isWithinSchedule(banner.startsAt, banner.endsAt)) return false;

      switch (banner.type) {
        case "GLOBAL":
          return true;
        case "GAME":
          return context.gameId != null && banner.gameId === context.gameId;
        case "CATEGORY":
          return (
            context.gameCategoryId != null && banner.gameCategoryId === context.gameCategoryId
          );
        case "MOD":
          return context.modId != null && banner.modId === context.modId;
        case "PARTNER":
          return (
            context.partnerProfileId != null &&
            banner.partnerProfileId === context.partnerProfileId
          );
        default:
          return false;
      }
    });
  } catch {
    return [];
  }
}
