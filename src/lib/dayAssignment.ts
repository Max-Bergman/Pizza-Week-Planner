import type { LatLng, Restaurant } from "../types";
import { haversineDistance } from "./geo";

/**
 * Greedy assignment: each movable restaurant goes to the nearest day's start
 * among days where it is open and under capacity. Respects pre-assigned buckets.
 */
export function greedyAssignByNearestDayStart(
  restaurants: Restaurant[],
  days: Date[],
  preAssigned: Map<number, Restaurant[]>,
  dayStarts: LatLng[],
  maxPerDay: number[]
): Restaurant[][] {
  const k = days.length;
  const assignments: Restaurant[][] = Array.from({ length: k }, (_, i) => [
    ...(preAssigned.get(i) ?? []),
  ]);

  const locked = new Set(
    Array.from(preAssigned.values())
      .flat()
      .map((r) => r.id)
  );

  const unassigned = restaurants.filter((r) => !locked.has(r.id));
  const shuffled = shuffle(unassigned);

  const dow = (d: number) => days[d]!.getDay();

  for (const r of shuffled) {
    const p: LatLng = { lat: r.lat, lng: r.lng };
    let bestD = -1;
    let bestDist = Infinity;
    for (let d = 0; d < k; d++) {
      if (r.closedDays.includes(dow(d))) continue;
      if (assignments[d]!.length >= maxPerDay[d]!) continue;
      const dist = haversineDistance(p, dayStarts[d]!);
      if (dist < bestDist) {
        bestDist = dist;
        bestD = d;
      }
    }
    if (bestD >= 0) assignments[bestD]!.push(r);
  }

  return assignments;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
