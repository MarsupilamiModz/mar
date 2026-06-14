"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, formatZodError, ok, requireActionPermission } from "@/lib/action-utils";
import {
  DEFAULT_MEMBERSHIP_PLANS,
  mapPlan,
  type MembershipPerks,
  DEFAULT_PREMIUM_PAGE,
  type PremiumPageSettings,
} from "@/lib/membership";
import { setSiteSetting } from "@/lib/site-settings";
import { grantMembershipPurchase } from "@/lib/membership";
import { zOptionalStripePriceId, zTrimmedString } from "@/lib/safe-string";
import { resolveSlug, ensureUniqueSlug, zSlugInput } from "@/lib/slug";
import type { BillingType, Prisma } from "@prisma/client";

const membershipPlanSchema = z.object({
  id: z.string().cuid().optional(),
  slug: zSlugInput,
  name: zTrimmedString.pipe(z.string().min(2).max(120)),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().min(0),
  currency: zTrimmedString.pipe(z.string().max(8)).optional(),
  stripePriceId: zOptionalStripePriceId,
  features: z.array(z.string()).default([]),
  perks: z.record(z.unknown()),
  badgeSlug: z.string().max(80).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  translations: z.record(z.unknown()).optional(),
  originalPriceCents: z.number().int().min(0).nullable().optional(),
  saleDiscountPercent: z.number().int().min(0).max(100).nullable().optional(),
  saleEndsAt: z.string().nullable().optional(),
  cardStyle: z.record(z.unknown()).optional(),
  iconKey: z.string().max(40).nullable().optional(),
});

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
  slug?: string;
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

  const parsed = membershipPlanSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const resolved = resolveSlug({ name: parsed.data.name, slug: parsed.data.slug, fallbackPrefix: "plan" });
  const slug = parsed.data.id
    ? resolved.slug
    : await ensureUniqueSlug(resolved.slug, async (s) =>
        Boolean(await prisma.membershipPlan.findUnique({ where: { slug: s } }))
      );

  const data = {
    slug,
    name: parsed.data.name,
    description: parsed.data.description,
    priceCents: parsed.data.priceCents,
    currency: parsed.data.currency ?? "EUR",
    billingType: "ONE_TIME" as BillingType,
    stripePriceId: parsed.data.stripePriceId ?? null,
    interval: null,
    features: parsed.data.features as Prisma.InputJsonValue,
    perks: parsed.data.perks as Prisma.InputJsonValue,
    badgeSlug: parsed.data.badgeSlug || null,
    sortOrder: parsed.data.sortOrder ?? 0,
    isActive: parsed.data.isActive ?? true,
    isFeatured: parsed.data.isFeatured ?? false,
    translations: (parsed.data.translations ?? undefined) as Prisma.InputJsonValue | undefined,
    originalPriceCents: parsed.data.originalPriceCents ?? null,
    saleDiscountPercent: parsed.data.saleDiscountPercent ?? null,
    saleEndsAt: parsed.data.saleEndsAt ? new Date(parsed.data.saleEndsAt) : null,
    cardStyle: (parsed.data.cardStyle ?? undefined) as Prisma.InputJsonValue | undefined,
    iconKey: parsed.data.iconKey ?? null,
  };

  if (parsed.data.id) {
    await prisma.membershipPlan.update({ where: { id: parsed.data.id }, data });
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
