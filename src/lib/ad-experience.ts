import { getAdSettings } from "@/lib/ads";
import { getUserMembershipTier } from "@/lib/membership";

export type AdExperienceLevel = "full" | "reduced" | "none";

export async function getUserAdExperience(
  userId: string | null,
  role: string | null
): Promise<AdExperienceLevel> {
  const settings = await getAdSettings();
  const levels = settings.roleAdLevels ?? {};

  if (!userId) return levels.GUEST ?? "full";

  const roleKey = role ?? "USER";
  if (levels[roleKey]) return levels[roleKey];

  const tier = await getUserMembershipTier(userId);
  if (tier?.slug && levels[tier.slug]) return levels[tier.slug];
  if (tier?.perks.adFree === true) return "none";

  if (settings.rolesWithoutAds?.includes(roleKey)) return "none";
  if (settings.rolesWithAds?.length && !settings.rolesWithAds.includes(roleKey)) return "none";
  if (settings.membershipSlugsWithoutAds?.length && tier?.slug) {
    if (settings.membershipSlugsWithoutAds.includes(tier.slug)) return "none";
  }

  return "full";
}

export function shouldRenderAds(level: AdExperienceLevel): boolean {
  return level !== "none";
}

export function adDensityClass(level: AdExperienceLevel): string {
  if (level === "reduced") return "ad-density-reduced opacity-90";
  return "";
}
