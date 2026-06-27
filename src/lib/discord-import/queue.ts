import { prisma } from "@/lib/db";
import type { DiscordImportJobStatus } from "@prisma/client";
import type { DiscordMessagePayload } from "@/lib/discord-import/processor";

let processing = false;

async function processDiscordImportEntry(
  entryId: string,
  payload: DiscordMessagePayload
) {
  const { processDiscordImportEntry: run } = await import("@/lib/discord-import/processor");
  return run(entryId, payload);
}

export async function queueDiscordImportMessage(payload: DiscordMessagePayload) {
  const existing = await prisma.discordImportEntry.findUnique({
    where: { messageId: payload.messageId },
  });
  if (existing) return existing;

  const entry = await prisma.discordImportEntry.create({
    data: {
      guildId: payload.guildId,
      channelId: payload.channelId,
      messageId: payload.messageId,
      importType: payload.importType,
      status: "PROCESSING",
      scanStatus: "PENDING",
      discordAuthorId: payload.authorId,
      discordAuthorName: payload.authorName,
      metadata: { queued: true, channelName: payload.channelName },
    },
  });

  await prisma.discordImportJob.create({
    data: {
      entryId: entry.id,
      payload: payload as object,
      status: "PENDING",
    },
  });

  void drainImportQueue();
  return entry;
}

export async function claimNextImportJob() {
  const job = await prisma.discordImportJob.findFirst({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
      attempts: { lt: 3 },
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (!job) return null;

  const updated = await prisma.discordImportJob.updateMany({
    where: { id: job.id, status: "PENDING" },
    data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (updated.count !== 1) return null;
  return job;
}

async function completeJob(jobId: string, status: DiscordImportJobStatus, error?: string) {
  await prisma.discordImportJob.update({
    where: { id: jobId },
    data: {
      status,
      lastError: error ?? null,
      completedAt: status === "COMPLETED" || status === "FAILED" ? new Date() : null,
    },
  });
}

export async function processNextImportJob(): Promise<boolean> {
  const job = await claimNextImportJob();
  if (!job) return false;

  try {
    await processDiscordImportEntry(job.entryId, job.payload as DiscordMessagePayload);
    await completeJob(job.id, "COMPLETED");
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import job failed";
    const attempts = job.attempts + 1;
    if (attempts >= job.maxAttempts) {
      await completeJob(job.id, "FAILED", message);
    } else {
      await prisma.discordImportJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          lastError: message,
          scheduledAt: new Date(Date.now() + attempts * 30_000),
        },
      });
    }
    return true;
  }
}

export async function drainImportQueue(maxJobs = 5) {
  if (processing) return;
  processing = true;
  try {
    for (let i = 0; i < maxJobs; i++) {
      const ran = await processNextImportJob();
      if (!ran) break;
    }
  } finally {
    processing = false;
  }
}

export function startImportQueuePoller(intervalMs = 3000) {
  setInterval(() => {
    void drainImportQueue().catch((err) => {
      console.error("[discord-import-queue]", err);
    });
  }, intervalMs);
}
