"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";

export async function submitCreatorApplication(input: {
  displayName: string;
  email: string;
  discord?: string;
  portfolioUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  tiktokUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  websiteUrl?: string;
  message?: string;
  portfolioImages?: string[];
  sampleModUrls?: string[];
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  if (!input.displayName.trim() || !input.email.trim()) return fail("Name and email required");

  const existingProfile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
  });
  if (existingProfile) return fail("You already have a creator profile");
  const pending = await prisma.creatorApplication.findFirst({
    where: { userId: user.id, status: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
  if (pending) return fail("Application already submitted");

  const app = await prisma.creatorApplication.create({
    data: {
      userId: user.id,
      displayName: input.displayName.trim(),
      email: input.email.trim(),
      discord: input.discord,
      portfolioUrl: input.portfolioUrl,
      youtubeUrl: input.youtubeUrl,
      twitchUrl: input.twitchUrl,
      tiktokUrl: input.tiktokUrl,
      instagramUrl: input.instagramUrl,
      xUrl: input.xUrl,
      websiteUrl: input.websiteUrl,
      message: input.message,
      portfolioImages: input.portfolioImages ?? [],
      sampleModUrls: input.sampleModUrls ?? [],
    },
  });

  revalidatePath("/become-creator");
  return ok({ id: app.id });
}

export async function submitPartnerApplication(input: {
  creatorName: string;
  email: string;
  audienceSize?: string;
  platforms?: string[];
  promotionStrategy?: string;
  socialLinks?: Record<string, string>;
  message?: string;
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const existingProfile = await prisma.partnerProfile.findUnique({
    where: { userId: user.id },
  });
  if (existingProfile) return fail("You already have a partner profile");
  const pending = await prisma.partnerApplication.findFirst({
    where: { userId: user.id, status: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
  if (pending) return fail("Application already submitted");

  const app = await prisma.partnerApplication.create({
    data: {
      userId: user.id,
      creatorName: input.creatorName.trim(),
      email: input.email.trim(),
      audienceSize: input.audienceSize,
      platforms: input.platforms ?? [],
      promotionStrategy: input.promotionStrategy,
      socialLinks: input.socialLinks ?? {},
      message: input.message,
    },
  });

  revalidatePath("/become-partner");
  return ok({ id: app.id });
}

export async function getMyCreatorApplication(userId: string) {
  return prisma.creatorApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyPartnerApplication(userId: string) {
  return prisma.partnerApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
