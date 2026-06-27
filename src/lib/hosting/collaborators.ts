import { prisma } from "@/lib/db";

export async function getModCollaborators(modId: string) {
  return prisma.modCollaborator.findMany({
    where: { modId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          creatorProfile: { select: { slug: true } },
        },
      },
    },
    orderBy: { revenueShareBps: "desc" },
  });
}

export async function validateCollaboratorShares(
  modId: string,
  shares: { userId: string; revenueShareBps: number }[]
) {
  const total = shares.reduce((sum, s) => sum + s.revenueShareBps, 0);
  if (total > 10000) {
    throw new Error("Co-creator revenue shares cannot exceed 100%.");
  }
  const dup = new Set(shares.map((s) => s.userId));
  if (dup.size !== shares.length) {
    throw new Error("Duplicate co-creators are not allowed.");
  }
  void modId;
}

export function splitPremiumRevenue(
  amountCents: number,
  collaborators: { userId: string; revenueShareBps: number }[],
  leadAuthorId: string
) {
  const allocated = collaborators.filter((c) => c.revenueShareBps > 0);
  const splits: { userId: string; amountCents: number }[] = [];
  let remaining = amountCents;

  for (const c of allocated) {
    const share = Math.floor((amountCents * c.revenueShareBps) / 10000);
    splits.push({ userId: c.userId, amountCents: share });
    remaining -= share;
  }

  const leadShare = splits.find((s) => s.userId === leadAuthorId);
  if (leadShare) leadShare.amountCents += remaining;
  else splits.push({ userId: leadAuthorId, amountCents: remaining });

  return splits;
}
