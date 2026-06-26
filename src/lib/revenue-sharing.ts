import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";

export type RevenueShareSettings = {
  creatorShareBps: number;
  designerShareBps: number;
  partnerShareBps: number;
  platformShareBps: number;
};

export const DEFAULT_REVENUE_SHARE: RevenueShareSettings = {
  creatorShareBps: 7000,
  designerShareBps: 1500,
  partnerShareBps: 500,
  platformShareBps: 1000,
};

const KEY = "revenue_share_settings";

export async function getRevenueShareSettings(): Promise<RevenueShareSettings> {
  const stored = await getSiteSetting<Partial<RevenueShareSettings>>(KEY, {});
  return { ...DEFAULT_REVENUE_SHARE, ...stored };
}

export async function saveRevenueShareSettings(
  settings: RevenueShareSettings
): Promise<RevenueShareSettings> {
  const total =
    settings.creatorShareBps +
    settings.designerShareBps +
    settings.partnerShareBps +
    settings.platformShareBps;
  if (total !== 10000) {
    throw new Error("Revenue shares must total 100% (10000 basis points).");
  }
  const saved = await setSiteSettingSafe(KEY, settings);
  return saved ? settings : DEFAULT_REVENUE_SHARE;
}

/** Resolve creator payout bps — per-profile override wins, then level rate, then global default. */
export function resolveCreatorShareBps(
  global: RevenueShareSettings,
  profile?: { commissionOverrideBps?: number | null; commissionRateBps?: number | null } | null
): number {
  if (profile?.commissionOverrideBps != null && profile.commissionOverrideBps >= 0) {
    return profile.commissionOverrideBps;
  }
  if (profile?.commissionRateBps != null && profile.commissionRateBps > 0) {
    return profile.commissionRateBps;
  }
  return global.creatorShareBps;
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(1);
}
