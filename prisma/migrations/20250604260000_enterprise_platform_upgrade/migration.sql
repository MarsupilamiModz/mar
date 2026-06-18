-- Team page system
CREATE TYPE "TeamVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'HIDDEN');

CREATE TABLE IF NOT EXISTS "TeamDepartment" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "translations" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamDepartment_slug_key" ON "TeamDepartment"("slug");
CREATE INDEX IF NOT EXISTS "TeamDepartment_isActive_sortOrder_idx" ON "TeamDepartment"("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "description" TEXT,
  "email" TEXT,
  "avatarUrl" TEXT,
  "bannerUrl" TEXT,
  "discordUrl" TEXT,
  "youtubeUrl" TEXT,
  "twitchUrl" TEXT,
  "tiktokUrl" TEXT,
  "instagramUrl" TEXT,
  "xUrl" TEXT,
  "websiteUrl" TEXT,
  "customLinks" JSONB,
  "departmentId" TEXT,
  "visibility" "TeamVisibility" NOT NULL DEFAULT 'PUBLIC',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_userId_key" ON "TeamMember"("userId");
CREATE INDEX IF NOT EXISTS "TeamMember_visibility_isActive_sortOrder_idx" ON "TeamMember"("visibility", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "TeamMember_departmentId_sortOrder_idx" ON "TeamMember"("departmentId", "sortOrder");

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "TeamDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TeamDepartment" ("id", "slug", "name", "sortOrder", "updatedAt")
VALUES
  ('dept_owner', 'owner', 'Owner', 0, CURRENT_TIMESTAMP),
  ('dept_management', 'management', 'Management', 1, CURRENT_TIMESTAMP),
  ('dept_development', 'development', 'Development', 2, CURRENT_TIMESTAMP),
  ('dept_design', 'design', 'Design', 3, CURRENT_TIMESTAMP),
  ('dept_support', 'support', 'Support', 4, CURRENT_TIMESTAMP),
  ('dept_moderation', 'moderation', 'Moderation', 5, CURRENT_TIMESTAMP),
  ('dept_partnerships', 'partnerships', 'Partnerships', 6, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
