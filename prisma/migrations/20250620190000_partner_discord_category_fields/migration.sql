-- AlterTable
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "discordWidgetEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "discordDescription" TEXT;
