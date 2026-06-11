"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { notifyStaffPartnerApplication } from "@/lib/notifications-service";

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
  applicationId?: string;
  creatorName: string;
  username?: string;
  email: string;
  discord?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  tiktokUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  websiteUrl?: string;
  audienceSize?: string;
  country?: string;
  platforms?: string[];
  whyPartner?: string;
  promotionStrategy?: string;
  message?: string;
  customResponses?: Record<string, string | boolean>;
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  if (!input.creatorName.trim() || !input.email.trim()) {
    return fail("Name and email required");
  }

  const existingProfile = await prisma.partnerProfile.findUnique({
    where: { userId: user.id },
  });
  if (existingProfile) return fail("You already have a partner profile");

  const existing = input.applicationId
    ? await prisma.partnerApplication.findFirst({
        where: { id: input.applicationId, userId: user.id },
      })
    : await prisma.partnerApplication.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

  if (existing && !input.applicationId) {
    if (["PENDING", "UNDER_REVIEW"].includes(existing.status)) {
      return fail("Application already submitted");
    }
    if (existing.status === "APPROVED") {
      return fail("Application already approved");
    }
  }

  const historyEntry = {
    status: existing?.status === "NEEDS_CHANGES" ? "PENDING" : "PENDING",
    at: new Date().toISOString(),
    note: existing ? "Application updated by applicant" : "Application submitted",
  };

  const data = {
    creatorName: input.creatorName.trim(),
    username: input.username?.trim() || user.username,
    email: input.email.trim(),
    discord: input.discord?.trim(),
    youtubeUrl: input.youtubeUrl?.trim(),
    twitchUrl: input.twitchUrl?.trim(),
    tiktokUrl: input.tiktokUrl?.trim(),
    instagramUrl: input.instagramUrl?.trim(),
    xUrl: input.xUrl?.trim(),
    websiteUrl: input.websiteUrl?.trim(),
    audienceSize: input.audienceSize?.trim(),
    country: input.country?.trim(),
    platforms: input.platforms ?? [],
    whyPartner: input.whyPartner?.trim(),
    promotionStrategy: input.promotionStrategy?.trim(),
    message: input.message?.trim(),
    customResponses: input.customResponses ?? {},
    socialLinks: {
      youtube: input.youtubeUrl ?? "",
      twitch: input.twitchUrl ?? "",
      tiktok: input.tiktokUrl ?? "",
      instagram: input.instagramUrl ?? "",
      x: input.xUrl ?? "",
      website: input.websiteUrl ?? "",
    },
    status: "PENDING" as const,
    requiredChanges: null,
  };

  let app;
  if (existing && (existing.status === "NEEDS_CHANGES" || existing.status === "REJECTED")) {
    const priorHistory = (existing.statusHistory as object[] | null) ?? [];
    app = await prisma.partnerApplication.update({
      where: { id: existing.id },
      data: {
        ...data,
        statusHistory: [...priorHistory, historyEntry],
      },
    });
  } else if (existing && input.applicationId) {
    return fail("Cannot update application in current status");
  } else {
    app = await prisma.partnerApplication.create({
      data: {
        userId: user.id,
        ...data,
        statusHistory: [historyEntry],
      },
    });
  }

  void notifyStaffPartnerApplication({
    applicationId: app.id,
    applicantName: app.creatorName,
    username: app.username ?? user.username,
  });

  revalidatePath("/become-partner");
  revalidatePath("/admin/applications");
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
