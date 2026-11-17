-- Coupon desk schema on the Hub Supabase project aozoakeghslgnhdegdyr.
-- Paste this file once in the Hub SQL editor:
-- https://supabase.com/dashboard/project/aozoakeghslgnhdegdyr/sql/new
--
-- Creates schema coupon and the coupon tables only.
-- Does not alter public hub tables.
-- Does not alter schema dmck.
-- Does not insert users and does not create Supabase Auth users.
-- Does not drop or pause the previous coupon database.
-- Safe to paste again: objects use IF NOT EXISTS, and catalog rows are skipped when present.
-- Do not add schema coupon to the Data API exposed schemas. The coupon API connects
-- with DATABASE_URL as the postgres role and uses schema coupon.
--
-- After this paste succeeds, set the API project's DATABASE_URL to the Hub pooler
-- URI (port 6543, pgbouncer=true, schema=coupon). Until that value changes, the
-- API keeps using the previous database.

CREATE SCHEMA IF NOT EXISTS coupon;

COMMENT ON SCHEMA coupon IS 'Digital coupon desk. Separate from hub tables in public and from schema dmck.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'ltree') THEN
    CREATE EXTENSION ltree WITH SCHEMA coupon;
  END IF;
END $$;

-- ltree may already live in public. coupon stays first so new unqualified names
-- cannot land in public; every table below is schema-qualified anyway.
SET search_path TO coupon, public;

