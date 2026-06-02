import { UserRole } from "@prisma/client";
import type { PermissionKey } from "@/lib/permissions";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLE_HIERARCHY } from "@/lib/permissions";
export { DEFAULT_ROLE_PERMISSIONS, ROLE_HIERARCHY };

/** Roles shown in admin assignment UI (OWNER only assignable by OWNER). */
export const ASSIGNABLE_ROLES: UserRole[] = [
  "USER",
  "PREMIUM",
  "PARTNER",
  "CREATOR",
  "DESIGNER",
  "SUPPORT",
  "MODERATOR",
  "ADMIN",
  "OWNER",
];

export function isWildcardPermission(value: string) {
  return value === "*";
}

export function permissionSetIncludes(
  permissions: Iterable<string>,
  permission: PermissionKey
): boolean {
  const list = Array.from(permissions);
  if (list.some(isWildcardPermission)) return true;
  return list.includes(permission);
}

/** Union permissions from USER up to and including `role` in the hierarchy. */
export function inheritedRolePermissions(
  role: UserRole,
  roleMap: Record<UserRole, PermissionKey[]>
): Set<PermissionKey | "*"> {
  const idx = ROLE_HIERARCHY.indexOf(role);
  const effective = new Set<PermissionKey | "*">();
  if (idx < 0) {
    for (const p of roleMap[role] ?? []) effective.add(p);
    return effective;
  }
  for (let i = 0; i <= idx; i++) {
    for (const p of roleMap[ROLE_HIERARCHY[i]] ?? []) effective.add(p);
  }
  return effective;
}

export function parseGroupPermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String);
}

export function allPermissionKeys(): PermissionKey[] {
  return Object.keys(PERMISSIONS) as PermissionKey[];
}
