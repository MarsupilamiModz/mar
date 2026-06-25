import type { SiteBannerFrequency } from "@prisma/client";

export function bannerStorageKey(bannerId: string, frequency: SiteBannerFrequency) {
  return `banner_dismiss_${bannerId}_${frequency}`;
}

export const FREQUENCY_MS: Partial<Record<SiteBannerFrequency, number>> = {
  EVERY_5_MIN: 5 * 60 * 1000,
  EVERY_15_MIN: 15 * 60 * 1000,
};
