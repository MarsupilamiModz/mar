"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionOwner, requireActionPermission } from "@/lib/action-utils";
import {
  getRevenueShareSettings,
  saveRevenueShareSettings,
  type RevenueShareSettings,
} from "@/lib/revenue-sharing";

export async function getAdminRevenueShareDashboard() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [settings, revenueToday, revenue30d, pendingPayouts, openEntries] = await Promise.all([
    getRevenueShareSettings(),
    prisma.modPurchase.aggregate({
      where: { createdAt: { gte: dayStart } },
      _sum: { amountCents: true },
    }),
    prisma.modPurchase.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.payout.aggregate({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.commissionEntry.aggregate({
      where: { status: "PENDING" },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  return ok({
    settings,
    revenueTodayCents: revenueToday._sum.amountCents ?? 0,
    revenue30dCents: revenue30d._sum.amountCents ?? 0,
    pendingPayoutCents: pendingPayouts._sum.amountCents ?? 0,
    pendingPayoutCount: pendingPayouts._count,
    openCommissionCents: openEntries._sum.amountCents ?? 0,
    openCommissionCount: openEntries._count,
  });
}

export async function saveAdminRevenueShareSettings(settings: RevenueShareSettings) {
  const { error } = await requireActionOwner();
  if (error) return error;

  try {
    await saveRevenueShareSettings(settings);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Invalid revenue share settings");
  }

  revalidatePath("/admin/payout-settings");
  return ok(undefined);
}
