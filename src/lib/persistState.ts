import type { AppStep, UserPreferences, Rating, RoutePlan, RestaurantVisitEntry } from "../types";
import type { BrowseFilters } from "./browseFilter";
import { EMPTY_BROWSE_FILTERS } from "./browseFilter";
import { sanitizeVisitLogRecord } from "./visitLogHelpers";

const STORAGE_KEY = "pizza-week-planner-state-v2";

export interface PersistedAppState {
  v: 3;
  step: AppStep;
  prefs: UserPreferences;
  ratings: Record<string, Rating>;
  browseFilters: BrowseFilters;
  plan: RoutePlan | null;
  /** Local-only diary: restaurants you have visited with optional score (0–10) and review. */
  visitLog: Record<string, RestaurantVisitEntry>;
  /** True after user locks the route (step 4); cleared when the plan is regenerated or stops change on step 3. */
  routeLocked?: boolean;
}

function reviveCalendarDate(d: unknown): Date {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const day = Number(m[3]);
      return new Date(y, mo - 1, day, 12, 0, 0, 0);
    }
  }
  return new Date();
}

export function rehydrateUserPreferences(p: UserPreferences): UserPreferences {
  return {
    ...p,
    selectedDays: (p.selectedDays as unknown[]).map(reviveCalendarDate),
  };
}

function revivePlan(plan: RoutePlan | null): RoutePlan | null {
  if (!plan) return null;
  return {
    ...plan,
    days: plan.days.map((d) => ({
      ...d,
      date: d.date instanceof Date ? new Date(d.date.getTime()) : new Date(d.date as unknown as string),
    })),
  };
}

export function loadPersistedState(): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      v?: number;
      prefs?: UserPreferences;
      ratings?: Record<string, Rating>;
      browseFilters?: BrowseFilters;
      plan?: RoutePlan | null;
      visitLog?: unknown;
      step?: AppStep;
      routeLocked?: boolean;
    };
    if ((data.v !== 2 && data.v !== 3) || !data.prefs) return null;
    const visitLog = sanitizeVisitLogRecord(data.visitLog);
    const step = data.step ?? 1;
    const routeLocked =
      data.routeLocked === true || step === 4;
    return {
      v: 3,
      step,
      prefs: rehydrateUserPreferences(data.prefs),
      ratings: data.ratings ?? {},
      browseFilters: data.browseFilters ?? EMPTY_BROWSE_FILTERS,
      plan: revivePlan(data.plan ?? null),
      visitLog,
      routeLocked,
    };
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}
