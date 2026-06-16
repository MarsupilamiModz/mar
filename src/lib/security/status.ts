import type { FileScanStatus, SecurityRiskLevel } from "@prisma/client";

/** Statuses that allow public download. */
export const DOWNLOADABLE_SCAN_STATUSES: FileScanStatus[] = ["CLEAN", "APPROVED"];

export const BLOCKED_DOWNLOAD_STATUSES: FileScanStatus[] = [
  "PENDING",
  "SCANNING",
  "SUSPICIOUS",
  "MALWARE",
  "REJECTED",
  "MANUAL_REVIEW",
  "FAILED",
];

export function isDownloadAllowed(scanStatus: FileScanStatus): boolean {
  return DOWNLOADABLE_SCAN_STATUSES.includes(scanStatus);
}

export function isSecurityVerified(scanStatus: FileScanStatus, isTrusted = false): boolean {
  return isDownloadAllowed(scanStatus) || isTrusted;
}

export type SecurityBadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

export type SecurityBadgeKey =
  | "verifiedClean"
  | "manuallyApproved"
  | "manualReview"
  | "malwareDetected"
  | "pendingScan"
  | "scanning"
  | "suspicious"
  | "rejected"
  | "securityChecked"
  | "approved"
  | "verifiedSafeDownload"
  | "virusTotalPassed"
  | "manuallyVerified"
  | "safeDownload"
  | "secureStorage"
  | "trustedByTeam";

export function getSecurityBadgeKey(
  scanStatus: FileScanStatus,
  isTrusted = false
): SecurityBadgeKey {
  if (isTrusted && isDownloadAllowed(scanStatus)) return "trustedByTeam";
  switch (scanStatus) {
    case "CLEAN":
      return "verifiedClean";
    case "APPROVED":
      return "manuallyApproved";
    case "MANUAL_REVIEW":
      return "manualReview";
    case "MALWARE":
      return "malwareDetected";
    case "PENDING":
      return "pendingScan";
    case "SCANNING":
      return "scanning";
    case "SUSPICIOUS":
      return "suspicious";
    case "REJECTED":
      return "rejected";
    default:
      return "manualReview";
  }
}

export function getSecurityBadgeVariant(scanStatus: FileScanStatus): SecurityBadgeVariant {
  if (isDownloadAllowed(scanStatus)) return "success";
  if (scanStatus === "SCANNING" || scanStatus === "PENDING") return "info";
  if (scanStatus === "SUSPICIOUS" || scanStatus === "MANUAL_REVIEW" || scanStatus === "FAILED") {
    return "warning";
  }
  return "danger";
}

export function computeRiskLevel(detections: number, totalEngines: number): SecurityRiskLevel {
  if (detections === 0) return "NONE";
  const ratio = totalEngines > 0 ? detections / totalEngines : 1;
  if (detections >= 5 || ratio >= 0.25) return "CRITICAL";
  if (detections >= 3 || ratio >= 0.15) return "HIGH";
  if (detections >= 2 || ratio >= 0.08) return "MEDIUM";
  return "LOW";
}

export function computeRiskScore(detections: number, totalEngines: number): number {
  if (detections === 0) return 0;
  const ratio = totalEngines > 0 ? detections / totalEngines : 0.5;
  return Math.min(100, Math.round(detections * 12 + ratio * 40));
}

export function getPublicSecurityLevel(
  scanStatus: FileScanStatus,
  isTrusted: boolean
): SecurityBadgeKey {
  if (isTrusted && scanStatus === "APPROVED") return "manuallyApproved";
  if (scanStatus === "APPROVED") return "verifiedSafeDownload";
  if (scanStatus === "CLEAN") return "verifiedClean";
  if (scanStatus === "SCANNING" || scanStatus === "PENDING") return "pendingScan";
  if (scanStatus === "MANUAL_REVIEW") return "manualReview";
  if (scanStatus === "MALWARE") return "malwareDetected";
  return "manualReview";
}
