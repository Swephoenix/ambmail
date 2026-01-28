CREATE TABLE "NextcloudToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT,
    "scope" TEXT,
    "ncUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextcloudToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NextcloudToken_userId_key" ON "NextcloudToken"("userId");

ALTER TABLE "NextcloudToken" ADD CONSTRAINT "NextcloudToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
