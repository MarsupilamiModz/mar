-- Performance indexes for hot paths (idempotent)

CREATE INDEX IF NOT EXISTS "Mod_gameId_status_visibility_updatedAt_idx"
  ON "Mod" ("gameId", "status", "visibility", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
  ON "Notification" ("userId", "read", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SupportTicket_status_updatedAt_idx"
  ON "SupportTicket" ("status", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "ModCollection_visibility_sortOrder_idx"
  ON "ModCollection" ("visibility", "sortOrder");

CREATE INDEX IF NOT EXISTS "GameMode_gameId_isActive_sortOrder_idx"
  ON "GameMode" ("gameId", "isActive", "sortOrder");
