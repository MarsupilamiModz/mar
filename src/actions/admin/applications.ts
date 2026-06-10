"use server";

import { revalidatePath } from "next/cache";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { sendCreatorApprovalEmail, sendPartnerApprovalEmail } from "@/lib/email/send";
import { slugify } from "@/lib/utils";
import { invalidateUserSessionCache } from "@/lib/auth-cache";

export async function listCreatorApplicationsAdmin(status?: ApplicationStatus) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const apps = await prisma.creatorApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true, email: true, avatarUrl: true } },
    },
  });
  return ok(apps);
}

export async function listPartnerApplicationsAdmin(status?: ApplicationStatus) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const apps = await prisma.partnerApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true, email: true, avatarUrl: true } },
    },
  });
  return ok(apps);
}

export async function reviewCreatorApplicationAdmin(
  id: string,
  action: "approve" | "reject" | "review" | "info",
  adminNotes?: string
) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const app = await prisma.creatorApplication.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!app) return fail("Not found");

  if (action === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.creatorApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      const slugBase = slugify(app.displayName);
      let slug = slugBase;
      let i = 0;
      while (await tx.creatorProfile.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${++i}`;
      }

      await tx.creatorProfile.upsert({
        where: { userId: app.userId },
        create: {
          userId: app.userId,
          slug,
          description: app.message,
          website: app.websiteUrl,
          isPublic: true,
        },
        update: { isVerified: true, isPublic: true },
      });

      if (app.user.role === "USER") {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: "CREATOR" },
        });
      }
    });

    if (app.user.supabaseId) invalidateUserSessionCache(app.user.supabaseId);

    void sendCreatorApprovalEmail({
      email: app.email,
      creatorName: app.displayName,
    });
  } else {
    const status =
      action === "reject"
        ? "REJECTED"
        : action === "info"
          ? "UNDER_REVIEW"
          : "UNDER_REVIEW";
    await prisma.creatorApplication.update({
      where: { id },
      data: {
        status,
        adminNotes,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  revalidatePath("/admin/applications");
  return ok(undefined);
}

export async function reviewPartnerApplicationAdmin(
  id: string,
  action: "approve" | "reject" | "review" | "info",
  input?: { adminNotes?: string; creatorCode?: string; partnerCode?: string }
) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const app = await prisma.partnerApplication.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!app) return fail("Not found");

  if (action === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.partnerApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes: input?.adminNotes,
          assignedCreatorCode: input?.creatorCode,
          assignedPartnerCode: input?.partnerCode,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      const slugBase = slugify(app.creatorName);
      let slug = slugBase;
      let i = 0;
      while (await tx.partnerProfile.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${++i}`;
      }

      await tx.partnerProfile.upsert({
        where: { userId: app.userId },
        create: {
          userId: app.userId,
          slug,
          description: app.message,
          affiliateCode: input?.partnerCode,
          isPublic: true,
        },
        update: { isVerified: true, isPublic: true },
      });

      if (app.user.role === "USER") {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: "PARTNER" },
        });
      }
    });

    if (app.user.supabaseId) invalidateUserSessionCache(app.user.supabaseId);

    void sendPartnerApprovalEmail({
      email: app.email,
      partnerName: app.creatorName,
    });
  } else {
    const status = action === "reject" ? "REJECTED" : "UNDER_REVIEW";
    await prisma.partnerApplication.update({
      where: { id },
      data: {
        status,
        adminNotes: input?.adminNotes,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  revalidatePath("/admin/applications");
  return ok(undefined);
}
