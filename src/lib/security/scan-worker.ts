import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getMalwareScannerSettings } from "@/lib/malware-settings";
import { isScannableFileName } from "@/lib/malware-settings";
import { fileSizeBigInt } from "@/lib/file-size";
import {
  scanStoredObject,
  persistScanResult,
  resolvePostScanModStatus,
} from "@/lib/security/virustotal";
import {
  claimNextScanJobs,
  completeScanJob,
  retryScanJob,
  recoverStuckScans,
} from "@/lib/security/scan-queue";
import { logSecurityEvent } from "@/lib/security/audit";

async function applyScanToVersion(
  modVersionId: string,
  modId: string,
  fileKey: string,
  fileName: string,
  fileSize: number,
  scanResult: Awaited<ReturnType<typeof scanStoredObject>>
) {
  const settings = await getMalwareScannerSettings();
  const modStatusOverride = resolvePostScanModStatus(scanResult.status, settings.autoApproveClean);
  const makePrimary = scanResult.status === "CLEAN" || scanResult.status === "APPROVED";

  const version = await prisma.modVersion.findUnique({
    where: { id: modVersionId },
    include: { mod: { select: { slug: true } } },
  });
  if (!version) return;

  await prisma.$transaction(async (tx) => {
    if (makePrimary && version.channel !== "ARCHIVED") {
      await tx.modVersion.updateMany({
        where: { modId: version.modId, isPrimary: true, id: { not: modVersionId } },
        data: { isPrimary: false },
      });
    }

    await tx.modVersion.update({
      where: { id: modVersionId },
      data: {
        sha256: scanResult.sha256,
        scanStatus: scanResult.status,
        scanReport: scanResult.report as Prisma.InputJsonValue,
        scannedAt: new Date(),
        isPrimary: makePrimary ? true : version.isPrimary,
      },
    });

    await tx.fileScanLog.create({
      data: {
        modVersionId,
        modId,
        fileName,
        fileSize: fileSizeBigInt(fileSize),
        sha256: scanResult.sha256,
        status: scanResult.status,
        detections: scanResult.detections,
        totalEngines: scanResult.totalEngines,
        report: scanResult.report as Prisma.InputJsonValue,
        blocked: scanResult.blocked,
      },
    });

    if (modStatusOverride) {
      await tx.mod.update({
        where: { id: modId },
        data: { status: modStatusOverride },
      });
    } else if (scanResult.status === "CLEAN" || scanResult.status === "APPROVED") {
      await tx.mod.update({
        where: { id: modId },
        data: { status: "PUBLISHED" },
      });
    }
  });

  await persistScanResult({
    modVersionId,
    fileKey,
    fileName,
    fileSize: fileSizeBigInt(fileSize),
    result: scanResult,
  });

  await logSecurityEvent({
    action: "SCAN_COMPLETED",
    modVersionId,
    modId,
    metadata: {
      status: scanResult.status,
      detections: scanResult.detections,
      sha256: scanResult.sha256,
    },
  });
}

export async function processScanQueue(batchSize = 3) {
  await recoverStuckScans();

  const jobs = await claimNextScanJobs(batchSize);
  const results: { jobId: string; ok: boolean; error?: string }[] = [];

  for (const job of jobs) {
    if (!job.modVersionId) {
      await completeScanJob(job.id, "FAILED", "Missing modVersionId");
      results.push({ jobId: job.id, ok: false, error: "Missing modVersionId" });
      continue;
    }

    try {
      await prisma.modVersion.update({
        where: { id: job.modVersionId },
        data: { scanStatus: "SCANNING" },
      });

      await logSecurityEvent({
        action: "SCAN_STARTED",
        modVersionId: job.modVersionId,
        modId: job.modId ?? undefined,
        metadata: { queueId: job.id },
      });

      const fileSize = Number(job.fileSize);
      let scanResult;

      if (isScannableFileName(job.fileName)) {
        scanResult = await scanStoredObject({
          r2Key: job.fileKey,
          fileName: job.fileName,
          fileSize,
        });
      } else {
        scanResult = {
          status: "MANUAL_REVIEW" as const,
          sha256: job.sha256 ?? "",
          md5: "",
          detections: 0,
          totalEngines: 0,
          report: { reason: "Unsupported extension for automated scan" },
          engineResults: {},
          riskLevel: "NONE" as const,
          riskScore: 0,
          blocked: false,
        };
      }

      await applyScanToVersion(
        job.modVersionId,
        job.modId ?? "",
        job.fileKey,
        job.fileName,
        fileSize,
        scanResult
      );

      await completeScanJob(job.id, "COMPLETED");
      results.push({ jobId: job.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await retryScanJob(job.id, message);
      results.push({ jobId: job.id, ok: false, error: message });
    }
  }

  return { processed: results.length, results };
}

export async function scheduleRescanStaleFiles(olderThanDays = 30, limit = 20) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const versions = await prisma.modVersion.findMany({
    where: {
      isArchived: false,
      isPrimary: true,
      scanStatus: { in: ["CLEAN", "APPROVED"] },
      OR: [{ scannedAt: { lt: cutoff } }, { scannedAt: null }],
    },
    include: {
      mod: {
        select: {
          author: { select: { creatorProfile: { select: { id: true } } } },
        },
      },
    },
    take: limit,
  });

  let queued = 0;
  for (const v of versions) {
    const priority = v.mod.author.creatorProfile?.id ? 10 : 0;
    const { enqueueScan } = await import("@/lib/security/scan-queue");
    await enqueueScan({
      modVersionId: v.id,
      modId: v.modId,
      fileKey: v.fileKey,
      fileName: v.fileName,
      fileSize: v.fileSize,
      sha256: v.sha256 ?? undefined,
      priority,
    });
    queued++;
    await logSecurityEvent({
      action: "RE_SCAN",
      modVersionId: v.id,
      modId: v.modId,
      metadata: { scheduled: true, reason: "30_day_rescan" },
    });
  }
  return queued;
}
