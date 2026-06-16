-- Extend FileScanStatus enum
ALTER TYPE "FileScanStatus" ADD VALUE IF NOT EXISTS 'SCANNING';
ALTER TYPE "FileScanStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "FileScanStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- New enums
CREATE TYPE "SecurityRiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ScanQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "SecurityAuditAction" AS ENUM (
  'UPLOAD', 'SCAN_STARTED', 'SCAN_COMPLETED', 'APPROVAL', 'REJECTION',
  'DOWNLOAD', 'RE_SCAN', 'TRUST_MARKED', 'REVIEW_REQUESTED', 'SCAN_REMOVED',
  'BULK_APPROVE', 'BULK_REJECT'
);
CREATE TYPE "CreatorTrustLevel" AS ENUM ('NEW', 'VERIFIED', 'TRUSTED', 'ELITE');

-- ModVersion index for rescan schedule
CREATE INDEX IF NOT EXISTS "ModVersion_scannedAt_idx" ON "ModVersion"("scannedAt");

-- file_scans
CREATE TABLE "file_scans" (
  "id" TEXT NOT NULL,
  "modVersionId" TEXT,
  "fileKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "md5" TEXT,
  "vtScanId" TEXT,
  "vtPermalink" TEXT,
  "scannedAt" TIMESTAMP(3),
  "status" "FileScanStatus" NOT NULL,
  "riskLevel" "SecurityRiskLevel" NOT NULL DEFAULT 'NONE',
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "detections" INTEGER NOT NULL DEFAULT 0,
  "totalEngines" INTEGER NOT NULL DEFAULT 0,
  "engineResults" JSONB,
  "scanReport" JSONB,
  "cachedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "file_scans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "file_scans_sha256_idx" ON "file_scans"("sha256");
CREATE INDEX "file_scans_modVersionId_idx" ON "file_scans"("modVersionId");
CREATE INDEX "file_scans_status_scannedAt_idx" ON "file_scans"("status", "scannedAt");
ALTER TABLE "file_scans" ADD CONSTRAINT "file_scans_modVersionId_fkey"
  FOREIGN KEY ("modVersionId") REFERENCES "ModVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- security_reviews
CREATE TABLE "security_reviews" (
  "id" TEXT NOT NULL,
  "modVersionId" TEXT NOT NULL,
  "fileScanId" TEXT,
  "status" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "reason" TEXT,
  "notes" TEXT,
  "isTrusted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "security_reviews_modVersionId_idx" ON "security_reviews"("modVersionId");
CREATE INDEX "security_reviews_status_idx" ON "security_reviews"("status");
ALTER TABLE "security_reviews" ADD CONSTRAINT "security_reviews_modVersionId_fkey"
  FOREIGN KEY ("modVersionId") REFERENCES "ModVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_reviews" ADD CONSTRAINT "security_reviews_fileScanId_fkey"
  FOREIGN KEY ("fileScanId") REFERENCES "file_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "security_reviews" ADD CONSTRAINT "security_reviews_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- security_logs
CREATE TABLE "security_logs" (
  "id" TEXT NOT NULL,
  "modVersionId" TEXT,
  "modId" TEXT,
  "userId" TEXT,
  "action" "SecurityAuditAction" NOT NULL,
  "ipHash" TEXT,
  "userAgent" VARCHAR(512),
  "deviceInfo" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "security_logs_action_createdAt_idx" ON "security_logs"("action", "createdAt");
CREATE INDEX "security_logs_modVersionId_idx" ON "security_logs"("modVersionId");
CREATE INDEX "security_logs_modId_idx" ON "security_logs"("modId");
CREATE INDEX "security_logs_userId_idx" ON "security_logs"("userId");
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- trusted_files
CREATE TABLE "trusted_files" (
  "id" TEXT NOT NULL,
  "modVersionId" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "notes" TEXT,
  CONSTRAINT "trusted_files_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trusted_files_modVersionId_key" ON "trusted_files"("modVersionId");
ALTER TABLE "trusted_files" ADD CONSTRAINT "trusted_files_modVersionId_fkey"
  FOREIGN KEY ("modVersionId") REFERENCES "ModVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trusted_files" ADD CONSTRAINT "trusted_files_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- trusted_creators
CREATE TABLE "trusted_creators" (
  "id" TEXT NOT NULL,
  "creatorProfileId" TEXT NOT NULL,
  "trustLevel" "CreatorTrustLevel" NOT NULL DEFAULT 'NEW',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "priorityScan" BOOLEAN NOT NULL DEFAULT false,
  "fastTrack" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trusted_creators_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trusted_creators_creatorProfileId_key" ON "trusted_creators"("creatorProfileId");
CREATE INDEX "trusted_creators_trustLevel_idx" ON "trusted_creators"("trustLevel");
ALTER TABLE "trusted_creators" ADD CONSTRAINT "trusted_creators_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trusted_creators" ADD CONSTRAINT "trusted_creators_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- scan_queue
CREATE TABLE "scan_queue" (
  "id" TEXT NOT NULL,
  "modVersionId" TEXT,
  "modId" TEXT,
  "fileKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "sha256" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" "ScanQueueStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lastError" TEXT,
  "vtAnalysisId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scan_queue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scan_queue_status_priority_scheduledAt_idx" ON "scan_queue"("status", "priority", "scheduledAt");
CREATE INDEX "scan_queue_modVersionId_idx" ON "scan_queue"("modVersionId");
ALTER TABLE "scan_queue" ADD CONSTRAINT "scan_queue_modVersionId_fkey"
  FOREIGN KEY ("modVersionId") REFERENCES "ModVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
