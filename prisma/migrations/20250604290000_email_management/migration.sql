-- Email management: user-scoped logs + verification timestamp
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "EmailLog_userId_createdAt_idx" ON "EmailLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_to_idx" ON "EmailLog"("to");
