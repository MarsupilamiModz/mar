"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { couponSchema } from "@/lib/validations";

export async function getCoupons() {
  const { error } = await requireActionPermission("coupons.write");
  if (error) return error;

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return ok(coupons);
}

export async function createCoupon(input: {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  maxUses?: number;
  expiresAt?: string;
  appliesTo?: string;
}) {
  const { user, error } = await requireActionPermission("coupons.write");
  if (error) return error;

  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const code = parsed.data.code.toUpperCase();
  const exists = await prisma.coupon.findUnique({ where: { code } });
  if (exists) return fail("Code already exists");

  const coupon = await prisma.coupon.create({
    data: {
      code,
      type: parsed.data.type,
      value: parsed.data.value,
      maxUses: parsed.data.maxUses,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      appliesTo: parsed.data.appliesTo ?? "all",
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "coupon.create",
    entityType: "Coupon",
    entityId: coupon.id,
  });

  revalidatePath("/admin/coupons");
  return ok(coupon);
}

export async function toggleCoupon(id: string, isActive: boolean) {
  const { error } = await requireActionPermission("coupons.write");
  if (error) return error;

  await prisma.coupon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/coupons");
  return ok(undefined);
}

export async function deleteCoupon(id: string) {
  const { user, error } = await requireActionPermission("coupons.write");
  if (error) return error;

  await prisma.coupon.delete({ where: { id } });
  await createAuditLog({
    actorId: user.id,
    action: "coupon.delete",
    entityType: "Coupon",
    entityId: id,
  });
  revalidatePath("/admin/coupons");
  return ok(undefined);
}
