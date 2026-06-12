"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { invalidatePermissionCache } from "@/lib/permission-store";
import { STAFF_ROLES, TEAM_DEPARTMENTS } from "@/lib/team";

const STAFF_ROLE_SET: UserRole[] = [...STAFF_ROLES];

export async function listTeamMembersAdmin() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const members = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLE_SET }, deletedAt: null },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      teamDepartment: true,
      teamBadge: true,
      permissionGroupId: true,
      permissionGroup: { select: { id: true, name: true, color: true } },
      updatedAt: true,
    },
  });

  const groups = await prisma.permissionGroup.findMany({
    where: { isArchived: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });

  return ok({ members, groups, departments: TEAM_DEPARTMENTS });
}

export async function updateTeamMemberAdmin(
  userId: string,
  input: {
    role?: UserRole;
    teamDepartment?: string | null;
    teamBadge?: string | null;
    permissionGroupId?: string | null;
  }
) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("User not found");

  if (input.role && !STAFF_ROLE_SET.includes(input.role)) {
    return fail("Invalid team role");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.role && { role: input.role }),
      ...(input.teamDepartment !== undefined && { teamDepartment: input.teamDepartment }),
      ...(input.teamBadge !== undefined && { teamBadge: input.teamBadge }),
      ...(input.permissionGroupId !== undefined && { permissionGroupId: input.permissionGroupId }),
    },
  });

  invalidatePermissionCache();
  revalidatePath("/admin/team");
  return ok(undefined);
}

export async function addTeamMemberAdmin(input: {
  userId: string;
  role: UserRole;
  teamDepartment?: string;
  permissionGroupId?: string;
}) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  if (!STAFF_ROLE_SET.includes(input.role)) {
    return fail("Role must be a staff role");
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return fail("User not found");

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      role: input.role,
      teamDepartment: input.teamDepartment ?? null,
      permissionGroupId: input.permissionGroupId ?? null,
    },
  });

  invalidatePermissionCache();
  revalidatePath("/admin/team");
  return ok(undefined);
}

export async function removeFromTeamAdmin(userId: string) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: "USER",
      teamDepartment: null,
      teamBadge: null,
      permissionGroupId: null,
    },
  });

  invalidatePermissionCache();
  revalidatePath("/admin/team");
  return ok(undefined);
}

export async function searchUsersForTeamAdmin(query: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: "USER",
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: { id: true, username: true, email: true, displayName: true },
  });

  return ok(users);
}
