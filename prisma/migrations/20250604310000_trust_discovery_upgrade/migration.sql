-- Security, Trust, Discovery & Mod Ecosystem Upgrade

CREATE TYPE "ModDependencyRelation" AS ENUM ('REQUIRED', 'OPTIONAL', 'CONFLICT');
ALTER TABLE "ModDependency" ADD COLUMN IF NOT EXISTS "relation" "ModDependencyRelation" NOT NULL DEFAULT 'REQUIRED';
UPDATE "ModDependency" SET "relation" = CASE WHEN "isRequired" = true THEN 'REQUIRED'::"ModDependencyRelation" ELSE 'OPTIONAL'::"ModDependencyRelation" END;

CREATE TYPE "ReportTargetType" AS ENUM ('MOD', 'USER', 'REVIEW', 'COMMENT', 'CREATOR');
CREATE TYPE "ReportCategory" AS ENUM ('STOLEN', 'MALWARE', 'VIRUS', 'BROKEN_DOWNLOAD', 'COPYRIGHT', 'SPAM', 'FAKE_CREATOR', 'ABUSIVE', 'TOS', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'REJECTED');

CREATE TABLE "ContentReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" "ReportCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "attachments" JSONB,
  "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "assigneeId" TEXT,
  "adminNotes" TEXT,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "DMCAStatus" AS ENUM ('SUBMITTED', 'LEGAL_REVIEW', 'ACCEPTED', 'REMOVED', 'REJECTED');

CREATE TABLE "DMCAClaim" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "contactPhone" TEXT,
  "infringingUrl" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidenceKeys" JSONB,
  "status" "DMCAStatus" NOT NULL DEFAULT 'SUBMITTED',
  "assigneeId" TEXT,
  "adminNotes" TEXT,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "DMCAClaim_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "UserSecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_CHALLENGE', 'BACKUP_CODE_USED', 'PASSWORD_CHANGED', 'SESSION_REVOKED');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnabledAt" TIMESTAMP(3);

CREATE TABLE "UserSecurityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" "UserSecurityEventType" NOT NULL,
  "ipHash" TEXT,
  "userAgent" VARCHAR(512),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMfaBackupCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMfaBackupCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "userId" TEXT,
  "modId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchQueryLog" (
  "id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "filters" JSONB,
  "userId" TEXT,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchQueryLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserSecurityEvent" ADD CONSTRAINT "UserSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMfaBackupCode" ADD CONSTRAINT "UserMfaBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformEvent" ADD CONSTRAINT "PlatformEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformEvent" ADD CONSTRAINT "PlatformEvent_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SearchQueryLog" ADD CONSTRAINT "SearchQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");
CREATE INDEX "ContentReport_targetType_targetId_idx" ON "ContentReport"("targetType", "targetId");
CREATE INDEX "ContentReport_reporterId_idx" ON "ContentReport"("reporterId");
CREATE INDEX "DMCAClaim_status_createdAt_idx" ON "DMCAClaim"("status", "createdAt");
CREATE INDEX "DMCAClaim_contactEmail_idx" ON "DMCAClaim"("contactEmail");
CREATE INDEX "UserSecurityEvent_userId_createdAt_idx" ON "UserSecurityEvent"("userId", "createdAt");
CREATE INDEX "UserSecurityEvent_eventType_createdAt_idx" ON "UserSecurityEvent"("eventType", "createdAt");
CREATE INDEX "UserMfaBackupCode_userId_idx" ON "UserMfaBackupCode"("userId");
CREATE INDEX "PlatformEvent_type_createdAt_idx" ON "PlatformEvent"("type", "createdAt");
CREATE INDEX "PlatformEvent_modId_createdAt_idx" ON "PlatformEvent"("modId", "createdAt");
CREATE INDEX "PlatformEvent_userId_createdAt_idx" ON "PlatformEvent"("userId", "createdAt");
CREATE INDEX "SearchQueryLog_createdAt_idx" ON "SearchQueryLog"("createdAt");
CREATE INDEX "SearchQueryLog_query_idx" ON "SearchQueryLog"("query");
