"use server";

import { revalidatePath } from "next/cache";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser, type ActionResult } from "@/lib/action-utils";
import { createModPurchaseCheckout, createModPurchaseCheckoutDynamic, createShopProductCheckout } from "@/lib/stripe";
import { isValidStripePriceId } from "@/lib/stripe-config";
import { getPaymentSettings } from "@/lib/payments/settings";
import { ensureDefaultShopProductTypes, ALLOWED_ORDER_UPLOAD_MIMES, MAX_ORDER_UPLOAD_BYTES, MAX_ORDER_UPLOAD_FILES } from "@/lib/shop-enterprise";
import { generateInvoiceNumber } from "@/lib/invoices";
import { uploadAsset } from "@/lib/asset-storage";
import { onNewShopOrder } from "@/lib/order-workflow";
import { rateLimit } from "@/lib/rate-limit";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import type { ShopFormFieldType } from "@prisma/client";

export async function startModPurchaseCheckout(modId: string, locale: string, clientOrigin?: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const paymentSettings = await getPaymentSettings();
  if (!paymentSettings.stripeEnabled) {
    return fail("Stripe payments are disabled");
  }

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod || mod.pricing !== "PAID" || !mod.priceCents || mod.priceCents <= 0) {
    return fail("Mod is not for sale");
  }

  const existing = await prisma.modPurchase.findUnique({
    where: { modId_userId: { modId, userId: user.id } },
  });
  if (existing) return fail("Already owned");

  try {
    const session =
      mod.stripePriceId && isValidStripePriceId(mod.stripePriceId)
        ? await createModPurchaseCheckout(user.id, user.email, mod.id, mod.slug, mod.stripePriceId, locale, {
            clientOrigin,
          })
        : await createModPurchaseCheckoutDynamic(
            user.id,
            user.email,
            mod.id,
            mod.slug,
            mod.title,
            mod.priceCents,
            locale,
            { clientOrigin }
          );

    if (!session.url) return fail("Checkout URL unavailable");
    return ok({ url: session.url });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Checkout failed");
  }
}

export async function getUserLibrary(userId: string) {
  const modPurchases = await prisma.modPurchase.findMany({
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
  });

  const shopPurchases = await prisma.shopPurchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: { name: true, productType: true },
      },
    },
  });

  return { modPurchases, shopPurchases };
}

export async function startCreditPackCheckout(
  _productId: string,
  _locale: string,
  _clientOrigin?: string
): Promise<ActionResult<{ url: string }>> {
  return fail("Credit pack checkout is no longer available");
}

export async function purchaseShopProductWithCredits(_productId: string): Promise<ActionResult<void>> {
  return fail("Credit purchases are no longer available");
}

export async function getShopCatalog(params?: { categorySlug?: string; featured?: boolean }) {
  const categorySlug = params?.categorySlug ?? "all";
  const featured = params?.featured ? "featured" : "all";

  return unstable_cache(
    async () => fetchShopCatalog(params),
    ["shop-catalog", categorySlug, featured],
    { revalidate: REVALIDATE.shop, tags: [CACHE_TAGS.shop] }
  )();
}

async function fetchShopCatalog(params?: { categorySlug?: string; featured?: boolean }) {
  await ensureDefaultShopProductTypes();

  const products = await prisma.shopProduct.findMany({
    where: {
      isActive: true,
      isArchived: false,
      status: "ACTIVE",
      visibility: "public",
      ...(params?.featured ? { isFeatured: true } : {}),
      ...(params?.categorySlug
        ? { shopCategory: { slug: params.categorySlug } }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      customType: { select: { name: true, slug: true, iconKey: true } },
      shopCategory: { select: { name: true, slug: true } },
      media: { where: { mediaType: { in: ["COVER", "GALLERY"] } }, orderBy: { sortOrder: "asc" }, take: 4 },
    },
  });

  const categories = await prisma.shopCategory.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });

  return { products, categories };
}

export async function getShopProduct(slug: string) {
  await ensureDefaultShopProductTypes();

  const product = await prisma.shopProduct.findFirst({
    where: {
      slug,
      isActive: true,
      isArchived: false,
      status: { in: ["ACTIVE", "DRAFT"] },
      visibility: "public",
    },
    include: {
      customType: true,
      shopCategory: true,
      subcategory: true,
      formFields: { orderBy: { sortOrder: "asc" } },
      media: { orderBy: [{ mediaType: "asc" }, { sortOrder: "asc" }] },
    },
  });

  return product;
}

