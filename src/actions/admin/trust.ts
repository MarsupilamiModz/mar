"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DMCAStatus, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";

const dmcaSchema = z.object({
  companyName: z.string().min(2).max(200),
  legalName: z.string().min(2).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).optional(),
  infringingUrl: z.string().url().max(500),
  description: z.string().min(20).max(10000),
  evidenceKeys: z.array(z.string()).max(10).optional(),
});

export async function submitDMCAClaim(input: z.infer<typeof dmcaSchema>) {
  const parsed = dmcaSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid DMCA submission");

  const claim = await prisma.dMCAClaim.create({
    data: {
      companyName: parsed.data.companyName,
      legalName: parsed.data.legalName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      infringingUrl: parsed.data.infringingUrl,
      description: parsed.data.description,
      evidenceKeys: parsed.data.evidenceKeys ?? undefined,
    },
  });

  return ok({ claimId: claim.id });
}

export async function getAdminReports(params?: {
  status?: ReportStatus;
  page?: number;
}) {
  const { error } = await requireActionPermission("moderation.reports");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 25;
  const skip = (page - 1) * limit;

  const where = params?.status ? { status: params.status } : {};

  const [reports, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        reporter: { select: { username: true, email: true } },
        assignee: { select: { username: true } },
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  return ok({ reports, total, pages: Math.ceil(total / limit), page });
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  resolution?: string,
  adminNotes?: string
) {
  const { user, error } = await requireActionPermission("moderation.reports");
  if (error) return error;

  await prisma.contentReport.update({
    where: { id: reportId },
    data: {
      status,
      resolution,
      adminNotes,
      resolvedAt: status === "RESOLVED" || status === "REJECTED" ? new Date() : null,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "report.status_change",
    entityType: "ContentReport",
    entityId: reportId,
    metadata: { status, resolution },
  });

  revalidatePath("/admin/reports");
  return ok(undefined);
}

export async function assignReport(reportId: string, assigneeId: string | null) {
  const { user, error } = await requireActionPermission("moderation.reports");
  if (error) return error;

  await prisma.contentReport.update({
    where: { id: reportId },
    data: { assigneeId, status: "UNDER_REVIEW" },
  });

  await createAuditLog({
    actorId: user.id,
    action: "report.assign",
    entityType: "ContentReport",
    entityId: reportId,
    metadata: { assigneeId },
  });

  revalidatePath("/admin/reports");
  return ok(undefined);
}

export async function getAdminDMCAClaims(params?: { status?: DMCAStatus; page?: number }) {
  const { error } = await requireActionPermission("moderation.reports");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 25;
  const skip = (page - 1) * limit;
  const where = params?.status ? { status: params.status } : {};

  const [claims, total] = await Promise.all([
    prisma.dMCAClaim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.dMCAClaim.count({ where }),
  ]);

  return ok({ claims, total, pages: Math.ceil(total / limit), page });
}

export async function updateDMCAStatus(
  claimId: string,
  status: DMCAStatus,
  resolution?: string,
  adminNotes?: string
) {
  const { user, error } = await requireActionPermission("moderation.reports");
  if (error) return error;

  const claim = await prisma.dMCAClaim.update({
    where: { id: claimId },
    data: {
      status,
      resolution,
      adminNotes,
      resolvedAt: status === "REMOVED" || status === "REJECTED" ? new Date() : null,
    },
  });

  if (status === "REMOVED") {
    const slugMatch = claim.infringingUrl.match(/\/mods\/([^/?#]+)/);
    if (slugMatch) {
      await prisma.mod.updateMany({
        where: { slug: slugMatch[1] },
        data: { status: "ARCHIVED" },
      });
    }
  }

  await createAuditLog({
    actorId: user.id,
    action: "dmca.status_change",
    entityType: "DMCAClaim",
    entityId: claimId,
    metadata: { status },
  });

  revalidatePath("/admin/dmca");
  return ok(undefined);
}

export async function getTrustCenterStats() {
  const { error } = await requireActionPermission("moderation.reports");
  if (error) return error;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    openReports,
    malwareReports,
    openDMCA,
    resolvedReports,
    searchQueries,
    recommendationClicks,
  ] = await Promise.all([
    prisma.contentReport.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "INVESTIGATING"] } } }),
    prisma.contentReport.count({ where: { category: { in: ["MALWARE", "VIRUS"] }, createdAt: { gte: since30 } } }),
    prisma.dMCAClaim.count({ where: { status: { in: ["SUBMITTED", "LEGAL_REVIEW", "ACCEPTED"] } } }),
    prisma.contentReport.count({ where: { status: "RESOLVED", resolvedAt: { gte: since30 } } }),
    prisma.searchQueryLog.count({ where: { createdAt: { gte: since30 } } }),
    prisma.platformEvent.count({ where: { type: "recommendation_click", createdAt: { gte: since30 } } }),
  ]);

  return ok({
    openReports,
    malwareReports,
    openDMCA,
    resolvedReports,
    searchQueries,
    recommendationClicks,
  });
}
