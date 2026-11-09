import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error.js';
import { Decimal, ZERO, minorUnitsToSafeInteger, moneyFromDatabase, toMinorUnits } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { creditBalanceLua, releaseBalanceLua, releaseLockLua, reserveBalanceLua, captureHoldLua } from './lua-scripts.js';
import { RedisService } from './redis.service.js';

const HOLD_TTL_SECONDS = 120;

@Injectable()
export class WalletService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async reserve(userId: string, amount: Decimal, token: string): Promise<void> {
    const minor = toMinorUnits(amount);
    await this.withLock(userId, async () => {
      await this.ensureWallet(userId);
      const result = await this.evalReserve(userId, minor, token);
      if (result === 'ALREADY' || result === 'OK') {
        return;
      }
      if (result === 'NO_WALLET') {
        await this.ensureWallet(userId);
        const retried = await this.evalReserve(userId, minor, token);
        if (retried === 'OK' || retried === 'ALREADY') {
          return;
        }
        throw new DomainError(retried === 'INSUFFICIENT' ? 'INSUFFICIENT_BALANCE' : 'RESERVE_FAILED');
      }
      if (result === 'INSUFFICIENT') {
        throw new DomainError('INSUFFICIENT_BALANCE');
      }
      throw new DomainError('RESERVE_FAILED');
    });
  }

  async release(userId: string, token: string): Promise<void> {
    await this.withLock(userId, async () => {
      const raw = await this.redis.client.eval(releaseBalanceLua, 2, this.walletKey(userId), this.holdKey(token));
      const [flag, reason] = asTuple(raw);
      if (flag === '1' || reason === 'MISSING') {
        return;
      }
      throw new DomainError('RESERVE_FAILED');
    });
  }

  async capture(token: string): Promise<void> {
    await this.redis.client.eval(captureHoldLua, 1, this.holdKey(token));
  }

  async credit(userId: string, amount: Decimal): Promise<void> {
    const minor = toMinorUnits(amount);
    await this.withLock(userId, async () => {
      const key = this.walletKey(userId);
      if ((await this.redis.client.exists(key)) === 0) {
        const won = await this.writeWalletFromLedger(userId);
        if (won) {
          return;
        }
      }
      const raw = await this.redis.client.eval(
        creditBalanceLua,
        1,
        key,
        String(minorUnitsToSafeInteger(minor)),
      );
      const [flag] = asTuple(raw);
      if (flag !== '1') {
        throw new DomainError('RESERVE_FAILED');
      }
    });
  }

  private async evalReserve(userId: string, minor: string, token: string): Promise<string> {
    const raw = await this.redis.client.eval(
      reserveBalanceLua,
      2,
      this.walletKey(userId),
      this.holdKey(token),
      String(minorUnitsToSafeInteger(minor)),
      token,
      String(HOLD_TTL_SECONDS),
    );
    const [flag, tokenOrReason, detail] = asTuple(raw);
    if (flag === '1' && detail === 'ALREADY') {
      return 'ALREADY';
    }
    if (flag === '1') {
      return 'OK';
    }
    return tokenOrReason || 'RESERVE_FAILED';
  }

  private async ensureWallet(userId: string): Promise<void> {
    if ((await this.redis.client.exists(this.walletKey(userId))) === 1) {
      return;
    }
    await this.writeWalletFromLedger(userId);
  }

  private async writeWalletFromLedger(userId: string): Promise<boolean> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { accountCode: this.accountCode(userId) },
      select: { debit: true, credit: true },
    });
    let available = ZERO;
    for (const row of rows) {
      available = available.plus(moneyFromDatabase(row.credit)).minus(moneyFromDatabase(row.debit));
    }
    if (available.lt(0)) {
      throw new DomainError('INSUFFICIENT_BALANCE');
    }
    const minor = available.eq(0) ? '0' : toMinorUnits(available);
    const wrote = await this.redis.client.set(this.walletKey(userId), minor, 'NX');
    return wrote === 'OK';
  }

  private async withLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const key = `wallet:lock:${userId}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const got = await this.redis.client.set(key, token, 'EX', 8, 'NX');
      if (got === 'OK') {
        try {
          return await fn();
        } finally {
          await this.redis.client.eval(releaseLockLua, 1, key, token);
        }
      }
      await delay(40 * (attempt + 1));
    }
    throw new DomainError('WALLET_BUSY');
  }

  private walletKey(userId: string): string {
    return `wallet:points:${userId}`;
  }

  private holdKey(token: string): string {
    return `wallet:hold:${token}`;
  }

  private accountCode(userId: string): string {
    return `USER_POINTS:${userId}`;
  }
}

function asTuple(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
