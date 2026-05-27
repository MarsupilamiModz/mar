"use server";

import { prisma } from "@/lib/db";
import { ok, requireActionPermission } from "@/lib/action-utils";

export async function getAdminSubscriptions() {
  const { error } = await requireActionPermission("subscriptions.read");
  if (error) return error;

  const subscriptions = await prisma.subscription.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, username: true, email: true, role: true } },
    },
  });

  const stats = {
    active: subscriptions.filter((s) => s.status === "ACTIVE").length,
    canceled: subscriptions.filter((s) => s.status === "CANCELED").length,
    pastDue: subscriptions.filter((s) => s.status === "PAST_DUE").length,
  };

  return ok({ subscriptions, stats });
}
