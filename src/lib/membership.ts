import { prisma, withDbRetry } from "@/lib/db";
import { getSiteSetting } from "@/lib/site-settings";
import { formatMoneyFromCents, formatMoneyWithInterval } from "@/lib/currency";
import {
  getEffectiveMembershipPlan,
  getUserMembershipState,
  isMembershipActive,
  planSlugToTier,
  syncUserRoleFromMembership,
  upsertUserMembership,
} from "@/lib/user-membership";
import type { UserRole } from "@prisma/client";

export type MembershipPerks = {
  downloadLimit?: number | null;
  downloadSpeedMbps?: number | null;
  adFree?: boolean;
  exclusiveMods?: boolean;
  creatorContent?: boolean;
  betaAccess?: boolean;
  discordPerks?: boolean;
  storageLimitMb?: number | null;
  customBadge?: string | null;
  accentColor?: string | null;
  earlyAccess?: boolean;
  earlyAccessDays?: number;
  marketplaceFeeBps?: number;
  prioritySupport?: boolean;
  exclusiveFeatures?: boolean;
};

export type PlanTranslation = {
  name?: string;
  description?: string;
  features?: string[];
  cta?: string;
};

export type MembershipPlanData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingType: "ONE_TIME" | "RECURRING";
  stripePriceId: string | null;
  interval: string | null;
  features: string[];
  perks: MembershipPerks;
  badgeSlug: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  translations: Record<string, PlanTranslation> | null;
  originalPriceCents: number | null;
  saleDiscountPercent: number | null;
  saleEndsAt: Date | null;
  cardStyle: PlanCardStyle | null;
  iconKey: string | null;
};

export type PlanCardStyle = {
  accentColor?: string;
  iconKey?: string;
  ctaText?: string;
  badgeLabel?: string;
  gradient?: string;
  borderGlow?: boolean;
};

export const DEFAULT_MEMBERSHIP_PLANS: Omit<MembershipPlanData, "id">[] = [
  {
    slug: "premium-lite",
    name: "Premium Lite",
    description: "Ad-free browsing with capped download speeds.",
    priceCents: 199,
    currency: "EUR",
    billingType: "RECURRING",
    stripePriceId: null,
    interval: "month",
    features: ["No ads", "Download limited to 3 MB/s", "Premium Lite badge"],
    perks: {
      downloadSpeedMbps: 3,
      adFree: true,
      earlyAccess: false,
      customBadge: "premium-lite",
      accentColor: "#60a5fa",
    },
    badgeSlug: "premium-lite",
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
    translations: null,
    originalPriceCents: null,
    saleDiscountPercent: null,
    saleEndsAt: null,
    cardStyle: null,
    iconKey: null,
  },
  {
    slug: "premium",
    name: "Premium",
    description: "Full-speed downloads and 7-day early access.",
    priceCents: 499,
    currency: "EUR",
    billingType: "RECURRING",
    stripePriceId: null,
    interval: "month",
    features: [
      "No ads",
      "Unlimited download speed",
      "7 days early access",
      "Exclusive mods",
      "Priority support",
    ],
    perks: {
      downloadLimit: null,
      downloadSpeedMbps: null,
      adFree: true,
      exclusiveMods: true,
      earlyAccess: true,
      earlyAccessDays: 7,
      prioritySupport: true,
      customBadge: "premium",
      accentColor: "#a855f7",
    },
    badgeSlug: "premium",
    sortOrder: 1,
    isActive: true,
    isFeatured: true,
    translations: null,
    originalPriceCents: null,
    saleDiscountPercent: null,
    saleEndsAt: null,
    cardStyle: null,
    iconKey: null,
  },
  {
    slug: "premium-max",
    name: "Premium MAX",
    description: "Ultimate tier with exclusive features, badges, and Discord perks.",
    priceCents: 999,
    currency: "EUR",
    billingType: "RECURRING",
    stripePriceId: null,
    interval: "month",
    features: [
      "No ads",
      "Unlimited download speed",
      "7 days early access",
      "Exclusive features",
      "Exclusive badges",
      "Exclusive Discord benefits",
      "Closed beta access",
    ],
    perks: {
      downloadLimit: null,
      adFree: true,
      exclusiveMods: true,
      creatorContent: true,
      betaAccess: true,
      earlyAccess: true,
      earlyAccessDays: 7,
      discordPerks: true,
      exclusiveFeatures: true,
      prioritySupport: true,
      customBadge: "premium-max",
      accentColor: "#3b82f6",
    },
    badgeSlug: "premium-max",
    sortOrder: 2,
    isActive: true,
    isFeatured: false,
    translations: null,
    originalPriceCents: null,
    saleDiscountPercent: null,
    saleEndsAt: null,
    cardStyle: null,
    iconKey: null,
  },
];


