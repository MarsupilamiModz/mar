import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions";
import {
  inheritedRolePermissions,
  parseGroupPermissions,
  permissionSetIncludes,
} from "@/lib/permission-types";

export const PERMISSION_CACHE_TAG = "permissions";

type PermissionUser = {
  id?: string;
  role: UserRole;
  permissionGroupId?: string | null;
};

async function ensurePermissionCatalog() {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  }
}

async function seedRolePermissionsIfEmpty() {
  const count = await prisma.rolePermission.count();
  if (count > 0) return;

  const catalog = await prisma.permission.findMany();
  const byKey = new Map(catalog.map((p) => [p.key, p.id]));

  const rows: { role: UserRole; permissionId: string }[] = [];
  for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as [
    UserRole,
    PermissionKey[],
  ][]) {
    for (const key of keys) {
      const permissionId = byKey.get(key);
      if (permissionId) rows.push({ role, permissionId });
    }
  }

  if (rows.length > 0) {
    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }
}

const loadRolePermissionMap = unstable_cache(
  async (): Promise<Record<UserRole, PermissionKey[]>> => {
    try {
      const rows = await prisma.rolePermission.findMany({
        include: { permission: { select: { key: true } } },
      });

      if (rows.length === 0) {
        await seedRolePermissionsIfEmpty();
        return DEFAULT_ROLE_PERMISSIONS;
      }

      const dbByRole = new Map<UserRole, PermissionKey[]>();
      for (const row of rows) {
        const key = row.permission.key as PermissionKey;
        const list = dbByRole.get(row.role) ?? [];
        if (!list.includes(key)) list.push(key);
        dbByRole.set(row.role, list);
      }

      const result = { ...DEFAULT_ROLE_PERMISSIONS };
      for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]) {
        if (role === "OWNER") {
          result[role] = Object.keys(PERMISSIONS) as PermissionKey[];
          continue;
        }
        if (dbByRole.has(role)) {
          const dbPerms = dbByRole.get(role)!;
          if (role === "ADMIN" && dbPerms.length > 0) {
            result[role] = Array.from(new Set([...DEFAULT_ROLE_PERMISSIONS.ADMIN, ...dbPerms]));
          } else if (dbPerms.length > 0) {
            result[role] = dbPerms;
          }
        }
      }
      return result;
    } catch (err) {
      console.error("[permissions] falling back to defaults", err);
      return DEFAULT_ROLE_PERMISSIONS;
    }
  },
  ["role-permission-map-v3"],
  { tags: [PERMISSION_CACHE_TAG], revalidate: 60 }
);

const loadGroupPermissionMap = unstable_cache(
  async (): Promise<Record<string, string[]>> => {
    try {
      const groups = await prisma.permissionGroup.findMany({
        where: { isArchived: false, isDisabled: false },
        select: { id: true, permissions: true },
      });
      const record: Record<string, string[]> = {};
      for (const g of groups) {
        record[g.id] = parseGroupPermissions(g.permissions);
      }
      return record;
    } catch (err) {
      console.error("[permissions] group map fallback", err);
      return {};
    }
  },
  ["permission-group-map-v2"],
  { tags: [PERMISSION_CACHE_TAG], revalidate: 30 }
);

export function invalidatePermissionCache() {
  revalidateTag(PERMISSION_CACHE_TAG);
}

export const getRolePermissionMap = cache(loadRolePermissionMap);

export async function getEffectivePermissions(user: PermissionUser): Promise<Set<string>> {
  const roleMap = await getRolePermissionMap();
  const inherited = inheritedRolePermissions(user.role, roleMap);
  const effective = new Set<string>(Array.from(inherited).map(String));

  if (user.permissionGroupId) {
    const groups = await loadGroupPermissionMap();
    const extras = groups[user.permissionGroupId] ?? [];
    for (const p of extras) effective.add(p);
  }

  if (user.id) {
    const overrides = await getUserPermissionOverrides(user.id);
    for (const row of overrides) {
      if (row.granted) effective.add(row.permissionKey);
      else effective.delete(row.permissionKey);
    }
  }

  return effective;
}

export async function getUserPermissionOverrides(userId: string) {
  return unstable_cache(
    async () =>
      prisma.userPermission.findMany({
        where: { userId },
        select: { permissionKey: true, granted: true },
      }),
    ["user-permission-overrides", userId],
    { tags: [PERMISSION_CACHE_TAG, `user-perms-${userId}`], revalidate: 30 }
  )();
}

export async function userHasPermission(
  user: PermissionUser,
  permission: PermissionKey
): Promise<boolean> {
  if (user.role === "OWNER") return true;
  try {
    const effective = await getEffectivePermissions(user);
    return permissionSetIncludes(effective, permission);
  } catch (err) {
    console.error("[permissions] userHasPermission fallback", err);
    const defaults = DEFAULT_ROLE_PERMISSIONS[user.role] ?? [];
    return permissionSetIncludes(new Set(defaults.map(String)), permission);
  }
}

export async function getRolePermissionsForAdmin(role: UserRole): Promise<PermissionKey[]> {
  const map = await getRolePermissionMap();
  return map[role] ?? [];
}

export async function saveRolePermissions(role: UserRole, permissions: string[]) {
  await ensurePermissionCatalog();

  const catalog = await prisma.permission.findMany();
  const byKey = new Map(catalog.map((p) => [p.key, p.id]));

  const permissionIds: string[] = [];
  for (const key of permissions) {
    if (key === "*") continue;
    const id = byKey.get(key);
    if (!id) continue;
    permissionIds.push(id);
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role } }),
    ...(permissionIds.length > 0
      ? [
          prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ role, permissionId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  invalidatePermissionCache();
}
