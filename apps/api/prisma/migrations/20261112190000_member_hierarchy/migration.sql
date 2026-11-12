-- Member line, hold percent, credit, and immutable bill slices.
-- Existing loan, receipt, and profile tables are not modified.

ALTER TABLE "User" ADD COLUMN "parentId" TEXT;
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "path" TEXT;
ALTER TABLE "User" ADD COLUMN "holdPercent" DECIMAL(6,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "commissionOnly" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "referralCode" = lower(split_part(email, '@', 1))
WHERE "referralCode" IS NULL
  AND lower(split_part(email, '@', 1)) ~ '^[a-z][a-z0-9_]{0,30}$';

UPDATE "User"
SET "referralCode" = 'u' || substr(replace(id::text, '-', ''), 1, 12)
WHERE "referralCode" IS NULL;

UPDATE "User" AS child
SET "parentId" = parent.id
FROM "User" AS parent
WHERE child.email = 'master@vantage.local'
  AND parent.email = 'admin@vantage.local'
  AND child."parentId" IS NULL;

UPDATE "User" AS child
SET "parentId" = parent.id
FROM "User" AS parent
WHERE child.email = 'shop@vantage.local'
  AND parent.email = 'master@vantage.local'
  AND child."parentId" IS NULL;

UPDATE "User" AS child
SET "parentId" = parent.id
FROM "User" AS parent
WHERE child.email = 'member@vantage.local'
  AND parent.email = 'shop@vantage.local'
  AND child."parentId" IS NULL;

UPDATE "User"
SET path = "referralCode"
WHERE "parentId" IS NULL
  AND path IS NULL;

DO $$
DECLARE
  updated integer := 1;
  guard integer := 0;
BEGIN
  WHILE updated > 0 AND guard < 32 LOOP
    UPDATE "User" AS child
    SET path = parent.path || '.' || child."referralCode"
    FROM "User" AS parent
    WHERE child."parentId" = parent.id
      AND parent.path IS NOT NULL
      AND child.path IS NULL;
    GET DIAGNOSTICS updated = ROW_COUNT;
    guard := guard + 1;
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "path" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "path" TYPE ltree USING "path"::ltree;

ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "User_path_key" ON "User"("path");
CREATE INDEX "User_parentId_idx" ON "User"("parentId");
CREATE INDEX "User_path_gist_idx" ON "User" USING GIST ("path");
ALTER TABLE "User" ADD CONSTRAINT "User_holdPercent_chk" CHECK ("holdPercent" >= 0 AND "holdPercent" <= 100);

CREATE TYPE "PercentLockMode" AS ENUM ('ADMIN_LOCK', 'SELF_MANAGE');
CREATE TYPE "CreditKind" AS ENUM ('MINT', 'BURN', 'TRANSFER');

CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "adminBasePercent" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "percentLockMode" "PercentLockMode" NOT NULL DEFAULT 'ADMIN_LOCK',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SystemSetting_base_chk" CHECK ("adminBasePercent" >= 5 AND "adminBasePercent" <= 10)
);

INSERT INTO "SystemSetting" ("id", "adminBasePercent", "percentLockMode", "updatedAt")
VALUES ('default', 5, 'ADMIN_LOCK', CURRENT_TIMESTAMP);

CREATE TABLE "CreditAccount" (
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "CreditAccount_balance_chk" CHECK ("balance" >= 0)
);

INSERT INTO "CreditAccount" ("userId", "balance")
SELECT id, 0 FROM "User"
ON CONFLICT ("userId") DO NOTHING;

ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT,
    "amount" DECIMAL(15,4) NOT NULL,
    "senderBefore" DECIMAL(15,4),
    "senderAfter" DECIMAL(15,4),
    "receiverBefore" DECIMAL(15,4),
    "receiverAfter" DECIMAL(15,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditTransaction_amount_chk" CHECK ("amount" > 0)
);

CREATE INDEX "CreditTransaction_senderId_createdAt_idx" ON "CreditTransaction"("senderId", "createdAt");
CREATE INDEX "CreditTransaction_receiverId_createdAt_idx" ON "CreditTransaction"("receiverId", "createdAt");
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BillShare" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holdPercent" DECIMAL(6,2) NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "receivedFromBelow" DECIMAL(15,4) NOT NULL,
    "sentUpward" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillShare_transactionId_userId_key" ON "BillShare"("transactionId", "userId");
CREATE INDEX "BillShare_userId_idx" ON "BillShare"("userId");
ALTER TABLE "BillShare" ADD CONSTRAINT "BillShare_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "CouponTx"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillShare" ADD CONSTRAINT "BillShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION block_written_bill_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Bill records are immutable and read-only.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_bill_share
BEFORE UPDATE OR DELETE ON "BillShare"
FOR EACH ROW EXECUTE FUNCTION block_written_bill_modifications();

CREATE TRIGGER trg_protect_commission_record
BEFORE UPDATE OR DELETE ON "CommissionRecord"
FOR EACH ROW EXECUTE FUNCTION block_written_bill_modifications();
