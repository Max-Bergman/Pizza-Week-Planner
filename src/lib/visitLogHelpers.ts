import type { Restaurant, RoutePlan, RestaurantVisitEntry } from "../types";

const MAX_SCORE = 10;
const MIN_SCORE = 0;

/** One decimal place, clamped to [0, 10]. */
export function clampVisitScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const c = Math.min(MAX_SCORE, Math.max(MIN_SCORE, n));
  return Math.round(c * 10) / 10;
}

export function collectPlanRestaurants(plan: RoutePlan): Restaurant[] {
  const seen = new Set<string>();
  const out: Restaurant[] = [];
  for (const day of plan.days) {
    for (const stop of day.stops) {
      const id = stop.restaurant.id;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(stop.restaurant);
    }
  }
  return out;
}

export function sanitizeVisitLogRecord(raw: unknown): Record<string, RestaurantVisitEntry> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, RestaurantVisitEntry> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { visited?: unknown; score?: unknown; review?: unknown };
    if (!o.visited) continue;
    const entry: RestaurantVisitEntry = { visited: true };
    if (typeof o.score === "number" && Number.isFinite(o.score)) {
      entry.score = clampVisitScore(o.score);
    }
    if (typeof o.review === "string" && o.review.trim()) {
      entry.review = o.review.trim().slice(0, 2000);
    }
    out[k] = entry;
  }
  return out;
}
