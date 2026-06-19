import type { OrderStatus, ShopFormFieldType, ShopPricingMode } from "@prisma/client";
import { prisma } from "@/lib/db";

export const DEFAULT_SHOP_PRODUCT_TYPES = [
  { slug: "custom-service", name: "Custom Service", sortOrder: 0 },
  { slug: "custom-design", name: "Custom Design", sortOrder: 1 },
  { slug: "custom-sound-pack", name: "Custom Sound Pack", sortOrder: 2 },
  { slug: "custom-hud-ui", name: "Custom HUD/UI", sortOrder: 3 },
  { slug: "custom-vehicle-mod", name: "Custom Vehicle Mod", sortOrder: 4 },
  { slug: "custom-graphics-pack", name: "Custom Graphics Pack", sortOrder: 5 },
  { slug: "custom-mapping-project", name: "Custom Mapping Project", sortOrder: 6 },
  { slug: "custom-script-project", name: "Custom Script Project", sortOrder: 7 },
  { slug: "custom-bundle", name: "Custom Bundle", sortOrder: 8 },
  { slug: "custom-request", name: "Custom Request", sortOrder: 9 },
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  QUOTED: "Quoted",
  IN_REVIEW: "In Review",
  ACCEPTED: "Accepted",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_CUSTOMER: "Waiting For Customer",
  REVISION_REQUESTED: "Revision Requested",
  REVIEW: "Review",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
  CANCELED: "Cancelled",
  REFUNDED: "Refunded",
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "IN_REVIEW",
  "ACCEPTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "REVISION_REQUESTED",
  "REVIEW",
  "QUOTED",
];

export const PRICING_MODE_LABELS: Record<ShopPricingMode, string> = {
  FIXED: "Fixed price",
  VARIABLE: "Variable price",
  STARTING_FROM: "Starting from",
  QUOTE: "Custom quotation",
  SUBSCRIPTION: "Monthly subscription",
  ONE_TIME: "One-time purchase",
};

export const FORM_FIELD_LABELS: Record<ShopFormFieldType, string> = {
  TEXT: "Text field",
  TEXTAREA: "Textarea",
  DROPDOWN: "Dropdown",
  CHECKBOX: "Checkbox",
  RADIO: "Radio button",
  DATE: "Date field",
  IMAGE_UPLOAD: "Image upload",
  FILE_UPLOAD: "File upload",
};

export const ALLOWED_ORDER_UPLOAD_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];

export const MAX_ORDER_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_ORDER_UPLOAD_FILES = 10;

import { safeIntlNumberFormat } from "@/lib/i18n/safe-locale";

export function formatShopPrice(
  priceCents: number,
  pricingMode: ShopPricingMode,
  locale = "en",
  currency = "EUR"
): string {
  const formatted = safeIntlNumberFormat(locale, {
    style: "currency",
    currency,
  }).format(priceCents / 100);

  if (pricingMode === "STARTING_FROM") return `Starting at ${formatted}`;
  if (pricingMode === "QUOTE") return "Custom quotation";
  if (pricingMode === "VARIABLE") return `From ${formatted}`;
  return formatted;
}

export async function ensureDefaultShopProductTypes() {
  for (const type of DEFAULT_SHOP_PRODUCT_TYPES) {
    await prisma.shopProductTypeDefinition.upsert({
      where: { slug: type.slug },
      create: {
        slug: type.slug,
        name: type.name,
        sortOrder: type.sortOrder,
        isActive: true,
        isCustom: true,
      },
      update: {},
    });
  }
}

export function isCustomShopProduct(productType: string) {
  return productType === "CUSTOM";
}
