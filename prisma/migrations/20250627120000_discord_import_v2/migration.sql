-- Discord Import Center V2

ALTER TYPE "DiscordImportStatus" ADD VALUE IF NOT EXISTS 'NEEDS_LINK_REVIEW';

ALTER TABLE "DiscordImportEntry" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

ALTER TABLE "DiscordImportFile" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "DiscordImportFile" ADD COLUMN IF NOT EXISTS "sourceProvider" TEXT;

CREATE TYPE "DiscordImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS "DiscordImportJob" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DiscordImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordImportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscordImportJob_entryId_key" ON "DiscordImportJob"("entryId");
CREATE INDEX IF NOT EXISTS "DiscordImportJob_status_scheduledAt_idx" ON "DiscordImportJob"("status", "scheduledAt");

ALTER TABLE "DiscordImportJob" DROP CONSTRAINT IF EXISTS "DiscordImportJob_entryId_fkey";
ALTER TABLE "DiscordImportJob" ADD CONSTRAINT "DiscordImportJob_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiscordImportEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
