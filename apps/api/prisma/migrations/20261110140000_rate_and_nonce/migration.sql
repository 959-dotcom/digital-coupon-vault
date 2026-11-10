CREATE TABLE "RateBucket" (
    "bucket" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("bucket")
);

CREATE TABLE "RequestNonce" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "RequestNonce_expiresAt_idx" ON "RequestNonce"("expiresAt");
