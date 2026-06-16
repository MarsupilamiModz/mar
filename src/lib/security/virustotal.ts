import { createHash } from "crypto";
import type { FileScanStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getMalwareScannerSettings } from "@/lib/malware-settings";
import { hashObjectFromR2, getObjectBufferFromR2 } from "@/lib/r2";
import { VIRUSTOTAL_UPLOAD_MAX_BYTES } from "@/lib/upload-limits";
import { consumeVtRequest } from "@/lib/security/quota";
import { computeRiskLevel, computeRiskScore } from "@/lib/security/status";

export type ScanResult = {
  status: FileScanStatus;
  sha256: string;
  md5: string;
  detections: number;
  totalEngines: number;
  report: Record<string, unknown>;
  engineResults: Record<string, unknown>;
  vtScanId?: string;
  vtPermalink?: string;
  riskLevel: ReturnType<typeof computeRiskLevel>;
  riskScore: number;
  blocked: boolean;
};

const CACHE_DAYS = 7;

function mapDetectionsToStatus(
  detections: number,
  threshold: number,
  requireManualReviewSuspicious: boolean
): FileScanStatus {
  if (detections === 0) return "CLEAN";
  if (detections >= threshold) return "MALWARE";
  if (requireManualReviewSuspicious) return "SUSPICIOUS";
  return "MANUAL_REVIEW";
}

async function vtFetch(apiKey: string, url: string, init?: RequestInit, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const allowed = await consumeVtRequest(init?.method === "POST");
    if (!allowed) {
      throw new Error("VirusTotal daily quota exceeded");
    }
    const res = await fetch(url, {
      ...init,
      headers: { "x-apikey": apiKey, ...init?.headers },
      cache: "no-store",
    });
    if (res.status === 429 && attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    return res;
  }
  throw new Error("VirusTotal rate limit exceeded");
}

async function queryVirusTotalHash(apiKey: string, sha256: string) {
  const res = await vtFetch(apiKey, `https://www.virustotal.com/api/v3/files/${sha256}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VirusTotal hash lookup failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    data: {
      id: string;
      links?: { self?: string };
      attributes: {
        md5?: string;
        last_analysis_stats: {
          malicious: number;
          suspicious: number;
          harmless: number;
          undetected: number;
        };
        last_analysis_results?: Record<string, unknown>;
        permalink?: string;
      };
    };
  }>;
}

async function uploadVirusTotalFile(apiKey: string, buffer: Buffer, fileName: string) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), fileName);
  const res = await vtFetch(apiKey, "https://www.virustotal.com/api/v3/files", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VirusTotal upload failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{ data: { id: string } }>;
}

async function pollVirusTotalAnalysis(apiKey: string, analysisId: string, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 3000 + i * 2000));
    const res = await vtFetch(apiKey, `https://www.virustotal.com/api/v3/analyses/${analysisId}`);
    if (!res.ok) continue;
    const json = (await res.json()) as {
      data: {
        attributes: {
          status: string;
          stats?: { malicious: number; suspicious: number; harmless: number; undetected: number };
        };
      };
    };
    if (json.data.attributes.status === "completed") return json;
  }
  return null;
}

function statsFromVt(stats: {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
}) {
  return {
    detections: stats.malicious + stats.suspicious,
    totalEngines: stats.malicious + stats.suspicious + stats.harmless + stats.undetected,
  };
}

function buildResult(input: {
  status: FileScanStatus;
  sha256: string;
  md5: string;
  detections: number;
  totalEngines: number;
  report: Record<string, unknown>;
  engineResults?: Record<string, unknown>;
  vtScanId?: string;
  vtPermalink?: string;
}): ScanResult {
  return {
    ...input,
    engineResults: input.engineResults ?? {},
    riskLevel: computeRiskLevel(input.detections, input.totalEngines),
    riskScore: computeRiskScore(input.detections, input.totalEngines),
    blocked: input.status === "MALWARE" || input.status === "REJECTED",
  };
}

