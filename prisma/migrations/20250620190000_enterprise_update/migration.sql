-- Custom order post-purchase requirements
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "requirementsSubmittedAt" TIMESTAMP(3);

-- Public profile & order query performance
CREATE INDEX IF NOT EXISTS "PartnerProfile_isPublic_isSuspended_isBanned_idx"
  ON "PartnerProfile"("isPublic", "isSuspended", "isBanned");
CREATE INDEX IF NOT EXISTS "CreatorProfile_isPublic_isSuspended_idx"
  ON "CreatorProfile"("isPublic", "isSuspended");
CREATE INDEX IF NOT EXISTS "CustomOrder_paymentStatus_requirementsSubmittedAt_idx"
  ON "CustomOrder"("paymentStatus", "requirementsSubmittedAt");
