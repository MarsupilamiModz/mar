"use server";

import { revalidatePath } from "next/cache";
import type { FileScanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission, requireActionUser } from "@/lib/action-utils";
import {
  getMalwareScannerSettings,
  saveMalwareScannerSettings,
  type MalwareScannerSettings,
} from "@/lib/malware-settings";
import { getVirusTotalQuota } from "@/lib/security/quota";
import { logSecurityEvent } from "@/lib/security/audit";
import { enqueueScan } from "@/lib/security/scan-queue";
import { isDownloadAllowed } from "@/lib/security/status";

export async function getMalwareSettingsAdmin() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const settings = await getMalwareScannerSettings();
  return ok({
    ...settings,
    virusTotalApiKey: settings.virusTotalApiKey ? "••••••••" : "",
    hasKey: Boolean(settings.virusTotalApiKey),
  });
}

export async function updateMalwareSettingsAdmin(
  data: Partial<MalwareScannerSettings> & { virusTotalApiKey?: string }
) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const current = await getMalwareScannerSettings();
  const next: MalwareScannerSettings = {
    ...current,
    scanThreshold: data.scanThreshold ?? current.scanThreshold,
    autoApproveClean: data.autoApproveClean ?? current.autoApproveClean,
    requireManualReviewSuspicious:
      data.requireManualReviewSuspicious ?? current.requireManualReviewSuspicious,
    enabled: data.enabled ?? current.enabled,
    virusTotalApiKey:
      data.virusTotalApiKey && !data.virusTotalApiKey.startsWith("••")
        ? data.virusTotalApiKey
        : current.virusTotalApiKey,
  };

  await saveMalwareScannerSettings(next);
  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function getSecurityDashboardStats() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    total,
    clean,
    suspicious,
    malware,
    blocked,
    pendingReviews,
    approved,
    rejected,
    failedScans,
    recent,
    pendingApprovals,
    quota,
    auditRecent,
  ] = await Promise.all([
    prisma.fileScanLog.count(),
    prisma.fileScanLog.count({ where: { status: { in: ["CLEAN", "APPROVED"] } } }),
    prisma.fileScanLog.count({
      where: { status: { in: ["SUSPICIOUS", "MANUAL_REVIEW"] } },
    }),
    prisma.fileScanLog.count({ where: { status: "MALWARE" } }),
    prisma.fileScanLog.count({ where: { blocked: true } }),
    prisma.modVersion.count({
      where: { scanStatus: { in: ["MANUAL_REVIEW", "SUSPICIOUS", "PENDING", "SCANNING"] } },
    }),
    prisma.modVersion.count({ where: { scanStatus: "APPROVED" } }),
    prisma.modVersion.count({ where: { scanStatus: { in: ["REJECTED", "MALWARE"] } } }),
    prisma.scanQueue.count({ where: { status: "FAILED" } }),
    prisma.fileScanLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        modVersion: {
          select: {
            id: true,
            version: true,
            mod: { select: { slug: true, title: true } },
          },
        },
      },
    }),
    prisma.modVersion.findMany({
      where: { scanStatus: { in: ["MANUAL_REVIEW", "SUSPICIOUS", "FAILED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        mod: { select: { id: true, slug: true, title: true } },
        trustedFile: true,
        fileScans: { orderBy: { scannedAt: "desc" }, take: 1 },
      },
    }),
    getVirusTotalQuota(),
    prisma.securityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { user: { select: { username: true, displayName: true } } },
    }),
  ]);

  const scannedToday = await prisma.fileScanLog.count({
    where: { createdAt: { gte: todayStart } },
  });

  return ok({
    total,
    clean,
    suspicious,
    malware,
    blocked,
    pendingReviews,
    approved,
    rejected,
    failedScans,
    scannedToday,
    quota,
    recent,
    pendingApprovals,
    auditRecent,
  });
}

async function approveVersionInternal(
  versionId: string,
  adminId: string,
  options?: { reason?: string; notes?: string; markTrusted?: boolean }
) {
  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true, trustedFile: true },
  });
  if (!version) return fail("Version not found");
  if (version.scanStatus === "MALWARE") return fail("Cannot approve malware");

  await prisma.$transaction(async (tx) => {
    await tx.modVersion.updateMany({
      where: { modId: version.modId, isPrimary: true },
      data: { isPrimary: false },
    });
    await tx.modVersion.update({
      where: { id: versionId },
      data: { isPrimary: true, scanStatus: "APPROVED", scannedAt: new Date() },
    });
    await tx.mod.update({
      where: { id: version.modId },
      data: { status: "PUBLISHED" },
    });
    await tx.securityReview.create({
      data: {
        modVersionId: versionId,
        status: "approved",
        approvedById: adminId,
        approvedAt: new Date(),
        reason: options?.reason ?? "Manual admin approval",
        notes: options?.notes,
        isTrusted: options?.markTrusted ?? false,
      },
    });
    if (options?.markTrusted && !version.trustedFile) {
      await tx.trustedFile.create({
        data: {
          modVersionId: versionId,
          approvedById: adminId,
          reason: options?.reason ?? "Marked trusted by security team",
          notes: options?.notes,
        },
      });
    }
  });

  await logSecurityEvent({
    action: "APPROVAL",
    modVersionId: versionId,
    modId: version.modId,
    userId: adminId,
    metadata: { reason: options?.reason, trusted: options?.markTrusted },
  });

  revalidatePath(`/mods/${version.mod.slug}`);
  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function approveScannedVersion(
  versionId: string,
  reason?: string,
  notes?: string
) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;
  return approveVersionInternal(versionId, user!.id, { reason, notes });
}

export async function markVersionTrusted(versionId: string, reason?: string, notes?: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;
  return approveVersionInternal(versionId, user!.id, {
    reason: reason ?? "Trusted by XUMARI MODZ Security Team",
    notes,
    markTrusted: true,
  });
}

