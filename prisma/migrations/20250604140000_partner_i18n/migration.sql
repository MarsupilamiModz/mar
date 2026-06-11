-- Partner application workflow + NEEDS_CHANGES status
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_CHANGES';

ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "customResponses" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "requiredChanges" TEXT;
ALTER TABLE "PartnerApplication" ADD COLUMN IF NOT EXISTS "statusHistory" JSONB NOT NULL DEFAULT '[]';
