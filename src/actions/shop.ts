"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { creditWallet } from "@/lib/credits";
import { createCreditPackCheckout } from "@/lib/stripe";
import { effectiveCreditPrice } from "@/lib/shop";
import { grantMembershipPurchase } from "@/lib/membership";

export async function startCreditPackCheckout(productId: string, locale: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const product = await prisma.shopProduct.findUnique({ where: { id: productId } });
  if (!product || !product.isActive || product.productType !== "CREDIT_PACK") {
    return fail("Product not available");
  }
  if (!product.creditsAmount || product.creditsAmount <= 0) return fail("Invalid credit pack");

  const session = await createCreditPackCheckout(
    user.id,
    user.email,
    product.id,
    product.slug,
    product.creditsAmount,
    product.priceCents,
    locale,
    product.stripePriceId
  );

  return ok({ url: session.url });
}

export async function purchaseShopProductWithCredits(productId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const product = await prisma.shopProduct.findUnique({
    where: { id: productId },
    include: { mod: true, membershipPlan: true },
  });
  if (!product || !product.isActive) return fail("Product not available");

  const cost = effectiveCreditPrice(product);
  if (cost <= 0) return fail("Product is not available for credits");

  if (product.stock != null && product.stock <= 0) return fail("Out of stock");

  try {
    await creditWallet({
      userId: user.id,
      amount: -cost,
      type: "ORDER_PAYMENT",
      description: `Shop: ${product.name}`,
      referenceId: product.id,
    });
  } catch {
    return fail("Insufficient credits");
  }

  await prisma.shopPurchase.create({
    data: {
      userId: user.id,
      productId: product.id,
      creditsSpent: cost,
      priceCents: product.priceCents,
    },
  });

  if (product.stock != null) {
    await prisma.shopProduct.update({
      where: { id: product.id },
      data: { stock: { decrement: 1 } },
    });
  }

  if (product.modId && product.mod) {
    await prisma.modPurchase.upsert({
      where: { modId_userId: { modId: product.modId, userId: user.id } },
      create: {
        modId: product.modId,
        userId: user.id,
        amountCents: cost,
      },
      update: {},
    });
  }

  if (product.membershipPlanId && product.membershipPlan) {
    await grantMembershipPurchase({
      userId: user.id,
      planId: product.membershipPlanId,
      amountCents: cost,
    });
  }

  if (product.productType === "CREDIT_PACK" && product.creditsAmount) {
    await creditWallet({
      userId: user.id,
      amount: product.creditsAmount,
      type: "PURCHASE",
      description: `Credit pack: ${product.name}`,
      referenceId: product.id,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/shop");
  revalidatePath("/dashboard/library");
  return ok({ productSlug: product.slug });
}

export async function purchaseModWithCredits(modId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod || mod.pricing !== "PAID" || !mod.priceCents || mod.priceCents <= 0) {
    return fail("Mod is not for sale");
  }

  const existing = await prisma.modPurchase.findUnique({
    where: { modId_userId: { modId, userId: user.id } },
  });
  if (existing) return fail("Already owned");

  try {
    await creditWallet({
      userId: user.id,
      amount: -mod.priceCents,
      type: "ORDER_PAYMENT",
      description: `Mod: ${mod.title}`,
      referenceId: mod.id,
    });
  } catch {
    return fail("Insufficient credits");
  }

  await prisma.modPurchase.create({
    data: {
      modId,
      userId: user.id,
      amountCents: mod.priceCents,
    },
  });

  revalidatePath(`/mods/${mod.slug}`);
  revalidatePath("/dashboard/library");
  return ok(undefined);
}

export async function getUserLibrary(userId: string) {
  const [modPurchases, shopPurchases] = await Promise.all([
    prisma.modPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        mod: {
          select: {
            id: true,
            slug: true,
            title: true,
            pricing: true,
            downloadCount: true,
            media: { where: { isFeatured: true }, take: 1 },
            screenshots: { take: 1, orderBy: { sortOrder: "asc" } },
            game: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    prisma.shopPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            productType: true,
            thumbnailUrl: true,
          },
        },
      },
    }),
  ]);

  return { modPurchases, shopPurchases };
}
