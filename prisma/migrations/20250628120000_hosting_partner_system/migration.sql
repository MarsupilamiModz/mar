-- Hosting partner system + mod co-creators

CREATE TYPE "HostingBannerSize" AS ENUM ('RECT_300x250', 'LEADERBOARD_728x90', 'BILLBOARD_970x250', 'RESPONSIVE');
CREATE TYPE "ModCollaboratorRole" AS ENUM ('LEAD_CREATOR', 'DEVELOPER', 'SCRIPTER', 'MODELER', 'DESIGNER', 'SOUND_DESIGNER', 'TESTER');
CREATE TYPE "HostingClickContext" AS ENUM ('MOD', 'COLLECTION', 'BANNER', 'SIDEBAR', 'CTA');

CREATE TABLE "HostingPartner" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "affiliateUrl" TEXT NOT NULL,
    "trackingId" TEXT,
    "apiProvider" TEXT,
    "apiConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostingPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HostingPartner_slug_key" ON "HostingPartner"("slug");
CREATE INDEX "HostingPartner_isActive_sortOrder_idx" ON "HostingPartner"("isActive", "sortOrder");
CREATE INDEX "HostingPartner_isGlobal_idx" ON "HostingPartner"("isGlobal");

CREATE TABLE "HostingPartnerBanner" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "size" "HostingBannerSize" NOT NULL DEFAULT 'RESPONSIVE',
    "imageUrl" TEXT NOT NULL,
    "webpUrl" TEXT,
    "avifUrl" TEXT,
    "targetUrl" TEXT,
    "gameId" TEXT,
    "modId" TEXT,
    "collectionId" TEXT,
    "creatorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostingPartnerBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HostingPartnerBanner_partnerId_isActive_idx" ON "HostingPartnerBanner"("partnerId", "isActive");
CREATE INDEX "HostingPartnerBanner_gameId_idx" ON "HostingPartnerBanner"("gameId");
CREATE INDEX "HostingPartnerBanner_modId_idx" ON "HostingPartnerBanner"("modId");
CREATE INDEX "HostingPartnerBanner_collectionId_idx" ON "HostingPartnerBanner"("collectionId");
CREATE INDEX "HostingPartnerBanner_creatorId_idx" ON "HostingPartnerBanner"("creatorId");

CREATE TABLE "GameHostingPartner" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameHostingPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameHostingPartner_gameId_key" ON "GameHostingPartner"("gameId");
CREATE INDEX "GameHostingPartner_partnerId_idx" ON "GameHostingPartner"("partnerId");

CREATE TABLE "HostingClick" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "userId" TEXT,
    "modId" TEXT,
    "collectionId" TEXT,
    "gameId" TEXT,
    "context" "HostingClickContext" NOT NULL DEFAULT 'CTA',
    "countryCode" TEXT,
    "referrer" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostingClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HostingClick_partnerId_createdAt_idx" ON "HostingClick"("partnerId", "createdAt" DESC);
CREATE INDEX "HostingClick_modId_createdAt_idx" ON "HostingClick"("modId", "createdAt" DESC);
CREATE INDEX "HostingClick_collectionId_createdAt_idx" ON "HostingClick"("collectionId", "createdAt" DESC);
CREATE INDEX "HostingClick_createdAt_idx" ON "HostingClick"("createdAt" DESC);

CREATE TABLE "ModCollaborator" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ModCollaboratorRole" NOT NULL DEFAULT 'DEVELOPER',
    "revenueShareBps" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModCollaborator_modId_userId_key" ON "ModCollaborator"("modId", "userId");
CREATE INDEX "ModCollaborator_userId_idx" ON "ModCollaborator"("userId");

ALTER TABLE "Mod" ADD COLUMN "serverPartnerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mod" ADD COLUMN "serverPartnerId" TEXT;
ALTER TABLE "Mod" ADD COLUMN "serverPartnerLink" TEXT;
ALTER TABLE "Mod" ADD COLUMN "serverPartnerBanner" TEXT;

ALTER TABLE "ModCollection" ADD COLUMN "serverPartnerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModCollection" ADD COLUMN "serverPartnerId" TEXT;
ALTER TABLE "ModCollection" ADD COLUMN "serverPartnerLink" TEXT;
ALTER TABLE "ModCollection" ADD COLUMN "serverPartnerBanner" TEXT;

ALTER TABLE "CreatorProfile" ADD COLUMN "hostingBannerUrl" TEXT;
ALTER TABLE "CreatorProfile" ADD COLUMN "hostingAffiliateLink" TEXT;
ALTER TABLE "CreatorProfile" ADD COLUMN "hostingDescription" TEXT;
ALTER TABLE "CreatorProfile" ADD COLUMN "hostingPartnerEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "HostingPartnerBanner" ADD CONSTRAINT "HostingPartnerBanner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "HostingPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostingPartnerBanner" ADD CONSTRAINT "HostingPartnerBanner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HostingPartnerBanner" ADD CONSTRAINT "HostingPartnerBanner_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HostingPartnerBanner" ADD CONSTRAINT "HostingPartnerBanner_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ModCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HostingPartnerBanner" ADD CONSTRAINT "HostingPartnerBanner_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GameHostingPartner" ADD CONSTRAINT "GameHostingPartner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameHostingPartner" ADD CONSTRAINT "GameHostingPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "HostingPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HostingClick" ADD CONSTRAINT "HostingClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "HostingPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostingClick" ADD CONSTRAINT "HostingClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModCollaborator" ADD CONSTRAINT "ModCollaborator_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModCollaborator" ADD CONSTRAINT "ModCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mod" ADD CONSTRAINT "Mod_serverPartnerId_fkey" FOREIGN KEY ("serverPartnerId") REFERENCES "HostingPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModCollection" ADD CONSTRAINT "ModCollection_serverPartnerId_fkey" FOREIGN KEY ("serverPartnerId") REFERENCES "HostingPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
