import "server-only";
import type { MembershipTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { upsertUserMembership, syncUserRoleFromMembership } from "@/lib/user-membership";
import { logPlatformError } from "@/lib/platform-log";
import { normalizeReferralCode } from "@/lib/referral-cookie";

export { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referral-cookie";

export async function findActiveReferral(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const referral = await prisma.referralLink.findUnique({ where: { code: normalized } });
  if (!referral || !referral.active) return null;
  if (referral.expiresAt && referral.expiresAt < new Date()) return null;
  if (referral.maxUses != null && referral.currentUses >= referral.maxUses) return null;
  return referral;
}

export async function trackReferralClick(code: string) {
  const referral = await findActiveReferral(code);
  if (!referral || !referral.trackingEnabled) return { tracked: false };

  await prisma.referralLink.update({
    where: { id: referral.id },
    data: { clickCount: { increment: 1 } },
  });

  return { tracked: true, referralId: referral.id };
}

export async function redeemReferralForUser(userId: string, code: string) {
  const referral = await findActiveReferral(code);
  if (!referral) return { granted: false, reason: "invalid" as const };

  const existing = await prisma.referralSignup.findUnique({ where: { userId } });
  if (existing) return { granted: false, reason: "already_redeemed" as const };

  const expiresAt = new Date(Date.now() + referral.premiumDays * 86400000);

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.referralLink.findUnique({ where: { id: referral.id } });
      if (!fresh || !fresh.active) throw new Error("Referral inactive");
      if (fresh.maxUses != null && fresh.currentUses >= fresh.maxUses) {
        throw new Error("Referral exhausted");
      }

      await tx.referralSignup.create({
        data: {
          referralId: referral.id,
          userId,
          premiumGranted: true,
        },
      });

      await tx.referralLink.update({
        where: { id: referral.id },
        data: { currentUses: { increment: 1 } },
      });
    });

    await upsertUserMembership({
      userId,
      membershipType: referral.premiumType as MembershipTier,
      status: "ACTIVE",
      renewalDate: expiresAt,
      isLifetime: false,
    });
    await syncUserRoleFromMembership(userId);

    void import("@/lib/notifications-service")
      .then(({ notifyOwnerPlatformEvent }) =>
        notifyOwnerPlatformEvent({
          title: "Referral registration",
          body: `New user signed up via referral ${referral.code} (${referral.name}) — ${referral.premiumDays}d ${referral.premiumType} granted.`,
          link: `/en/admin/referrals`,
          category: "referrals",
        })
      )
      .catch(() => undefined);

    return {
      granted: true,
      premiumType: referral.premiumType,
      premiumDays: referral.premiumDays,
      expiresAt,
    };
  } catch (err) {
    void logPlatformError("referral:redeem", err);
    return { granted: false, reason: "error" as const };
  }
}

export async function getReferralAnalytics(referralId?: string) {
  const where = referralId ? { id: referralId } : {};

  const [links, signups] = await Promise.all([
    prisma.referralLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { username: true, displayName: true } },
        _count: { select: { signups: true } },
        signups: {
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { username: true, displayName: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.referralSignup.count({
      where: referralId ? { referralId } : undefined,
    }),
  ]);

  const totals = links.reduce(
    (acc, link) => {
      acc.clicks += link.clickCount;
      acc.registrations += link.currentUses;
      acc.signups += link._count.signups;
      return acc;
    },
    { clicks: 0, registrations: 0, signups: 0 }
  );

  const conversionRate =
    totals.clicks > 0 ? Math.round((totals.registrations / totals.clicks) * 1000) / 10 : 0;

  return { links, totals, signups, conversionRate };
}

