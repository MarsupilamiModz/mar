"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import {
  cancelStripeSubscription,
  changeStripeSubscriptionPlan,
  resumeStripeSubscription,
} from "@/lib/stripe";
import {
  getUserMembershipState,
  planSlugToTier,
  syncUserRoleFromMembership,
  upsertUserMembership,
} from "@/lib/user-membership";
import { grantMembershipPurchase } from "@/lib/membership";
import type { MembershipTier, UserMembershipStatus } from "@prisma/client";

export async function getAdminUserMembership(userId: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const [state, purchases, subscriptions, invoices] = await Promise.all([
    getUserMembershipState(userId),
    prisma.membershipPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true, slug: true } } },
    }),
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true, slug: true } } },
    }),
    prisma.membershipPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        stripePaymentId: true,
        plan: { select: { name: true } },
      },
    }),
  ]);

  return ok({ state, purchases, subscriptions, billingHistory: invoices });
}

export async function adminAssignMembership(
  userId: string,
  planId: string,
  options?: { lifetime?: boolean; extendDays?: number }
) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) return fail("Plan not found");

  if (options?.lifetime || plan.billingType === "ONE_TIME") {
    await grantMembershipPurchase({
      userId,
      planId,
      stripePaymentId: `admin_${user!.id}_${Date.now()}`,
    });
  } else {
    const renewal = new Date();
    renewal.setDate(renewal.getDate() + (options?.extendDays ?? 30));
    await upsertUserMembership({
      userId,
      membershipType: planSlugToTier(plan.slug),
      status: "ACTIVE",
      planId: plan.id,
      renewalDate: renewal,
      isLifetime: false,
    });
    await syncUserRoleFromMembership(userId);
  }

  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function adminCancelMembership(userId: string) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  const state = await getUserMembershipState(userId);
  if (state.stripeSubscriptionId) {
    try {
      await cancelStripeSubscription(state.stripeSubscriptionId);
    } catch {
      /* stripe may already be canceled */
    }
  }

  await upsertUserMembership({
    userId,
    membershipType: state.isLifetime ? state.membershipType : "FREE",
    status: state.isLifetime ? "ACTIVE" : "CANCELED",
    cancelDate: new Date(),
    stripeSubscriptionId: state.stripeSubscriptionId,
  });

  if (!state.isLifetime) {
    await upsertUserMembership({
      userId,
      membershipType: "FREE",
      status: "CANCELED",
      cancelDate: new Date(),
    });
  }

  await syncUserRoleFromMembership(userId);
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function adminExtendMembership(userId: string, days: number) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  const state = await getUserMembershipState(userId);
  const base = state.renewalDate && state.renewalDate > new Date() ? state.renewalDate : new Date();
  const renewal = new Date(base);
  renewal.setDate(renewal.getDate() + days);

  await upsertUserMembership({
    userId,
    membershipType: state.membershipType,
    status: "ACTIVE",
    planId: state.planId,
    renewalDate: renewal,
    stripeSubscriptionId: state.stripeSubscriptionId,
    isLifetime: state.isLifetime,
  });

  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function adminSetMembershipTier(
  userId: string,
  tier: MembershipTier,
  status: UserMembershipStatus = "ACTIVE"
) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  const slug =
    tier === "PREMIUM_LITE" ? "premium-lite" : tier === "PREMIUM_MAX" ? "premium-max" : tier === "PREMIUM" ? "premium" : null;
  const plan = slug
    ? await prisma.membershipPlan.findFirst({ where: { slug } })
    : null;

  await upsertUserMembership({
    userId,
    membershipType: tier,
    status,
    planId: plan?.id ?? null,
    isLifetime: tier !== "FREE",
  });
  await syncUserRoleFromMembership(userId);
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function adminChangeMembershipPlan(userId: string, newPlanId: string) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  const plan = await prisma.membershipPlan.findUnique({ where: { id: newPlanId } });
  if (!plan) return fail("Plan not found");

  const state = await getUserMembershipState(userId);
  if (state.stripeSubscriptionId && plan.stripePriceId) {
    try {
      await changeStripeSubscriptionPlan(state.stripeSubscriptionId, plan.stripePriceId);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Stripe plan change failed");
    }
  }

  await upsertUserMembership({
    userId,
    membershipType: planSlugToTier(plan.slug),
    status: "ACTIVE",
    planId: plan.id,
    stripeSubscriptionId: state.stripeSubscriptionId,
    renewalDate: state.renewalDate,
    isLifetime: false,
  });
  await syncUserRoleFromMembership(userId);
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function adminResumeMembership(userId: string) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  const state = await getUserMembershipState(userId);
  if (state.stripeSubscriptionId) {
    await resumeStripeSubscription(state.stripeSubscriptionId);
  }

  await upsertUserMembership({
    userId,
    membershipType: state.membershipType,
    status: "ACTIVE",
    planId: state.planId,
    cancelDate: null,
    stripeSubscriptionId: state.stripeSubscriptionId,
    renewalDate: state.renewalDate,
    isLifetime: state.isLifetime,
  });
  await syncUserRoleFromMembership(userId);
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}
