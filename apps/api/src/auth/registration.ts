import { DomainError } from '../common/domain-error.js';

export const BANK_PROVIDERS = [
  'BBL',
  'KBANK',
  'KTB',
  'SCB',
  'BAY',
  'TTB',
  'GSB',
  'BAAC',
  'UOB',
  'CIMB',
  'KKP',
  'LHB',
  'TCRB',
  'TRUEWALLET',
] as const;

export const SOURCE_CHANNELS = ['FACEBOOK', 'TIKTOK', 'GOOGLE', 'FRIEND', 'YOUTUBE', 'OTHER'] as const;

export type BankProviderName = (typeof BANK_PROVIDERS)[number];
export type SourceChannelName = (typeof SOURCE_CHANNELS)[number];

export type RegistrationInput = {
  phone: string;
  pin: string;
  pinConfirm: string;
  bankProvider: string;
  accountNumber: string;
  fullName: string;
  lineId?: string;
  sourceChannel: string;
};

export function assertThaiMobile(phone: string): string {
  const trimmed = phone.trim();
  if (!/^0\d{9}$/.test(trimmed)) {
    throw new DomainError('BAD_PHONE');
  }
  return trimmed;
}

export function assertPinPair(pin: string, pinConfirm: string): string {
  if (!/^\d{6}$/.test(pin) || !/^\d{6}$/.test(pinConfirm)) {
    throw new DomainError('BAD_PIN');
  }
  if (pin !== pinConfirm) {
    throw new DomainError('PIN_MISMATCH');
  }
  return pin;
}

export function assertAccountNumber(bankProvider: string, accountNumber: string): { bank: BankProviderName; account: string } {
  if (!BANK_PROVIDERS.includes(bankProvider as BankProviderName)) {
    throw new DomainError('INVALID_ITEM');
  }
  const account = accountNumber.trim();
  if (!/^\d+$/.test(account)) {
    throw new DomainError('INVALID_ITEM');
  }
  if (bankProvider === 'TRUEWALLET') {
    if (!/^0\d{9}$/.test(account)) {
      throw new DomainError('INVALID_ITEM');
    }
  } else if (account.length < 10 || account.length > 15) {
    throw new DomainError('INVALID_ITEM');
  }
  return { bank: bankProvider as BankProviderName, account };
}

export function assertRegistration(input: RegistrationInput): {
  phone: string;
  pin: string;
  bank: BankProviderName;
  account: string;
  fullName: string;
  lineId: string | null;
  source: SourceChannelName;
} {
  const phone = assertThaiMobile(input.phone);
  const pin = assertPinPair(input.pin, input.pinConfirm);
  const account = assertAccountNumber(input.bankProvider, input.accountNumber);
  const fullName = input.fullName.trim();
  if (fullName.length < 1 || fullName.length > 80) {
    throw new DomainError('INVALID_ITEM');
  }
  if (!SOURCE_CHANNELS.includes(input.sourceChannel as SourceChannelName)) {
    throw new DomainError('INVALID_ITEM');
  }
  const line = input.lineId?.trim() ?? '';
  if (line.length > 40) {
    throw new DomainError('INVALID_ITEM');
  }
  return {
    phone,
    pin,
    bank: account.bank,
    account: account.account,
    fullName,
    lineId: line.length > 0 ? line : null,
    source: input.sourceChannel as SourceChannelName,
  };
}
