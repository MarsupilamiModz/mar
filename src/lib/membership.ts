import { prisma, withDbRetry } from "@/lib/db";
import { getSiteSetting } from "@/lib/site-settings";
import {
  DEFAULT_MEMBERSHIP_PLANS,
  DEFAULT_PREMIUM_PAGE,
  mapPlan,
  type MembershipPlanData,
} from "@/lib/membership-pricing";
import {
  getEffectiveMembershipPlan,
  getUserMembershipState,
  isMembershipActive,
  planSlugToTier,
  syncUserRoleFromMembership,
  upsertUserMembership,
} from "@/lib/user-membership";
import type { UserRole } from "@prisma/client";

export type {
  MembershipPerks,
  PlanTranslation,
  MembershipPlanData,
  PlanCardStyle,
  PremiumPageSettings,
} from "@/lib/membership-pricing";

export {
  DEFAULT_MEMBERSHIP_PLANS,
  DEFAULT_PREMIUM_PAGE,
  parsePlanFeatures,
  parsePlanPerks,
  mapPlan,
  isSaleActive,
  getEffectivePlanPrice,
  getSaleTimeRemaining,
  formatPlanPrice,
  formatPlanPriceOnce,
  localizedPlan,
} from "@/lib/membership-pricing";

export async function getActiveMembershipPlans() {
  try {
    const plans = await withDbRetry(
      () =>
        prisma.membershipPlan.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
      { label: "membership:plans" }
    );
    if (plans.length === 0) {
      await seedDefaultPlans();
      const seeded = await prisma.membershipPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      return seeded.map(mapPlan);
    }
    return plans.map(mapPlan);
  } catch (err) {
    console.error("[membership] getActiveMembershipPlans failed", err);
    return DEFAULT_MEMBERSHIP_PLANS.map((plan, index) =>
      mapPlan({
        id: `fallback-${plan.slug}-${index}`,
        ...plan,
      })
    );
  }
}

export async function seedDefaultPlans() {
  for (const plan of DEFAULT_MEMBERSHIP_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        billingType: plan.billingType,
        stripePriceId: plan.stripePriceId,
        interval: plan.interval,
        features: plan.features,
        perks: plan.perks,
        badgeSlug: plan.badgeSlug,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
      },
      update: {
        billingType: plan.billingType,
        interval: plan.interval,
        priceCents: plan.priceCents,
        description: plan.description,
        features: plan.features,
        perks: plan.perks,
      },
    });
  }
}

/** Highest active membership tier for a user. */
export async function getUserMembershipTier(userId: string): Promise<MembershipPlanData | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return null;
  return getEffectiveMembershipPlan(userId, user.role);
}

export async function userHasMembershipAccess(userId: string, role: UserRole): Promise<boolean> {
  if (["OWNER", "ADMIN", "MODERATOR", "PREMIUM"].includes(role)) return true;
  const state = await getUserMembershipState(userId);
  return isMembershipActive(state);
}

export async function userHasAdFree(userId: string, role: string): Promise<boolean> {
  if (["OWNER", "ADMIN", "MODERATOR", "PREMIUM", "CREATOR", "PARTNER", "DESIGNER", "SUPPORT"].includes(role)) {
    return true;
  }

  const tier = await getUserMembershipTier(userId);
  if (tier?.perks.adFree === true) return true;

  const { getAdSettings } = await import("@/lib/ads");
  const adSettings = await getAdSettings();

  if (adSettings.rolesWithoutAds?.includes(role)) return true;
  if (adSettings.rolesWithAds?.length && !adSettings.rolesWithAds.includes(role)) return true;

  if (adSettings.membershipSlugsWithoutAds?.length && tier?.slug) {
    return adSettings.membershipSlugsWithoutAds.includes(tier.slug);
  }

  return false;
}

export async function getPremiumPageSettings() {
  return getSiteSetting("premium_page", DEFAULT_PREMIUM_PAGE);
}

export async function grantMembershipPurchase(params: {
  userId: string;
  planId: string;
  amountCents?: number;
  stripePaymentId?: string;
}) {
  if (params.stripePaymentId) {
    const dup = await prisma.membershipPurchase.findFirst({
      where: { stripePaymentId: params.stripePaymentId },
    });
    if (dup) return dup;
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const plan = await tx.membershipPlan.findUnique({ where: { id: params.planId } });
    if (!plan) throw new Error("Plan not found");

    if (plan.stockLimit != null && plan.soldCount >= plan.stockLimit) {
      throw new Error("Plan sold out");
    }

    const created = await tx.membershipPurchase.create({
      data: {
        userId: params.userId,
        planId: params.planId,
        amountCents: params.amountCents ?? plan.priceCents,
        stripePaymentId: params.stripePaymentId ?? null,
        expiresAt: plan.durationDays
          ? new Date(Date.now() + plan.durationDays * 86_400_000)
          : null,
      },
    });

    if (plan.stockLimit != null) {
      await tx.membershipPlan.update({
        where: { id: plan.id },
        data: { soldCount: { increment: 1 } },
      });
    }

    return { purchase: created, plan };
  });

  const isLifetime =
    purchase.plan.billingType === "ONE_TIME" || purchase.plan.planKind === "LIFETIME";

  await upsertUserMembership({
    userId: params.userId,
    membershipType: planSlugToTier(purchase.plan.slug),
    status: "ACTIVE",
    planId: purchase.plan.id,
    isLifetime,
  });
  await syncUserRoleFromMembership(params.userId);

  const { evaluateUserAchievements } = await import("@/lib/achievements");
  void evaluateUserAchievements(params.userId);

  return purchase.purchase;
}

export async function grantMembershipSubscription(params: {
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  renewalDate: Date;
  status?: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
}) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: params.planId } });
  if (!plan) throw new Error("Plan not found");

  await upsertUserMembership({
    userId: params.userId,
    membershipType: planSlugToTier(plan.slug),
    status: params.status ?? "ACTIVE",
    planId: plan.id,
    stripeSubscriptionId: params.stripeSubscriptionId,
    renewalDate: params.renewalDate,
    isLifetime: false,
  });
  await syncUserRoleFromMembership(params.userId);

  const { evaluateUserAchievements } = await import("@/lib/achievements");
  void evaluateUserAchievements(params.userId);
}

export function getPlanDiscordRoles(planSlug: string): string[] {
  switch (planSlug) {
    case "premium-lite":
      return ["premium-lite", "premium"];
    case "premium-max":
      return ["premium-max", "premium"];
    case "premium":
    default:
      return ["premium"];
  }
}
