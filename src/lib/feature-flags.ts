import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import { unstable_cache } from "next/cache";

export const FEATURE_FLAGS_KEY = "feature_flags";

export type FeatureFlagKey =
  | "shop"
  | "sounds"
  | "creator"
  | "partner"
  | "premium"
  | "ads"
  | "teamChat"
  | "tickets"
  | "collections"
  | "modpacks";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  shop: true,
  sounds: true,
  creator: true,
  partner: true,
  premium: true,
  ads: true,
  teamChat: true,
  tickets: true,
  collections: true,
  modpacks: true,
};

export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, string> = {
  shop: "Shop",
  sounds: "Sounds",
  creator: "Creator program",
  partner: "Partner program",
  premium: "Premium memberships",
  ads: "Advertising",
  teamChat: "Team chat",
  tickets: "Support tickets",
  collections: "Collections",
  modpacks: "Modpacks",
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const stored = await getSiteSetting<Partial<FeatureFlags>>(FEATURE_FLAGS_KEY, {});
  return { ...DEFAULT_FEATURE_FLAGS, ...stored };
}

export async function saveFeatureFlags(flags: FeatureFlags) {
  const saved = await setSiteSettingSafe(FEATURE_FLAGS_KEY, flags);
  if (!saved.ok) throw new Error(saved.error);
}

export const getCachedFeatureFlags = unstable_cache(
  () => getFeatureFlags(),
  ["feature-flags"],
  { revalidate: 30 }
);

export async function isFeatureEnabled(flag: FeatureFlagKey): Promise<boolean> {
  const flags = await getCachedFeatureFlags();
  return flags[flag] !== false;
}
