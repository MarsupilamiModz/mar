-- TranslationJob table + Mod.translations for enterprise AI localization
ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "translations" JSONB;

CREATE TABLE IF NOT EXISTS "TranslationJob" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "sourceLocale" TEXT NOT NULL,
  "targetLocale" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "translatedText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TranslationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TranslationJob_status_createdAt_idx" ON "TranslationJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "TranslationJob_entityType_entityId_idx" ON "TranslationJob"("entityType", "entityId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TranslationJob_approvedById_fkey'
  ) THEN
    ALTER TABLE "TranslationJob"
      ADD CONSTRAINT "TranslationJob_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
