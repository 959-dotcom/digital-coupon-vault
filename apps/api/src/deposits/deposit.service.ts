import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { AccessService } from '../access/access.service.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { DomainError } from '../common/domain-error.js';
import { Decimal, formatMoney, moneyFromDatabase, parseExactMoney } from '../money/decimal.js';
import { Prisma } from '../generated/prisma/client.js';
import { buildDepositLedger } from '../money/ledger.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { settleLocked, type ReviewStatus } from './deposit-decision.js';
import { allocateSatang, buildPromptPayPayload, normalizePromptPayTarget, parseWholeBaht, payableTotal } from './promptpay.js';

const DEPOSIT_TTL_MS = 15 * 60 * 1000;
const PUBLIC_API = process.env.API_PUBLIC_URL ?? 'https://api.db357.com';

type PaymentRow = {
  promptPayId: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramWebhookSecret: string | null;
  payoutRail: string | null;
};

@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
  ) {}

  async config(): Promise<{ open: boolean }> {
    const settings = await this.settings();
    return { open: Boolean(settings.promptPayId) };
  }

  async adminView(actor: AuthUser) {
    await this.access.denyStaff(actor);
    this.assertAdmin(actor);
    const settings = await this.settings();
    return {
      open: Boolean(settings.promptPayId),
      promptPayId: settings.promptPayId ?? '',
      telegramConfigured: Boolean(settings.telegramBotToken && settings.telegramChatId),
      telegramChatId: settings.telegramChatId ?? '',
      payoutRail: settings.payoutRail ?? '',
      payoutRailConfigured: Boolean(settings.payoutRail?.trim()),
    };
  }

  async updateSettings(
    actor: AuthUser,
    input: {
      promptPayId?: string;
      telegramChatId?: string;
      telegramBotToken?: string;
      clearTelegramToken?: boolean;
      payoutRail?: string;
    },
    ip?: string,
  ) {
    await this.access.denyStaff(actor);
    this.assertAdmin(actor);
    const current = await this.settings();
    const data: {
      promptPayId?: string | null;
      telegramChatId?: string | null;
      telegramBotToken?: string | null;
      telegramWebhookSecret?: string | null;
      payoutRail?: string | null;
    } = {};
    if (input.promptPayId !== undefined) {
      data.promptPayId = normalizePromptPayTarget(input.promptPayId);
    }
    if (input.telegramChatId !== undefined) {
      data.telegramChatId = input.telegramChatId.trim() || null;
    }
    if (input.payoutRail !== undefined) {
      data.payoutRail = input.payoutRail.trim() || null;
    }
    if (input.clearTelegramToken) {
      data.telegramBotToken = null;
    } else if (input.telegramBotToken?.trim()) {
      data.telegramBotToken = input.telegramBotToken.trim();
      if (!current.telegramWebhookSecret) {
        data.telegramWebhookSecret = randomBytes(32).toString('hex');
      }
    }
    const saved = await this.prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', adminBasePercent: '5.00', ...data },
    });
    await this.audit.append(this.prisma, {
      actorId: actor.userId,
      action: 'PAYMENT_SETTINGS',
      target: 'default',
      detail: {
        promptPaySet: Boolean(saved.promptPayId),
        telegramSet: Boolean(saved.telegramBotToken),
        chatSet: Boolean(saved.telegramChatId),
        payoutRailSet: Boolean(saved.payoutRail),
      },
      ip,
    });
    const webhookSet = await this.ensureWebhook(saved);
    return { ...(await this.adminView(actor)), webhookSet };
  }

  async list(actor: AuthUser) {
    await this.expireOpen();
    const rows = await this.prisma.deposit.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: depositSelect,
    });
    return rows.map((row) => this.present(row));
  }

  async create(actor: AuthUser, amountInput: string) {
    const settings = await this.settings();
    if (!settings.promptPayId) {
      throw new DomainError('DEPOSITS_CLOSED');
    }
    const requested = parseWholeBaht(amountInput);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const created = await this.reserveDeposit(actor.userId, requested);
        return this.withQr(created, settings.promptPayId);
      } catch (error) {
        const raced = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!raced || attempt === 1) {
          throw error;
        }
      }
    }
    throw new DomainError('DEPOSIT_BUSY');
  }

  private reserveDeposit(userId: string, requested: Decimal) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "Deposit" SET status = 'EXPIRED'
        WHERE status IN ('PENDING', 'REVIEW') AND "expiresAt" <= NOW()
      `;
      const open = await tx.$queryRaw<Array<{ satang: number }>>`
        SELECT satang FROM "Deposit" WHERE status IN ('PENDING', 'REVIEW') FOR UPDATE
      `;
      const satang = allocateSatang(open.map((row) => row.satang));
      const amount = payableTotal(requested, satang);
      const id = randomUUID();
      return tx.deposit.create({
        data: {
          id,
          userId,
          requested: formatMoney(requested),
          satang,
          amount: formatMoney(amount),
          qrRef: `PP${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + DEPOSIT_TTL_MS),
        },
        select: depositSelect,
      });
    });
  }

  async one(actor: AuthUser, id: string) {
    await this.expireOpen();
    const row = await this.prisma.deposit.findFirst({
      where: { id, userId: actor.userId },
      select: depositSelect,
    });
    if (!row) {
      throw new DomainError('BILL_HIDDEN');
    }
    const settings = await this.settings();
    return this.withQr(row, settings.promptPayId);
  }

  async attachSlip(actor: AuthUser, id: string, filename: string, contentBase64: string, ip?: string) {
    const bytes = Buffer.from(contentBase64, 'base64');
    if (bytes.length < 32 || bytes.length > 1_500_000) {
      throw new DomainError('INVALID_ITEM');
    }
    const slipSha256 = createHash('sha256').update(bytes).digest('hex');
    const duplicate = await this.prisma.deposit.findUnique({ where: { slipSha256 }, select: { id: true } });
    if (duplicate) {
      throw new DomainError('SLIP_REUSED');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; userId: string; expiresAt: Date }>>`
        SELECT id, status::text AS status, "userId", "expiresAt"
        FROM "Deposit" WHERE id = ${id} FOR UPDATE
      `;
      const row = locked[0];
      if (!row || row.userId !== actor.userId) {
        throw new DomainError('BILL_HIDDEN');
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        await tx.deposit.update({ where: { id }, data: { status: 'EXPIRED' } });
        throw new DomainError('DEPOSIT_EXPIRED');
      }
      if (row.status !== 'PENDING') {
        throw new DomainError('CONFLICT');
      }
      return tx.deposit.update({
        where: { id },
        data: { status: 'REVIEW', slipSha256, slipName: filename.trim().slice(0, 120), slipBytes: bytes },
        select: depositSelect,
      });
    });
    await this.audit.append(this.prisma, {
      actorId: actor.userId,
      action: 'DEPOSIT_REVIEW',
      target: updated.id,
      detail: { qrRef: updated.qrRef, amount: formatMoney(moneyFromDatabase(updated.amount)) },
      ip,
    });
    await this.notifyReview(updated.id);
    return this.present(updated);
  }

  async match(actor: AuthUser, amountInput: string, bankRef: string, ip?: string) {
    await this.access.denyStaff(actor);
    this.assertAdmin(actor);
    const amount = parseExactMoney(amountInput);
    const reference = bankRef.trim();
    const duplicate = await this.prisma.deposit.findUnique({ where: { bankRef: reference }, select: { id: true } });
    if (duplicate) {
      throw new DomainError('SLIP_REUSED');
    }
    const paid = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; userId: string }>>`
        SELECT id, status::text AS status, "userId"
        FROM "Deposit"
        WHERE amount = ${formatMoney(amount)}::numeric
          AND status IN ('PENDING', 'REVIEW')
          AND "expiresAt" > NOW()
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new DomainError('DEPOSIT_UNMATCHED');
      }
      if (rows.length > 1) {
        throw new DomainError('CONFLICT');
      }
      const row = rows[0];
      if (!row) {
        throw new DomainError('DEPOSIT_UNMATCHED');
      }
      await this.credit(tx, row.id, row.userId, amount);
      return tx.deposit.update({
        where: { id: row.id },
        data: { status: 'PAID', bankRef: reference, paidAt: new Date(), decidedBy: actor.userId },
        select: depositSelect,
      });
    });
    await this.audit.append(this.prisma, {
      actorId: actor.userId,
      action: 'DEPOSIT_MATCH',
      target: paid.id,
      detail: { amount: formatMoney(amount), bankRef: reference },
      ip,
    });
    return this.present(paid);
  }

  async handleTelegram(headerSecret: string | undefined, update: TelegramUpdate): Promise<void> {
    const settings = await this.settings();
    if (!settings.telegramBotToken || !settings.telegramWebhookSecret || !settings.telegramChatId) {
      throw new DomainError('FORBIDDEN');
    }
    if (!safeEqual(headerSecret ?? '', settings.telegramWebhookSecret)) {
      throw new DomainError('FORBIDDEN');
    }
    const query = update.callback_query;
    if (!query?.data || !query.message?.chat) {
      return;
    }
    if (String(query.message.chat.id) !== settings.telegramChatId) {
      return;
    }
    const matched = /^deposit:(approve|reject):([0-9a-f-]{36})$/i.exec(query.data);
    if (!matched?.[1] || !matched[2]) {
      return;
    }
    const action = matched[1] === 'approve' ? 'approve' : 'reject';
    const depositId = matched[2];
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; userId: string; amount: string }>>`
        SELECT id, status::text AS status, "userId", amount::text AS amount
        FROM "Deposit" WHERE id = ${depositId} FOR UPDATE
      `;
      const row = locked[0];
      if (!row) {
        return;
      }
      await settleLocked(
        async (fn) => fn(),
        async () => ({ status: row.status }),
        async (status) => {
          await tx.deposit.update({
            where: { id: row.id },
            data: {
              status,
              paidAt: status === 'PAID' ? new Date() : null,
              decidedBy: `telegram:${query.from.id}`,
              telegramUpdateId: String(update.update_id),
            },
          });
        },
        async () => {
          await this.credit(tx, row.id, row.userId, moneyFromDatabase(row.amount));
        },
        action,
      );
    });
    await this.answerCallback(settings.telegramBotToken, query.id);
  }

  async payoutConfigured(): Promise<boolean> {
    const settings = await this.settings();
    return Boolean(settings.payoutRail?.trim());
  }

  private async credit(tx: Prisma.TransactionClient, depositId: string, userId: string, amount: Decimal) {
    const memo = `DEPOSIT_CREDIT:${depositId}`;
    const existing = await tx.ledgerEntry.count({ where: { memo } });
    if (existing > 0) {
      return;
    }
    const lines = buildDepositLedger({ userId, amount, depositId });
    await tx.ledgerEntry.createMany({
      data: lines.map((line) => ({
        transactionId: depositId,
        accountType: line.accountType,
        accountCode: line.accountCode,
        debit: formatMoney(line.debit),
        credit: formatMoney(line.credit),
        memo: line.memo,
      })),
    });
  }

  private async notifyReview(id: string) {
    const settings = await this.settings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return;
    }
    const row = await this.prisma.deposit.findUnique({
      where: { id },
      include: { user: { select: { displayName: true } } },
    });
    if (!row) {
      return;
    }
    const text = [
      `ชื่อ: ${row.user.displayName}`,
      `ยอด: ${formatMoney(moneyFromDatabase(row.amount))}`,
      `เวลา: ${bangkok(row.createdAt)}`,
      `อ้างอิง: ${row.qrRef}`,
    ].join('\n');
    const keyboard = {
      inline_keyboard: [[
        { text: 'อนุมัติ', callback_data: `deposit:approve:${row.id}` },
        { text: 'ปฏิเสธ', callback_data: `deposit:reject:${row.id}` },
      ]],
    };
    await telegramCall(settings.telegramBotToken, row.slipBytes ? 'sendPhoto' : 'sendMessage', (body) => {
      if (row.slipBytes) {
        body.set('chat_id', settings.telegramChatId ?? '');
        body.set('caption', text);
        body.set('reply_markup', JSON.stringify(keyboard));
        body.set('photo', new Blob([new Uint8Array(row.slipBytes)]), row.slipName ?? 'slip.jpg');
        return;
      }
      body.set('chat_id', settings.telegramChatId ?? '');
      body.set('text', text);
      body.set('reply_markup', JSON.stringify(keyboard));
    });
  }

  private async ensureWebhook(row: PaymentRow): Promise<boolean> {
    if (!row.telegramBotToken || !row.telegramChatId || !row.telegramWebhookSecret) {
      return false;
    }
    return telegramJson(row.telegramBotToken, 'setWebhook', {
      url: `${PUBLIC_API}/telegram/webhook`,
      secret_token: row.telegramWebhookSecret,
      allowed_updates: ['callback_query'],
    });
  }

  private async answerCallback(token: string, callbackId: string) {
    await telegramJson(token, 'answerCallbackQuery', { callback_query_id: callbackId });
  }

  private async expireOpen() {
    await this.prisma.$executeRaw`
      UPDATE "Deposit" SET status = 'EXPIRED'
      WHERE status IN ('PENDING', 'REVIEW') AND "expiresAt" <= NOW()
    `;
  }

  private async settings(): Promise<PaymentRow> {
    const row = await this.prisma.systemSetting.findUnique({ where: { id: 'default' } });
    return {
      promptPayId: row?.promptPayId ?? null,
      telegramBotToken: row?.telegramBotToken ?? null,
      telegramChatId: row?.telegramChatId ?? null,
      telegramWebhookSecret: row?.telegramWebhookSecret ?? null,
      payoutRail: row?.payoutRail ?? null,
    };
  }

  private async withQr(row: DepositView, promptPayId: string | null) {
    const presented = this.present(row);
    if (row.status !== 'PENDING' && row.status !== 'REVIEW') {
      return { ...presented, qrDataUrl: null };
    }
    const payload = buildPromptPayPayload(promptPayId, moneyFromDatabase(row.amount));
    if (!payload) {
      return { ...presented, qrDataUrl: null };
    }
    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
    return { ...presented, qrDataUrl };
  }

  private present(row: DepositView) {
    return {
      id: row.id,
      amount: formatMoney(moneyFromDatabase(row.amount)),
      requested: formatMoney(moneyFromDatabase(row.requested)),
      satang: row.satang,
      qrRef: row.qrRef,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      paid: row.status === 'PAID',
    };
  }

  private assertAdmin(actor: AuthUser) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new DomainError('FORBIDDEN');
    }
  }
}

const depositSelect = {
  id: true,
  amount: true,
  requested: true,
  satang: true,
  qrRef: true,
  status: true,
  expiresAt: true,
  createdAt: true,
} as const;

type DepositView = {
  id: string;
  amount: { toString(): string } | string;
  requested: { toString(): string } | string;
  satang: number;
  qrRef: string;
  status: ReviewStatus;
  expiresAt: Date;
  createdAt: Date;
};

type TelegramUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { chat: { id: number } };
  };
};

function bangkok(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

async function telegramJson(token: string, method: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function telegramCall(token: string, method: string, fill: (body: FormData) => void): Promise<void> {
  try {
    const body = new FormData();
    fill(body);
    await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body });
  } catch {
    return;
  }
}
