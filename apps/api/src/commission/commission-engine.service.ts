import { Injectable } from '@nestjs/common';
import { DomainError, asDomainError } from '../common/domain-error.js';
import { Decimal } from '../money/decimal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { categoryRate } from '../partners/rates.js';
import { allocateCommissions, type Allocation, type ChainNode, type DistributionModeName } from './commission-math.js';

type ChainRow = {
  id: string;
  distributionMode: string;
  commissionRates: unknown;
};

@Injectable()
export class CommissionEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(sellerId: string, categoryCode: string, volume: Decimal): Promise<Allocation> {
    const seller = await this.prisma.partner.findUnique({ where: { id: sellerId } });
    if (!seller || !seller.isActive) {
      throw new DomainError('PARTNER_INACTIVE');
    }
    const rows = await this.prisma.$queryRaw<ChainRow[]>`
      SELECT id,
             "distributionMode"::text AS "distributionMode",
             "commissionRates"
      FROM "Partner"
      WHERE ${seller.path}::ltree <@ path
        AND "isActive" = true
      ORDER BY nlevel(path) DESC
    `;
    if (rows.length === 0 || rows[0]?.id !== seller.id) {
      throw new DomainError('PARTNER_INACTIVE');
    }
    const chain: ChainNode[] = rows.map((row) => ({
      id: row.id,
      mode: asMode(row.distributionMode),
      rate: rateFor(row.commissionRates, categoryCode),
    }));
    return allocateCommissions(chain, volume, categoryCode);
  }
}

function asMode(value: string): DistributionModeName {
  if (value === 'COMMISSION_ONLY' || value === 'FULL_PASS' || value === 'SPLIT_KEEP') {
    return value;
  }
  throw new DomainError('INVALID_ITEM');
}

function rateFor(rates: unknown, categoryCode: string): Decimal {
  try {
    return new Decimal(categoryRate(rates, categoryCode));
  } catch (error) {
    throw asDomainError(error) ?? error;
  }
}
