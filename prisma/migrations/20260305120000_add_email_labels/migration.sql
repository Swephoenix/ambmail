-- Add labels column for local tagging
ALTER TABLE "EmailMessage" ADD COLUMN "labels" TEXT[] DEFAULT ARRAY[]::TEXT[];
