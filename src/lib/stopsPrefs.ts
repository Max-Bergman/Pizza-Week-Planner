import type { DayStopsBounds, StopsPerDayMap, UserPreferences } from "../types";

export const DEFAULT_STOPS_BOUNDS: DayStopsBounds = { min: 2, max: 5 };

/** Local calendar key for stable prefs storage (YYYY-MM-DD). */
export function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getStopsBounds(
  stopsPerDay: StopsPerDayMap,
  date: Date
): DayStopsBounds {
  return stopsPerDay[dayKeyLocal(date)] ?? DEFAULT_STOPS_BOUNDS;
}

export function stopsBoundsForPrefs(
  prefs: UserPreferences,
  date: Date
): DayStopsBounds {
  return getStopsBounds(prefs.stopsPerDay, date);
}

/** Clamp min/max and persist under day key. */
export function setStopsForDay(
  prefs: UserPreferences,
  date: Date,
  next: Partial<DayStopsBounds>
): UserPreferences {
  const key = dayKeyLocal(date);
  const cur = getStopsBounds(prefs.stopsPerDay, date);
  let min = next.min ?? cur.min;
  let max = next.max ?? cur.max;
  min = Math.max(1, Math.min(15, min));
  max = Math.max(1, Math.min(15, max));
  if (min > max) {
    if (next.min !== undefined) max = min;
    else min = max;
  }
  return {
    ...prefs,
    stopsPerDay: { ...prefs.stopsPerDay, [key]: { min, max } },
  };
}
