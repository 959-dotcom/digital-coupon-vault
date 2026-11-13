import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { DomainError } from '../src/common/domain-error.js';
import { assertPinPair, assertRegistration, assertThaiMobile } from '../src/auth/registration.js';
import { reserveSlip, settleLocked } from '../src/deposits/deposit-decision.js';
import { allocateSatang, buildPromptPayPayload, formatExactAmount, payableTotal, parseMatchAmount, parseWholeBaht } from '../src/deposits/promptpay.js';
import { Decimal } from '../src/money/decimal.js';

test('two pending deposits never share a satang', () => {
  const used: number[] = [];
  const first = allocateSatang(used);
  used.push(first);
  const second = allocateSatang(used);
  assert.notEqual(first, second);
  assert.equal(payableTotal(parseWholeBaht('100'), first).toFixed(2), `100.${String(first).padStart(2, '0')}`);
  assert.equal(allocateSatang([]), 0);
  assert.throws(() => allocateSatang(Array.from({ length: 100 }, (_, index) => index)), DomainError);
  assert.throws(() => parseWholeBaht('100.50'), DomainError);
});

test('an empty PromptPay target does not build a QR payload', () => {
  assert.equal(buildPromptPayPayload('', new Decimal('100.37')), null);
  assert.equal(buildPromptPayPayload(null, new Decimal('100.37')), null);
  const payload = buildPromptPayPayload('0800000000', new Decimal('100.37'));
  assert.ok(payload);
  assert.match(payload, /^000201/);
  assert.match(payload, /5303764/);
  assert.match(payload, /5406100\.37/);
  assert.equal(formatExactAmount(new Decimal('300.0100')), '300.01');
  assert.equal(parseMatchAmount('300.01').toFixed(2), '300.01');
  assert.equal(parseMatchAmount('300.0100').toFixed(2), '300.01');
  const charged = buildPromptPayPayload('0800000000', new Decimal('300.0100'));
  assert.match(charged ?? '', /5406300\.01/);
  assert.doesNotThrow(() => buildPromptPayPayload('  ', new Decimal('1.00')));
});

test('a repeated slip is rejected', () => {
  const seen = new Set<string>();
  reserveSlip(seen, 'slip-hash');
  assert.throws(() => reserveSlip(seen, 'slip-hash'), /SLIP_REUSED/);
});

test('two concurrent approvals credit once and a later reject changes nothing', async () => {
  let status = 'REVIEW';
  let credits = 0;
  let chain = Promise.resolve();
  const lock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
  const read = async () => ({ status });
  const write = async (next: string) => {
    status = next;
  };
  const credit = async () => {
    credits += 1;
  };
  const [first, second] = await Promise.all([
    settleLocked(lock, read, write, credit, 'approve'),
    settleLocked(lock, read, write, credit, 'approve'),
  ]);
  assert.equal(credits, 1);
  assert.equal(status, 'PAID');
  assert.equal(first.credited !== second.credited, true);
  const after = await settleLocked(lock, read, write, credit, 'reject');
  assert.equal(after.credited, false);
  assert.equal(credits, 1);
  assert.equal(status, 'PAID');
});

test('a bad PIN is rejected and registration rejects a bad phone or a mismatched PIN', async () => {
  const hash = await bcrypt.hash('123456', 4);
  assert.equal(await bcrypt.compare('000000', hash), false);
  assert.equal(await bcrypt.compare('123456', hash), true);
  assert.throws(() => assertPinPair('123456', '654321'), (error: unknown) => error instanceof DomainError && error.code === 'PIN_MISMATCH');
  assert.throws(() => assertThaiMobile('081234567'), (error: unknown) => error instanceof DomainError && error.code === 'BAD_PHONE');
  assert.throws(
    () =>
      assertRegistration({
        phone: '0812345678',
        pin: '123456',
        pinConfirm: '123455',
        bankProvider: 'KBANK',
        accountNumber: '1234567890',
        fullName: 'ทดสอบ ระบบ',
        sourceChannel: 'FRIEND',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'PIN_MISMATCH',
  );
  const valid = assertRegistration({
    phone: '0812345678',
    pin: '123456',
    pinConfirm: '123456',
    bankProvider: 'TRUEWALLET',
    accountNumber: '0812345678',
    fullName: 'ทดสอบ ระบบ',
    sourceChannel: 'TIKTOK',
  });
  assert.equal(valid.phone, '0812345678');
  assert.equal(valid.bank, 'TRUEWALLET');
});
