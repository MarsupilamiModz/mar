"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/action-utils";
import { visitorHash } from "@/lib/affiliate";
import { recordCommission } from "@/lib/analytics/ecosystem";

function ipHash() {
  const ip = headers().get("x-forwarded-for") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function trackAffiliateClick(code: string) {
  const normalized = code.toUpperCase().trim();
  const coupon = await prisma.coupon.findUnique({
    where: { code: normalized },
    include: { owner: { select: { id: true, role: true } } },
  });

  if (!coupon || !coupon.isActive) return fail("Invalid code");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return fail("Code expired");

  const ip = headers().get("x-forwarded-for") ?? "unknown";
  const ua = headers().get("user-agent") ?? undefined;
  const vHash = visitorHash(ip, ua);

  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { clickCount: { increment: 1 } },
    });
    await tx.affiliateEvent.create({
      data: {
        couponId: coupon.id,
        code: normalized,
        ownerUserId: coupon.ownerUserId,
        eventType: "CLICK",
        visitorHash: vHash,
        ipHash: ipHash(),
        userAgent: ua?.slice(0, 512),
      },
    });
    if (coupon.ownerUserId) {
      await tx.partnerProfile.updateMany({
        where: { userId: coupon.ownerUserId },
        data: { totalClicks: { increment: 1 } },
      });
    }
  });

  return ok({ code: normalized, type: coupon.affiliateType });
}

export async function trackAffiliateConversion(
  code: string,
  amountCents: number,
  eventType: "CONVERSION" | "SUBSCRIPTION" = "CONVERSION"
) {
  const normalized = code.toUpperCase().trim();
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.ownerUserId) return fail("Invalid code");

  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        conversionCount: { increment: 1 },
        revenueCents: { increment: amountCents },
        usedCount: { increment: 1 },
      },
    });

    await tx.affiliateEvent.create({
      data: {
        couponId: coupon.id,
        code: normalized,
        ownerUserId: coupon.ownerUserId,
        eventType,
        amountCents,
        ipHash: ipHash(),
      },
    });

    await tx.partnerProfile.updateMany({
      where: { userId: coupon.ownerUserId! },
      data: {
        totalConversions: { increment: 1 },
        totalRevenueCents: { increment: amountCents },
      },
    });
  });

  const owner = await prisma.user.findUnique({ where: { id: coupon.ownerUserId! } });
  if (owner) {
    await recordCommission({
      userId: owner.id,
      source: eventType === "SUBSCRIPTION" ? "SUBSCRIPTION" : "COUPON",
      sourceId: coupon.id,
      grossCents: amountCents,
      role: owner.role,
      description: `Affiliate conversion: ${normalized}`,
    });
  }

  revalidatePath("/partner");
  revalidatePath("/creator");
  return ok(undefined);
}
