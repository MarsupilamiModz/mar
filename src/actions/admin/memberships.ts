"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, requireActionPermission } from "@/lib/action-utils";
import {
  DEFAULT_MEMBERSHIP_PLANS,
  mapPlan,
  type MembershipPerks,
  DEFAULT_PREMIUM_PAGE,
  type PremiumPageSettings,
} from "@/lib/membership";
import { setSiteSetting } from "@/lib/site-settings";
import { grantMembershipPurchase } from "@/lib/membership";
import type { BillingType, Prisma } from "@prisma/client";

export async function getAdminMembershipPlans() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  let plans = await prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } });
  if (plans.length === 0) {
    for (const p of DEFAULT_MEMBERSHIP_PLANS) {
      await prisma.membershipPlan.create({
        data: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          currency: p.currency,
          billingType: p.billingType,
          stripePriceId: p.stripePriceId,
          interval: p.interval,
          features: p.features,
          perks: p.perks,
          badgeSlug: p.badgeSlug,
          sortOrder: p.sortOrder,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
        },
      });
    }
    plans = await prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } });
  }
  return ok(plans.map(mapPlan));
}

export async function saveMembershipPlan(input: {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  billingType?: BillingType;
  stripePriceId?: string;
  interval?: string;
  features: string[];
  perks: MembershipPerks;
  badgeSlug?: string;
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  translations?: Record<string, unknown>;
  originalPriceCents?: number | null;
  saleDiscountPercent?: number | null;
  saleEndsAt?: string | null;
  cardStyle?: Record<string, unknown>;
  iconKey?: string | null;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const data = {
    slug: input.slug,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    currency: input.currency ?? "EUR",
    billingType: "ONE_TIME" as BillingType,
    stripePriceId: input.stripePriceId || null,
    interval: null,
    features: input.features as Prisma.InputJsonValue,
    perks: input.perks as Prisma.InputJsonValue,
    badgeSlug: input.badgeSlug || null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    translations: (input.translations ?? undefined) as Prisma.InputJsonValue | undefined,
    originalPriceCents: input.originalPriceCents ?? null,
    saleDiscountPercent: input.saleDiscountPercent ?? null,
    saleEndsAt: input.saleEndsAt ? new Date(input.saleEndsAt) : null,
    cardStyle: (input.cardStyle ?? undefined) as Prisma.InputJsonValue | undefined,
    iconKey: input.iconKey ?? null,
  };

  if (input.id) {
    await prisma.membershipPlan.update({ where: { id: input.id }, data });
  } else {
    await prisma.membershipPlan.create({ data });
  }

  revalidatePath("/premium");
  revalidatePath("/admin/memberships");
  return ok(undefined);
}

export async function deleteMembershipPlan(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.membershipPlan.delete({ where: { id } });
  revalidatePath("/admin/memberships");
  return ok(undefined);
}

export async function getPremiumPageAdminSettings() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const row = await prisma.siteSetting.findUnique({ where: { key: "premium_page" } });
  return ok((row?.value as PremiumPageSettings) ?? DEFAULT_PREMIUM_PAGE);
}

export async function savePremiumPageSettings(settings: PremiumPageSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await setSiteSetting("premium_page", settings);
  revalidatePath("/premium");
  return ok(undefined);
}

export async function reorderMembershipPlans(orderedIds: string[]) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.membershipPlan.update({ where: { id }, data: { sortOrder: i } }))
  );
  revalidatePath("/premium");
  return ok(undefined);
}

export async function assignMembershipToUser(userId: string, planId: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await grantMembershipPurchase({ userId, planId, stripePaymentId: `admin_${user.id}_${Date.now()}` });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function getAdminMembershipPurchases(params?: { page?: number; limit?: number }) {
  const { error } = await requireActionPermission("subscriptions.read");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = Math.min(params?.limit ?? 50, 100);

  const [purchases, total, revenue] = await Promise.all([
    prisma.membershipPurchase.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, email: true } },
        plan: { select: { name: true, slug: true } },
      },
    }),
    prisma.membershipPurchase.count(),
    prisma.membershipPurchase.aggregate({ _sum: { amountCents: true } }),
  ]);

  return ok({
    purchases,
    total,
    pages: Math.ceil(total / limit),
    page,
    totalRevenueCents: revenue._sum.amountCents ?? 0,
  });
}
