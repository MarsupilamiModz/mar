import { prisma } from "@/lib/db";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import type { ShopProductCategory } from "@prisma/client";

export const DEFAULT_CREDIT_PACKS = [
  { slug: "credits-500", name: "500 Credits", creditsAmount: 500, priceCents: 500, sortOrder: 1 },
  { slug: "credits-1000", name: "1000 Credits", creditsAmount: 1000, priceCents: 1000, sortOrder: 2, isFeatured: true },
  { slug: "credits-2500", name: "2500 Credits", creditsAmount: 2500, priceCents: 2500, sortOrder: 3 },
  { slug: "credits-5000", name: "5000 Credits", creditsAmount: 5000, priceCents: 5000, sortOrder: 4 },
  { slug: "credits-10000", name: "10000 Credits", creditsAmount: 10000, priceCents: 10000, sortOrder: 5 },
] as const;

export async function ensureDefaultCreditPacks() {
  for (const pack of DEFAULT_CREDIT_PACKS) {
    await prisma.shopProduct.upsert({
      where: { slug: pack.slug },
      create: {
        slug: pack.slug,
        name: pack.name,
        category: "CREDITS",
        productType: "CREDIT_PACK",
        creditsAmount: pack.creditsAmount,
        priceCents: pack.priceCents,
        creditPrice: 0,
        isActive: true,
        isFeatured: "isFeatured" in pack ? pack.isFeatured : false,
        sortOrder: pack.sortOrder,
        description: `${safeToLocaleString(pack.creditsAmount)} Credits for the XumariModz platform`,
      },
      update: {},
    });
  }
}

export function effectiveCreditPrice(product: {
  creditPrice: number;
  priceCents: number;
  salePercent: number;
}) {
  const base = product.creditPrice > 0 ? product.creditPrice : product.priceCents;
  if (!product.salePercent) return base;
  return Math.round(base * (100 - product.salePercent) / 100);
}

export async function getShopProducts(category?: ShopProductCategory) {
  try {
    await ensureDefaultCreditPacks();
  } catch {
    return [];
  }

  try {
    return await prisma.shopProduct.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      mod: { select: { slug: true, title: true, pricing: true } },
      membershipPlan: { select: { slug: true, name: true } },
    },
  });
  } catch {
    return [];
  }
}

export async function getFeaturedShopProducts(limit = 8) {
  return prisma.shopProduct.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { sortOrder: "asc" },
    take: limit,
    include: {
      mod: { select: { slug: true, title: true } },
      membershipPlan: { select: { slug: true, name: true } },
    },
  });
}
