-- Sound metadata + user moderation extensions

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isMuted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "warningCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "moderationNote" TEXT;

ALTER TABLE "UserBan" ADD COLUMN IF NOT EXISTS "banType" TEXT NOT NULL DEFAULT 'PERMANENT';
ALTER TABLE "UserBan" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "UserBan" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;

ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "previewFileId" TEXT;
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "previewMimeType" TEXT;
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "previewBitrateKbps" INTEGER;
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "uploadedById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "sound_profiles_previewFileId_key" ON "sound_profiles"("previewFileId");
CREATE INDEX IF NOT EXISTS "sound_profiles_uploadedById_idx" ON "sound_profiles"("uploadedById");
CREATE INDEX IF NOT EXISTS "sound_profiles_previewScanStatus_idx" ON "sound_profiles"("previewScanStatus");
CREATE INDEX IF NOT EXISTS "User_banExpiresAt_idx" ON "User"("banExpiresAt");

DO $$ BEGIN
  CREATE TYPE "ModerationAction" AS ENUM (
    'BAN_PERMANENT',
    'BAN_TEMPORARY',
    'UNBAN',
    'SUSPEND',
    'UNSUSPEND',
    'MUTE',
    'UNMUTE',
    'WARN',
    'RESET_WARNINGS',
    'SOFT_DELETE',
    'RESTORE',
    'ROLE_CHANGE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "UserModerationLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" "ModerationAction" NOT NULL,
  "reason" TEXT,
  "internalNote" TEXT,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserModerationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserModerationLog_userId_createdAt_idx" ON "UserModerationLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserModerationLog_actorId_idx" ON "UserModerationLog"("actorId");
CREATE INDEX IF NOT EXISTS "UserModerationLog_action_idx" ON "UserModerationLog"("action");

ALTER TABLE "UserModerationLog" ADD CONSTRAINT "UserModerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModerationLog" ADD CONSTRAINT "UserModerationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sound_profiles" ADD CONSTRAINT "sound_profiles_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
