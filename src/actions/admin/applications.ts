"use server";

import { revalidatePath } from "next/cache";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { sendCreatorApprovalEmail, sendPartnerApprovalEmail } from "@/lib/email/send";
import { slugify } from "@/lib/utils";
import { invalidateUserSessionCache } from "@/lib/auth-cache";
import { savePartnerFormFields, getPartnerFormFields, type PartnerFormField } from "@/lib/partner-form-config";

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
      user: { select: { username: true, email: true, avatarUrl: true, displayName: true } },
      assignedCommissionRule: { select: { id: true, name: true, value: true, type: true } },
    },
  });
  return ok(apps);
}

export async function listCommissionRulesForApplications() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const rules = await prisma.commissionRule.findMany({
    where: { isActive: true, targetRole: "PARTNER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, value: true, source: true },
  });
  return ok(rules);
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
  action: "approve" | "reject" | "review" | "info" | "needs_changes",
  input?: {
    adminNotes?: string;
    requiredChanges?: string;
    creatorCode?: string;
    partnerCode?: string;
    commissionRuleId?: string;
  }
) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const app = await prisma.partnerApplication.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!app) return fail("Not found");

  if (action === "approve") {
    const commissionRule = input?.commissionRuleId
      ? await prisma.commissionRule.findUnique({ where: { id: input.commissionRuleId } })
      : null;

    await prisma.$transaction(async (tx) => {
      const priorHistory = (app.statusHistory as object[] | null) ?? [];
      await tx.partnerApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes: input?.adminNotes,
          requiredChanges: null,
          assignedCreatorCode: input?.creatorCode,
          assignedPartnerCode: input?.partnerCode,
          assignedCommissionRuleId: input?.commissionRuleId ?? null,
          reviewedById: user.id,
          reviewedAt: new Date(),
          statusHistory: [
            ...priorHistory,
            { status: "APPROVED", at: new Date().toISOString(), note: input?.adminNotes },
          ],
        },
      });

      const slugBase = slugify(app.creatorName);
      let slug = slugBase;
      let i = 0;
      while (await tx.partnerProfile.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${++i}`;
      }

      const commissionRateBps =
        commissionRule?.type === "PERCENT" ? commissionRule.value * 100 : undefined;

      await tx.partnerProfile.upsert({
        where: { userId: app.userId },
        create: {
          userId: app.userId,
          slug,
          description: app.whyPartner ?? app.message,
          website: app.websiteUrl,
          affiliateCode: input?.partnerCode,
          commissionRateBps: commissionRateBps ?? 1000,
          commissionOverrideBps: commissionRateBps,
          isPublic: true,
        },
        update: {
          isVerified: true,
          isPublic: true,
          ...(commissionRateBps != null ? { commissionOverrideBps: commissionRateBps } : {}),
          ...(input?.partnerCode ? { affiliateCode: input.partnerCode } : {}),
        },
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
    const status =
      action === "reject"
        ? "REJECTED"
        : action === "needs_changes"
          ? "NEEDS_CHANGES"
          : "UNDER_REVIEW";
    const priorHistory = (app.statusHistory as object[] | null) ?? [];
    await prisma.partnerApplication.update({
      where: { id },
      data: {
        status,
        adminNotes: input?.adminNotes,
        requiredChanges: action === "needs_changes" ? input?.requiredChanges ?? input?.adminNotes : null,
        reviewedById: user.id,
        reviewedAt: new Date(),
        statusHistory: [
          ...priorHistory,
          {
            status,
            at: new Date().toISOString(),
            note: input?.adminNotes ?? input?.requiredChanges,
          },
        ],
      },
    });
  }

  revalidatePath("/admin/applications");
  return ok(undefined);
}

export async function getPartnerFormFieldsAdmin() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;
  const fields = await getPartnerFormFields();
  return ok(fields);
}

export async function savePartnerFormFieldsAdmin(fields: PartnerFormField[]) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;
  if (!fields.length) return fail("At least one field required");
  await savePartnerFormFields(fields);
  revalidatePath("/admin/applications");
  revalidatePath("/become-partner");
  return ok(undefined);
}
