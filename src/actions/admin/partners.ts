"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { generateAffiliateCode } from "@/lib/affiliate";
import { slugify } from "@/lib/utils";
import { CREATOR_LEVELS } from "@/lib/creator-levels";
import type { PublisherLevel, SocialPlatform } from "@prisma/client";

const profileSchema = z.object({
  userId: z.string(),
  slug: z.string().min(2).max(60).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  commissionRateBps: z.number().int().min(0).max(10000).optional(),
  isVerified: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  level: z.enum(["VERIFIED", "TRUSTED", "ELITE", "OFFICIAL_PARTNER"]).optional(),
  isPublic: z.boolean().optional(),
  isHomepage: z.boolean().optional(),
  commissionOverrideBps: z.number().int().min(0).max(10000).nullable().optional(),
  isBanned: z.boolean().optional(),
});

export async function setPartnerLevel(id: string, level: PublisherLevel) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const bps = CREATOR_LEVELS[level].revenueShareBps;
  await prisma.partnerProfile.update({
    where: { id },
    data: { level, commissionRateBps: bps, isVerified: level !== "UNVERIFIED" },
  });

  await createAuditLog({
    actorId: user.id,
    action: "partner.set_level",
    entityType: "PartnerProfile",
    entityId: id,
    metadata: { level },
  });

  revalidatePath("/admin/partners");
  return ok(undefined);
}

export async function listPartners(params?: { search?: string; page?: number }) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 30;
  const where = params?.search
    ? {
        OR: [
          { slug: { contains: params.search, mode: "insensitive" as const } },
          { user: { username: { contains: params.search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [partners, total] = await Promise.all([
    prisma.partnerProfile.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, role: true } },
        socialLinks: true,
      },
    }),
    prisma.partnerProfile.count({ where }),
  ]);

  return ok({ partners, total, pages: Math.ceil(total / limit), page });
}

export async function getPartnerAdmin(id: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const profile = await prisma.partnerProfile.findUnique({
    where: { id },
    include: { user: true, socialLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!profile) return fail("Partner not found");
  return ok(profile);
}

export async function searchUsersForPartner(query: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;
  if (!query.trim()) return ok([]);

  const users = await prisma.user.findMany({
    where: {
      partnerProfile: null,
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, email: true, displayName: true },
    take: 10,
  });
  return ok(users);
}

export async function createPartnerProfile(input: z.infer<typeof profileSchema>) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const existing = await prisma.partnerProfile.findUnique({ where: { userId: parsed.data.userId } });
  if (existing) return fail("User already has a partner profile");

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return fail("User not found");

  let slug = parsed.data.slug ?? slugify(target.username);
  let slugTaken = await prisma.partnerProfile.findUnique({ where: { slug } });
  let i = 0;
  while (slugTaken && i < 20) {
    slug = `${slugify(target.username)}-${++i}`;
    slugTaken = await prisma.partnerProfile.findUnique({ where: { slug } });
  }

  const code = generateAffiliateCode("PT");

  const profile = await prisma.partnerProfile.create({
    data: {
      userId: parsed.data.userId,
      slug,
      tagline: parsed.data.tagline,
      description: parsed.data.description,
      website: parsed.data.website || null,
      affiliateCode: code,
      couponCode: code,
      commissionRateBps: parsed.data.commissionRateBps ?? 1000,
      isVerified: parsed.data.isVerified ?? false,
      isFeatured: parsed.data.isFeatured ?? false,
      isPublic: parsed.data.isPublic ?? true,
    },
  });

  await prisma.coupon.upsert({
    where: { code },
    create: {
      code,
      type: "PERCENT",
      value: 500,
      affiliateType: "AFFILIATE",
      ownerUserId: parsed.data.userId,
      appliesTo: "all",
    },
    update: { ownerUserId: parsed.data.userId, isActive: true },
  });

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: target.role === "USER" ? "PARTNER" : target.role },
  });

  await createAuditLog({
    actorId: user.id,
    action: "partner.create",
    entityType: "PartnerProfile",
    entityId: profile.id,
  });

  revalidatePath("/admin/partners");
  return ok(profile);
}

export async function updatePartnerProfile(id: string, input: Partial<z.infer<typeof profileSchema>>) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const profile = await prisma.partnerProfile.update({
    where: { id },
    data: {
      ...(input.tagline !== undefined && { tagline: input.tagline }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.commissionRateBps !== undefined && { commissionRateBps: input.commissionRateBps }),
      ...(input.isVerified !== undefined && { isVerified: input.isVerified }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.isSuspended !== undefined && { isSuspended: input.isSuspended }),
      ...(input.isBanned !== undefined && { isBanned: input.isBanned }),
      ...(input.slug && { slug: input.slug }),
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "partner.update",
    entityType: "PartnerProfile",
    entityId: id,
  });

  revalidatePath("/admin/partners");
  revalidatePath(`/partners/${profile.slug}`);
  return ok(profile);
}

export async function deletePartnerProfile(id: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.partnerProfile.delete({ where: { id } });
  await createAuditLog({
    actorId: user.id,
    action: "partner.delete",
    entityType: "PartnerProfile",
    entityId: id,
  });

  revalidatePath("/admin/partners");
  return ok(undefined);
}

export async function upsertPartnerSocialLinks(
  partnerProfileId: string,
  links: { platform: SocialPlatform; url: string }[]
) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.socialLink.deleteMany({ where: { partnerProfileId } });
  if (links.length) {
    await prisma.socialLink.createMany({
      data: links.map((l, i) => ({
        partnerProfileId,
        platform: l.platform,
        url: l.url,
        sortOrder: i,
      })),
    });
  }

  revalidatePath("/admin/partners");
  return ok(undefined);
}

export async function assignPartnerCode(partnerProfileId: string, code?: string) {
  const { error } = await requireActionPermission("coupons.write");
  if (error) return error;

  const profile = await prisma.partnerProfile.findUnique({
    where: { id: partnerProfileId },
    include: { user: true },
  });
  if (!profile) return fail("Partner not found");

  const finalCode = (code ?? profile.affiliateCode ?? generateAffiliateCode("PT")).toUpperCase();
  const exists = await prisma.coupon.findUnique({ where: { code: finalCode } });
  if (exists && exists.ownerUserId !== profile.userId) return fail("Code already taken");

  await prisma.$transaction([
    prisma.partnerProfile.update({
      where: { id: partnerProfileId },
      data: { affiliateCode: finalCode },
    }),
    prisma.coupon.upsert({
      where: { code: finalCode },
      create: {
        code: finalCode,
        type: "PERCENT",
        value: 500,
        affiliateType: "AFFILIATE",
        ownerUserId: profile.userId,
        appliesTo: "all",
      },
      update: { ownerUserId: profile.userId, affiliateType: "AFFILIATE", isActive: true },
    }),
  ]);

  revalidatePath("/admin/partners");
  return ok({ code: finalCode });
}
