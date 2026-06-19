import { prisma } from "@/lib/db";
import type { ScanQueueStatus } from "@prisma/client";

export async function getCreatorScanPriority(creatorProfileId?: string | null): Promise<number> {
  if (!creatorProfileId) return 0;
  const trust = await prisma.trustedCreator.findUnique({
    where: { creatorProfileId },
    select: { trustLevel: true, priorityScan: true, fastTrack: true },
  });
  if (!trust) return 0;
  if (trust.trustLevel === "ELITE" || trust.fastTrack) return 100;
  if (trust.trustLevel === "TRUSTED" || trust.priorityScan) return 50;
  if (trust.trustLevel === "VERIFIED") return 25;
  return 0;
}

export async function enqueueScan(input: {
  modVersionId: string;
  modId: string;
  fileKey: string;
  fileName: string;
  fileSize: bigint;
  sha256?: string;
  priority?: number;
}) {
  const existing = await prisma.scanQueue.findFirst({
    where: {
      modVersionId: input.modVersionId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existing) return existing;

  return prisma.scanQueue.create({
    data: {
      modVersionId: input.modVersionId,
      modId: input.modId,
      fileKey: input.fileKey,
      fileName: input.fileName,
      fileSize: input.fileSize,
      sha256: input.sha256,
      priority: input.priority ?? 0,
      status: "PENDING",
      scheduledAt: new Date(),
    },
  });
}

export async function claimNextScanJobs(limit = 3) {
  const jobs = await prisma.scanQueue.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
    },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    take: limit * 2,
  });

  const _eligible = jobs.filter((j) => j.attempts < j.maxAttempts).slice(0, limit);

  const claimed = [];
  for (const job of jobs) {
    const updated = await prisma.scanQueue.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (updated.count === 1) claimed.push(job);
  }
  return claimed;
}

export async function completeScanJob(
  jobId: string,
  status: ScanQueueStatus,
  error?: string
) {
  return prisma.scanQueue.update({
    where: { id: jobId },
    data: {
      status,
      completedAt: new Date(),
      lastError: error,
    },
  });
}

export async function retryScanJob(jobId: string, error: string, delayMs = 60_000) {
  const job = await prisma.scanQueue.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.attempts >= job.maxAttempts) {
    await completeScanJob(jobId, "FAILED", error);
    if (job.modVersionId) {
      await prisma.modVersion.update({
        where: { id: job.modVersionId },
        data: { scanStatus: "MANUAL_REVIEW" },
      });
    }
    return;
  }

  await prisma.scanQueue.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      lastError: error,
      scheduledAt: new Date(Date.now() + delayMs),
    },
  });
}

export async function recoverStuckScans(maxAgeMinutes = 15) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const stuckVersions = await prisma.modVersion.findMany({
    where: { scanStatus: "SCANNING", scannedAt: { lt: cutoff } },
    select: { id: true },
    take: 50,
  });
  if (stuckVersions.length === 0) return 0;

  await prisma.modVersion.updateMany({
    where: { id: { in: stuckVersions.map((v) => v.id) } },
    data: { scanStatus: "MANUAL_REVIEW" },
  });
  return stuckVersions.length;
}
