-- Add encrypted password storage for admin visibility
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordEncrypted" TEXT;
