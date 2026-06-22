import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { syncDiscordRoles, logToDiscordWebhook } from "@/lib/discord";
import { trackAffiliateConversion } from "@/actions/affiliate";
import {
  grantMembershipPurchase,
  grantMembershipSubscription,
  getPlanDiscordRoles,
} from "@/lib/membership";
import { sendPaymentNotification, sendPremiumActivationEmail } from "@/lib/email/send";
import { notifyPremiumActivated } from "@/lib/notifications-service";
import { logStripeServer } from "@/lib/stripe-config";
import { upsertUserMembership, planSlugToTier, syncUserRoleFromMembership } from "@/lib/user-membership";
import type Stripe from "stripe";
import type { SubscriptionStatus, UserMembershipStatus } from "@prisma/client";

function toSubscriptionStatus(status: UserMembershipStatus): SubscriptionStatus {
  if (status === "EXPIRED") return "CANCELED";
  return status;
}

function mapStripeSubStatus(status: Stripe.Subscription.Status): UserMembershipStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const planId = sub.metadata?.planId;
  if (!userId || !planId) return;

  const renewalDate = new Date(sub.current_period_end * 1000);
  const membershipStatus = mapStripeSubStatus(sub.status);
  const subscriptionStatus = toSubscriptionStatus(membershipStatus);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      userId,
      planId,
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id ?? "",
      status: subscriptionStatus,
      interval: sub.items.data[0]?.price.recurring?.interval ?? "month",
      currentPeriodEnd: renewalDate,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      status: subscriptionStatus,
      currentPeriodEnd: renewalDate,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });

  await grantMembershipSubscription({
    userId,
    planId,
    stripeSubscriptionId: sub.id,
    renewalDate,
    status: membershipStatus === "EXPIRED" ? "CANCELED" : membershipStatus,
  });

  if (sub.cancel_at_period_end) {
    await upsertUserMembership({
      userId,
      membershipType: planSlugToTier(sub.metadata?.planSlug ?? "premium"),
      status: membershipStatus,
      planId,
      stripeSubscriptionId: sub.id,
      renewalDate,
      cancelDate: renewalDate,
    });
  }
}

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
          type === "membership_subscription" ||
          type === "membership_purchase" ||
          type === "membership_onetime";

        if (isMembership && userId && planId && session.mode === "subscription") {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;

          if (subId) {
            const sub = await getStripe().subscriptions.retrieve(subId);
            await handleSubscriptionUpdate(sub);
          }

          const planSlug = session.metadata?.planSlug;
          const user = await prisma.user.findUnique({ where: { id: userId } });
          const discordRoles = planSlug ? getPlanDiscordRoles(planSlug) : ["premium"];
          if (user?.discordId) await syncDiscordRoles(user.discordId, discordRoles);
          if (user?.email) {
            void sendPremiumActivationEmail({
              email: user.email,
              username: user.displayName ?? user.username,
            });
          }
          void notifyPremiumActivated(userId);

          const refCode = session.metadata?.refCode;
          if (refCode) {
            await trackAffiliateConversion(refCode, session.amount_total ?? 0, "SUBSCRIPTION");
          }

          await logToDiscordWebhook({
            title: "Membership Subscription",
            description: `User ${userId} subscribed to plan ${planId}`,
          });

          void sendPaymentNotification({
            type: "Membership subscription",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: planId,
          });

          logStripeServer("webhook_membership_subscription", { userId, planId, subId });
        }

        if (isMembership && userId && planId && session.mode === "payment") {
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
          }
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

        const orderId = session.metadata?.orderId;
        if (orderId && userId && type === "shop_product_order") {
          const paymentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;
          const productId = session.metadata?.productId;

          if (productId) {
            const purchase = await prisma.shopPurchase.create({
              data: {
                userId,
                productId,
                priceCents: session.amount_total ?? 0,
                stripePaymentId: paymentId ?? undefined,
              },
            });

            await prisma.customOrder.update({
              where: { id: orderId },
              data: {
                paymentStatus: "PAID",
                paymentMethod: "STRIPE",
                stripePaymentId: paymentId ?? undefined,
                status: "PAID",
                shopPurchaseId: purchase.id,
                finalAmountCents: session.amount_total ?? 0,
              },
            });

            const { onOrderPaid } = await import("@/lib/order-workflow");
            void onOrderPaid(orderId, "en");
          }

          void sendPaymentNotification({
            type: "Shop order payment",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: session.metadata?.invoiceNumber ?? orderId,
          });
        }

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
              status: "PAID",
            },
          });

          const { onOrderPaid } = await import("@/lib/order-workflow");
          void onOrderPaid(orderId, "en");

          void sendPaymentNotification({
            type: "Custom order payment",
            amountCents: session.amount_total ?? 0,
            userId,
            reference: session.metadata?.invoiceNumber ?? orderId,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "CANCELED" },
        });
        if (userId) {
          await upsertUserMembership({
            userId,
            membershipType: "FREE",
            status: "CANCELED",
            stripeSubscriptionId: null,
            cancelDate: new Date(),
            renewalDate: null,
          });
          await syncUserRoleFromMembership(userId);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(subId);
          await handleSubscriptionUpdate(sub);
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
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
