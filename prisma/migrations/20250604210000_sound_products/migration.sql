-- ProductType enum
CREATE TYPE "ProductType" AS ENUM ('MOD', 'SOUND');
CREATE TYPE "SoundAudioCategory" AS ENUM (
  'ENGINE_SOUNDS', 'WEAPON_SOUNDS', 'SIRENS', 'UI_SOUNDS', 'AMBIENT_SOUNDS',
  'RADIO_PACKS', 'VOICE_PACKS', 'EFFECTS', 'MUSIC_PACKS', 'CUSTOM_AUDIO'
);
CREATE TYPE "SoundPreviewType" AS ENUM ('FULL', 'SECONDS_30', 'SECONDS_60', 'CUSTOM');

ALTER TABLE "Mod" ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'MOD';
CREATE INDEX "Mod_productType_status_idx" ON "Mod"("productType", "status");

CREATE TABLE "sound_profiles" (
  "id" TEXT NOT NULL,
  "modId" TEXT NOT NULL,
  "artist" TEXT,
  "audioCategory" "SoundAudioCategory" NOT NULL DEFAULT 'CUSTOM_AUDIO',
  "durationSeconds" INTEGER,
  "bpm" INTEGER,
  "genre" TEXT,
  "previewFileKey" TEXT,
  "previewFileName" TEXT,
  "previewFileSize" BIGINT,
  "previewDurationSeconds" INTEGER,
  "previewType" "SoundPreviewType" NOT NULL DEFAULT 'FULL',
  "previewCustomSeconds" INTEGER,
  "waveformPeaks" JSONB,
  "coverImageKey" TEXT,
  "playCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sound_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sound_profiles_modId_key" ON "sound_profiles"("modId");
CREATE INDEX "sound_profiles_audioCategory_idx" ON "sound_profiles"("audioCategory");
CREATE INDEX "sound_profiles_genre_idx" ON "sound_profiles"("genre");
ALTER TABLE "sound_profiles" ADD CONSTRAINT "sound_profiles_modId_fkey"
  FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sound_plays" (
  "id" TEXT NOT NULL,
  "modId" TEXT NOT NULL,
  "userId" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sound_plays_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sound_plays_modId_createdAt_idx" ON "sound_plays"("modId", "createdAt");
CREATE INDEX "sound_plays_userId_idx" ON "sound_plays"("userId");
ALTER TABLE "sound_plays" ADD CONSTRAINT "sound_plays_modId_fkey"
  FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
