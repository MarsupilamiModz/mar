-- Download analytics & dashboard queries
CREATE INDEX IF NOT EXISTS "Download_userId_createdAt_idx" ON "Download"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Download_modId_createdAt_idx" ON "Download"("modId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Download_createdAt_idx" ON "Download"("createdAt" DESC);

-- Tag search & popular tags
CREATE INDEX IF NOT EXISTS "ModTag_name_idx" ON "ModTag"("name");

-- Catalog sort columns
CREATE INDEX IF NOT EXISTS "Mod_status_visibility_updatedAt_idx" ON "Mod"("status", "visibility", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Mod_status_visibility_favoriteCount_idx" ON "Mod"("status", "visibility", "favoriteCount" DESC);
CREATE INDEX IF NOT EXISTS "Mod_status_visibility_averageRating_idx" ON "Mod"("status", "visibility", "averageRating" DESC);
CREATE INDEX IF NOT EXISTS "Mod_categoryId_status_idx" ON "Mod"("categoryId", "status");
