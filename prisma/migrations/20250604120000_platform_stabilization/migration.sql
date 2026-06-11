-- Platform stabilization: partner applications, large uploads, indexes
-- Run: npx prisma migrate deploy  OR  npx prisma db push

-- Partner application fields
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "discord" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "youtubeUrl" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "twitchUrl" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "tiktokUrl" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "xUrl" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "whyPartner" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "assignedCommissionRuleId" TEXT;

DO $$ BEGIN
  ALTER TABLE "PartnerApplication"
    ADD CONSTRAINT "PartnerApplication_assignedCommissionRuleId_fkey"
    FOREIGN KEY ("assignedCommissionRuleId") REFERENCES "CommissionRule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PartnerApplication_assignedCommissionRuleId_idx"
  ON "PartnerApplication"("assignedCommissionRuleId");

-- Large file support (BigInt file sizes)
ALTER TABLE "ModVersion" ALTER COLUMN "fileSize" TYPE BIGINT USING "fileSize"::BIGINT;
ALTER TABLE "FileScanLog" ALTER COLUMN "fileSize" TYPE BIGINT USING "fileSize"::BIGINT;
ALTER TABLE "StorageUploadSession" ALTER COLUMN "fileSize" TYPE BIGINT USING "fileSize"::BIGINT;
ALTER TABLE "StorageUploadSession" ADD COLUMN IF NOT EXISTS "completedParts" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "StorageUploadSession_createdAt_idx"
  ON "StorageUploadSession"("createdAt");

-- Query performance indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
  ON "Notification"("userId", "read", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SupportTicket_status_priority_updatedAt_idx"
  ON "SupportTicket"("status", "priority", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Mod_status_visibility_createdAt_idx"
  ON "Mod"("status", "visibility", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ModCollection_moderationStatus_sortOrder_idx"
  ON "ModCollection"("moderationStatus", "sortOrder");

CREATE INDEX IF NOT EXISTS "Download_userId_createdAt_idx"
  ON "Download"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "User_role_deletedAt_idx"
  ON "User"("role", "deletedAt");

CREATE INDEX IF NOT EXISTS "Subscription_userId_status_idx"
  ON "Subscription"("userId", "status");
