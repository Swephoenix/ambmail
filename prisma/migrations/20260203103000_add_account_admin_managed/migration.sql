-- Track whether an account password was set via admin panel
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "adminManaged" BOOLEAN NOT NULL DEFAULT false;
