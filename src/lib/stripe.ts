import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { checkoutPath, resolveCheckoutOrigin } from "@/lib/app-url";
import { assertStripeConfigured, formatStripeError, isValidStripePriceId, logStripeServer } from "@/lib/stripe-config";
import { getEffectivePlanPrice, type MembershipPlanData } from "@/lib/membership";

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

/** One-time lifetime membership checkout (payment mode). */
export async function createMembershipCheckout(
  userId: string,
  email: string,
  plan: Pick<MembershipPlanData, "id" | "slug" | "name" | "priceCents" | "currency" | "stripePriceId" | "originalPriceCents" | "saleDiscountPercent" | "saleEndsAt">,
  locale: string = "en",
  refCode?: string,
  options?: CheckoutOriginOptions
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);
  const pricing = getEffectivePlanPrice(plan as MembershipPlanData);

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

  if (!pricing.onSale && isValidStripePriceId(plan.stripePriceId)) {
    const validation = await validateStripePriceId(plan.stripePriceId);
    if (!validation.ok) throw new Error(validation.error);
    lineItems = [{ price: plan.stripePriceId, quantity: 1 }];
  } else {
    lineItems = [
      {
        price_data: {
          currency: (plan.currency || "eur").toLowerCase(),
          unit_amount: pricing.priceCents,
          product_data: {
            name: `${plan.name} — Lifetime`,
            description: pricing.onSale
              ? `Limited offer (${pricing.discountPercent}% off)`
              : "One-time lifetime membership",
          },
        },
        quantity: 1,
      },
    ];
  }

  logStripeServer("membership_checkout_create", {
    userId,
    planId: plan.id,
    planSlug: plan.slug,
    amountCents: pricing.priceCents,
    onSale: pricing.onSale,
    origin,
  });

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: lineItems,
    success_url: `${checkoutPath(origin, locale, "/dashboard/subscription")}?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${checkoutPath(origin, locale, "/premium")}?canceled=1`,
    invoice_creation: { enabled: true },
    metadata: {
      userId,
      planId: plan.id,
      planSlug: plan.slug,
      type: "membership_purchase",
      refCode: refCode ?? "",
      amountCents: String(pricing.priceCents),
    },
    payment_intent_data: {
      metadata: {
        userId,
        planId: plan.id,
        planSlug: plan.slug,
        type: "membership_purchase",
      },
    },
  });
}

/** Credit pack checkout (real money → credits). Uses Stripe Price ID when configured. */
export async function createCreditPackCheckout(
  userId: string,
  email: string,
  productId: string,
  productSlug: string,
  creditsAmount: number,
  amountCents: number,
  locale: string = "en",
  stripePriceId?: string | null,
  options?: CheckoutOriginOptions
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const origin = resolveOrigin(options);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    isValidStripePriceId(stripePriceId)
      ? [{ price: stripePriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `${creditsAmount.toLocaleString()} Credits`,
                description: "XumariModz credit pack",
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ];

  if (isValidStripePriceId(stripePriceId)) {
    const validation = await validateStripePriceId(stripePriceId);
    if (!validation.ok) throw new Error(validation.error);
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: lineItems,
    success_url: `${checkoutPath(origin, locale, "/dashboard")}?credits=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: checkoutPath(origin, locale, "/shop"),
    invoice_creation: { enabled: true },
    payment_method_types: ["card"],
    metadata: {
      userId,
      productId,
      productSlug,
      creditsAmount: String(creditsAmount),
      type: "credit_purchase",
    },
    payment_intent_data: {
      metadata: { userId, productId, type: "credit_purchase" },
    },
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
