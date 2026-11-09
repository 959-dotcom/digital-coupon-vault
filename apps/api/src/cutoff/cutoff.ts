const BANGKOK = 'Asia/Bangkok';

/**
 * Cutoff comparisons use the API server clock only.
 * Production hosts should sync that clock with NTP. This request path does not call an external NTP service.
 * Asia/Bangkok is the category timezone. The civil cutoff is resolved with Intl so the offset is not hardcoded.
 */
export function isPastCutoff(now: Date, batchDate: Date, cutoffTime: string): boolean {
  return now.getTime() > cutoffInstant(batchDate, cutoffTime).getTime();
}

export function cutoffInstant(batchDate: Date, cutoffTime: string): Date {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(cutoffTime);
  if (!match) {
    throw new Error('BAD_CUTOFF');
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error('BAD_CUTOFF');
  }
  return zonedCivilToUtc(
    batchDate.getUTCFullYear(),
    batchDate.getUTCMonth() + 1,
    batchDate.getUTCDate(),
    hour,
    minute,
    second,
    BANGKOK,
  );
}

export function bangkokCalendarDate(now: Date): Date {
  const parts = civilParts(now, BANGKOK);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function zonedCivilToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = zoneOffsetMs(guess, timeZone);
  const corrected = new Date(guess.getTime() - offset);
  const offsetAfter = zoneOffsetMs(corrected, timeZone);
  return new Date(guess.getTime() - offsetAfter);
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = civilParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

function civilParts(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const bag = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}
