import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { syncDiscordRoles, logToDiscordWebhook } from "@/lib/discord";
import { trackAffiliateConversion } from "@/actions/affiliate";
import { grantMembershipPurchase } from "@/lib/membership";
import { sendPaymentNotification, sendPremiumActivationEmail } from "@/lib/email/send";
import { notifyPremiumActivated } from "@/lib/notifications-service";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const modId = session.metadata?.modId;
        const planId = session.metadata?.planId;
        const type = session.metadata?.type;

        const isMembership =
          type === "membership_purchase" ||
          type === "membership_onetime";

        if (isMembership && userId && planId) {
          const paymentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;

          const existing = paymentId
            ? await prisma.membershipPurchase.findFirst({ where: { stripePaymentId: paymentId } })
            : null;

          if (!existing) {
            await grantMembershipPurchase({
              userId,
              planId,
              stripePaymentId: paymentId ?? undefined,
              amountCents: session.amount_total ?? 0,
            });

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user?.discordId) await syncDiscordRoles(user.discordId, ["premium"]);
            if (user?.email) {
              void sendPremiumActivationEmail({
                email: user.email,
                username: user.displayName ?? user.username,
              });
            }
            void notifyPremiumActivated(userId);
          }

          const refCode = session.metadata?.refCode;
          if (refCode) {
            await trackAffiliateConversion(refCode, session.amount_total ?? 0, "SUBSCRIPTION");
          }

          await logToDiscordWebhook({
            title: "Membership Purchase",
            description: `User ${userId} purchased plan ${planId}`,
          });

          void sendPaymentNotification({
            type: "Membership purchase",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: planId,
          });
        }

        if (modId && userId && type === "mod_purchase") {
          const paymentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;

          await prisma.modPurchase.upsert({
            where: { modId_userId: { modId, userId } },
            create: {
              modId,
              userId,
              stripePaymentId: paymentId ?? undefined,
              amountCents: session.amount_total ?? 0,
            },
            update: {},
          });

          const { evaluateUserAchievements } = await import("@/lib/achievements");
          void evaluateUserAchievements(userId);

          void sendPaymentNotification({
            type: "Mod purchase",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: modId,
          });
        }

        if (userId && type === "credit_purchase") {
          const productId = session.metadata?.productId;
          const creditsAmount = Number(session.metadata?.creditsAmount ?? 0);
          const paymentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;

          if (productId && creditsAmount > 0) {
            const { creditWallet } = await import("@/lib/credits");
            await creditWallet({
              userId,
              amount: creditsAmount,
              type: "PURCHASE",
              description: "Credit pack purchase",
              referenceId: productId,
            });
            await prisma.shopPurchase.create({
              data: {
                userId,
                productId,
                creditsSpent: 0,
                priceCents: session.amount_total ?? 0,
                stripePaymentId: paymentId ?? undefined,
              },
            });
          }

          void sendPaymentNotification({
            type: "Credit pack purchase",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: productId ?? undefined,
          });
        }

        const orderId = session.metadata?.orderId;
        if (orderId && userId && type === "custom_order_payment") {
          const paymentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;

          await prisma.customOrder.update({
            where: { id: orderId },
            data: {
              paymentStatus: "PAID",
              paymentMethod: "STRIPE",
              stripePaymentId: paymentId ?? undefined,
              status: "COMPLETED",
            },
          });

          await logToDiscordWebhook({
            title: "Custom Order Paid",
            description: `Order ${session.metadata?.invoiceNumber ?? orderId} paid via Stripe`,
          });

          void sendPaymentNotification({
            type: "Custom order payment",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: session.metadata?.invoiceNumber ?? orderId,
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const userId = pi.metadata?.userId;
        if (userId) {
          await logToDiscordWebhook({
            title: "Payment Failed",
            description: `User ${userId} — ${pi.id}`,
          });
        }
        break;
      }

      // Legacy subscription events — no new subscriptions are sold; keep for grandfathered Stripe subs
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "CANCELED" },
        });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
