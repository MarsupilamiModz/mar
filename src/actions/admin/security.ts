"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import {
  getMalwareScannerSettings,
  saveMalwareScannerSettings,
  type MalwareScannerSettings,
} from "@/lib/malware-settings";

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

export async function updateMalwareSettingsAdmin(data: Partial<MalwareScannerSettings> & { virusTotalApiKey?: string }) {
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

  const [total, clean, suspicious, malware, blocked, recent] = await Promise.all([
    prisma.fileScanLog.count(),
    prisma.fileScanLog.count({ where: { status: "CLEAN" } }),
    prisma.fileScanLog.count({ where: { status: { in: ["SUSPICIOUS", "MANUAL_REVIEW"] } } }),
    prisma.fileScanLog.count({ where: { status: "MALWARE" } }),
    prisma.fileScanLog.count({ where: { blocked: true } }),
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
  ]);

  return ok({ total, clean, suspicious, malware, blocked, recent });
}

export async function approveScannedVersion(versionId: string) {
  const { error } = await requireActionPermission("mods.write");
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");
  if (version.scanStatus === "MALWARE") return fail("Cannot approve malware");

  await prisma.$transaction([
    prisma.modVersion.updateMany({
      where: { modId: version.modId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.modVersion.update({
      where: { id: versionId },
      data: { isPrimary: true, scanStatus: "CLEAN" },
    }),
    prisma.mod.update({
      where: { id: version.modId },
      data: { status: "PUBLISHED" },
    }),
  ]);

  revalidatePath(`/mods/${version.mod.slug}`);
  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function rejectScannedVersion(versionId: string) {
  const { error } = await requireActionPermission("mods.write");
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");

  await prisma.$transaction([
    prisma.modVersion.update({
      where: { id: versionId },
      data: { scanStatus: "MALWARE", isPrimary: false, isArchived: true },
    }),
    prisma.mod.update({
      where: { id: version.modId },
      data: { status: "REJECTED" },
    }),
  ]);

  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function reprocessVersionScan(versionId: string) {
  const { error } = await requireActionPermission("mods.write");
  if (error) return error;

  const version = await prisma.modVersion.findUnique({
    where: { id: versionId },
    include: { mod: true },
  });
  if (!version) return fail("Version not found");

  const { scanStoredObject } = await import("@/lib/malware-scanner");
  const { fileSizeNumber, fileSizeBigInt } = await import("@/lib/file-size");

  const fileSize = fileSizeNumber(version.fileSize);
  const scanResult = await scanStoredObject({
    r2Key: version.fileKey,
    fileName: version.fileName,
    fileSize,
  });

  await prisma.$transaction([
    prisma.modVersion.update({
      where: { id: versionId },
      data: {
        sha256: scanResult.sha256,
        scanStatus: scanResult.status,
        scanReport: scanResult.report as object,
        scannedAt: new Date(),
      },
    }),
    prisma.fileScanLog.create({
      data: {
        modVersionId: versionId,
        modId: version.modId,
        fileName: version.fileName,
        fileSize: fileSizeBigInt(fileSize),
        sha256: scanResult.sha256,
        status: scanResult.status,
        detections: scanResult.detections,
        totalEngines: scanResult.totalEngines,
        report: scanResult.report as object,
        blocked: scanResult.blocked,
      },
    }),
  ]);

  revalidatePath("/admin/security");
  return ok({ scanStatus: scanResult.status });
}
