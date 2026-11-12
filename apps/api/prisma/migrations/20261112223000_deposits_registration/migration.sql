-- PromptPay deposits, customer registration, and cash withdrawals.
-- Existing loan, receipt, profile, and non-point ledger rows are not modified.

CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'REVIEW', 'PAID', 'REJECTED', 'EXPIRED');
CREATE TYPE "BankProvider" AS ENUM ('BBL', 'KBANK', 'KTB', 'SCB', 'BAY', 'TTB', 'GSB', 'BAAC', 'UOB', 'CIMB', 'KKP', 'LHB', 'TCRB', 'TRUEWALLET');
CREATE TYPE "SourceChannel" AS ENUM ('FACEBOOK', 'TIKTOK', 'GOOGLE', 'FRIEND', 'YOUTUBE', 'OTHER');

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "bankProvider" "BankProvider";
ALTER TABLE "User" ADD COLUMN "bankAccountNo" TEXT;
ALTER TABLE "User" ADD COLUMN "accountName" TEXT;
ALTER TABLE "User" ADD COLUMN "lineId" TEXT;
ALTER TABLE "User" ADD COLUMN "sourceChannel" "SourceChannel";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "Withdrawal" ADD COLUMN "wallet" TEXT NOT NULL DEFAULT 'POINTS';

ALTER TABLE "SystemSetting" ADD COLUMN "promptPayId" TEXT;
ALTER TABLE "SystemSetting" ADD COLUMN "telegramBotToken" TEXT;
ALTER TABLE "SystemSetting" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "SystemSetting" ADD COLUMN "telegramWebhookSecret" TEXT;
ALTER TABLE "SystemSetting" ADD COLUMN "payoutRail" TEXT;

CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requested" DECIMAL(15,4) NOT NULL,
    "satang" INTEGER NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "qrRef" TEXT NOT NULL,
    "status" "DepositStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "bankRef" TEXT,
    "slipSha256" TEXT,
    "slipName" TEXT,
    "slipBytes" BYTEA,
    "paidAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "telegramUpdateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Deposit_satang_chk" CHECK ("satang" >= 1 AND "satang" <= 99)
);
CREATE UNIQUE INDEX "Deposit_qrRef_key" ON "Deposit"("qrRef");
CREATE UNIQUE INDEX "Deposit_bankRef_key" ON "Deposit"("bankRef");
CREATE UNIQUE INDEX "Deposit_slipSha256_key" ON "Deposit"("slipSha256");
CREATE INDEX "Deposit_userId_createdAt_idx" ON "Deposit"("userId", "createdAt");
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");
CREATE UNIQUE INDEX "Deposit_open_satang_key" ON "Deposit"("satang") WHERE "status" IN ('PENDING', 'REVIEW');
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
