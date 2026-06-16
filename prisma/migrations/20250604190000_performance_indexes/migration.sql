-- Performance indexes for hot query paths

CREATE INDEX IF NOT EXISTS "Download_modId_createdAt_idx" ON "Download"("modId", "createdAt");
CREATE INDEX IF NOT EXISTS "Download_userId_createdAt_idx" ON "Download"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Download_versionId_idx" ON "Download"("versionId");

CREATE INDEX IF NOT EXISTS "CustomOrder_status_updatedAt_idx" ON "CustomOrder"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomOrder_clientId_updatedAt_idx" ON "CustomOrder"("clientId", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomOrder_assigneeId_idx" ON "CustomOrder"("assigneeId");

CREATE INDEX IF NOT EXISTS "OrderMessage_orderId_createdAt_idx" ON "OrderMessage"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "ModReview_modId_createdAt_idx" ON "ModReview"("modId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModFavorite_userId_createdAt_idx" ON "ModFavorite"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission"("role");
CREATE INDEX IF NOT EXISTS "User_permissionGroupId_idx" ON "User"("permissionGroupId");

CREATE INDEX IF NOT EXISTS "MembershipPurchase_userId_expiresAt_idx" ON "MembershipPurchase"("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "ModMedia_modId_orderIndex_idx" ON "ModMedia"("modId", "orderIndex");

CREATE INDEX IF NOT EXISTS "ShopPurchase_stripePaymentId_idx" ON "ShopPurchase"("stripePaymentId");