DO $$ BEGIN
  CREATE TYPE coupon."Role" AS ENUM ('SUPER_ADMIN', 'MASTER_PARTNER', 'PARTNER', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."DistributionMode" AS ENUM ('COMMISSION_ONLY', 'FULL_PASS', 'SPLIT_KEEP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SETTLED', 'CANCELLED_SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."AccountType" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."PercentLockMode" AS ENUM ('ADMIN_LOCK', 'SELF_MANAGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."CreditKind" AS ENUM ('MINT', 'BURN', 'TRANSFER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."DepositStatus" AS ENUM ('PENDING', 'REVIEW', 'PAID', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."BankProvider" AS ENUM ('BBL', 'KBANK', 'KTB', 'SCB', 'BAY', 'TTB', 'GSB', 'BAAC', 'UOB', 'CIMB', 'KKP', 'LHB', 'TCRB', 'TRUEWALLET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon."SourceChannel" AS ENUM ('FACEBOOK', 'TIKTOK', 'GOOGLE', 'FRIEND', 'YOUTUBE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS coupon."Partner" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "path" ltree NOT NULL,
  "distributionMode" coupon."DistributionMode" NOT NULL,
  "commissionRates" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" coupon."Role" NOT NULL,
  "partnerId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "parentId" TEXT,
  "path" ltree NOT NULL,
  "referralCode" TEXT NOT NULL,
  "holdPercent" DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "commissionOnly" BOOLEAN NOT NULL DEFAULT false,
  "isStaff" BOOLEAN NOT NULL DEFAULT false,
  "principalId" TEXT,
  "permissions" JSONB,
  "phone" TEXT,
  "pinHash" TEXT,
  "bankProvider" coupon."BankProvider",
  "bankAccountNo" TEXT,
  "accountName" TEXT,
  "lineId" TEXT,
  "sourceChannel" coupon."SourceChannel",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."CouponCategory" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "cutoffTime" TEXT NOT NULL,
  "schedule" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "gridMin" INTEGER NOT NULL,
  "gridMax" INTEGER NOT NULL,
  "pad" INTEGER NOT NULL,
  "stakeAmounts" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."CouponBatch" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "batchDate" DATE NOT NULL,
  "slot" TEXT NOT NULL DEFAULT 'day',
  "label" TEXT NOT NULL,
  "isOpen" BOOLEAN NOT NULL DEFAULT true,
  "settledAt" TIMESTAMP(3),
  "outcome" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."CouponTx" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "totalAmount" DECIMAL(15, 4) NOT NULL,
  "status" coupon."TxStatus" NOT NULL,
  "txHash" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "CouponTx_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."CommissionRecord" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "categoryCode" TEXT NOT NULL,
  "rate" DECIMAL(5, 4) NOT NULL,
  "baseAmount" DECIMAL(15, 4) NOT NULL,
  "amount" DECIMAL(15, 4) NOT NULL,
  "mode" coupon."DistributionMode" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."LedgerEntry" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "accountType" coupon."AccountType" NOT NULL,
  "accountCode" TEXT NOT NULL,
  "debit" DECIMAL(15, 4) NOT NULL,
  "credit" DECIMAL(15, 4) NOT NULL,
  "memo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."Withdrawal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(15, 4) NOT NULL,
  "destination" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "wallet" TEXT NOT NULL DEFAULT 'POINTS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "detail" JSONB NOT NULL,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."RateBucket" (
  "bucket" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("bucket")
);

CREATE TABLE IF NOT EXISTS coupon."RequestNonce" (
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE TABLE IF NOT EXISTS coupon."SystemSetting" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "adminBasePercent" DECIMAL(5, 2) NOT NULL DEFAULT 5,
  "percentLockMode" coupon."PercentLockMode" NOT NULL DEFAULT 'ADMIN_LOCK',
  "promptPayId" TEXT,
  "telegramBotToken" TEXT,
  "telegramChatId" TEXT,
  "telegramWebhookSecret" TEXT,
  "payoutRail" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."CreditAccount" (
  "userId" TEXT NOT NULL,
  "balance" DECIMAL(15, 4) NOT NULL DEFAULT 0,
  CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS coupon."CreditTransaction" (
  "id" TEXT NOT NULL,
  "kind" coupon."CreditKind" NOT NULL,
  "senderId" TEXT,
  "receiverId" TEXT,
  "amount" DECIMAL(15, 4) NOT NULL,
  "senderBefore" DECIMAL(15, 4),
  "senderAfter" DECIMAL(15, 4),
  "receiverBefore" DECIMAL(15, 4),
  "receiverAfter" DECIMAL(15, 4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."BillShare" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "holdPercent" DECIMAL(6, 2) NOT NULL,
  "amount" DECIMAL(15, 4) NOT NULL,
  "receivedFromBelow" DECIMAL(15, 4) NOT NULL,
  "sentUpward" DECIMAL(15, 4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."LineProduct" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS coupon."Deposit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requested" DECIMAL(15, 4) NOT NULL,
  "satang" INTEGER NOT NULL,
  "amount" DECIMAL(15, 4) NOT NULL,
  "qrRef" TEXT NOT NULL,
  "status" coupon."DepositStatus" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "bankRef" TEXT,
  "slipSha256" TEXT,
  "slipName" TEXT,
  "slipBytes" BYTEA,
  "paidAt" TIMESTAMP(3),
  "decidedBy" TEXT,
  "telegramUpdateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Partner_code_key" ON coupon."Partner" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Partner_path_key" ON coupon."Partner" ("path");
CREATE INDEX IF NOT EXISTS "Partner_parentId_idx" ON coupon."Partner" ("parentId");
CREATE INDEX IF NOT EXISTS "Partner_path_gist_idx" ON coupon."Partner" USING GIST ("path");

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON coupon."User" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON coupon."User" ("referralCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_path_key" ON coupon."User" ("path");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON coupon."User" ("phone");
CREATE INDEX IF NOT EXISTS "User_partnerId_idx" ON coupon."User" ("partnerId");
CREATE INDEX IF NOT EXISTS "User_parentId_idx" ON coupon."User" ("parentId");
CREATE INDEX IF NOT EXISTS "User_principalId_idx" ON coupon."User" ("principalId");
CREATE INDEX IF NOT EXISTS "User_path_gist_idx" ON coupon."User" USING GIST ("path");

CREATE UNIQUE INDEX IF NOT EXISTS "CouponCategory_code_key" ON coupon."CouponCategory" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "CouponBatch_categoryId_batchDate_slot_key" ON coupon."CouponBatch" ("categoryId", "batchDate", "slot");
CREATE INDEX IF NOT EXISTS "CouponBatch_categoryId_idx" ON coupon."CouponBatch" ("categoryId");

CREATE UNIQUE INDEX IF NOT EXISTS "CouponTx_txHash_key" ON coupon."CouponTx" ("txHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CouponTx_idempotencyKey_key" ON coupon."CouponTx" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CouponTx_userId_createdAt_idx" ON coupon."CouponTx" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CouponTx_partnerId_idx" ON coupon."CouponTx" ("partnerId");
CREATE INDEX IF NOT EXISTS "CouponTx_categoryId_idx" ON coupon."CouponTx" ("categoryId");
CREATE INDEX IF NOT EXISTS "CouponTx_batchId_idx" ON coupon."CouponTx" ("batchId");
CREATE INDEX IF NOT EXISTS "CouponTx_status_idx" ON coupon."CouponTx" ("status");

CREATE INDEX IF NOT EXISTS "CommissionRecord_transactionId_idx" ON coupon."CommissionRecord" ("transactionId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_partnerId_idx" ON coupon."CommissionRecord" ("partnerId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_transactionId_idx" ON coupon."LedgerEntry" ("transactionId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_accountCode_idx" ON coupon."LedgerEntry" ("accountCode");
CREATE INDEX IF NOT EXISTS "Withdrawal_userId_createdAt_idx" ON coupon."Withdrawal" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON coupon."AdminAuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON coupon."AdminAuditLog" ("action");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key" ON coupon."Notification" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON coupon."Notification" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RequestNonce_expiresAt_idx" ON coupon."RequestNonce" ("expiresAt");
CREATE INDEX IF NOT EXISTS "CreditTransaction_senderId_createdAt_idx" ON coupon."CreditTransaction" ("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditTransaction_receiverId_createdAt_idx" ON coupon."CreditTransaction" ("receiverId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BillShare_transactionId_userId_key" ON coupon."BillShare" ("transactionId", "userId");
CREATE INDEX IF NOT EXISTS "BillShare_userId_idx" ON coupon."BillShare" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "LineProduct_userId_code_key" ON coupon."LineProduct" ("userId", "code");
CREATE INDEX IF NOT EXISTS "LineProduct_code_idx" ON coupon."LineProduct" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Deposit_qrRef_key" ON coupon."Deposit" ("qrRef");
CREATE UNIQUE INDEX IF NOT EXISTS "Deposit_bankRef_key" ON coupon."Deposit" ("bankRef");
CREATE UNIQUE INDEX IF NOT EXISTS "Deposit_slipSha256_key" ON coupon."Deposit" ("slipSha256");
CREATE INDEX IF NOT EXISTS "Deposit_userId_createdAt_idx" ON coupon."Deposit" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Deposit_status_idx" ON coupon."Deposit" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "Deposit_open_satang_key" ON coupon."Deposit" ("satang") WHERE "status" IN ('PENDING', 'REVIEW');

DO $$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    'ALTER TABLE coupon."Partner" ADD CONSTRAINT "Partner_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES coupon."Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES coupon."Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."User" ADD CONSTRAINT "User_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."User" ADD CONSTRAINT "User_holdPercent_chk" CHECK ("holdPercent" >= 0 AND "holdPercent" <= 100)',
    'ALTER TABLE coupon."CouponBatch" ADD CONSTRAINT "CouponBatch_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES coupon."CouponCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CouponTx" ADD CONSTRAINT "CouponTx_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CouponTx" ADD CONSTRAINT "CouponTx_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES coupon."Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CouponTx" ADD CONSTRAINT "CouponTx_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES coupon."CouponCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CouponTx" ADD CONSTRAINT "CouponTx_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES coupon."CouponBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CommissionRecord" ADD CONSTRAINT "CommissionRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES coupon."CouponTx"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CommissionRecord" ADD CONSTRAINT "CommissionRecord_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES coupon."Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."LedgerEntry" ADD CONSTRAINT "LedgerEntry_one_side_chk" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))',
    'ALTER TABLE coupon."Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."Withdrawal" ADD CONSTRAINT "Withdrawal_amount_positive_chk" CHECK ("amount" > 0)',
    'ALTER TABLE coupon."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."SystemSetting" ADD CONSTRAINT "SystemSetting_base_chk" CHECK ("adminBasePercent" >= 5 AND "adminBasePercent" <= 100)',
    'ALTER TABLE coupon."CreditAccount" ADD CONSTRAINT "CreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CreditAccount" ADD CONSTRAINT "CreditAccount_balance_chk" CHECK ("balance" >= 0)',
    'ALTER TABLE coupon."CreditTransaction" ADD CONSTRAINT "CreditTransaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CreditTransaction" ADD CONSTRAINT "CreditTransaction_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."CreditTransaction" ADD CONSTRAINT "CreditTransaction_amount_chk" CHECK ("amount" > 0)',
    'ALTER TABLE coupon."BillShare" ADD CONSTRAINT "BillShare_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES coupon."CouponTx"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."BillShare" ADD CONSTRAINT "BillShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."LineProduct" ADD CONSTRAINT "LineProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES coupon."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE coupon."Deposit" ADD CONSTRAINT "Deposit_satang_chk" CHECK ("satang" >= 0 AND "satang" <= 99)'
  ]
  LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION coupon.block_confirmed_tx_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = coupon, public
AS $$
BEGIN
  IF OLD.status IN ('CONFIRMED', 'SETTLED') THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Vault records are immutable and read-only.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION coupon.block_admin_audit_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = coupon, public
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_IMMUTABLE';
END;
$$;

CREATE OR REPLACE FUNCTION coupon.block_written_bill_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = coupon, public
AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Bill records are immutable and read-only.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_vault_tx ON coupon."CouponTx";
CREATE TRIGGER trg_protect_vault_tx
BEFORE UPDATE OR DELETE ON coupon."CouponTx"
FOR EACH ROW EXECUTE FUNCTION coupon.block_confirmed_tx_modifications();

DROP TRIGGER IF EXISTS trg_protect_admin_audit ON coupon."AdminAuditLog";
CREATE TRIGGER trg_protect_admin_audit
BEFORE UPDATE OR DELETE ON coupon."AdminAuditLog"
FOR EACH ROW EXECUTE FUNCTION coupon.block_admin_audit_modifications();

DROP TRIGGER IF EXISTS trg_protect_bill_share ON coupon."BillShare";
CREATE TRIGGER trg_protect_bill_share
BEFORE UPDATE OR DELETE ON coupon."BillShare"
FOR EACH ROW EXECUTE FUNCTION coupon.block_written_bill_modifications();

DROP TRIGGER IF EXISTS trg_protect_commission_record ON coupon."CommissionRecord";
CREATE TRIGGER trg_protect_commission_record
BEFORE UPDATE OR DELETE ON coupon."CommissionRecord"
FOR EACH ROW EXECUTE FUNCTION coupon.block_written_bill_modifications();

-- Catalog rows only. No accounts.
INSERT INTO coupon."SystemSetting" ("id", "adminBasePercent", "percentLockMode", "updatedAt")
VALUES ('default', 5, 'ADMIN_LOCK', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO coupon."CouponCategory" (
  "id", "code", "name", "description", "cutoffTime", "schedule", "isActive",
  "gridMin", "gridMax", "pad", "stakeAmounts", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text,
       'YEEKEE_10M',
       'ยี่กี VIP 10 นาที',
       'เปิดงวดทุก 10 นาทีตามนาฬิกาเซิร์ฟเวอร์เวลาประเทศไทย',
       '00:10',
       '{"group":"FLASH","weekdays":null,"daysOfMonth":null,"sessions":[],"intervalMinutes":10,"batchesPerDay":143}'::jsonb,
       true,
       0,
       999,
       3,
       '["10.0000","20.0000","50.0000","100.0000"]'::jsonb,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM coupon."CouponCategory" WHERE "code" = 'YEEKEE_10M');

ALTER TABLE coupon."Partner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."CouponCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."CouponBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."CouponTx" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."CommissionRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."Withdrawal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."RateBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."RequestNonce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."SystemSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."CreditAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."CreditTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."BillShare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."LineProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon."Deposit" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA coupon FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA coupon FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA coupon FROM PUBLIC;

-- Data API roles get no privileges. The postgres role used by DATABASE_URL
-- owns these tables and bypasses row level security. No policies are created.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA coupon FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA coupon FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA coupon FROM %I', role_name);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT USAGE ON SCHEMA coupon TO postgres;
    GRANT ALL ON ALL TABLES IN SCHEMA coupon TO postgres;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA coupon TO postgres;
  END IF;
END $$;
