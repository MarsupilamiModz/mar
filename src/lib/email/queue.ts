import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail, type SendEmailParams } from "@/lib/email/send";

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 60_000;

export type QueuedEmailJob = SendEmailParams & {
  templateKey?: string;
};

/** Queue email for async delivery with automatic retry on failure. */
export async function queueEmail(params: QueuedEmailJob) {
  const recipients = Array.isArray(params.to) ? params.to.join(",") : params.to;

  const log = await prisma.emailLog.create({
    data: {
      to: recipients,
      subject: params.subject,
      templateKey: params.templateKey,
      html: params.html,
      status: "PENDING",
      userId: params.userId,
    },
  });

  void deliverQueuedEmail(log.id, params).catch((err) =>
    console.error("[email-queue]", err)
  );

  return log.id;
}

async function deliverQueuedEmail(logId: string, params: QueuedEmailJob) {
  const sent = await sendEmail({ ...params, queueOnFailure: false });

  if (sent) {
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
    });
    return;
  }

  const log = await prisma.emailLog.findUnique({ where: { id: logId } });
  const attempts = (log?.attempts ?? 0) + 1;

  if (attempts < MAX_ATTEMPTS) {
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: "PENDING", attempts },
    });
    setTimeout(() => {
      void deliverQueuedEmail(logId, params);
    }, RETRY_DELAY_MS * attempts);
    return;
  }

  await prisma.emailLog.update({
    where: { id: logId },
    data: { status: "FAILED", attempts },
  });
}

/** Retry all failed/pending emails (admin or cron). */
export async function processEmailQueue(limit = 20) {
  const pending = await prisma.emailLog.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const row of pending) {
    if (!row.html) continue;
    await deliverQueuedEmail(row.id, {
      to: row.to,
      subject: row.subject,
      html: row.html,
      templateKey: row.templateKey ?? undefined,
      userId: row.userId ?? undefined,
    });
    processed++;
  }
  return processed;
}
