-- Owner Control Center: visitor metrics + lifetime membership campaigns

CREATE TABLE IF NOT EXISTS "PlatformDailyMetric" (
  "id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "pageViews" INTEGER NOT NULL DEFAULT 0,
  "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformDailyMetric_day_key" ON "PlatformDailyMetric"("day");

CREATE TABLE IF NOT EXISTS "MembershipCampaign" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "badgeLabel" TEXT,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "planId" TEXT,
  "totalSlots" INTEGER NOT NULL,
  "soldSlots" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "bannerText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MembershipCampaign_slug_key" ON "MembershipCampaign"("slug");
CREATE INDEX IF NOT EXISTS "MembershipCampaign_isActive_isVisible_idx" ON "MembershipCampaign"("isActive", "isVisible");

ALTER TABLE "MembershipCampaign" ADD CONSTRAINT "MembershipCampaign_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
