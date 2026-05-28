"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { slugify } from "@/lib/utils";
import type { ShopProductCategory, ShopProductType } from "@prisma/client";

const productSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(10000).optional(),
  category: z.enum(["CREDITS", "MEMBERSHIP", "MODS", "EXCLUSIVE", "BUNDLES", "ACCESS"]),
  productType: z.enum(["CREDIT_PACK", "MEMBERSHIP", "MOD", "EXCLUSIVE", "BUNDLE", "SUBSCRIPTION", "ACCESS"]),
  creditPrice: z.number().int().min(0).default(0),
  priceCents: z.number().int().min(0).default(0),
  creditsAmount: z.number().int().min(0).optional(),
  modId: z.string().cuid().optional().nullable(),
  membershipPlanId: z.string().cuid().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  stock: z.number().int().min(0).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  salePercent: z.number().int().min(0).max(90).optional(),
  creatorShareBps: z.number().int().min(0).max(10000).optional(),
  partnerShareBps: z.number().int().min(0).max(10000).optional(),
  sortOrder: z.number().int().optional(),
});

export async function listAdminShopProducts() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const products = await prisma.shopProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      mod: { select: { title: true, slug: true } },
      membershipPlan: { select: { name: true, slug: true } },
      _count: { select: { purchases: true } },
    },
  });
  return ok(products);
}

export async function createShopProduct(input: z.infer<typeof productSchema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  let uniqueSlug = slug;
  let i = 0;
  while (await prisma.shopProduct.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}-${++i}`;
  }

  const product = await prisma.shopProduct.create({
    data: {
      ...parsed.data,
      slug: uniqueSlug,
      modId: parsed.data.modId || null,
      membershipPlanId: parsed.data.membershipPlanId || null,
      stock: parsed.data.stock ?? null,
    },
  });

  revalidatePath("/admin/shop");
  revalidatePath("/shop");
  return ok(product);
}

export async function updateShopProduct(id: string, input: Partial<z.infer<typeof productSchema>>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = productSchema.partial().safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const product = await prisma.shopProduct.update({
    where: { id },
    data: {
      ...parsed.data,
      modId: parsed.data.modId === undefined ? undefined : parsed.data.modId || null,
      membershipPlanId:
        parsed.data.membershipPlanId === undefined ? undefined : parsed.data.membershipPlanId || null,
    },
  });

  revalidatePath("/admin/shop");
  revalidatePath("/shop");
  return ok(product);
}

export async function deleteShopProduct(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.shopProduct.delete({ where: { id } });
  revalidatePath("/admin/shop");
  revalidatePath("/shop");
  return ok(undefined);
}

export type { ShopProductCategory, ShopProductType };
