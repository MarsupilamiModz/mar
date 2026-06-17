import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { checkoutPath, resolveCheckoutOrigin } from "@/lib/app-url";
import { assertStripeConfigured, formatStripeError, isValidStripePriceId, logStripeServer } from "@/lib/stripe-config";
import { getEffectivePlanPrice, type MembershipPlanData } from "@/lib/membership";
import { convertFromEurCents, detectCurrency, stripeCurrencyCode, type SupportedCurrency } from "@/lib/currency";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  assertStripeConfigured();
  const key = process.env.STRIPE_SECRET_KEY!;
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripeClient;
}

export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const stripe = getStripe();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export async function validateStripePriceId(priceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      return { ok: false, error: "Stripe price is archived or inactive. Create a new Price in Stripe and update Admin → Memberships." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatStripeError(err) };
  }
}

type CheckoutOriginOptions = {
  clientOrigin?: string | null;
};

function resolveOrigin(options?: CheckoutOriginOptions) {
  return resolveCheckoutOrigin(options?.clientOrigin);
}

/** Recurring monthly membership checkout (subscription mode). */
export async function createMembershipSubscriptionCheckout(
  userId: string,
  email: string,
  plan: Pick<MembershipPlanData, "id" | "slug" | "name" | "priceCents" | "currency" | "stripePriceId" | "interval" | "originalPriceCents" | "saleDiscountPercent" | "saleEndsAt">,
  locale: string = "en",
  refCode?: string,
  options?: CheckoutOriginOptions & { currency?: SupportedCurrency }
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);
  const pricing = getEffectivePlanPrice(plan as MembershipPlanData);
  const displayCurrency = options?.currency ?? detectCurrency(locale);
  const unitAmount = convertFromEurCents(pricing.priceCents, displayCurrency);
  const currency = stripeCurrencyCode(displayCurrency);

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

  if (!pricing.onSale && isValidStripePriceId(plan.stripePriceId)) {
    const validation = await validateStripePriceId(plan.stripePriceId);
    if (!validation.ok) throw new Error(validation.error);
    lineItems = [{ price: plan.stripePriceId, quantity: 1 }];
  } else {
    lineItems = [
      {
        price_data: {
          currency,
          unit_amount: unitAmount,
          recurring: { interval: (plan.interval as "month" | "year") ?? "month" },
          product_data: {
            name: `${plan.name} — Monthly`,
            description: pricing.onSale
              ? `Limited offer (${pricing.discountPercent}% off)`
              : "Monthly subscription membership",
          },
        },
        quantity: 1,
      },
    ];
  }

  logStripeServer("membership_subscription_checkout", {
    userId,
    planId: plan.id,
    planSlug: plan.slug,
    amountCents: unitAmount,
    currency,
    onSale: pricing.onSale,
    origin,
  });

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    success_url: `${checkoutPath(origin, locale, "/dashboard/subscription")}?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${checkoutPath(origin, locale, "/premium")}?canceled=1`,
    metadata: {
      userId,
      planId: plan.id,
      planSlug: plan.slug,
      type: "membership_subscription",
      refCode: refCode ?? "",
    },
    subscription_data: {
      metadata: {
        userId,
        planId: plan.id,
        planSlug: plan.slug,
        type: "membership_subscription",
      },
    },
  });
}

/** Alias for subscription checkout (legacy import name). */
export async function createMembershipCheckout(
  userId: string,
  email: string,
  plan: Pick<MembershipPlanData, "id" | "slug" | "name" | "priceCents" | "currency" | "stripePriceId" | "interval" | "originalPriceCents" | "saleDiscountPercent" | "saleEndsAt">,
  locale: string = "en",
  refCode?: string,
  options?: CheckoutOriginOptions
) {
  return createMembershipSubscriptionCheckout(userId, email, plan, locale, refCode, options);
}

