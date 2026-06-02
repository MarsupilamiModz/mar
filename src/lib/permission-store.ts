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
    await ensurePermissionCatalog();
    await seedRolePermissionsIfEmpty();

    const rows = await prisma.rolePermission.findMany({
      include: { permission: { select: { key: true } } },
    });

    const dbByRole = new Map<UserRole, PermissionKey[]>();
    for (const row of rows) {
      const key = row.permission.key as PermissionKey;
      const list = dbByRole.get(row.role) ?? [];
      if (!list.includes(key)) list.push(key);
      dbByRole.set(row.role, list);
    }

    const result = { ...DEFAULT_ROLE_PERMISSIONS };
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]) {
      if (dbByRole.has(role)) {
        result[role] = dbByRole.get(role)!;
      }
    }
    return result;
  },
  ["role-permission-map-v2"],
  { tags: [PERMISSION_CACHE_TAG], revalidate: 30 }
);

const loadGroupPermissionMap = unstable_cache(
  async (): Promise<Map<string, string[]>> => {
    const groups = await prisma.permissionGroup.findMany({
      select: { id: true, permissions: true },
    });
    return new Map(
      groups.map((g) => [g.id, parseGroupPermissions(g.permissions)])
    );
  },
  ["permission-group-map-v1"],
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
    const extras = groups.get(user.permissionGroupId) ?? [];
    for (const p of extras) effective.add(p);
  }

  return effective;
}

export async function userHasPermission(
  user: PermissionUser,
  permission: PermissionKey
): Promise<boolean> {
  const effective = await getEffectivePermissions(user);
  return permissionSetIncludes(effective, permission);
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
