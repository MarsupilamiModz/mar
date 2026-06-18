"use server";

import { revalidatePath } from "next/cache";
import { TeamVisibility } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { createAuditLog } from "@/lib/audit";

export async function listTeamDepartmentsAdmin() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const departments = await prisma.teamDepartment.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { members: true } } },
  });
  return ok(departments);
}

export async function upsertTeamDepartment(input: {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
  const data = {
    slug,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };

  const dept = input.id
    ? await prisma.teamDepartment.update({ where: { id: input.id }, data })
    : await prisma.teamDepartment.create({ data });

  await createAuditLog({
    actorId: user!.id,
    action: input.id ? "team.department_update" : "team.department_create",
    entityType: "TeamDepartment",
    entityId: dept.id,
    metadata: { slug: dept.slug },
  });

  revalidatePath("/admin/team");
  revalidatePath("/team");
  return ok(dept);
}

export async function deleteTeamDepartment(id: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.teamDepartment.delete({ where: { id } });
  await createAuditLog({
    actorId: user!.id,
    action: "team.department_delete",
    entityType: "TeamDepartment",
    entityId: id,
  });

  revalidatePath("/admin/team");
  revalidatePath("/team");
  return ok(undefined);
}

export async function listTeamProfilesAdmin() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const members = await prisma.teamMember.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { department: { select: { id: true, name: true, slug: true } } },
  });
  return ok(members);
}

export async function upsertTeamProfile(input: {
  id?: string;
  name: string;
  position: string;
  description?: string;
  email?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  discordUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  tiktokUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  websiteUrl?: string;
  customLinks?: { label: string; url: string }[];
  departmentId?: string | null;
  visibility?: TeamVisibility;
  sortOrder?: number;
  isActive?: boolean;
  userId?: string | null;
}) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const data = {
    name: input.name.trim(),
    position: input.position.trim(),
    description: input.description?.trim() || null,
    email: input.email?.trim() || null,
    avatarUrl: input.avatarUrl?.trim() || null,
    bannerUrl: input.bannerUrl?.trim() || null,
    discordUrl: input.discordUrl?.trim() || null,
    youtubeUrl: input.youtubeUrl?.trim() || null,
    twitchUrl: input.twitchUrl?.trim() || null,
    tiktokUrl: input.tiktokUrl?.trim() || null,
    instagramUrl: input.instagramUrl?.trim() || null,
    xUrl: input.xUrl?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
    customLinks: input.customLinks?.length ? input.customLinks : undefined,
    departmentId: input.departmentId || null,
    visibility: input.visibility ?? "PUBLIC",
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    userId: input.userId || null,
  };

  const member = input.id
    ? await prisma.teamMember.update({ where: { id: input.id }, data })
    : await prisma.teamMember.create({ data });

  await createAuditLog({
    actorId: user!.id,
    action: input.id ? "team.member_update" : "team.member_create",
    entityType: "TeamMember",
    entityId: member.id,
    metadata: { name: member.name },
  });

  revalidatePath("/admin/team");
  revalidatePath("/team");
  return ok(member);
}

export async function deleteTeamProfile(id: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.teamMember.delete({ where: { id } });
  await createAuditLog({
    actorId: user!.id,
    action: "team.member_delete",
    entityType: "TeamMember",
    entityId: id,
  });

  revalidatePath("/admin/team");
  revalidatePath("/team");
  return ok(undefined);
}

export async function reorderTeamProfiles(orderedIds: string[]) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.teamMember.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  await createAuditLog({
    actorId: user!.id,
    action: "team.member_reorder",
    entityType: "TeamMember",
    metadata: { orderedIds },
  });

  revalidatePath("/admin/team");
  revalidatePath("/team");
  return ok(undefined);
}
