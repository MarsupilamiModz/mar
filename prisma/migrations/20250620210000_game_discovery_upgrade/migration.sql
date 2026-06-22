-- Game discovery & category media
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "backgroundUrl" TEXT;

ALTER TABLE "GameCategory" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "GameCategory" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
ALTER TABLE "GameCategory" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE "GameCategory" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;

CREATE INDEX IF NOT EXISTS "Mod_gameId_status_updatedAt_idx" ON "Mod"("gameId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Mod_categoryId_status_idx" ON "Mod"("categoryId", "status");
