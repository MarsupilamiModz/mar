-- Unified media registry
CREATE TYPE "MediaEntityType" AS ENUM (
  'MOD_SCREENSHOT',
  'MOD_MEDIA',
  'USER_AVATAR',
  'SOUND_PREVIEW',
  'SOUND_COVER',
  'CREATOR_BANNER',
  'PARTNER_LOGO',
  'GAME_ASSET',
  'COLLECTION_COVER',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS "media_files" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL DEFAULT 0,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "entityType" "MediaEntityType" NOT NULL,
  "entityId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_files_storagePath_key" UNIQUE ("storagePath"),
  CONSTRAINT "media_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "media_files_entityType_entityId_idx" ON "media_files"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "media_files_uploadedById_idx" ON "media_files"("uploadedById");