type FormResponse = Record<string, string | string[] | boolean>;

function parseFormResponses(
  formData: FormData,
  fields: { id: string; fieldType: ShopFormFieldType; label: string; required: boolean }[]
): { responses: FormResponse } | { error: string } {
  const responses: FormResponse = {};

  for (const field of fields) {
    const key = `field_${field.id}`;
    if (field.fieldType === "CHECKBOX") {
      responses[field.label] = formData.get(key) === "on" || formData.get(key) === "true";
      continue;
    }
    if (field.fieldType === "IMAGE_UPLOAD" || field.fieldType === "FILE_UPLOAD") {
      const files = formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
      if (field.required && files.length === 0) return { error: `${field.label} is required` };
      continue;
    }
    const value = String(formData.get(key) ?? "").trim();
    if (field.required && !value) return { error: `${field.label} is required` };
    if (value) responses[field.label] = value;
  }

  return { responses };
}

export async function submitShopProductOrder(formData: FormData, locale = "en") {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const limit = rateLimit(`shop-order:${user.id}`, 5, 3600_000);
  if (!limit.success) return fail("Rate limited");

  const productSlug = String(formData.get("productSlug") ?? "").trim();
  if (!productSlug) return fail("Product required");

  const product = await getShopProduct(productSlug);
  if (!product) return fail("Product not found");

  const parsed = parseFormResponses(formData, product.formFields);
  if ("error" in parsed) return fail(parsed.error);

  const invoiceNumber = await generateInvoiceNumber();
  const responses = parsed.responses;
  const description =
    Object.entries(responses)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}`)
      .join("\n") || product.shortDescription || product.description || product.name;

  const order = await prisma.customOrder.create({
    data: {
      clientId: user.id,
      shopProductId: product.id,
      title: product.name,
      description,
      orderType: product.customType?.name ?? product.productType,
      budgetCents: product.pricingMode === "QUOTE" ? null : product.priceCents,
      finalAmountCents: product.pricingMode === "QUOTE" ? null : product.priceCents,
      invoiceNumber,
      customerEmail: user.email,
      discordUsername: String(formData.get("discord") ?? user.discordUsername ?? "").trim() || undefined,
      formResponses: responses as object,
      status: product.pricingMode === "QUOTE" ? "PENDING" : "PENDING",
      messages: {
        create: {
          senderId: user.id,
          content: description,
        },
      },
    },
  });

  const files = formData
    .getAll("order_files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_ORDER_UPLOAD_FILES) return fail(`Maximum ${MAX_ORDER_UPLOAD_FILES} files`);

  for (const file of files) {
    if (file.size > MAX_ORDER_UPLOAD_BYTES) return fail(`${file.name} exceeds upload limit`);
    if (!ALLOWED_ORDER_UPLOAD_MIMES.includes(file.type) && !file.name.match(/\.(zip|pdf|png|jpe?g|webp)$/i)) {
      return fail(`File type not allowed: ${file.name}`);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const uploaded = await uploadAsset({
      bucket: "tickets",
      relativePath: `orders/${order.id}/refs/${Date.now()}-${safeName}`,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });
    await prisma.orderAttachment.create({
      data: {
        orderId: order.id,
        fileKey: uploaded.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      },
    });
  }

  await onNewShopOrder(order.id, locale);

  if (product.pricingMode === "QUOTE" || !product.priceCents) {
    revalidatePath("/dashboard/orders");
    return ok({ orderId: order.id, checkoutUrl: null as string | null });
  }

  const paymentSettings = await getPaymentSettings();
  if (!paymentSettings.stripeEnabled) {
    revalidatePath("/dashboard/orders");
    return ok({ orderId: order.id, checkoutUrl: null });
  }

  try {
    const clientOrigin = String(formData.get("clientOrigin") ?? "").trim() || undefined;
    const session = await createShopProductCheckout(
      user.id,
      user.email,
      order.id,
      product.id,
      product.name,
      product.priceCents,
      invoiceNumber,
      locale,
      { clientOrigin, productSlug: product.slug }
    );
    revalidatePath("/dashboard/orders");
    return ok({ orderId: order.id, checkoutUrl: session.url ?? null });
  } catch (err) {
    revalidatePath("/dashboard/orders");
    return ok({
      orderId: order.id,
      checkoutUrl: null,
      warning: err instanceof Error ? err.message : "Checkout unavailable",
    });
  }
}
