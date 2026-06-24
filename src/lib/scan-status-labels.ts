import type { FileScanStatus } from "@prisma/client";

const LABELS: Record<FileScanStatus, string> = {
  PENDING: "Pending",
  SCANNING: "VirusTotal scan running",
  CLEAN: "Clean",
  APPROVED: "Manually reviewed and approved",
  SUSPICIOUS: "Suspicious",
  MALWARE: "Malware detected",
  REJECTED: "Rejected",
  MANUAL_REVIEW: "Awaiting manual review",
  FAILED: "Scan failed",
};

export function scanStatusLabel(status: FileScanStatus | string | null | undefined): string {
  if (!status) return "Pending";
  return LABELS[status as FileScanStatus] ?? String(status);
}

export function scanStatusVariant(
  status: FileScanStatus | string | null | undefined
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "CLEAN":
    case "APPROVED":
      return "default";
    case "SCANNING":
    case "PENDING":
    case "MANUAL_REVIEW":
      return "secondary";
    case "SUSPICIOUS":
    case "FAILED":
      return "outline";
    case "MALWARE":
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
}
