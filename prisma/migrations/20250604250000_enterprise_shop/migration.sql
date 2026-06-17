-- Enterprise shop & custom order platform

-- OrderStatus extensions
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_CUSTOMER';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REVISION_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- Shop enums
CREATE TYPE "ShopPricingMode" AS ENUM ('FIXED', 'VARIABLE', 'STARTING_FROM', 'QUOTE', 'SUBSCRIPTION', 'ONE_TIME');
CREATE TYPE "ShopProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DISABLED');
CREATE TYPE "ShopFormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'DATE', 'IMAGE_UPLOAD', 'FILE_UPLOAD');
CREATE TYPE "ShopMediaType" AS ENUM ('COVER', 'BANNER', 'FEATURED', 'GALLERY', 'EXAMPLE', 'VIDEO');

ALTER TYPE "ShopProductCategory" ADD VALUE IF NOT EXISTS 'CUSTOM_SERVICES';
ALTER TYPE "ShopProductType" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- CustomOrder extensions
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "shopProductId" TEXT;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "shopPurchaseId" TEXT;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "assignedTeam" TEXT;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "formResponses" JSONB;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomOrder_shopPurchaseId_key" ON "CustomOrder"("shopPurchaseId");
CREATE INDEX IF NOT EXISTS "CustomOrder_status_updatedAt_idx" ON "CustomOrder"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomOrder_assigneeId_status_idx" ON "CustomOrder"("assigneeId", "status");
CREATE INDEX IF NOT EXISTS "CustomOrder_clientId_createdAt_idx" ON "CustomOrder"("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomOrder_shopProductId_idx" ON "CustomOrder"("shopProductId");

-- OrderMessage extensions
ALTER TABLE "OrderMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
ALTER TABLE "OrderMessage" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "OrderMessage_orderId_createdAt_idx" ON "OrderMessage"("orderId", "createdAt");

-- New order tables
CREATE TABLE IF NOT EXISTS "OrderMessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderActivity" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderDelivery" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "fileKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "uploadedById" TEXT NOT NULL,
  "isRevision" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderDelivery_pkey" PRIMARY KEY ("id")
);

-- Shop product type definitions
CREATE TABLE IF NOT EXISTS "ShopProductTypeDefinition" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "iconKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isCustom" BOOLEAN NOT NULL DEFAULT true,
  "translations" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopProductTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopProductTypeDefinition_slug_key" ON "ShopProductTypeDefinition"("slug");
CREATE INDEX IF NOT EXISTS "ShopProductTypeDefinition_isActive_sortOrder_idx" ON "ShopProductTypeDefinition"("isActive", "sortOrder");

-- Shop categories
CREATE TABLE IF NOT EXISTS "ShopCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "translations" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopCategory_slug_key" ON "ShopCategory"("slug");
CREATE INDEX IF NOT EXISTS "ShopCategory_parentId_sortOrder_idx" ON "ShopCategory"("parentId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ShopCategory_isActive_sortOrder_idx" ON "ShopCategory"("isActive", "sortOrder");

-- ShopProduct extensions
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "customTypeId" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "shopCategoryId" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "subcategoryId" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "status" "ShopProductStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "pricingMode" "ShopPricingMode" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "bannerImageUrl" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "featuredImageUrl" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "customFields" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "ShopProduct_status_isArchived_idx" ON "ShopProduct"("status", "isArchived");
CREATE INDEX IF NOT EXISTS "ShopProduct_shopCategoryId_idx" ON "ShopProduct"("shopCategoryId");
CREATE INDEX IF NOT EXISTS "ShopProduct_customTypeId_idx" ON "ShopProduct"("customTypeId");

-- Form fields & media
CREATE TABLE IF NOT EXISTS "ShopProductFormField" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "fieldType" "ShopFormFieldType" NOT NULL,
  "label" TEXT NOT NULL,
  "placeholder" TEXT,
  "helpText" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "validation" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ShopProductFormField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopProductMedia" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "mediaType" "ShopMediaType" NOT NULL DEFAULT 'GALLERY',
  "url" TEXT NOT NULL,
  "alt" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShopProductFormField_productId_sortOrder_idx" ON "ShopProductFormField"("productId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ShopProductMedia_productId_mediaType_sortOrder_idx" ON "ShopProductMedia"("productId", "mediaType", "sortOrder");

-- ShopPurchase extensions
ALTER TABLE "ShopPurchase" ADD COLUMN IF NOT EXISTS "formResponses" JSONB;
CREATE INDEX IF NOT EXISTS "ShopPurchase_productId_idx" ON "ShopPurchase"("productId");
CREATE INDEX IF NOT EXISTS "ShopPurchase_stripePaymentId_idx" ON "ShopPurchase"("stripePaymentId");

-- Foreign keys
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_shopProductId_fkey" FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_shopPurchaseId_fkey" FOREIGN KEY ("shopPurchaseId") REFERENCES "ShopPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderMessageAttachment" ADD CONSTRAINT "OrderMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "OrderMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCategory" ADD CONSTRAINT "ShopCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_customTypeId_fkey" FOREIGN KEY ("customTypeId") REFERENCES "ShopProductTypeDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_shopCategoryId_fkey" FOREIGN KEY ("shopCategoryId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopProductFormField" ADD CONSTRAINT "ShopProductFormField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopProductMedia" ADD CONSTRAINT "ShopProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default custom product types
INSERT INTO "ShopProductTypeDefinition" ("id", "slug", "name", "description", "sortOrder", "isActive", "isCustom", "updatedAt")
VALUES
  ('cpt_custom_service', 'custom-service', 'Custom Service', 'General custom modding services', 0, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_design', 'custom-design', 'Custom Design', 'Custom design work', 1, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_sound', 'custom-sound-pack', 'Custom Sound Pack', 'Custom sound packs and audio', 2, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_hud', 'custom-hud-ui', 'Custom HUD/UI', 'Custom HUD and UI design', 3, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_vehicle', 'custom-vehicle-mod', 'Custom Vehicle Mod', 'Custom vehicle modifications', 4, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_gfx', 'custom-graphics-pack', 'Custom Graphics Pack', 'Custom graphics and textures', 5, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_mapping', 'custom-mapping-project', 'Custom Mapping Project', 'Custom map and world projects', 6, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_script', 'custom-script-project', 'Custom Script Project', 'Custom scripting projects', 7, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_bundle', 'custom-bundle', 'Custom Bundle', 'Bundled custom services', 8, true, true, CURRENT_TIMESTAMP),
  ('cpt_custom_request', 'custom-request', 'Custom Request', 'Open custom requests', 9, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
