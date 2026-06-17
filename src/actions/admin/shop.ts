"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  actionTry,
  fail,
  formatZodError,
  ok,
  requireAnyActionPermission,
} from "@/lib/action-utils";
import { zNullableStripePriceId, zTrimmedString } from "@/lib/safe-string";
import { resolveSlug, ensureUniqueSlug, zSlugInput } from "@/lib/slug";
import type {
  ShopFormFieldType,
  ShopMediaType,
  ShopPricingMode,
  ShopProductCategory,
  ShopProductStatus,
  ShopProductType,
  Prisma,
} from "@prisma/client";

const formFieldSchema = z.object({
  id: z.string().cuid().optional(),
  fieldType: z.enum([
    "TEXT",
    "TEXTAREA",
    "DROPDOWN",
    "CHECKBOX",
    "RADIO",
    "DATE",
    "IMAGE_UPLOAD",
    "FILE_UPLOAD",
  ]),
  label: zTrimmedString.pipe(z.string().min(1).max(200)),
  placeholder: z.string().max(200).optional().nullable(),
  helpText: z.string().max(500).optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const mediaSchema = z.object({
  id: z.string().cuid().optional(),
  mediaType: z.enum(["COVER", "BANNER", "FEATURED", "GALLERY", "EXAMPLE", "VIDEO"]),
  url: z.string().min(1),
  alt: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const productSchema = z.object({
  name: zTrimmedString.pipe(z.string().min(2).max(120)),
  slug: zSlugInput,
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  category: z.enum(["CREDITS", "MEMBERSHIP", "MODS", "EXCLUSIVE", "BUNDLES", "ACCESS", "CUSTOM_SERVICES"]),
  productType: z.enum([
    "CREDIT_PACK",
    "MEMBERSHIP",
    "MOD",
    "EXCLUSIVE",
    "BUNDLE",
    "SUBSCRIPTION",
    "ACCESS",
    "CUSTOM",
  ]),
  customTypeId: z.string().cuid().optional().nullable(),
  shopCategoryId: z.string().cuid().optional().nullable(),
  subcategoryId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "DISABLED"]).optional(),
  pricingMode: z.enum(["FIXED", "VARIABLE", "STARTING_FROM", "QUOTE", "SUBSCRIPTION", "ONE_TIME"]).optional(),
  creditPrice: z.number().int().min(0).default(0),
  priceCents: z.number().int().min(0).default(0),
  creditsAmount: z.number().int().min(0).optional().nullable(),
  stripePriceId: zNullableStripePriceId,
  modId: z.string().cuid().optional().nullable(),
  membershipPlanId: z.string().cuid().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  bannerImageUrl: z.string().optional().nullable(),
  featuredImageUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  stock: z.number().int().min(0).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  visibility: z.string().max(40).optional(),
  salePercent: z.number().int().min(0).max(90).optional(),
  creatorShareBps: z.number().int().min(0).max(10000).optional(),
  partnerShareBps: z.number().int().min(0).max(10000).optional(),
  sortOrder: z.number().int().optional(),
  customFields: z.record(z.unknown()).optional(),
  formFields: z.array(formFieldSchema).optional(),
  media: z.array(mediaSchema).optional(),
});

async function requireShopRead() {
  return requireAnyActionPermission("shop.view", "shop.edit", "settings.write");
}

async function requireShopWrite() {
  return requireAnyActionPermission("shop.create", "shop.edit", "settings.write");
}

async function requireShopDelete() {
  return requireAnyActionPermission("shop.delete", "settings.write");
}

export async function listAdminShopProducts(includeArchived = false) {
  const { error } = await requireShopRead();
  if (error) return error;

  return actionTry(
    () =>
      prisma.shopProduct.findMany({
        where: includeArchived ? undefined : { isArchived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          customType: { select: { id: true, name: true, slug: true } },
          shopCategory: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          mod: { select: { title: true, slug: true } },
          membershipPlan: { select: { name: true, slug: true } },
          formFields: { orderBy: { sortOrder: "asc" } },
          media: { orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }] },
          _count: { select: { purchases: true, orders: true } },
        },
      }),
    "shop:list"
  );
}

