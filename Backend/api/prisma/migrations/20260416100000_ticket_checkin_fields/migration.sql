-- Add check-in tracking fields to ticket_purchases
ALTER TABLE "ticket_purchases" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "ticket_purchases" ADD COLUMN IF NOT EXISTS "checkedInBy" TEXT;
