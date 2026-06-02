"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { generateAffiliateCode } from "@/lib/affiliate";
import { slugify } from "@/lib/utils";
import { CREATOR_LEVELS } from "@/lib/creator-levels";
import { applyLevelRevenueShare, syncCreatorStats } from "@/lib/creators";
import { CACHE_TAGS } from "@/lib/cache";
import { sendCreatorApprovalEmail } from "@/lib/email/send";
import type { PublisherLevel, SocialPlatform } from "@prisma/client";

const profileSchema = z.object({
  userId: z.string(),
  slug: z.string().min(2).max(60).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  level: z.enum(["VERIFIED", "TRUSTED", "ELITE", "OFFICIAL_PARTNER"]).optional(),
  commissionOverrideBps: z.number().int().min(0).max(10000).nullable().optional(),
  isVerified: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isHomepage: z.boolean().optional(),
  isTrending: z.boolean().optional(),
});

function revalidateCreatorPaths(slug?: string) {
  revalidatePath("/admin/creators");
  revalidatePath("/creators");
  revalidateTag(CACHE_TAGS.creators);
  if (slug) revalidatePath(`/creators/${slug}`);
}

export async function listCreators(params?: { search?: string; page?: number; visibility?: "all" | "public" | "hidden" }) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 50;
  const where = {
    ...(params?.visibility === "public" && { isPublic: true }),
    ...(params?.visibility === "hidden" && { isPublic: false }),
    ...(params?.search && {
      OR: [
        { slug: { contains: params.search, mode: "insensitive" as const } },
        { user: { username: { contains: params.search, mode: "insensitive" as const } } },
        { creatorCode: { contains: params.search.toUpperCase() } },
      ],
    }),
  };

  const [creators, total] = await Promise.all([
    prisma.creatorProfile.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, role: true, isBanned: true } },
        socialLinks: true,
      },
    }),
    prisma.creatorProfile.count({ where }),
  ]);

  return ok({ creators, total, pages: Math.ceil(total / limit), page });
}

export async function listVisibleCreators() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const creators = await prisma.creatorProfile.findMany({
    orderBy: [{ sortOrder: "asc" }, { totalDownloads: "desc" }],
    include: {
      user: { select: { displayName: true, username: true } },
    },
  });
  return ok(creators);
}

export async function getCreatorAdmin(id: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      socialLinks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!profile) return fail("Creator not found");

  const [payouts, commissions] = await Promise.all([
    prisma.payout.findMany({ where: { userId: profile.userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.commissionEntry.aggregate({
      where: { userId: profile.userId },
      _sum: { amountCents: true },
    }),
  ]);

  return ok({ ...profile, payouts, totalCommission: commissions._sum.amountCents ?? 0 });
}

export async function createCreatorProfile(input: z.infer<typeof profileSchema>) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return fail("User not found");
  if (await prisma.creatorProfile.findUnique({ where: { userId: parsed.data.userId } })) {
    return fail("Creator profile already exists");
  }

  const slug = parsed.data.slug ?? slugify(target.username);
  const code = generateAffiliateCode("CR");
  const level = (parsed.data.level ?? "VERIFIED") as PublisherLevel;
  const bps = CREATOR_LEVELS[level].revenueShareBps;

  const profile = await prisma.creatorProfile.create({
    data: {
      userId: parsed.data.userId,
      slug,
      tagline: parsed.data.tagline,
      description: parsed.data.description,
      website: parsed.data.website || null,
      creatorCode: code,
      referralCode: code,
      level,
      commissionRateBps: bps,
      isVerified: true,
      isPublic: parsed.data.isPublic ?? false,
      isFeatured: parsed.data.isFeatured ?? false,
    },
  });

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: target.role === "USER" ? "CREATOR" : target.role },
  });

  await prisma.coupon.create({
    data: {
      code,
      type: "PERCENT",
      value: 1000,
      affiliateType: "CREATOR",
      ownerUserId: target.id,
    },
  });

  await createAuditLog({ actorId: user.id, action: "creator.create", entityType: "CreatorProfile", entityId: profile.id });
  revalidateCreatorPaths(slug);

  void sendCreatorApprovalEmail({
    email: target.email,
    creatorName: target.displayName ?? target.username,
  });

  return ok(profile);
}

export async function updateCreatorProfile(
  id: string,
  input: Partial<z.infer<typeof profileSchema>> & { commissionOverrideBps?: number | null }
) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const existing = await prisma.creatorProfile.findUnique({
    where: { id },
    include: { user: { select: { email: true, username: true, displayName: true } } },
  });
  if (!existing) return fail("Creator not found");

  const profile = await prisma.creatorProfile.update({
    where: { id },
    data: {
      ...(input.tagline !== undefined && { tagline: input.tagline }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.commissionOverrideBps !== undefined && { commissionOverrideBps: input.commissionOverrideBps }),
      ...(input.isVerified !== undefined && { isVerified: input.isVerified }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.isSuspended !== undefined && { isSuspended: input.isSuspended }),
      ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
      ...(input.isHomepage !== undefined && { isHomepage: input.isHomepage }),
      ...(input.isTrending !== undefined && { isTrending: input.isTrending }),
      ...(input.slug && { slug: input.slug }),
    },
  });

  await createAuditLog({ actorId: user.id, action: "creator.update", entityType: "CreatorProfile", entityId: id });
  revalidateCreatorPaths(profile.slug);

  if (input.isVerified === true && !existing.isVerified && existing.user.email) {
    void sendCreatorApprovalEmail({
      email: existing.user.email,
      creatorName: existing.user.displayName ?? existing.user.username,
    });
  }

  return ok(profile);
}