export async function rejectScannedVersion(versionId: string, reason?: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");

  await prisma.$transaction([
    prisma.modVersion.update({
      where: { id: versionId },
      data: { scanStatus: "REJECTED", isPrimary: false, isArchived: true },
    }),
    prisma.mod.update({
      where: { id: version.modId },
      data: { status: "REJECTED" },
    }),
    prisma.securityReview.create({
      data: {
        modVersionId: versionId,
        status: "rejected",
        approvedById: user!.id,
        approvedAt: new Date(),
        reason: reason ?? "Rejected by admin",
      },
    }),
  ]);

  await logSecurityEvent({
    action: "REJECTION",
    modVersionId: versionId,
    modId: version.modId,
    userId: user!.id,
    metadata: { reason },
  });

  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function requestVersionReview(versionId: string, notes?: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  const version = await prisma.modVersion.findUnique({ where: { id: versionId } });
  if (!version) return fail("Version not found");

  await prisma.$transaction([
    prisma.modVersion.update({
      where: { id: versionId },
      data: { scanStatus: "MANUAL_REVIEW" },
    }),
    prisma.securityReview.create({
      data: {
        modVersionId: versionId,
        status: "review_requested",
        approvedById: user!.id,
        notes,
      },
    }),
  ]);

  await logSecurityEvent({
    action: "REVIEW_REQUESTED",
    modVersionId: versionId,
    modId: version.modId,
    userId: user!.id,
    metadata: { notes },
  });

  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function reprocessVersionScan(versionId: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");

  await prisma.modVersion.update({
    where: { id: versionId },
    data: { scanStatus: "PENDING" },
  });

  await enqueueScan({
    modVersionId: versionId,
    modId: version.modId,
    fileKey: version.fileKey,
    fileName: version.fileName,
    fileSize: version.fileSize,
    sha256: version.sha256 ?? undefined,
    priority: 75,
  });

  await logSecurityEvent({
    action: "RE_SCAN",
    modVersionId: versionId,
    modId: version.modId,
    userId: user!.id,
  });

  void import("@/lib/security/scan-worker").then(({ processScanQueue }) =>
    processScanQueue(1).catch(console.error)
  );

  revalidatePath("/admin/security");
  return ok({ scanStatus: "PENDING" as FileScanStatus });
}

export async function removeVersionScan(versionId: string) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  await prisma.$transaction([
    prisma.scanQueue.deleteMany({ where: { modVersionId: versionId } }),
    prisma.modVersion.update({
      where: { id: versionId },
      data: {
        scanStatus: "MANUAL_REVIEW",
        scanReport: { scanRemoved: true } as Prisma.InputJsonValue,
      },
    }),
  ]);

  await logSecurityEvent({
    action: "SCAN_REMOVED",
    modVersionId: versionId,
    userId: user!.id,
  });

  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function bulkApproveVersions(versionIds: string[]) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  for (const id of versionIds) {
    await approveVersionInternal(id, user!.id, { reason: "Bulk approval" });
  }

  await logSecurityEvent({
    action: "BULK_APPROVE",
    userId: user!.id,
    metadata: { count: versionIds.length, versionIds },
  });

  return ok({ count: versionIds.length });
}

export async function bulkRejectVersions(versionIds: string[]) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  for (const id of versionIds) {
    await rejectScannedVersion(id, "Bulk rejection");
  }

  await logSecurityEvent({
    action: "BULK_REJECT",
    userId: user!.id,
    metadata: { count: versionIds.length, versionIds },
  });

  return ok({ count: versionIds.length });
}

export async function exportSecurityReport() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const [logs, scans, reviews] = await Promise.all([
    prisma.securityLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.fileScan.findMany({ orderBy: { scannedAt: "desc" }, take: 500 }),
    prisma.securityReview.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  return ok({
    exportedAt: new Date().toISOString(),
    logs,
    scans,
    reviews,
  });
}

export async function getModSecurityInfo(modId: string) {
  const version = await prisma.modVersion.findFirst({
    where: { modId, isPrimary: true, isArchived: false },
    include: {
      trustedFile: { include: { approvedBy: { select: { displayName: true, username: true } } } },
      fileScans: { orderBy: { scannedAt: "desc" }, take: 1 },
    },
  });
  if (!version) return null;

  return {
    scanStatus: version.scanStatus,
    scannedAt: version.scannedAt,
    sha256: version.sha256,
    isTrusted: !!version.trustedFile,
    isDownloadable: isDownloadAllowed(version.scanStatus),
    trustedFile: version.trustedFile,
    lastScan: version.fileScans[0] ?? null,
  };
}

export async function updateCreatorTrustLevel(
  creatorProfileId: string,
  trustLevel: "NEW" | "VERIFIED" | "TRUSTED" | "ELITE",
  notes?: string
) {
  const { user, error } = await requireActionPermission("mods.write");
  if (error) return error;

  await prisma.trustedCreator.upsert({
    where: { creatorProfileId },
    create: {
      creatorProfileId,
      trustLevel,
      approvedById: user!.id,
      approvedAt: new Date(),
      notes,
      priorityScan: trustLevel === "TRUSTED" || trustLevel === "ELITE",
      fastTrack: trustLevel === "ELITE",
    },
    update: {
      trustLevel,
      approvedById: user!.id,
      approvedAt: new Date(),
      notes,
      priorityScan: trustLevel === "TRUSTED" || trustLevel === "ELITE",
      fastTrack: trustLevel === "ELITE",
    },
  });

  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function triggerScanWorker() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const { processScanQueue } = await import("@/lib/security/scan-worker");
  const result = await processScanQueue(5);
  return ok(result);
}
