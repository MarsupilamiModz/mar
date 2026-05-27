import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { createMembershipCheckout } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = rateLimit(`checkout:${user.id}:${ip}`, 5, 60_000);
  if (!limit.success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const body = await req.json();
  const { planSlug, locale: bodyLocale } = body as { planSlug?: string; locale?: string };
  const locale = bodyLocale ?? user.locale ?? "en";

  if (!planSlug) {
    return NextResponse.json({ error: "planSlug is required" }, { status: 400 });
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { slug: planSlug, isActive: true } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: "Stripe price not configured. Set a one-time Stripe Price ID in Admin → Memberships." },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const refCode = cookieStore.get("mm_ref")?.value;

  const session = await createMembershipCheckout(
    user.id,
    user.email,
    plan.stripePriceId,
    plan.id,
    plan.slug,
    locale,
    refCode
  );

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

  return NextResponse.json({ url: session.url });
}
