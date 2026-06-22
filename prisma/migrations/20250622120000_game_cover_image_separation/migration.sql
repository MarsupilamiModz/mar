-- Backfill portrait cover from banner when no dedicated cover exists yet.
-- Upload proper 2:3 cover assets in Admin → Supported Games when available.
UPDATE "Game"
SET "coverUrl" = "bannerUrl"
WHERE "coverUrl" IS NULL
  AND "bannerUrl" IS NOT NULL;
