-- Game modes (platforms / hover categories)
CREATE TABLE IF NOT EXISTS "GameMode" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "bannerUrl" TEXT,
  "iconUrl" TEXT,
  "accentColor" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GameMode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameMode_gameId_slug_key" ON "GameMode"("gameId", "slug");
CREATE INDEX IF NOT EXISTS "GameMode_gameId_sortOrder_idx" ON "GameMode"("gameId", "sortOrder");
CREATE INDEX IF NOT EXISTS "GameMode_gameId_isActive_idx" ON "GameMode"("gameId", "isActive");

ALTER TABLE "GameMode"
  ADD CONSTRAINT "GameMode_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "modeId" TEXT;
ALTER TABLE "GameCategory" ADD COLUMN IF NOT EXISTS "modeId" TEXT;

ALTER TABLE "Mod"
  ADD CONSTRAINT "Mod_modeId_fkey"
  FOREIGN KEY ("modeId") REFERENCES "GameMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GameCategory"
  ADD CONSTRAINT "GameCategory_modeId_fkey"
  FOREIGN KEY ("modeId") REFERENCES "GameMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Mod_gameId_modeId_status_idx" ON "Mod"("gameId", "modeId", "status");
CREATE INDEX IF NOT EXISTS "Mod_modeId_status_idx" ON "Mod"("modeId", "status");
CREATE INDEX IF NOT EXISTS "GameCategory_gameId_modeId_idx" ON "GameCategory"("gameId", "modeId");
