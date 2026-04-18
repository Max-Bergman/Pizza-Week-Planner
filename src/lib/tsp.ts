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

/** Miles: start → each stop in order → back to start (haversine). */
export function depotTourMiles(start: LatLng, route: Restaurant[]): number {
  if (route.length === 0) return 0;
  let miles = haversineDistance(start, { lat: route[0]!.lat, lng: route[0]!.lng });
  for (let i = 0; i < route.length - 1; i++) {
    miles += haversineDistance(
      { lat: route[i]!.lat, lng: route[i]!.lng },
      { lat: route[i + 1]!.lat, lng: route[i + 1]!.lng }
    );
  }
  miles += haversineDistance(
    { lat: route[route.length - 1]!.lat, lng: route[route.length - 1]!.lng },
    start
  );
  return miles;
}

function reverseSegment(route: Restaurant[], i: number, j: number): Restaurant[] {
  const next = [...route];
  let a = i;
  let b = j;
  while (a < b) {
    const t = next[a]!;
    next[a] = next[b]!;
    next[b] = t;
    a++;
    b--;
  }
  return next;
}

/**
 * 2-opt refinement on a fixed-depot tour (start → stops → start).
 * Improves an existing order; caller usually passes NN first.
 */
export function refineTourWithTwoOpt(
  start: LatLng,
  route: Restaurant[]
): Restaurant[] {
  if (route.length <= 2) return [...route];

  let best = [...route];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = reverseSegment(best, i, j);
        if (depotTourMiles(start, candidate) < depotTourMiles(start, best) - 1e-6) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** NN seed + 2-opt for a single day's visit order. */
export function planRestaurantVisitOrder(
  start: LatLng,
  restaurants: Restaurant[]
): Restaurant[] {
  if (restaurants.length === 0) return [];
  const seed = solveNearestNeighborTSP(start, restaurants);
  return refineTourWithTwoOpt(start, seed);
}

/** Total miles across days, each day scored with NN depot tour (fast objective). */
export function totalNNDepotTourMiles(
  start: LatLng,
  perDay: Restaurant[][]
): number {
  let sum = 0;
  for (const day of perDay) {
    if (day.length === 0) continue;
    const ord = solveNearestNeighborTSP(start, day);
    sum += depotTourMiles(start, ord);
  }
  return sum;
}
