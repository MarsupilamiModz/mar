import type { FileScanStatus, ModStatus, SoundApprovalStatus } from "@prisma/client";

export function canStreamSoundPreview(profile: {
  previewFileKey: string | null;
  approvalStatus: SoundApprovalStatus;
  previewScanStatus: FileScanStatus;
}, modStatus: ModStatus | string): boolean {
  if (modStatus !== "PUBLISHED") return false;
  if (!profile.previewFileKey) return false;
  if (profile.approvalStatus === "REJECTED") return false;
  if (profile.previewScanStatus === "MALWARE" || profile.previewScanStatus === "REJECTED") {
    return false;
  }
  if (profile.approvalStatus === "MANUALLY_APPROVED" || profile.approvalStatus === "VIRUS_TOTAL_VERIFIED") {
    return true;
  }
  // Published sounds remain playable while review is pending (unless flagged malware/rejected).
  return true;
}

export function resolveSoundScanStatus(profile: {
  approvalStatus: SoundApprovalStatus;
  previewScanStatus: FileScanStatus;
}): FileScanStatus {
  if (profile.approvalStatus === "MANUALLY_APPROVED" || profile.approvalStatus === "VIRUS_TOTAL_VERIFIED") {
    return "APPROVED";
  }
  if (profile.approvalStatus === "REJECTED") return "REJECTED";
  if (profile.previewScanStatus === "SCANNING") return "SCANNING";
  if (profile.previewScanStatus === "CLEAN" || profile.previewScanStatus === "APPROVED") {
    return profile.previewScanStatus;
  }
  return profile.previewScanStatus;
}

export function estimateBitrateKbps(fileSizeBytes: bigint | number | null, durationSeconds: number | null): number | null {
  if (!fileSizeBytes || !durationSeconds || durationSeconds <= 0) return null;
  const bytes = typeof fileSizeBytes === "bigint" ? Number(fileSizeBytes) : fileSizeBytes;
  return Math.round((bytes * 8) / durationSeconds / 1000);
}

export function formatFileSize(bytes: bigint | number | null): string {
  if (!bytes) return "—";
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolveStreamContentType(
  previewMimeType: string | null | undefined,
  previewFileName: string,
  mimeFromFileName: (name: string) => string
): string {
  const fromDb = previewMimeType?.trim();
  if (fromDb && fromDb.startsWith("audio/") && fromDb !== "application/octet-stream") {
    return fromDb;
  }
  const fromName = mimeFromFileName(previewFileName);
  return fromName.startsWith("audio/") ? fromName : "audio/mpeg";
}
