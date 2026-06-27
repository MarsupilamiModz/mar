-- Discord Import Center

CREATE TYPE "DiscordImportType" AS ENUM ('MOD', 'SOUND', 'COLLECTION', 'NEWS', 'GALLERY');
CREATE TYPE "DiscordImportStatus" AS ENUM ('PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED');
CREATE TYPE "DiscordImportScanStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'SUSPICIOUS', 'MANUAL_REVIEW');

CREATE TABLE "DiscordImportGuild" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "iconUrl" TEXT,
    "botConnected" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordImportGuild_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordImportGuild_guildId_key" ON "DiscordImportGuild"("guildId");

CREATE TABLE "DiscordImportChannel" (
    "id" TEXT NOT NULL,
    "guildRecordId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "importType" "DiscordImportType" NOT NULL,
    "gameSlug" TEXT,
    "gameId" TEXT,
    "modeId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordImportChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordImportChannel_guildRecordId_channelId_key" ON "DiscordImportChannel"("guildRecordId", "channelId");
CREATE INDEX "DiscordImportChannel_enabled_idx" ON "DiscordImportChannel"("enabled");

CREATE TABLE "DiscordImportRule" (
    "id" TEXT NOT NULL,
    "guildRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "importType" "DiscordImportType",
    "gameSlug" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordImportRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordImportRule_guildRecordId_enabled_idx" ON "DiscordImportRule"("guildRecordId", "enabled");

CREATE TABLE "DiscordImportEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "importType" "DiscordImportType" NOT NULL,
    "status" "DiscordImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "scanStatus" "DiscordImportScanStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discordAuthorId" TEXT NOT NULL,
    "discordAuthorName" TEXT,
    "authorUserId" TEXT,
    "modId" TEXT,
    "collectionId" TEXT,
    "blogPostId" TEXT,
    "gameId" TEXT,
    "modeId" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordImportEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordImportEntry_messageId_key" ON "DiscordImportEntry"("messageId");
CREATE INDEX "DiscordImportEntry_status_createdAt_idx" ON "DiscordImportEntry"("status", "createdAt" DESC);
CREATE INDEX "DiscordImportEntry_importType_status_idx" ON "DiscordImportEntry"("importType", "status");
CREATE INDEX "DiscordImportEntry_authorUserId_idx" ON "DiscordImportEntry"("authorUserId");

CREATE TABLE "DiscordImportFile" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" BIGINT,
    "r2Key" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'attachment',
    "scanStatus" "DiscordImportScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordImportFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordImportFile_entryId_idx" ON "DiscordImportFile"("entryId");

ALTER TABLE "DiscordImportChannel" ADD CONSTRAINT "DiscordImportChannel_guildRecordId_fkey" FOREIGN KEY ("guildRecordId") REFERENCES "DiscordImportGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordImportRule" ADD CONSTRAINT "DiscordImportRule_guildRecordId_fkey" FOREIGN KEY ("guildRecordId") REFERENCES "DiscordImportGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordImportEntry" ADD CONSTRAINT "DiscordImportEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscordImportEntry" ADD CONSTRAINT "DiscordImportEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscordImportEntry" ADD CONSTRAINT "DiscordImportEntry_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscordImportFile" ADD CONSTRAINT "DiscordImportFile_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiscordImportEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
