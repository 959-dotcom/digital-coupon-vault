import { bangkokCalendarDate, bangkokParts, cutoffInstant } from '../cutoff/cutoff.js';

export const CATEGORY_GROUPS = ['NATIONAL', 'REGIONAL', 'FLASH', 'STOCK'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Schedule = {
  group: CategoryGroup;
  weekdays: Weekday[] | null;
  daysOfMonth: number[] | null;
  sessions: Array<{ cutoff: string }>;
  intervalMinutes: number | null;
  batchesPerDay: number | null;
};

export type SessionHit = {
  batchDate: Date;
  slot: string;
  cutoffAt: Date;
};

const WEEKDAY_BY_SHORT: Record<string, Weekday> = {
  Mon: 'MON',
  Tue: 'TUE',
  Wed: 'WED',
  Thu: 'THU',
  Fri: 'FRI',
  Sat: 'SAT',
  Sun: 'SUN',
};

export function parseSchedule(value: unknown): Schedule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('BAD_CUTOFF');
  }
  const row = value as Record<string, unknown>;
  const group = row.group;
  if (group !== 'NATIONAL' && group !== 'REGIONAL' && group !== 'FLASH' && group !== 'STOCK') {
    throw new Error('BAD_CUTOFF');
  }
  const weekdays = readWeekdays(row.weekdays);
  const daysOfMonth = readDays(row.daysOfMonth);
  const sessions = readSessions(row.sessions);
  const intervalMinutes = readNullableInt(row.intervalMinutes);
  const batchesPerDay = readNullableInt(row.batchesPerDay);
  if ((intervalMinutes === null) !== (batchesPerDay === null)) {
    throw new Error('BAD_CUTOFF');
  }
  if (intervalMinutes !== null && !validYeekeeCadence(intervalMinutes, batchesPerDay)) {
    throw new Error('BAD_CUTOFF');
  }
  if (intervalMinutes === null && sessions.length === 0) {
    throw new Error('BAD_CUTOFF');
  }
  return { group, weekdays, daysOfMonth, sessions, intervalMinutes, batchesPerDay };
}

export function nextSession(schedule: Schedule, now: Date): SessionHit | null {
  if (schedule.intervalMinutes !== null && schedule.batchesPerDay !== null) {
    return nextYeekee(now, schedule.batchesPerDay, schedule.intervalMinutes);
  }
  for (let offset = 0; offset < 370; offset += 1) {
    const day = addUtcDays(bangkokCalendarDate(now), offset);
    if (!dayMatches(schedule, day)) {
      continue;
    }
    for (const session of schedule.sessions) {
      const cutoffAt = cutoffInstant(day, session.cutoff);
      if (cutoffAt.getTime() >= now.getTime()) {
        return { batchDate: day, slot: session.cutoff, cutoffAt };
      }
    }
  }
  return null;
}

export function countdownSeconds(cutoffAt: Date, now: Date): number {
  const delta = Math.floor((cutoffAt.getTime() - now.getTime()) / 1000);
  return delta > 0 ? delta : 0;
}

export function cutoffForSlot(schedule: Schedule, fallback: string, slot: string): string {
  if (/^\d{2}:\d{2}$/.test(slot)) {
    return slot;
  }
  if (schedule.intervalMinutes !== null) {
    const index = Number(slot);
    if (!Number.isInteger(index) || index < 1 || index > (schedule.batchesPerDay ?? 0)) {
      throw new Error('BAD_CUTOFF');
    }
    const minutes = index * schedule.intervalMinutes;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  return fallback;
}

function validYeekeeCadence(intervalMinutes: number, batchesPerDay: number | null): boolean {
  return (intervalMinutes === 15 && batchesPerDay === 88) || (intervalMinutes === 10 && batchesPerDay === 143);
}

function nextYeekee(now: Date, batchesPerDay: number, intervalMinutes: number): SessionHit {
  const parts = bangkokParts(now);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  const slot = Math.floor(minuteOfDay / intervalMinutes) + 1;
  const today = bangkokCalendarDate(now);
  if (slot <= batchesPerDay) {
    const cutoffAt = cutoffInstant(today, minutesToHm(slot * intervalMinutes));
    if (cutoffAt.getTime() >= now.getTime()) {
      return { batchDate: today, slot: slotLabel(slot), cutoffAt };
    }
  }
  const tomorrow = addUtcDays(today, 1);
  return {
    batchDate: tomorrow,
    slot: slotLabel(1),
    cutoffAt: cutoffInstant(tomorrow, minutesToHm(intervalMinutes)),
  };
}

function dayMatches(schedule: Schedule, day: Date): boolean {
  const probe = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 4, 0, 0));
  const parts = bangkokParts(probe);
  if (schedule.daysOfMonth && !schedule.daysOfMonth.includes(parts.day)) {
    return false;
  }
  if (schedule.weekdays && !schedule.weekdays.includes(weekdayOf(probe))) {
    return false;
  }
  return true;
}

function weekdayOf(instant: Date): Weekday {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(instant);
  const weekday = WEEKDAY_BY_SHORT[label];
  if (!weekday) {
    throw new Error('BAD_CUTOFF');
  }
  return weekday;
}

function addUtcDays(day: Date, offset: number): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + offset));
}

function minutesToHm(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function slotLabel(slot: number): string {
  return slot.toString().padStart(2, '0');
}

function readWeekdays(value: unknown): Weekday[] | null {
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('BAD_CUTOFF');
  }
  return value.map((entry) => {
    if (typeof entry !== 'string' || !(WEEKDAYS as readonly string[]).includes(entry)) {
      throw new Error('BAD_CUTOFF');
    }
    return entry as Weekday;
  });
}

function readDays(value: unknown): number[] | null {
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('BAD_CUTOFF');
  }
  return value.map((entry) => {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 1 || entry > 31) {
      throw new Error('BAD_CUTOFF');
    }
    return entry;
  });
}

function readSessions(value: unknown): Array<{ cutoff: string }> {
  if (!Array.isArray(value)) {
    throw new Error('BAD_CUTOFF');
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('BAD_CUTOFF');
    }
    const cutoff = (entry as { cutoff?: unknown }).cutoff;
    if (typeof cutoff !== 'string' || !/^\d{2}:\d{2}$/.test(cutoff)) {
      throw new Error('BAD_CUTOFF');
    }
    return { cutoff };
  });
}

function readNullableInt(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('BAD_CUTOFF');
  }
  return value;
}
