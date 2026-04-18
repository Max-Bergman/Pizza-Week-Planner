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

/** Simple mode: set the same min/max on every currently selected day. */
export function applyGlobalStopsToSelectedDays(
  prefs: UserPreferences,
  min: number,
  max: number
): UserPreferences {
  let m = Math.max(1, Math.min(15, min));
  let M = Math.max(1, Math.min(15, max));
  if (m > M) M = m;
  const next: StopsPerDayMap = { ...prefs.stopsPerDay };
  for (const d of prefs.selectedDays) {
    next[dayKeyLocal(d)] = { min: m, max: M };
  }
  return { ...prefs, stopsPerDay: next };
}

export function setSimpleStopsBounds(
  prefs: UserPreferences,
  min: number,
  max: number
): UserPreferences {
  let m = Math.max(1, Math.min(15, min));
  let M = Math.max(1, Math.min(15, max));
  if (m > M) M = m;
  return applyGlobalStopsToSelectedDays(
    { ...prefs, simpleStops: { min: m, max: M } },
    m,
    M
  );
}