/** Mod purchase checkout with dynamic pricing when no Stripe Price ID. */
export async function createModPurchaseCheckoutDynamic(
  userId: string,
  email: string,
  modId: string,
  modSlug: string,
  title: string,
  priceCents: number,
  locale: string = "en",
  options?: CheckoutOriginOptions
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);
  const currency = stripeCurrencyCode(detectCurrency(locale));
  const unitAmount = convertFromEurCents(priceCents, detectCurrency(locale));

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: { name: title, description: "Mod purchase" },
        },
        quantity: 1,
      },
    ],
    success_url: `${checkoutPath(origin, locale, `/mods/${modSlug}`)}?purchased=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: checkoutPath(origin, locale, `/mods/${modSlug}`),
    invoice_creation: { enabled: true },
    metadata: { userId, modId, modSlug, type: "mod_purchase" },
  });
}

/** @deprecated Credit packs removed — use premium subscriptions. */
export async function createCreditPackCheckout(
  userId: string,
  email: string,
  _productId: string,
  _productSlug: string,
  _creditsAmount: number,
  _amountCents: number,
  _locale: string = "en",
  _stripePriceId?: string | null,
  _options?: CheckoutOriginOptions
) {
  throw new Error("Credit packs are no longer available. Subscribe at /premium instead.");
}

export async function cancelStripeSubscription(stripeSubscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
}

export async function resumeStripeSubscription(stripeSubscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
}

export async function changeStripeSubscriptionPlan(
  stripeSubscriptionId: string,
  newPriceId: string
) {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");
  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "create_prorations",
  });
}

export async function createModPurchaseCheckout(
  userId: string,
  email: string,
  modId: string,
  modSlug: string,
  priceId: string,
  locale: string = "en",
  options?: CheckoutOriginOptions
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);

  const validation = await validateStripePriceId(priceId);
  if (!validation.ok) throw new Error(validation.error);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${checkoutPath(origin, locale, `/mods/${modSlug}`)}?purchased=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: checkoutPath(origin, locale, `/mods/${modSlug}`),
    invoice_creation: { enabled: true },
    metadata: { userId, modId, modSlug, type: "mod_purchase" },
  });
}

/** Custom order payment checkout. */
export async function createOrderPaymentCheckout(
  userId: string,
  email: string,
  orderId: string,
  invoiceNumber: string,
  amountCents: number,
  locale: string = "en",
  options?: CheckoutOriginOptions
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Custom Order ${invoiceNumber}`,
            description: "XumariModz custom commission payment",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${checkoutPath(origin, locale, `/dashboard/orders/${orderId}`)}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: checkoutPath(origin, locale, `/dashboard/orders/${orderId}`),
    invoice_creation: { enabled: true },
    metadata: {
      userId,
      orderId,
      invoiceNumber,
      type: "custom_order_payment",
    },
    payment_intent_data: {
      metadata: { userId, orderId, invoiceNumber, type: "custom_order_payment" },
    },
  });
}

/** Shop custom product order checkout. */
export async function createShopProductCheckout(
  userId: string,
  email: string,
  orderId: string,
  productId: string,
  productName: string,
  amountCents: number,
  invoiceNumber: string,
  locale: string = "en",
  options?: CheckoutOriginOptions & { productSlug?: string }
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: productName,
            description: `Custom service order ${invoiceNumber}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${checkoutPath(origin, locale, `/dashboard/orders/${orderId}`)}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: checkoutPath(origin, locale, `/shop/${options?.productSlug ?? ""}`),
    invoice_creation: { enabled: true },
    metadata: {
      userId,
      orderId,
      productId,
      invoiceNumber,
      type: "shop_product_order",
    },
    payment_intent_data: {
      metadata: { userId, orderId, productId, invoiceNumber, type: "shop_product_order" },
    },
  });
}

export async function getStripeReceiptUrl(paymentIntentId: string): Promise<string | null> {
  try {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge;
    if (charge && typeof charge === "object" && "receipt_url" in charge) {
      return (charge.receipt_url as string) ?? null;
    }
  } catch {
    return null;
  }
  return null;
}
