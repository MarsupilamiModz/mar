import { prisma } from "@/lib/db";
import { getSiteSetting } from "@/lib/site-settings";
import { formatCreditsFromCents } from "@/lib/credits";
import type { UserRole } from "@prisma/client";

export type MembershipPerks = {
  downloadLimit?: number | null;
  adFree?: boolean;
  exclusiveMods?: boolean;
  creatorContent?: boolean;
  betaAccess?: boolean;
  discordPerks?: boolean;
  storageLimitMb?: number | null;
  customBadge?: string | null;
  accentColor?: string | null;
  earlyAccess?: boolean;
  marketplaceFeeBps?: number;
  prioritySupport?: boolean;
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
  billingType: "ONE_TIME";
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
    description: "Lifetime access to premium downloads and ad-free browsing.",
    priceCents: 799,
    currency: "EUR",
    billingType: "ONE_TIME",
    stripePriceId: null,
    interval: null,
    features: ["Premium mod downloads", "Ad-free experience", "Premium Lite badge", "50 downloads/month"],
    perks: { downloadLimit: 50, adFree: true, exclusiveMods: true, customBadge: "premium-lite", accentColor: "#60a5fa" },
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
    description: "Lifetime full premium access with exclusive content and creator perks.",
    priceCents: 1499,
    currency: "EUR",
    billingType: "ONE_TIME",
    stripePriceId: null,
    interval: null,
    features: [
      "Unlimited premium downloads",
      "Exclusive mods",
      "Creator content access",
      "Discord perks",
      "Priority support",
    ],
    perks: {
      downloadLimit: null,
      adFree: true,
      exclusiveMods: true,
      creatorContent: true,
      discordPerks: true,
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
    name: "Premium Max",
    description: "Lifetime ultimate tier with beta access, early releases, and maximum perks.",
    priceCents: 2999,
    currency: "EUR",
    billingType: "ONE_TIME",
    stripePriceId: null,
    interval: null,
    features: [
      "Everything in Premium",
      "Closed beta access",
      "Early access releases",
      "Extended storage",
      "Lowest marketplace fees",
    ],
    perks: {
      downloadLimit: null,
      adFree: true,
      exclusiveMods: true,
      creatorContent: true,
      betaAccess: true,
      earlyAccess: true,
      discordPerks: true,
      storageLimitMb: 10240,
      prioritySupport: true,
      marketplaceFeeBps: 500,
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

const activePurchaseWhere = {
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
};

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
    billingType: "ONE_TIME",
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
  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (plans.length === 0) {
    await seedDefaultPlans();
    return (await prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    })).map(mapPlan);
  }
  return plans.map(mapPlan);
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
        billingType: "ONE_TIME",
        stripePriceId: plan.stripePriceId,
        interval: null,
        features: plan.features,
        perks: plan.perks,
        badgeSlug: plan.badgeSlug,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
      },
      update: {
        billingType: "ONE_TIME",
        interval: null,
        priceCents: plan.priceCents,
        description: plan.description,
      },
    });
  }
}

/** Highest active membership tier by plan sortOrder (supports upgrades). */
export async function getUserMembershipTier(userId: string): Promise<MembershipPlanData | null> {
  const purchases = await prisma.membershipPurchase.findMany({
    where: { userId, ...activePurchaseWhere },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (purchases.length === 0) {
    // Legacy: honor grandfathered Stripe subscriptions until migrated
    const sub = await prisma.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    if (sub?.plan) return mapPlan(sub.plan);
    return null;
  }

  const best = purchases
    .filter((p) => p.plan?.isActive)
    .sort((a, b) => (b.plan?.sortOrder ?? 0) - (a.plan?.sortOrder ?? 0))[0];

  return best?.plan ? mapPlan(best.plan) : null;
}

export async function userHasMembershipAccess(userId: string, role: UserRole): Promise<boolean> {
  if (["OWNER", "ADMIN", "MODERATOR", "PREMIUM"].includes(role)) return true;
  const tier = await getUserMembershipTier(userId);
  return tier !== null;
}

export async function userHasAdFree(userId: string, role: string): Promise<boolean> {
  if (["OWNER", "ADMIN", "MODERATOR", "PREMIUM"].includes(role)) return true;
  const tier = await getUserMembershipTier(userId);
  return tier?.perks.adFree === true;
}

export type PremiumPageSettings = {
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  showComparison: boolean;
};

export const DEFAULT_PREMIUM_PAGE: PremiumPageSettings = {
  heroTitle: "Unlock the full MarsupilamiModz experience",
  heroSubtitle: "One-time lifetime access — premium downloads, exclusive mods, and ad-free browsing.",
  ctaText: "Buy lifetime access",
  showComparison: true,
};

export async function getPremiumPageSettings() {
  return getSiteSetting("premium_page", DEFAULT_PREMIUM_PAGE);
}

export function formatPlanPrice(cents: number, _currency?: string, locale?: string) {
  return formatCreditsFromCents(cents, locale ?? "en");
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

  const purchase = await prisma.membershipPurchase.create({
    data: {
      userId: params.userId,
      planId: params.planId,
      amountCents: params.amountCents ?? plan.priceCents,
      stripePaymentId: params.stripePaymentId ?? null,
      expiresAt: null,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (user && !["OWNER", "ADMIN", "MODERATOR"].includes(user.role)) {
    await prisma.user.update({ where: { id: params.userId }, data: { role: "PREMIUM" } });
  }

  const { evaluateUserAchievements } = await import("@/lib/achievements");
  void evaluateUserAchievements(params.userId);

  return purchase;
}
