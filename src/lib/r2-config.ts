import { STORAGE } from "@/lib/storage";

export type R2ConfigStatus = {
  configured: boolean;
  missing: string[];
  bucket: string;
  endpoint: string | null;
  publicUrl: string | null;
};

export function getR2Endpoint(): string {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error("Cloudflare R2 is not configured: missing R2_ACCOUNT_ID");
  }
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function getR2ConfigStatus(): R2ConfigStatus {
  const missing: string[] = [];
  if (!process.env.R2_ACCOUNT_ID?.trim()) missing.push("R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID?.trim()) missing.push("R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY?.trim()) missing.push("R2_SECRET_ACCESS_KEY");
  if (!process.env.R2_BUCKET_NAME?.trim() && !STORAGE.bucket) missing.push("R2_BUCKET_NAME");

  return {
    configured: missing.length === 0,
    missing,
    bucket: STORAGE.bucket,
    endpoint: process.env.R2_ACCOUNT_ID?.trim()
      ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
      : null,
    publicUrl: process.env.R2_PUBLIC_URL?.trim() ?? null,
  };
}

export function assertR2Configured(): void {
  const status = getR2ConfigStatus();
  if (!status.configured) {
    throw new Error(
      `Cloudflare R2 storage is not configured. Missing: ${status.missing.join(", ")}`
    );
  }
}

/** Recommended CORS rules for browser direct-to-R2 multipart uploads. */
export function getRecommendedR2CorsRules(appOrigins: string[]) {
  return [
    {
      AllowedOrigins: appOrigins.filter(Boolean),
      AllowedMethods: ["GET", "PUT", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ];
}

export function logUploadServer(event: string, detail?: Record<string, unknown>) {
  console.info("[upload:server]", { ts: new Date().toISOString(), event, ...detail });
}
