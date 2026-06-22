-- Owner user management tables + ban scopes
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "uploadBanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commentBanned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UserBan" ADD COLUMN IF NOT EXISTS "banScope" TEXT NOT NULL DEFAULT 'ACCOUNT';
ALTER TABLE "UserBan" ADD COLUMN IF NOT EXISTS "ipHash" TEXT;
CREATE INDEX IF NOT EXISTS "UserBan_banScope_idx" ON "UserBan"("banScope");

CREATE TABLE IF NOT EXISTS "user_permissions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT true,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_userId_permissionKey_key" ON "user_permissions"("userId", "permissionKey");
CREATE INDEX IF NOT EXISTS "user_permissions_userId_idx" ON "user_permissions"("userId");
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "user_role_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fromRole" "UserRole",
  "toRole" "UserRole" NOT NULL,
  "changedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_role_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "user_role_history_userId_createdAt_idx" ON "user_role_history"("userId", "createdAt");
ALTER TABLE "user_role_history" ADD CONSTRAINT "user_role_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_role_history" ADD CONSTRAINT "user_role_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_username_search_idx" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_role_isBanned_idx" ON "User"("role", "isBanned");
