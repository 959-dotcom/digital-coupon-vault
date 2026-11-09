-- CreateExtension
CREATE EXTENSION IF NOT EXISTS ltree;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "DistributionMode" AS ENUM ('COMMISSION_ONLY', 'FULL_PASS', 'SPLIT_KEEP');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SETTLED', 'CANCELLED_SYSTEM');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "distributionMode" "DistributionMode" NOT NULL,
    "commissionRates" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "partnerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cutoffTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gridMin" INTEGER NOT NULL,
    "gridMax" INTEGER NOT NULL,
    "pad" INTEGER NOT NULL,
    "stakeAmounts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponBatch" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "batchDate" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponTx" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(15,4) NOT NULL,
    "status" "TxStatus" NOT NULL,
    "txHash" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "CouponTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "baseAmount" DECIMAL(15,4) NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "mode" "DistributionMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debit" DECIMAL(15,4) NOT NULL,
    "credit" DECIMAL(15,4) NOT NULL,
    "memo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "CouponCategory_code_key" ON "CouponCategory"("code");
CREATE UNIQUE INDEX "CouponBatch_categoryId_batchDate_key" ON "CouponBatch"("categoryId", "batchDate");
CREATE UNIQUE INDEX "CouponTx_txHash_key" ON "CouponTx"("txHash");
CREATE UNIQUE INDEX "CouponTx_idempotencyKey_key" ON "CouponTx"("idempotencyKey");

CREATE INDEX "Partner_parentId_idx" ON "Partner"("parentId");
CREATE INDEX "User_partnerId_idx" ON "User"("partnerId");
CREATE INDEX "CouponBatch_categoryId_idx" ON "CouponBatch"("categoryId");
CREATE INDEX "CouponTx_userId_createdAt_idx" ON "CouponTx"("userId", "createdAt");
CREATE INDEX "CouponTx_partnerId_idx" ON "CouponTx"("partnerId");
CREATE INDEX "CouponTx_categoryId_idx" ON "CouponTx"("categoryId");
CREATE INDEX "CouponTx_batchId_idx" ON "CouponTx"("batchId");
CREATE INDEX "CouponTx_status_idx" ON "CouponTx"("status");
CREATE INDEX "CommissionRecord_transactionId_idx" ON "CommissionRecord"("transactionId");
CREATE INDEX "CommissionRecord_partnerId_idx" ON "CommissionRecord"("partnerId");
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX "LedgerEntry_accountCode_idx" ON "LedgerEntry"("accountCode");

ALTER TABLE "Partner" ADD CONSTRAINT "Partner_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponBatch" ADD CONSTRAINT "CouponBatch_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CouponCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponTx" ADD CONSTRAINT "CouponTx_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponTx" ADD CONSTRAINT "CouponTx_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponTx" ADD CONSTRAINT "CouponTx_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CouponCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponTx" ADD CONSTRAINT "CouponTx_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CouponBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "CouponTx"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_one_side_chk" CHECK (
  ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
);

-- Cast the hierarchy path to ltree and index containment queries.
ALTER TABLE "Partner" ALTER COLUMN "path" TYPE ltree USING "path"::ltree;
CREATE UNIQUE INDEX "Partner_path_key" ON "Partner"("path");
CREATE INDEX "Partner_path_gist_idx" ON "Partner" USING GIST ("path");

-- CONFIRMED and SETTLED vault rows are immutable. PENDING may move to CONFIRMED or CANCELLED_SYSTEM.
CREATE OR REPLACE FUNCTION block_confirmed_tx_modifications()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('CONFIRMED', 'SETTLED') THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Vault records are immutable and read-only.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_vault_tx
BEFORE UPDATE OR DELETE ON "CouponTx"
FOR EACH ROW EXECUTE FUNCTION block_confirmed_tx_modifications();
