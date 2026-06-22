-- Platform languages for admin-managed locale catalog
CREATE TABLE IF NOT EXISTS "PlatformLanguage" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "flagIcon" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformLanguage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformLanguage_code_key" ON "PlatformLanguage"("code");
CREATE INDEX IF NOT EXISTS "PlatformLanguage_isActive_sortOrder_idx" ON "PlatformLanguage"("isActive", "sortOrder");

INSERT INTO "PlatformLanguage" ("id", "code", "name", "flagIcon", "isActive", "sortOrder", "updatedAt")
VALUES
  ('lang_en', 'en', 'English', '🇺🇸', true, 0, CURRENT_TIMESTAMP),
  ('lang_de', 'de', 'Deutsch', '🇩🇪', true, 1, CURRENT_TIMESTAMP),
  ('lang_fr', 'fr', 'Français', '🇫🇷', true, 2, CURRENT_TIMESTAMP),
  ('lang_es', 'es', 'Español', '🇪🇸', true, 3, CURRENT_TIMESTAMP),
  ('lang_it', 'it', 'Italiano', '🇮🇹', false, 4, CURRENT_TIMESTAMP),
  ('lang_pl', 'pl', 'Polski', '🇵🇱', true, 5, CURRENT_TIMESTAMP),
  ('lang_tr', 'tr', 'Türkçe', '🇹🇷', true, 6, CURRENT_TIMESTAMP),
  ('lang_nl', 'nl', 'Nederlands', '🇳🇱', false, 7, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
