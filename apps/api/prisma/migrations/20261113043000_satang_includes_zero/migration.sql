ALTER TABLE "Deposit" DROP CONSTRAINT "Deposit_satang_chk";
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_satang_chk" CHECK ("satang" >= 0 AND "satang" <= 99);
