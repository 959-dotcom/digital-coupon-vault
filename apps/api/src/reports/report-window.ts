import { bangkokCalendarDate, cutoffInstant } from '../cutoff/cutoff.js';
import { DomainError } from '../common/domain-error.js';

export type ReportPreset = 'today' | '3' | '7' | '30' | 'custom';

export function reportWindow(
  preset: ReportPreset,
  now: Date,
  from?: string,
  to?: string,
): { start: Date; end: Date } {
  if (preset === 'custom') {
    const startDay = parseIsoDate(from ?? '');
    const endDay = parseIsoDate(to ?? '');
    if (endDay.getTime() < startDay.getTime()) {
      throw new DomainError('INVALID_ITEM');
    }
    return {
      start: cutoffInstant(startDay, '00:00:00'),
      end: cutoffInstant(addUtcDays(endDay, 1), '00:00:00'),
    };
  }
  const days = preset === 'today' ? 1 : preset === '3' ? 3 : preset === '7' ? 7 : 30;
  const today = bangkokCalendarDate(now);
  return {
    start: cutoffInstant(addUtcDays(today, 1 - days), '00:00:00'),
    end: cutoffInstant(addUtcDays(today, 1), '00:00:00'),
  };
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new DomainError('INVALID_ITEM');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new DomainError('INVALID_ITEM');
  }
  return date;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}