export function parsePlanFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

export function parsePlanPerks(raw: unknown): MembershipPerks {
  if (raw && typeof raw === "object") return raw as MembershipPerks;
  return {};
}

export function mapPlan(plan: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingType: string;
  stripePriceId: string | null;
  interval: string | null;
  features: unknown;
  perks: unknown;
  badgeSlug: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  translations: unknown;
  originalPriceCents?: number | null;
  saleDiscountPercent?: number | null;
  saleEndsAt?: Date | null;
  cardStyle?: unknown;
  iconKey?: string | null;
}): MembershipPlanData {
  return {
    ...plan,
    billingType: plan.billingType === "RECURRING" ? "RECURRING" : "ONE_TIME",
    features: parsePlanFeatures(plan.features),
    perks: parsePlanPerks(plan.perks),
    translations: (plan.translations as Record<string, PlanTranslation>) ?? null,
    originalPriceCents: plan.originalPriceCents ?? null,
    saleDiscountPercent: plan.saleDiscountPercent ?? null,
    saleEndsAt: plan.saleEndsAt ?? null,
    cardStyle: (plan.cardStyle as PlanCardStyle) ?? null,
    iconKey: plan.iconKey ?? null,
  };
}

export function isSaleActive(plan: MembershipPlanData): boolean {
  if (!plan.saleDiscountPercent || plan.saleDiscountPercent <= 0) return false;
  if (plan.saleEndsAt && plan.saleEndsAt < new Date()) return false;
  return true;
}

export function getEffectivePlanPrice(plan: MembershipPlanData): {
  priceCents: number;
  originalCents: number | null;
  discountPercent: number | null;
  onSale: boolean;
} {
  const onSale = isSaleActive(plan);
  if (!onSale) {
    return { priceCents: plan.priceCents, originalCents: plan.originalPriceCents, discountPercent: null, onSale: false };
  }
  const discounted = Math.round(plan.priceCents * (1 - (plan.saleDiscountPercent ?? 0) / 100));
  return {
    priceCents: discounted,
    originalCents: plan.originalPriceCents ?? plan.priceCents,
    discountPercent: plan.saleDiscountPercent,
    onSale: true,
  };
}

export function getSaleTimeRemaining(plan: MembershipPlanData): number | null {
  if (!plan.saleEndsAt || !isSaleActive(plan)) return null;
  return Math.max(0, plan.saleEndsAt.getTime() - Date.now());
}

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

export type PremiumPageSettings = {
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  showComparison: boolean;
};

export const DEFAULT_PREMIUM_PAGE: PremiumPageSettings = {
  heroTitle: "Unlock the full XumariModz experience",
  heroSubtitle: "Monthly subscriptions — ad-free browsing, faster downloads, and exclusive perks.",
  ctaText: "Subscribe now",
  showComparison: true,
};

export async function getPremiumPageSettings() {
  return getSiteSetting("premium_page", DEFAULT_PREMIUM_PAGE);
}

export function formatPlanPrice(cents: number, _currency?: string, locale?: string) {
  return formatMoneyWithInterval(cents, locale ?? "en", undefined, "month");
}

export function formatPlanPriceOnce(cents: number, locale?: string) {
  return formatMoneyFromCents(cents, locale ?? "en");
}

export function localizedPlan(plan: MembershipPlanData, locale: string) {
  const t = plan.translations?.[locale];
  return {
    ...plan,
    name: t?.name ?? plan.name,
    description: t?.description ?? plan.description,
    features: t?.features ?? plan.features,
    cta: t?.cta ?? undefined,
  };
}

export async function grantMembershipPurchase(params: {
  userId: string;
  planId: string;
  amountCents?: number;
  stripePaymentId?: string;
}) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: params.planId } });
  if (!plan) throw new Error("Plan not found");

  if (params.stripePaymentId) {
    const dup = await prisma.membershipPurchase.findFirst({
      where: { stripePaymentId: params.stripePaymentId },
    });
    if (dup) return dup;
  }

  const purchase = await prisma.membershipPurchase.create({
    data: {
      userId: params.userId,
      planId: params.planId,
      amountCents: params.amountCents ?? plan.priceCents,
      stripePaymentId: params.stripePaymentId ?? null,
      expiresAt: null,
    },
  });

  await upsertUserMembership({
    userId: params.userId,
    membershipType: planSlugToTier(plan.slug),
    status: "ACTIVE",
    planId: plan.id,
    isLifetime: plan.billingType === "ONE_TIME",
  });
  await syncUserRoleFromMembership(params.userId);

  const { evaluateUserAchievements } = await import("@/lib/achievements");
  void evaluateUserAchievements(params.userId);

  return purchase;
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
