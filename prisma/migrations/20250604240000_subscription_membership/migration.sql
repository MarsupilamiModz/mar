-- Subscription membership, sound approvals, avatar variants, credit system removal

CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'PREMIUM_LITE', 'PREMIUM', 'PREMIUM_MAX');
CREATE TYPE "UserMembershipStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING', 'INCOMPLETE', 'EXPIRED');
CREATE TYPE "SoundApprovalStatus" AS ENUM ('PENDING_REVIEW', 'VIRUS_TOTAL_VERIFIED', 'MANUALLY_APPROVED', 'REVIEW_REQUIRED', 'REJECTED', 'CHANGES_REQUESTED');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarOriginalUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar64Url" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar128Url" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar256Url" TEXT;

CREATE TABLE "UserMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipType" "MembershipTier" NOT NULL DEFAULT 'FREE',
    "status" "UserMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "planId" TEXT,
    "stripeSubscriptionId" TEXT,
    "renewalDate" TIMESTAMP(3),
    "cancelDate" TIMESTAMP(3),
    "isLifetime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMembership_userId_key" ON "UserMembership"("userId");
CREATE UNIQUE INDEX "UserMembership_stripeSubscriptionId_key" ON "UserMembership"("stripeSubscriptionId");
CREATE INDEX "UserMembership_membershipType_status_idx" ON "UserMembership"("membershipType", "status");
CREATE INDEX "UserMembership_stripeSubscriptionId_idx" ON "UserMembership"("stripeSubscriptionId");

ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "previewScanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "approvalStatus" "SoundApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "sound_profiles" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

CREATE INDEX IF NOT EXISTS "sound_profiles_approvalStatus_idx" ON "sound_profiles"("approvalStatus");

ALTER TABLE "sound_profiles" ADD CONSTRAINT "sound_profiles_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Convert plans to monthly subscriptions (base EUR prices)
UPDATE "MembershipPlan" SET "billingType" = 'RECURRING', "interval" = 'month', "priceCents" = 199 WHERE slug = 'premium-lite';
UPDATE "MembershipPlan" SET "billingType" = 'RECURRING', "interval" = 'month', "priceCents" = 499 WHERE slug = 'premium';
UPDATE "MembershipPlan" SET "billingType" = 'RECURRING', "interval" = 'month', "priceCents" = 999 WHERE slug = 'premium-max';

-- Migrate existing lifetime purchasers to UserMembership
INSERT INTO "UserMembership" ("id", "userId", "membershipType", "status", "planId", "isLifetime", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  mp."userId",
  CASE p.slug
    WHEN 'premium-lite' THEN 'PREMIUM_LITE'::"MembershipTier"
    WHEN 'premium-max' THEN 'PREMIUM_MAX'::"MembershipTier"
    ELSE 'PREMIUM'::"MembershipTier"
  END,
  'ACTIVE'::"UserMembershipStatus",
  mp."planId",
  true,
  mp."createdAt",
  NOW()
FROM (
  SELECT DISTINCT ON ("userId") "userId", "planId", "createdAt"
  FROM "MembershipPurchase"
  WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()
  ORDER BY "userId", "createdAt" DESC
) mp
JOIN "MembershipPlan" p ON p."id" = mp."planId"
ON CONFLICT ("userId") DO NOTHING;

-- Migrate active Stripe subscriptions
INSERT INTO "UserMembership" ("id", "userId", "membershipType", "status", "planId", "stripeSubscriptionId", "renewalDate", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."userId",
  CASE COALESCE(p.slug, 'premium')
    WHEN 'premium-lite' THEN 'PREMIUM_LITE'::"MembershipTier"
    WHEN 'premium-max' THEN 'PREMIUM_MAX'::"MembershipTier"
    ELSE 'PREMIUM'::"MembershipTier"
  END,
  CASE s.status
    WHEN 'ACTIVE' THEN 'ACTIVE'::"UserMembershipStatus"
    WHEN 'TRIALING' THEN 'TRIALING'::"UserMembershipStatus"
    WHEN 'PAST_DUE' THEN 'PAST_DUE'::"UserMembershipStatus"
    WHEN 'CANCELED' THEN 'CANCELED'::"UserMembershipStatus"
    ELSE 'INCOMPLETE'::"UserMembershipStatus"
  END,
  s."planId",
  s."stripeSubscriptionId",
  s."currentPeriodEnd",
  s."createdAt",
  NOW()
FROM "Subscription" s
LEFT JOIN "MembershipPlan" p ON p."id" = s."planId"
WHERE s.status IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
ON CONFLICT ("userId") DO UPDATE SET
  "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId",
  "renewalDate" = EXCLUDED."renewalDate",
  "status" = EXCLUDED."status",
  "updatedAt" = NOW();

-- Approve already-published sounds (grandfather existing content)
UPDATE "sound_profiles" sp
SET "approvalStatus" = 'MANUALLY_APPROVED', "approvedAt" = NOW()
FROM "Mod" m
WHERE m."id" = sp."modId" AND m."productType" = 'SOUND' AND m."status" = 'PUBLISHED';

-- Remove credit system
DROP TABLE IF EXISTS "CreditTransaction";
DROP TABLE IF EXISTS "CreditWallet";
DROP TYPE IF EXISTS "CreditTransactionType";
