import { dayKeyLocal } from "./stopsPrefs";

/** Stable local calendar day at noon (avoids DST edge cases). */
export function cloneLocalCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/** Dedupe by calendar key, clone dates, sort chronologically. */
export function normalizeSelectedDayDates(days: Date[]): Date[] {
  const byKey = new Map<string, Date>();
  for (const d of days) {
    const k = dayKeyLocal(d);
    if (!byKey.has(k)) {
      byKey.set(k, cloneLocalCalendarDay(d));
    }
  }
  return [...byKey.values()].sort((a, b) => a.getTime() - b.getTime());
}