async function getCachedScan(sha256: string): Promise<ScanResult | null> {
  const cached = await prisma.fileScan.findFirst({
    where: {
      sha256,
      cachedUntil: { gt: new Date() },
      status: { in: ["CLEAN", "SUSPICIOUS", "MALWARE", "MANUAL_REVIEW"] },
    },
    orderBy: { scannedAt: "desc" },
  });
  if (!cached) return null;
  return buildResult({
    status: cached.status,
    sha256: cached.sha256,
    md5: cached.md5 ?? "",
    detections: cached.detections,
    totalEngines: cached.totalEngines,
    report: { ...(cached.scanReport as Record<string, unknown>), source: "cache" },
    engineResults: (cached.engineResults as Record<string, unknown>) ?? {},
    vtScanId: cached.vtScanId ?? undefined,
    vtPermalink: cached.vtPermalink ?? undefined,
  });
}

async function scanByHash(
  apiKey: string,
  sha256: string,
  settings: Awaited<ReturnType<typeof getMalwareScannerSettings>>
): Promise<ScanResult | null> {
  const existing = await queryVirusTotalHash(apiKey, sha256);
  if (!existing) return null;
  const stats = existing.data.attributes.last_analysis_stats;
  const { detections, totalEngines } = statsFromVt(stats);
  const status = mapDetectionsToStatus(
    detections,
    settings.scanThreshold,
    settings.requireManualReviewSuspicious
  );
  return buildResult({
    status,
    sha256,
    md5: existing.data.attributes.md5 ?? "",
    detections,
    totalEngines,
    report: { source: "hash_lookup", stats },
    engineResults: existing.data.attributes.last_analysis_results ?? {},
    vtScanId: existing.data.id,
    vtPermalink:
      existing.data.attributes.permalink ??
      `https://www.virustotal.com/gui/file/${sha256}`,
  });
}

export async function scanFileBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const md5 = createHash("md5").update(buffer).digest("hex");
  const settings = await getMalwareScannerSettings();

  if (!settings.enabled) {
    return buildResult({
      status: "CLEAN",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { skipped: true, reason: "Scanner disabled" },
    });
  }

  const cached = await getCachedScan(sha256);
  if (cached) return cached;

  if (!settings.virusTotalApiKey) {
    return buildResult({
      status: "MANUAL_REVIEW",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { skipped: true, reason: "No VirusTotal API key configured" },
    });
  }

  try {
    const fromHash = await scanByHash(settings.virusTotalApiKey, sha256, settings);
    if (fromHash) return fromHash;

    if (buffer.length > VIRUSTOTAL_UPLOAD_MAX_BYTES) {
      return buildResult({
        status: "MANUAL_REVIEW",
        sha256,
        md5,
        detections: 0,
        totalEngines: 0,
        report: {
          source: "hash_pending",
          reason: "File exceeds VirusTotal upload limit; hash not in database yet",
        },
      });
    }

    const upload = await uploadVirusTotalFile(settings.virusTotalApiKey, buffer, fileName);
    const analysis = await pollVirusTotalAnalysis(settings.virusTotalApiKey, upload.data.id);
    if (analysis?.data.attributes.stats) {
      const stats = analysis.data.attributes.stats;
      const { detections, totalEngines } = statsFromVt(stats);
      const status = mapDetectionsToStatus(
        detections,
        settings.scanThreshold,
        settings.requireManualReviewSuspicious
      );
      return buildResult({
        status,
        sha256,
        md5,
        detections,
        totalEngines,
        report: { source: "upload_analysis", stats, analysisId: upload.data.id },
        vtScanId: upload.data.id,
        vtPermalink: `https://www.virustotal.com/gui/file/${sha256}`,
      });
    }

    return buildResult({
      status: "MANUAL_REVIEW",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { source: "upload_pending", analysisId: upload.data.id },
      vtScanId: upload.data.id,
    });
  } catch (err) {
    return buildResult({
      status: "MANUAL_REVIEW",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { error: err instanceof Error ? err.message : String(err), vtUnavailable: true },
    });
  }
}

