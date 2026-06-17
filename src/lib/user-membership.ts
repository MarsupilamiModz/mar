import type { MembershipTier, UserMembershipStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mapPlan, type MembershipPlanData } from "@/lib/membership";

const TIER_ORDER: MembershipTier[] = ["FREE", "PREMIUM_LITE", "PREMIUM", "PREMIUM_MAX"];

export type UserMembershipState = {
  membershipType: MembershipTier;
  status: UserMembershipStatus;
  planId: string | null;
  planSlug: string | null;
  stripeSubscriptionId: string | null;
  renewalDate: Date | null;
  cancelDate: Date | null;
  isLifetime: boolean;
};

export function planSlugToTier(slug: string): MembershipTier {
  switch (slug) {
    case "premium-lite":
      return "PREMIUM_LITE";
    case "premium-max":
      return "PREMIUM_MAX";
    case "premium":
      return "PREMIUM";
    default:
      return "FREE";
  }
}

export function tierToPlanSlug(tier: MembershipTier): string | null {
  switch (tier) {
    case "PREMIUM_LITE":
      return "premium-lite";
    case "PREMIUM":
      return "premium";
    case "PREMIUM_MAX":
      return "premium-max";
    default:
      return null;
  }
}

function tierRank(tier: MembershipTier): number {
  return TIER_ORDER.indexOf(tier);
}

export async function getUserMembershipState(userId: string): Promise<UserMembershipState> {
  const row = await prisma.userMembership.findUnique({
    where: { userId },
    include: { plan: { select: { slug: true } } },
  });

  if (row) {
    return {
      membershipType: row.membershipType,
      status: row.status,
      planId: row.planId,
      planSlug: row.plan?.slug ?? tierToPlanSlug(row.membershipType),
      stripeSubscriptionId: row.stripeSubscriptionId,
      renewalDate: row.renewalDate,
      cancelDate: row.cancelDate,
      isLifetime: row.isLifetime,
    };
  }

  return {
    membershipType: "FREE",
    status: "ACTIVE",
    planId: null,
    planSlug: null,
    stripeSubscriptionId: null,
    renewalDate: null,
    cancelDate: null,
    isLifetime: false,
  };
}

export async function upsertUserMembership(params: {
  userId: string;
  membershipType: MembershipTier;
  status?: UserMembershipStatus;
  planId?: string | null;
  stripeSubscriptionId?: string | null;
  renewalDate?: Date | null;
  cancelDate?: Date | null;
  isLifetime?: boolean;
}) {
  const data = {
    membershipType: params.membershipType,
    status: params.status ?? "ACTIVE",
    planId: params.planId ?? null,
    stripeSubscriptionId: params.stripeSubscriptionId ?? null,
    renewalDate: params.renewalDate ?? null,
    cancelDate: params.cancelDate ?? null,
    isLifetime: params.isLifetime ?? false,
  };

  return prisma.userMembership.upsert({
    where: { userId: params.userId },
    create: { userId: params.userId, ...data },
    update: data,
  });
}

export async function syncUserRoleFromMembership(userId: string) {
  const state = await getUserMembershipState(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || ["OWNER", "ADMIN", "MODERATOR"].includes(user.role)) return;

  const hasPremium =
    state.status === "ACTIVE" &&
    state.membershipType !== "FREE" &&
    (state.isLifetime || !state.cancelDate || state.cancelDate > new Date());

  await prisma.user.update({
    where: { id: userId },
    data: { role: hasPremium ? "PREMIUM" : "USER" },
  });
}

export async function getEffectiveMembershipPlan(userId: string, role: UserRole): Promise<MembershipPlanData | null> {
  if (["OWNER", "ADMIN", "MODERATOR", "PREMIUM"].includes(role)) {
    const maxPlan = await prisma.membershipPlan.findFirst({
      where: { slug: "premium-max", isActive: true },
      orderBy: { sortOrder: "desc" },
    });
    if (maxPlan) return mapPlan(maxPlan);
  }

  const state = await getUserMembershipState(userId);
  if (state.membershipType === "FREE" || state.status === "CANCELED" || state.status === "EXPIRED") {
    return null;
  }

  if (state.planId) {
    const plan = await prisma.membershipPlan.findUnique({ where: { id: state.planId } });
    if (plan?.isActive) return mapPlan(plan);
  }

  const slug = state.planSlug ?? tierToPlanSlug(state.membershipType);
  if (!slug) return null;

  const plan = await prisma.membershipPlan.findFirst({ where: { slug, isActive: true } });
  return plan ? mapPlan(plan) : null;
}

export function isMembershipActive(state: UserMembershipState): boolean {
  if (state.membershipType === "FREE") return false;
  if (state.isLifetime) return state.status === "ACTIVE";
  if (state.status === "ACTIVE" || state.status === "TRIALING") {
    if (state.renewalDate && state.renewalDate < new Date()) return false;
    return true;
  }
  return false;
}

export function compareTiers(a: MembershipTier, b: MembershipTier): number {
  return tierRank(a) - tierRank(b);
}
