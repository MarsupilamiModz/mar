-- Performance indexes for game/mod catalog filters
CREATE INDEX IF NOT EXISTS "Mod_gameId_status_uploadedAt_idx" ON "Mod"("gameId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Mod_gameId_modeId_status_idx" ON "Mod"("gameId", "modeId", "status");
CREATE INDEX IF NOT EXISTS "Mod_categoryId_status_productType_idx" ON "Mod"("categoryId", "status", "productType");
CREATE INDEX IF NOT EXISTS "Mod_status_visibility_downloadCount_idx" ON "Mod"("status", "visibility", "downloadCount" DESC);
