import { getCurrentUser, hasPremiumAccess } from "@/lib/auth";
import type { NavUser } from "@/components/layout/user-nav";
import { resolveAssetUrl } from "@/lib/assets";
import { getEffectivePermissions } from "@/lib/permission-store";
import type { PermissionKey } from "@/lib/permissions";

export async function getNavUser(): Promise<NavUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  let permissions: PermissionKey[] = [];
  try {
    const effective = await getEffectivePermissions({
      id: user.id,
      role: user.role,
      permissionGroupId: user.permissionGroupId,
    });
    permissions = Array.from(effective).filter((p) => p !== "*") as PermissionKey[];
  } catch (error) {
    console.error("[getNavUser] permissions", error);
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: resolveAssetUrl(user.avatarUrl),
    role: user.role,
    isPremium: hasPremiumAccess(user),
    permissions,
  };
}