export async function getAdminShopAnalytics() {
  const { error } = await requireShopRead();
  if (error) return error;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    revenueToday,
    revenueMonth,
    ordersToday,
    pendingOrders,
    activeDesigners,
    completedOrders,
    totalOrders,
    avgDelivery,
  ] = await Promise.all([
    prisma.shopPurchase.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { priceCents: true },
    }),
    prisma.shopPurchase.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { priceCents: true },
    }),
    prisma.customOrder.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.customOrder.count({
      where: { status: { in: ["PENDING", "PAID", "IN_REVIEW", "ASSIGNED", "IN_PROGRESS"] } },
    }),
    prisma.user.count({ where: { role: "DESIGNER", deletedAt: null, isBanned: false } }),
    prisma.customOrder.count({ where: { status: { in: ["COMPLETED", "DELIVERED"] } } }),
    prisma.customOrder.count(),
    prisma.customOrder.findMany({
      where: { completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 200,
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const avgMs =
    avgDelivery.length > 0
      ? avgDelivery.reduce((sum, o) => {
          if (!o.completedAt) return sum;
          return sum + (o.completedAt.getTime() - o.createdAt.getTime());
        }, 0) / avgDelivery.length
      : 0;

  return ok({
    revenueTodayCents: revenueToday._sum.priceCents ?? 0,
    revenueMonthCents: revenueMonth._sum.priceCents ?? 0,
    ordersToday,
    pendingOrders,
    activeDesigners,
    completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
    avgDeliveryHours: Math.round(avgMs / 3_600_000),
  });
}

async function syncFormFields(productId: string, fields: z.infer<typeof formFieldSchema>[]) {
  await prisma.shopProductFormField.deleteMany({ where: { productId } });
  if (fields.length === 0) return;
  await prisma.shopProductFormField.createMany({
    data: fields.map((f, i) => ({
      productId,
      fieldType: f.fieldType as ShopFormFieldType,
      label: f.label,
      placeholder: f.placeholder ?? null,
      helpText: f.helpText ?? null,
      required: f.required ?? false,
      options: f.options ? (f.options as Prisma.InputJsonValue) : undefined,
      sortOrder: f.sortOrder ?? i,
    })),
  });
}

async function syncMedia(productId: string, media: z.infer<typeof mediaSchema>[]) {
  await prisma.shopProductMedia.deleteMany({ where: { productId } });
  if (media.length === 0) return;
  await prisma.shopProductMedia.createMany({
    data: media.map((m, i) => ({
      productId,
      mediaType: m.mediaType as ShopMediaType,
      url: m.url,
      alt: m.alt ?? null,
      sortOrder: m.sortOrder ?? i,
    })),
  });
}

export async function createShopProduct(input: z.infer<typeof productSchema>) {
  const { error } = await requireShopWrite();
  if (error) return error;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const resolved = resolveSlug({ name: parsed.data.name, slug: parsed.data.slug, fallbackPrefix: "product" });
    const slug = await ensureUniqueSlug(resolved.slug, async (s) =>
      Boolean(await prisma.shopProduct.findUnique({ where: { slug: s } }))
    );

    const { formFields, media, tags, customFields, ...rest } = parsed.data;

    const product = await prisma.shopProduct.create({
      data: {
        ...rest,
        slug,
        tags: (tags ?? []) as Prisma.InputJsonValue,
        customFields: (customFields ?? {}) as Prisma.InputJsonValue,
        modId: parsed.data.modId || null,
        membershipPlanId: parsed.data.membershipPlanId || null,
        stripePriceId: parsed.data.stripePriceId || null,
        creditsAmount: parsed.data.creditsAmount ?? null,
        stock: parsed.data.stock ?? null,
        customTypeId: parsed.data.customTypeId || null,
        shopCategoryId: parsed.data.shopCategoryId || null,
        subcategoryId: parsed.data.subcategoryId || null,
      },
    });

    if (formFields) await syncFormFields(product.id, formFields);
    if (media) await syncMedia(product.id, media);

    revalidatePath("/admin/shop");
    revalidatePath("/shop");
    return product;
  }, "shop:create");
}

