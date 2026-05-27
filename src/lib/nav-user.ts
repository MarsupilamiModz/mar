import { getCurrentUser, hasPremiumAccess } from "@/lib/auth";
import type { NavUser } from "@/components/layout/user-nav";

import { getInlineUserBadges } from "@/lib/user-badges";
import { resolveAssetUrl } from "@/lib/assets";

export async function getNavUser(): Promise<NavUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  let badges: Awaited<ReturnType<typeof getInlineUserBadges>> = [];
  try {
    badges = await getInlineUserBadges(user.id, user.locale, 2);
  } catch (error) {
    console.error("[getNavUser] badges", error);
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: resolveAssetUrl(user.avatarUrl),
    role: user.role,
    isPremium: hasPremiumAccess(user),
    badges,
  };
}
