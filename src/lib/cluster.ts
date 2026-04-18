import type { LatLng, Restaurant } from "../types";
import { haversineDistance, centroid } from "./geo";

export interface ClusterAssignment {
  dayIndex: number;
  restaurants: Restaurant[];
}

/**
 * Assign restaurants to day-buckets using iterative geographic clustering.
 *
 * - Seeds initial centroids from any pre-assigned restaurants (must-eats locked to specific days).
 * - Falls back to k-means++ style initialization for empty days.
 * - Respects closedDays: a restaurant can only go into a day it's open.
 * - Respects per-day max capacity (`maxPerDay[d]`).
 * - Runs for a fixed number of iterations (convergence isn't critical at this scale).
 */
export function clusterByDay(
  restaurants: Restaurant[],
  days: Date[],
  preAssigned: Map<number, Restaurant[]>, // dayIndex → already-locked restaurants
  maxPerDay: number[]
): ClusterAssignment[] {
  const k = days.length;

  const assignments: Restaurant[][] = Array.from({ length: k }, (_, i) => [
    ...(preAssigned.get(i) ?? []),
  ]);

  // Compute initial centroids from pre-assigned restaurants
  const centroids: LatLng[] = assignments.map((group) => {
    if (group.length > 0) {
      return centroid(group.map((r) => ({ lat: r.lat, lng: r.lng })));
    }
    return { lat: 0, lng: 0 }; // placeholder, seeded below
  });

  // Seed empty centroids with furthest-apart restaurants (simple k-means++ idea)
  const emptyDays = centroids
    .map((c, i) => (c.lat === 0 && c.lng === 0 ? i : -1))
    .filter((i) => i >= 0);

  if (emptyDays.length > 0 && restaurants.length > 0) {
    const step = Math.max(1, Math.floor(restaurants.length / emptyDays.length));
    emptyDays.forEach((dayIdx, i) => {
      const r = restaurants[Math.min(i * step, restaurants.length - 1)]!;
      centroids[dayIdx] = { lat: r.lat, lng: r.lng };
    });
  }

  const assignedIds = new Set(
    Array.from(preAssigned.values())
      .flat()
      .map((r) => r.id)
  );
  const unassigned = restaurants.filter((r) => !assignedIds.has(r.id));

  const ITERATIONS = 5;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Clear non-pre-assigned restaurants each iteration
    for (let d = 0; d < k; d++) {
      assignments[d] = [...(preAssigned.get(d) ?? [])];
    }

    // Assign each unassigned restaurant to the nearest open, non-full day
    for (const r of unassigned) {
      const rPoint: LatLng = { lat: r.lat, lng: r.lng };
      const dayOfWeek = (dayIdx: number) => days[dayIdx]!.getDay();

      let bestDay = -1;
      let bestDist = Infinity;

      for (let d = 0; d < k; d++) {
        if (r.closedDays.includes(dayOfWeek(d))) continue;
        if (assignments[d]!.length >= (maxPerDay[d] ?? 15)) continue;
        const dist = haversineDistance(rPoint, centroids[d]!);
        if (dist < bestDist) {
          bestDist = dist;
          bestDay = d;
        }
      }

      if (bestDay >= 0) {
        assignments[bestDay]!.push(r);
      }
    }

    // Recompute centroids
    for (let d = 0; d < k; d++) {
      if (assignments[d]!.length > 0) {
        centroids[d] = centroid(
          assignments[d]!.map((r) => ({ lat: r.lat, lng: r.lng }))
        );
      }
    }
  }

  return assignments.map((group, i) => ({
    dayIndex: i,
    restaurants: group,
  }));
}
