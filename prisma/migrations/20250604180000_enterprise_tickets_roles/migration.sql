-- Enterprise tickets, partner Discord, role disable flag
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PENDING';

DO $$ BEGIN
  CREATE TYPE "TicketDepartment" AS ENUM (
    'SUPPORT',
    'MODERATION',
    'CREATOR_MANAGEMENT',
    'PARTNER_MANAGEMENT',
    'BILLING',
    'TECHNICAL_SUPPORT',
    'ADMINISTRATION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "department" "TicketDepartment" NOT NULL DEFAULT 'SUPPORT';
CREATE INDEX IF NOT EXISTS "SupportTicket_department_idx" ON "SupportTicket"("department");

CREATE TABLE IF NOT EXISTS "TicketWatcher" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TicketWatcher_ticketId_userId_key" ON "TicketWatcher"("ticketId", "userId");
CREATE INDEX IF NOT EXISTS "TicketWatcher_userId_idx" ON "TicketWatcher"("userId");
CREATE INDEX IF NOT EXISTS "TicketWatcher_ticketId_idx" ON "TicketWatcher"("ticketId");

DO $$ BEGIN
  ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "discordInviteUrl" TEXT;
ALTER TABLE "PartnerProfile" ADD COLUMN IF NOT EXISTS "discordWidgetUrl" TEXT;

ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "isDisabled" BOOLEAN NOT NULL DEFAULT false;
