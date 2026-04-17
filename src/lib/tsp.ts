import type { LatLng, Restaurant } from "../types";
import { haversineDistance } from "./geo";

/**
 * Nearest-neighbor TSP heuristic.
 * Given a starting point and a set of restaurants, returns them in
 * visit order that minimizes total haversine travel distance.
 *
 * O(n²) — perfectly fine for n ≤ 15.
 */
export function solveNearestNeighborTSP(
  start: LatLng,
  restaurants: Restaurant[]
): Restaurant[] {
  if (restaurants.length <= 1) return [...restaurants];

  const ordered: Restaurant[] = [];
  const remaining = new Set(restaurants.map((_, i) => i));
  let current: LatLng = start;

  while (remaining.size > 0) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (const idx of remaining) {
      const r = restaurants[idx]!;
      const dist = haversineDistance(current, { lat: r.lat, lng: r.lng });
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    }

    remaining.delete(nearestIdx);
    const chosen = restaurants[nearestIdx]!;
    ordered.push(chosen);
    current = { lat: chosen.lat, lng: chosen.lng };
  }

  return ordered;
}
