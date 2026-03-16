ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "AuthNonce" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthNonce_walletAddress_key" ON "AuthNonce"("walletAddress");
CREATE INDEX IF NOT EXISTS "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");
