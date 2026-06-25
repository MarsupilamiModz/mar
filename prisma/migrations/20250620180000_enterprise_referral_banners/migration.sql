-- CreateEnum
CREATE TYPE "SiteBannerType" AS ENUM ('GLOBAL', 'GAME', 'CATEGORY', 'MOD', 'PARTNER');

-- CreateEnum
CREATE TYPE "SiteBannerFrequency" AS ENUM ('ALWAYS', 'EVERY_5_MIN', 'EVERY_15_MIN', 'ONCE_SESSION', 'ONCE_DAY');

-- AlterTable
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "discordServerId" TEXT;

-- CreateTable
CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "premiumType" "MembershipTier" NOT NULL DEFAULT 'PREMIUM',
    "premiumDays" INTEGER NOT NULL DEFAULT 3,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSignup" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "premiumGranted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteBanner" (
    "id" TEXT NOT NULL,
    "type" "SiteBannerType" NOT NULL DEFAULT 'GLOBAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "buttonText" TEXT,
    "frequency" "SiteBannerFrequency" NOT NULL DEFAULT 'ALWAYS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "gameId" TEXT,
    "gameCategoryId" TEXT,
    "modId" TEXT,
    "partnerProfileId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");

-- CreateIndex
CREATE INDEX "ReferralLink_active_expiresAt_idx" ON "ReferralLink"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "ReferralLink_code_idx" ON "ReferralLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralSignup_userId_key" ON "ReferralSignup"("userId");

-- CreateIndex
CREATE INDEX "ReferralSignup_referralId_createdAt_idx" ON "ReferralSignup"("referralId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteBanner_isActive_type_priority_idx" ON "SiteBanner"("isActive", "type", "priority");

-- CreateIndex
CREATE INDEX "SiteBanner_gameId_idx" ON "SiteBanner"("gameId");

-- CreateIndex
CREATE INDEX "SiteBanner_gameCategoryId_idx" ON "SiteBanner"("gameCategoryId");

-- AddForeignKey
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "ReferralLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBanner" ADD CONSTRAINT "SiteBanner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBanner" ADD CONSTRAINT "SiteBanner_gameCategoryId_fkey" FOREIGN KEY ("gameCategoryId") REFERENCES "GameCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBanner" ADD CONSTRAINT "SiteBanner_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBanner" ADD CONSTRAINT "SiteBanner_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
