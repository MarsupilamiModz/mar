-- Tutorial Center + Membership plan kinds

CREATE TYPE "MembershipPlanKind" AS ENUM ('STANDARD', 'LIFETIME', 'LIMITED', 'EVENT', 'CREATOR', 'PARTNER');
CREATE TYPE "TutorialType" AS ENUM ('YOUTUBE', 'VIDEO', 'ARTICLE', 'MIXED');
CREATE TYPE "TutorialLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "TutorialStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "MembershipPlan" ADD COLUMN "planKind" "MembershipPlanKind" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "MembershipPlan" ADD COLUMN "stockLimit" INTEGER;
ALTER TABLE "MembershipPlan" ADD COLUMN "soldCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MembershipPlan" ADD COLUMN "durationDays" INTEGER;

CREATE TABLE "TutorialCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TutorialCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TutorialCategory_slug_key" ON "TutorialCategory"("slug");
CREATE INDEX "TutorialCategory_isActive_sortOrder_idx" ON "TutorialCategory"("isActive", "sortOrder");

CREATE TABLE "Tutorial" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "type" "TutorialType" NOT NULL,
    "level" "TutorialLevel" NOT NULL DEFAULT 'BEGINNER',
    "status" "TutorialStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "authorId" TEXT NOT NULL,
    "youtubeUrl" TEXT,
    "youtubeVideoId" TEXT,
    "youtubeTitle" TEXT,
    "youtubeThumbnail" TEXT,
    "youtubeDurationSec" INTEGER,
    "youtubeChannel" TEXT,
    "videoFileKey" TEXT,
    "videoUrl" TEXT,
    "videoThumbUrl" TEXT,
    "videoDurationSec" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "avgWatchSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tutorial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tutorial_slug_key" ON "Tutorial"("slug");
CREATE INDEX "Tutorial_status_publishedAt_idx" ON "Tutorial"("status", "publishedAt" DESC);
CREATE INDEX "Tutorial_categoryId_status_idx" ON "Tutorial"("categoryId", "status");
CREATE INDEX "Tutorial_level_status_idx" ON "Tutorial"("level", "status");
CREATE INDEX "Tutorial_type_status_idx" ON "Tutorial"("type", "status");

CREATE TABLE "TutorialLike" (
    "id" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TutorialLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TutorialLike_tutorialId_userId_key" ON "TutorialLike"("tutorialId", "userId");

CREATE TABLE "TutorialComment" (
    "id" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TutorialComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TutorialComment_tutorialId_createdAt_idx" ON "TutorialComment"("tutorialId", "createdAt" DESC);

CREATE TABLE "TutorialView" (
    "id" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "userId" TEXT,
    "watchSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TutorialView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TutorialView_tutorialId_createdAt_idx" ON "TutorialView"("tutorialId", "createdAt" DESC);

ALTER TABLE "Tutorial" ADD CONSTRAINT "Tutorial_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TutorialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tutorial" ADD CONSTRAINT "Tutorial_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorialLike" ADD CONSTRAINT "TutorialLike_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorialLike" ADD CONSTRAINT "TutorialLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorialComment" ADD CONSTRAINT "TutorialComment_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorialComment" ADD CONSTRAINT "TutorialComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorialView" ADD CONSTRAINT "TutorialView_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