export async function updateShopProduct(id: string, input: Partial<z.infer<typeof productSchema>>) {
  const { error } = await requireShopWrite();
  if (error) return error;

  const parsed = productSchema.partial().safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const { formFields, media, tags, customFields, ...rest } = parsed.data;

    const product = await prisma.shopProduct.update({
      where: { id },
      data: {
        ...rest,
        ...(tags !== undefined && { tags: tags as Prisma.InputJsonValue }),
        ...(customFields !== undefined && { customFields: customFields as Prisma.InputJsonValue }),
        modId: parsed.data.modId === undefined ? undefined : parsed.data.modId || null,
        membershipPlanId:
          parsed.data.membershipPlanId === undefined ? undefined : parsed.data.membershipPlanId || null,
        stripePriceId:
          parsed.data.stripePriceId === undefined ? undefined : parsed.data.stripePriceId || null,
        creditsAmount:
          parsed.data.creditsAmount === undefined ? undefined : parsed.data.creditsAmount ?? null,
        customTypeId:
          parsed.data.customTypeId === undefined ? undefined : parsed.data.customTypeId || null,
        shopCategoryId:
          parsed.data.shopCategoryId === undefined ? undefined : parsed.data.shopCategoryId || null,
        subcategoryId:
          parsed.data.subcategoryId === undefined ? undefined : parsed.data.subcategoryId || null,
      },
    });

    if (formFields) await syncFormFields(id, formFields);
    if (media) await syncMedia(id, media);

    revalidatePath("/admin/shop");
    revalidatePath("/shop");
    return product;
  }, "shop:update");
}

export async function deleteShopProduct(id: string) {
  const { error } = await requireShopDelete();
  if (error) return error;

  return actionTry(async () => {
    await prisma.shopProduct.delete({ where: { id } });
    revalidatePath("/admin/shop");
    revalidatePath("/shop");
  }, "shop:delete");
}

export async function archiveShopProduct(id: string, archived = true) {
  const { error } = await requireShopWrite();
  if (error) return error;

  return actionTry(async () => {
    await prisma.shopProduct.update({
      where: { id },
      data: { isArchived: archived, status: archived ? "ARCHIVED" : "ACTIVE" },
    });
    revalidatePath("/admin/shop");
    revalidatePath("/shop");
  }, "shop:archive");
}

export async function duplicateShopProduct(id: string) {
  const { error } = await requireShopWrite();
  if (error) return error;

  return actionTry(async () => {
    const source = await prisma.shopProduct.findUnique({
      where: { id },
      include: { formFields: true, media: true },
    });
    if (!source) throw new Error("Product not found");

    const slug = await ensureUniqueSlug(`${source.slug}-copy`, async (s) =>
      Boolean(await prisma.shopProduct.findUnique({ where: { slug: s } }))
    );

    const {
      id: _id,
      createdAt,
      updatedAt,
      formFields,
      media,
      tags,
      customFields,
      translations,
      ...data
    } = source;
    const copy = await prisma.shopProduct.create({
      data: {
        ...data,
        tags: tags as Prisma.InputJsonValue,
        customFields: customFields as Prisma.InputJsonValue,
        translations: translations === null ? undefined : (translations as Prisma.InputJsonValue),
        slug,
        name: `${source.name} (Copy)`,
        isFeatured: false,
        status: "DRAFT",
      },
    });

    if (formFields.length) {
      await syncFormFields(
        copy.id,
        formFields.map((f) => ({
          fieldType: f.fieldType,
          label: f.label,
          placeholder: f.placeholder,
          helpText: f.helpText,
          required: f.required,
          options: f.options as string[] | null,
          sortOrder: f.sortOrder,
        }))
      );
    }
    if (media.length) {
      await syncMedia(
        copy.id,
        media.map((m) => ({
          mediaType: m.mediaType,
          url: m.url,
          alt: m.alt,
          sortOrder: m.sortOrder,
        }))
      );
    }

    revalidatePath("/admin/shop");
    return copy;
  }, "shop:duplicate");
}

