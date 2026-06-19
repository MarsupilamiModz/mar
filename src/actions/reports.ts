"use server";

import { z } from "zod";
import { ReportCategory, ReportStatus, ReportTargetType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionUser } from "@/lib/action-utils";

const submitSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().min(1),
  category: z.nativeEnum(ReportCategory),
  description: z.string().min(10).max(5000),
  attachments: z.array(z.string()).max(5).optional(),
});

export async function submitContentReport(input: z.infer<typeof submitSchema>) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid report");

  const recent = await prisma.contentReport.count({
    where: {
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent > 0) return fail("You already reported this recently");

  const report = await prisma.contentReport.create({
    data: {
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      category: parsed.data.category,
      description: parsed.data.description,
      attachments: parsed.data.attachments ?? undefined,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "report.submit",
    entityType: "ContentReport",
    entityId: report.id,
    metadata: { targetType: parsed.data.targetType, category: parsed.data.category },
  });

  return ok({ reportId: report.id });
}

export async function getMyReports() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const reports = await prisma.contentReport.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok({ reports });
}

export { ReportCategory, ReportStatus, ReportTargetType };
