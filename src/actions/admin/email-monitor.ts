"use server";

import { prisma } from "@/lib/db";
import { getEmailSettingsPublic } from "@/lib/email/settings";
import { processEmailQueue } from "@/lib/email/queue";
import { ok, requireActionOwner } from "@/lib/action-utils";
import { listPlatformErrors } from "@/lib/platform-log";

export async function getOwnerEmailMonitor() {
  const { error } = await requireActionOwner();
  if (error) return error;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [settings, sentToday, failedToday, pendingQueue, failedRecent, recentLogs, authErrors] =
    await Promise.all([
      getEmailSettingsPublic(),
      prisma.emailLog.count({
        where: { status: "SENT", sentAt: { gte: startOfDay } },
      }),
      prisma.emailLog.count({
        where: { status: "FAILED", createdAt: { gte: startOfDay } },
      }),
      prisma.emailLog.count({
        where: { status: "PENDING" },
      }),
      prisma.emailLog.count({
        where: { status: "FAILED", attempts: { gte: 1 } },
      }),
      prisma.emailLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          to: true,
          subject: true,
          templateKey: true,
          status: true,
          error: true,
          attempts: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      listPlatformErrors(20).then((entries) =>
        entries.filter((e) => e.context.startsWith("auth:") || e.context.startsWith("email:"))
      ),
    ]);

  const providers = [
    settings.configured && settings.authMode === "microsoft" ? "Microsoft 365" : null,
    settings.configured && settings.authMode === "smtp" ? "Primary SMTP" : null,
    settings.fallbackSes?.enabled ? "Amazon SES" : null,
    settings.fallbackBrevo?.enabled ? "Brevo" : null,
    process.env.RESEND_API_KEY ? "Resend" : null,
  ].filter(Boolean) as string[];

  return ok({
    settings,
    metrics: {
      sentToday,
      failedToday,
      pendingQueue,
      failedRecent,
      providers,
      smtpConfigured: settings.configured,
    },
    recentLogs,
    authErrors,
    checkedAt: now.toISOString(),
  });
}

export async function ownerProcessEmailQueue() {
  const { error } = await requireActionOwner();
  if (error) return error;

  const processed = await processEmailQueue(50);
  return ok({ processed });
}
