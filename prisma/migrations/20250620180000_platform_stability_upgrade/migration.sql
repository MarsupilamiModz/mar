-- Mod version original file metadata
ALTER TABLE "ModVersion" ADD COLUMN IF NOT EXISTS "originalFileName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ModVersion" ADD COLUMN IF NOT EXISTS "originalExtension" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ModVersion" ADD COLUMN IF NOT EXISTS "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream';

UPDATE "ModVersion"
SET
  "originalFileName" = CASE WHEN "originalFileName" = '' THEN "fileName" ELSE "originalFileName" END,
  "originalExtension" = CASE
    WHEN "originalExtension" = '' AND "fileName" LIKE '%.%' THEN lower(substring("fileName" from '\.[^.]+$'))
    ELSE "originalExtension"
  END
WHERE "originalFileName" = '' OR "originalExtension" = '';

-- Report system enterprise fields
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'SOUND';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'GAME';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'PARTNER';

ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS 'BROKEN_FILE';
ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS 'SCAM';
ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS 'OFFENSIVE_CONTENT';
ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS 'DUPLICATE_CONTENT';

ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'NEEDS_MORE_INFO';

DO $$ BEGIN
  CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportAssignmentRole" AS ENUM ('MODERATOR', 'ADMIN', 'OWNER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ContentReport" ADD COLUMN IF NOT EXISTS "priority" "ReportPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "ContentReport" ADD COLUMN IF NOT EXISTS "assignmentRole" "ReportAssignmentRole";
ALTER TABLE "ContentReport" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

CREATE INDEX IF NOT EXISTS "ContentReport_priority_status_idx" ON "ContentReport"("priority", "status");