export async function setCreatorLevel(id: string, level: PublisherLevel) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await applyLevelRevenueShare(id, level);
  await createAuditLog({
    actorId: user.id,
    action: "creator.set_level",
    entityType: "CreatorProfile",
    entityId: id,
    metadata: { level },
  });
  revalidateCreatorPaths();
  return ok(undefined);
}

export async function banCreator(id: string, ban: boolean) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!profile) return fail("Creator not found");

  await prisma.$transaction([
    prisma.user.update({ where: { id: profile.userId }, data: { isBanned: ban } }),
    prisma.creatorProfile.update({
      where: { id },
      data: { isSuspended: ban, isPublic: ban ? false : undefined },
    }),
  ]);

  await createAuditLog({
    actorId: user.id,
    action: ban ? "creator.ban" : "creator.unban",
    entityType: "CreatorProfile",
    entityId: id,
  });
  revalidateCreatorPaths(profile.slug);
  return ok(undefined);
}

export async function deleteCreatorProfile(id: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.creatorProfile.delete({ where: { id } });
  await createAuditLog({ actorId: user.id, action: "creator.delete", entityType: "CreatorProfile", entityId: id });
  revalidateCreatorPaths();
  return ok(undefined);
}

export async function reorderVisibleCreators(ids: string[]) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.$transaction(
    ids.map((id, index) => prisma.creatorProfile.update({ where: { id }, data: { sortOrder: index } }))
  );
  revalidateCreatorPaths();
  return ok(undefined);
}

export async function syncCreatorStatsAction(id: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!profile) return fail("Not found");
  await syncCreatorStats(profile.userId);
  revalidateCreatorPaths(profile.slug);
  return ok(undefined);
}

export async function upsertCreatorSocialLinks(
  creatorProfileId: string,
  links: { platform: SocialPlatform; url: string }[]
) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.socialLink.deleteMany({ where: { creatorProfileId } });
  if (links.length) {
    await prisma.socialLink.createMany({
      data: links.map((l, i) => ({ creatorProfileId, platform: l.platform, url: l.url, sortOrder: i })),
    });
  }
  revalidateCreatorPaths();
  return ok(undefined);
}

export async function assignCreatorCode(creatorProfileId: string, code?: string) {
  const { error } = await requireActionPermission("coupons.write");
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { id: creatorProfileId }, include: { user: true } });
  if (!profile) return fail("Creator not found");

  const finalCode = (code ?? generateAffiliateCode("CR")).toUpperCase();
  const exists = await prisma.coupon.findUnique({ where: { code: finalCode } });
  if (exists && exists.ownerUserId !== profile.userId) return fail("Code already taken");

  await prisma.$transaction([
    prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: { creatorCode: finalCode, referralCode: finalCode },
    }),
    prisma.coupon.upsert({
      where: { code: finalCode },
      create: { code: finalCode, type: "PERCENT", value: 1000, affiliateType: "CREATOR", ownerUserId: profile.userId },
      update: { ownerUserId: profile.userId, affiliateType: "CREATOR", isActive: true },
    }),
  ]);

  revalidateCreatorPaths(profile.slug);
  return ok({ code: finalCode });
}

export async function assignCreatorCouponCode(creatorProfileId: string, code?: string) {
  const { error } = await requireActionPermission("coupons.write");
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { id: creatorProfileId }, include: { user: true } });
  if (!profile) return fail("Creator not found");

  const finalCode = (code ?? generateAffiliateCode("CP")).toUpperCase();
  const exists = await prisma.coupon.findUnique({ where: { code: finalCode } });
  if (exists && exists.ownerUserId !== profile.userId) return fail("Code already taken");

  await prisma.$transaction([
    prisma.creatorProfile.update({ where: { id: creatorProfileId }, data: { couponCode: finalCode } }),
    prisma.coupon.upsert({
      where: { code: finalCode },
      create: { code: finalCode, type: "PERCENT", value: 1500, affiliateType: "PRIVATE", ownerUserId: profile.userId },
      update: { ownerUserId: profile.userId, isActive: true },
    }),
  ]);

  revalidateCreatorPaths(profile.slug);
  return ok({ code: finalCode });
}

export async function searchUsersForCreator(q: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const users = await prisma.user.findMany({
    where: {
      creatorProfile: null,
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, email: true, displayName: true },
    take: 10,
  });
  return ok(users);
}
