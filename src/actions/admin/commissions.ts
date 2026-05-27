"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import type { CommissionSource, CommissionType, PayoutStatus, UserRole } from "@prisma/client";

const ruleSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(["FIXED", "PERCENT", "RECURRING"]),
  value: z.number().int().min(0),
  source: z.enum(["SUBSCRIPTION", "MOD_SALE", "CUSTOM_ORDER", "COUPON", "REFERRAL", "BONUS"]),
  targetRole: z.enum(["CREATOR", "PARTNER", "DESIGNER"]).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export async function listCommissionRules() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const rules = await prisma.commissionRule.findMany({ orderBy: { createdAt: "desc" } });
  return ok(rules);
}

export async function createCommissionRule(input: z.infer<typeof ruleSchema>) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const rule = await prisma.commissionRule.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type as CommissionType,
      value: parsed.data.value,
      source: parsed.data.source as CommissionSource,
      targetRole: parsed.data.targetRole as UserRole | undefined,
      description: parsed.data.description,
      isActive: parsed.data.isActive ?? true,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "commission_rule.create",
    entityType: "CommissionRule",
    entityId: rule.id,
  });

  revalidatePath("/admin/commissions");
  return ok(rule);
}

export async function toggleCommissionRule(id: string, isActive: boolean) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.commissionRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/commissions");
  return ok(undefined);
}

export async function listPayouts(params?: { userId?: string; status?: PayoutStatus }) {
  const { error } = await requireActionPermission("analytics.read");
  if (error) return error;

  const payouts = await prisma.payout.findMany({
    where: {
      ...(params?.userId && { userId: params.userId }),
      ...(params?.status && { status: params.status }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { username: true, displayName: true } } },
  });

  return ok(payouts);
}

export async function createPayout(userId: string, amountCents: number, method?: string) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;

  const pending = await prisma.commissionEntry.aggregate({
    where: { userId, status: "PENDING" },
    _sum: { amountCents: true },
  });

  const available = pending._sum.amountCents ?? 0;
  if (amountCents > available) return fail("Amount exceeds pending balance");

  const payout = await prisma.$transaction(async (tx) => {
    const p = await tx.payout.create({
      data: { userId, amountCents, method, status: "PROCESSING" },
    });

    const entries = await tx.commissionEntry.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    let remaining = amountCents;
    for (const entry of entries) {
      if (remaining <= 0) break;
      if (entry.amountCents <= remaining) {
        await tx.commissionEntry.update({
          where: { id: entry.id },
          data: { status: "PAID", payoutId: p.id },
        });
        remaining -= entry.amountCents;
      }
    }

    return p;
  });

  await createAuditLog({
    actorId: user.id,
    action: "payout.create",
    entityType: "Payout",
    entityId: payout.id,
    metadata: { userId, amountCents },
  });

  revalidatePath("/admin/commissions");
  return ok(payout);
}

export async function markPayoutPaid(id: string, reference?: string) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.payout.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date(), reference },
  });

  await createAuditLog({
    actorId: user.id,
    action: "payout.paid",
    entityType: "Payout",
    entityId: id,
  });

  revalidatePath("/admin/commissions");
  return ok(undefined);
}
