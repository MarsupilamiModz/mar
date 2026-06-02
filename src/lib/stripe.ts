import Stripe from "stripe";
import { prisma } from "@/lib/db";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
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

import { appPathForLocale } from "@/lib/app-url";

/** One-time lifetime membership checkout (payment mode). */
export async function createMembershipCheckout(
  userId: string,
  email: string,
  priceId: string,
  planId: string,
  planSlug: string,
  locale: string = "en",
  refCode?: string
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appPathForLocale(locale, "/dashboard/subscription")}?success=1`,
    cancel_url: `${appPathForLocale(locale, "/premium")}?canceled=1`,
    invoice_creation: { enabled: true },
    metadata: {
      userId,
      planId,
      planSlug,
      type: "membership_purchase",
      refCode: refCode ?? "",
    },
    payment_intent_data: {
      metadata: { userId, planId, planSlug, type: "membership_purchase" },
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
  stripePriceId?: string | null
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = stripePriceId
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

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: lineItems,
    success_url: `${appPathForLocale(locale, "/dashboard")}?credits=1`,
    cancel_url: appPathForLocale(locale, "/shop"),
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
  locale: string = "en"
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appPathForLocale(locale, `/mods/${modSlug}`)}?purchased=1`,
    cancel_url: appPathForLocale(locale, `/mods/${modSlug}`),
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
  locale: string = "en"
) {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId, email);

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Custom Order ${invoiceNumber}`,
            description: `XumariModz custom commission payment`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${appPathForLocale(locale, `/dashboard/orders/${orderId}`)}?paid=1`,
    cancel_url: appPathForLocale(locale, `/dashboard/orders/${orderId}`),
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
