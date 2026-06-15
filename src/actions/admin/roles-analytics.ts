"use server";

import { ok, requireActionPermission } from "@/lib/action-utils";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getRolePermissionsForAdmin } from "@/lib/permission-store";
import type { UserRole } from "@prisma/client";

export async function getRoleAnalytics() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const [usersByRole, activePurchases, groups, purchasesByPlan] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
      where: { deletedAt: null },
    }),
    prisma.membershipPurchase.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }),
    prisma.permissionGroup.findMany({
      where: { isArchived: false },
      include: { _count: { select: { users: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.membershipPurchase.groupBy({
      by: ["planId"],
      _count: { id: true },
    }),
  ]);

  const plans = await prisma.membershipPlan.findMany({ select: { id: true, name: true, slug: true } });
  const planNameById = Object.fromEntries(plans.map((p) => [p.id, p.name]));

  const builtinRoles = Object.keys(PERMISSIONS).length;
  const rolePermissions: { role: UserRole; permissionCount: number }[] = [];

  for (const role of [
    "USER",
    "PREMIUM",
    "PARTNER",
    "CREATOR",
    "DESIGNER",
    "SUPPORT",
    "MODERATOR",
    "ADMIN",
    "OWNER",
  ] as UserRole[]) {
    const perms = await getRolePermissionsForAdmin(role);
    rolePermissions.push({ role, permissionCount: perms.length });
  }

  return ok({
    usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count.id })),
    activePurchases,
    customGroups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      userCount: g._count.users,
      isDisabled: g.isDisabled,
      isSystem: g.isSystem,
    })),
    purchasesByPlan: purchasesByPlan.map((p) => ({
      planId: p.planId,
      planName: planNameById[p.planId] ?? p.planId,
      count: p._count.id,
    })),
    totalPermissions: builtinRoles,
    rolePermissions,
  });
}
