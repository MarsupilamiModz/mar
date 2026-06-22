import { formatMoneyFromCents, formatMoneyWithInterval } from "@/lib/currency";

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

export type PlanCardStyle = {
  accentColor?: string;
  iconKey?: string;
  ctaText?: string;
  badgeLabel?: string;
  gradient?: string;
  borderGlow?: boolean;
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

function planSaleEnd(plan: { saleEndsAt?: Date | string | null }): Date | null {
  if (!plan.saleEndsAt) return null;
  if (plan.saleEndsAt instanceof Date) return plan.saleEndsAt;
  const parsed = new Date(plan.saleEndsAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSaleActive(plan: MembershipPlanData): boolean {
  if (!plan.saleDiscountPercent || plan.saleDiscountPercent <= 0) return false;
  const saleEndsAt = planSaleEnd(plan);
  if (saleEndsAt && saleEndsAt < new Date()) return false;
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
  const saleEndsAt = planSaleEnd(plan);
  if (!saleEndsAt || !isSaleActive(plan)) return null;
  return Math.max(0, saleEndsAt.getTime() - Date.now());
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
