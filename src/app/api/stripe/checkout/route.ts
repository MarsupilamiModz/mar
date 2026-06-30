import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { createMembershipCheckout } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { mapPlan } from "@/lib/membership";
import { isPlanSoldOut } from "@/lib/membership-stock";
import { getPaymentSettings } from "@/lib/payments/settings";
import { assertStripeConfigured, formatStripeError, isValidStripePriceId, logStripeServer } from "@/lib/stripe-config";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Sign in required to checkout", 401, "AUTH");
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = rateLimit(`checkout:${user.id}:${ip}`, 5, 60_000);
  if (!limit.success) {
    return jsonError("Too many checkout attempts. Wait a minute and try again.", 429, "RATE_LIMIT");
  }

  let body: { planSlug?: string; locale?: string; clientOrigin?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body", 400, "VALIDATION");
  }

  const { planSlug, locale: bodyLocale, clientOrigin } = body;
  const locale = bodyLocale ?? user.locale ?? "en";

  if (!planSlug) {
    return jsonError("Plan not selected", 400, "VALIDATION");
  }

  try {
    assertStripeConfigured();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe is not configured";
    logStripeServer("checkout_config_error", { userId: user.id, message });
    return jsonError(message, 503, "STRIPE_CONFIG");
  }

  const paymentSettings = await getPaymentSettings();
  if (!paymentSettings.stripeEnabled) {
    return jsonError("Stripe payments are disabled in Admin → Payments", 503, "STRIPE_DISABLED");
  }

  const planRow = await prisma.membershipPlan.findFirst({
    where: { slug: planSlug, isActive: true },
  });
  if (!planRow) {
    return jsonError("Membership plan not found or inactive", 404, "PLAN_NOT_FOUND");
  }

  const plan = mapPlan(planRow);

  if (isPlanSoldOut(plan)) {
    return jsonError("This membership is sold out", 409, "SOLD_OUT");
  }

  if (!isValidStripePriceId(plan.stripePriceId)) {
    logStripeServer("checkout_no_price_id", { planSlug, planId: plan.id });
    // Fall through — createMembershipCheckout uses dynamic price_data when no valid price ID
  }

  try {
    const cookieStore = await cookies();
    const refCode = cookieStore.get("mm_ref")?.value;

    logStripeServer("checkout_start", { userId: user.id, planSlug, locale });

    const session = await createMembershipCheckout(
      user.id,
      user.email,
      plan,
      locale,
      refCode,
      { clientOrigin }
    );

    if (!session.url) {
      return jsonError("Stripe did not return a checkout URL. Check Stripe dashboard logs.", 502, "STRIPE_SESSION");
    }

    if (refCode) {
      await prisma.affiliateEvent
        .create({
          data: {
            code: refCode,
            eventType: "SUBSCRIPTION",
            metadata: { checkoutSessionId: session.id, userId: user.id, type: "membership_purchase" },
          },
        })
        .catch(() => null);
    }

    logStripeServer("checkout_ok", { userId: user.id, sessionId: session.id });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = formatStripeError(err);
    logStripeServer("checkout_failed", { userId: user.id, planSlug, message });
    return jsonError(`Checkout failed: ${message}`, 502, "STRIPE_ERROR");
  }
}

export async function GET() {
  const { getStripeConfigStatus } = await import("@/lib/stripe-config");
  return NextResponse.json(getStripeConfigStatus());
}
