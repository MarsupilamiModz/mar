-- Platform enterprise upgrade: announcements targeting, team fields
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "visibilityTargets" JSONB NOT NULL DEFAULT '["everyone"]';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamDepartment" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamBadge" TEXT;