export async function reorderShopProducts(orderedIds: string[]) {
  const { error } = await requireShopWrite();
  if (error) return error;

  return actionTry(async () => {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.shopProduct.update({ where: { id }, data: { sortOrder: index } })
      )
    );
    revalidatePath("/admin/shop");
    revalidatePath("/shop");
  }, "shop:reorder");
}

// --- Categories ---

const categorySchema = z.object({
  name: zTrimmedString.pipe(z.string().min(2).max(80)),
  slug: zSlugInput,
  description: z.string().max(2000).optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function listShopCategories() {
  const { error } = await requireShopRead();
  if (error) return error;

  return actionTry(
    () =>
      prisma.shopCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, children: true } },
        },
      }),
    "shop:categories"
  );
}

export async function createShopCategory(input: z.infer<typeof categorySchema>) {
  const { error } = await requireShopWrite();
  if (error) return error;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const resolved = resolveSlug({ name: parsed.data.name, slug: parsed.data.slug, fallbackPrefix: "category" });
    const slug = await ensureUniqueSlug(resolved.slug, async (s) =>
      Boolean(await prisma.shopCategory.findUnique({ where: { slug: s } }))
    );
    const cat = await prisma.shopCategory.create({
      data: { ...parsed.data, slug, parentId: parsed.data.parentId || null },
    });
    revalidatePath("/admin/shop");
    return cat;
  }, "shop:category-create");
}

export async function updateShopCategory(id: string, input: Partial<z.infer<typeof categorySchema>>) {
  const { error } = await requireShopWrite();
  if (error) return error;
  const parsed = categorySchema.partial().safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const cat = await prisma.shopCategory.update({
      where: { id },
      data: {
        ...parsed.data,
        parentId: parsed.data.parentId === undefined ? undefined : parsed.data.parentId || null,
      },
    });
    revalidatePath("/admin/shop");
    return cat;
  }, "shop:category-update");
}

export async function deleteShopCategory(id: string) {
  const { error } = await requireShopDelete();
  if (error) return error;

  return actionTry(async () => {
    await prisma.shopCategory.delete({ where: { id } });
    revalidatePath("/admin/shop");
  }, "shop:category-delete");
}

// --- Product types ---

const typeSchema = z.object({
  name: zTrimmedString.pipe(z.string().min(2).max(80)),
  slug: zSlugInput,
  description: z.string().max(2000).optional().nullable(),
  iconKey: z.string().max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function listShopProductTypes() {
  const { error } = await requireShopRead();
  if (error) return error;

  return actionTry(
    () =>
      prisma.shopProductTypeDefinition.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { products: true } } },
      }),
    "shop:types"
  );
}

export async function createShopProductType(input: z.infer<typeof typeSchema>) {
  const { error } = await requireShopWrite();
  if (error) return error;
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const resolved = resolveSlug({ name: parsed.data.name, slug: parsed.data.slug, fallbackPrefix: "type" });
    const slug = await ensureUniqueSlug(resolved.slug, async (s) =>
      Boolean(await prisma.shopProductTypeDefinition.findUnique({ where: { slug: s } }))
    );
    const row = await prisma.shopProductTypeDefinition.create({
      data: { ...parsed.data, slug },
    });
    revalidatePath("/admin/shop");
    return row;
  }, "shop:type-create");
}

export async function updateShopProductType(id: string, input: Partial<z.infer<typeof typeSchema>>) {
  const { error } = await requireShopWrite();
  if (error) return error;
  const parsed = typeSchema.partial().safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const row = await prisma.shopProductTypeDefinition.update({ where: { id }, data: parsed.data });
    revalidatePath("/admin/shop");
    return row;
  }, "shop:type-update");
}

export async function deleteShopProductType(id: string) {
  const { error } = await requireShopDelete();
  if (error) return error;

  return actionTry(async () => {
    await prisma.shopProductTypeDefinition.delete({ where: { id } });
    revalidatePath("/admin/shop");
  }, "shop:type-delete");
}

export type {
  ShopProductCategory,
  ShopProductType,
  ShopPricingMode,
  ShopProductStatus,
  ShopFormFieldType,
  ShopMediaType,
};
