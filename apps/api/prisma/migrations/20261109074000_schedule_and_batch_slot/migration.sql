-- Category draw calendar and multiple sessions per civil day.
ALTER TABLE "CouponCategory" ADD COLUMN "schedule" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "CouponBatch" ADD COLUMN "slot" TEXT NOT NULL DEFAULT 'day';
ALTER TABLE "CouponBatch" ADD COLUMN "settledAt" TIMESTAMP(3);
ALTER TABLE "CouponBatch" ADD COLUMN "outcome" JSONB;

DROP INDEX "CouponBatch_categoryId_batchDate_key";
CREATE UNIQUE INDEX "CouponBatch_categoryId_batchDate_slot_key" ON "CouponBatch"("categoryId", "batchDate", "slot");
