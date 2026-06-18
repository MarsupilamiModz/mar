import { prisma } from "@/lib/db";
import { getUserMembershipState } from "@/lib/user-membership";
import { getOrCreateStripeCustomer, listCustomerInvoices } from "@/lib/stripe";
import { mapPlan } from "@/lib/membership";

export async function getPremiumBillingData(userId: string, email: string) {
  const [membership, subscription, purchases, user] = await Promise.all([
    getUserMembershipState(userId),
    prisma.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      include: { plan: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.membershipPurchase.findMany({
      where: { userId },
      include: { plan: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }),
  ]);

  let invoices: Awaited<ReturnType<typeof listCustomerInvoices>> = [];
  const customerId = user?.stripeCustomerId;
  if (customerId) {
    try {
      invoices = await listCustomerInvoices(customerId);
    } catch {
      invoices = [];
    }
  } else {
    try {
      const id = await getOrCreateStripeCustomer(userId, email);
      invoices = await listCustomerInvoices(id);
    } catch {
      invoices = [];
    }
  }

  const currentPlan = subscription?.plan
    ? mapPlan(subscription.plan)
    : membership.planId
      ? await prisma.membershipPlan
          .findUnique({ where: { id: membership.planId } })
          .then((p) => (p ? mapPlan(p) : null))
      : null;

  return {
    membership,
    subscription,
    currentPlan,
    purchases,
    invoices,
    hasStripeSubscription: !!membership.stripeSubscriptionId || !!subscription,
  };
}
