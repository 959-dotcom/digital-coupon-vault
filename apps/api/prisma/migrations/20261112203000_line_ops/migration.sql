-- Widen the admin base fee to 5.00–100.00, and add staff, line products, and audit IP.
-- Existing loan, receipt, and profile tables are not modified.

ALTER TABLE "SystemSetting" DROP CONSTRAINT "SystemSetting_base_chk";
ALTER TABLE "SystemSetting" ALTER COLUMN "adminBasePercent" TYPE DECIMAL(5,2);
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_base_chk" CHECK ("adminBasePercent" >= 5 AND "adminBasePercent" <= 100);

ALTER TABLE "User" ADD COLUMN "isStaff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "principalId" TEXT;
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;
ALTER TABLE "User" ADD CONSTRAINT "User_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_principalId_idx" ON "User"("principalId");

ALTER TABLE "AdminAuditLog" ADD COLUMN "ip" TEXT;

CREATE TABLE "LineProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LineProduct_userId_code_key" ON "LineProduct"("userId", "code");
CREATE INDEX "LineProduct_code_idx" ON "LineProduct"("code");
ALTER TABLE "LineProduct" ADD CONSTRAINT "LineProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CouponCategory" (
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
WHERE NOT EXISTS (SELECT 1 FROM "CouponCategory" WHERE "code" = 'YEEKEE_10M');