export async function scanStoredObject(input: {
  r2Key: string;
  fileName: string;
  fileSize: number;
}): Promise<ScanResult> {
  const settings = await getMalwareScannerSettings();
  const { sha256, size } = await hashObjectFromR2(input.r2Key);
  const md5 = createHash("md5").update(sha256).digest("hex");

  if (!settings.enabled) {
    return buildResult({
      status: "CLEAN",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { skipped: true, reason: "Scanner disabled", bytesHashed: size },
    });
  }

  const cached = await getCachedScan(sha256);
  if (cached) {
    cached.report = { ...cached.report, bytesHashed: size, r2Key: input.r2Key };
    return cached;
  }

  if (!settings.virusTotalApiKey) {
    return buildResult({
      status: "MANUAL_REVIEW",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { skipped: true, reason: "No VirusTotal API key" },
    });
  }

  try {
    const fromHash = await scanByHash(settings.virusTotalApiKey, sha256, settings);
    if (fromHash) {
      fromHash.report = { ...fromHash.report, bytesHashed: size, r2Key: input.r2Key };
      return fromHash;
    }

    if (input.fileSize <= VIRUSTOTAL_UPLOAD_MAX_BYTES) {
      const buffer = await getObjectBufferFromR2(input.r2Key);
      const result = await scanFileBuffer(buffer, input.fileName);
      result.report = { ...result.report, bytesHashed: size, r2Key: input.r2Key };
      return result;
    }

    return buildResult({
      status: "MANUAL_REVIEW",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: {
        source: "large_file_hash_only",
        reason: "File >32MB and not in VirusTotal database — queued for manual review",
        fileSize: input.fileSize,
      },
    });
  } catch (err) {
    return buildResult({
      status: "MANUAL_REVIEW",
      sha256,
      md5,
      detections: 0,
      totalEngines: 0,
      report: { error: err instanceof Error ? err.message : String(err), vtUnavailable: true },
    });
  }
}

export async function persistScanResult(input: {
  modVersionId: string;
  fileKey: string;
  fileName: string;
  fileSize: bigint;
  result: ScanResult;
}) {
  const cachedUntil = new Date();
  cachedUntil.setDate(cachedUntil.getDate() + CACHE_DAYS);

  return prisma.fileScan.create({
    data: {
      modVersionId: input.modVersionId,
      fileKey: input.fileKey,
      fileName: input.fileName,
      fileSize: input.fileSize,
      sha256: input.result.sha256,
      md5: input.result.md5 || null,
      vtScanId: input.result.vtScanId,
      vtPermalink: input.result.vtPermalink,
      scannedAt: new Date(),
      status: input.result.status,
      riskLevel: input.result.riskLevel,
      riskScore: input.result.riskScore,
      detections: input.result.detections,
      totalEngines: input.result.totalEngines,
      engineResults: input.result.engineResults as object,
      scanReport: input.result.report as object,
      cachedUntil,
    },
  });
}

export function resolvePostScanModStatus(
  scanStatus: FileScanStatus,
  autoApproveClean: boolean
): "PUBLISHED" | "PENDING" | "REJECTED" | null {
  if (scanStatus === "MALWARE" || scanStatus === "REJECTED") return "REJECTED";
  if (scanStatus === "CLEAN" || scanStatus === "APPROVED") {
    return autoApproveClean ? null : null;
  }
  if (
    scanStatus === "SUSPICIOUS" ||
    scanStatus === "MANUAL_REVIEW" ||
    scanStatus === "FAILED" ||
    scanStatus === "PENDING" ||
    scanStatus === "SCANNING"
  ) {
    return "PENDING";
  }
  return null;
}
