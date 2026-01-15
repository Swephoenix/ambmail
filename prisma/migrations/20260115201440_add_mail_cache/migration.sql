-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "uid" INTEGER NOT NULL,
    "messageId" TEXT,
    "subject" TEXT,
    "from" TEXT,
    "to" TEXT,
    "date" TIMESTAMP(3),
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preview" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "hasBody" BOOLEAN NOT NULL DEFAULT false,
    "toRecipients" JSONB,
    "ccRecipients" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSyncState" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "lastUid" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailMessage_accountId_folder_uid_idx" ON "EmailMessage"("accountId", "folder", "uid");

-- CreateIndex
CREATE INDEX "EmailMessage_accountId_folder_date_idx" ON "EmailMessage"("accountId", "folder", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_accountId_folder_uid_key" ON "EmailMessage"("accountId", "folder", "uid");

-- CreateIndex
CREATE INDEX "MailSyncState_accountId_folder_idx" ON "MailSyncState"("accountId", "folder");

-- CreateIndex
CREATE UNIQUE INDEX "MailSyncState_accountId_folder_key" ON "MailSyncState"("accountId", "folder");

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailSyncState" ADD CONSTRAINT "MailSyncState_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
