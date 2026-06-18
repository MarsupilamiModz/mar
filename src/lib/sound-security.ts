import type { FileScanStatus, SoundApprovalStatus } from "@prisma/client";

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
