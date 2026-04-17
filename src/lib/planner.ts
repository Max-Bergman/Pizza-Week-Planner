import type {
  Restaurant,
  UserPreferences,
  RatingsMap,
  RoutePlan,
  DayRoute,
  RouteStop,
  LatLng,
} from "../types";
import { haversineDistance } from "./geo";
import { clusterByDay } from "./cluster";
import { solveNearestNeighborTSP } from "./tsp";
import { fetchDrivingRoute } from "./routing";

/**
 * Main route planning orchestrator.
 *
 * 1. Separate must-eat vs interested+neutral (drop skipped).
 * 2. Lock constrained must-eats to their only available days.
 * 3. Cluster remaining restaurants geographically across days.
 * 4. Solve TSP for each day.
 * 5. Optionally fetch OSRM routes for display.
 */
export async function planRoutes(
  restaurants: Restaurant[],
  ratings: RatingsMap,
  prefs: UserPreferences,
  fetchRealRoutes = true
): Promise<RoutePlan> {
  const warnings: string[] = [];
  const userLoc = prefs.location!;
  const days = prefs.selectedDays;

  // Partition by rating
  const mustEats: Restaurant[] = [];
  const interested: Restaurant[] = [];

  for (const r of restaurants) {
    const rating = ratings.get(r.id) ?? "neutral";
    if (rating === "must_eat") mustEats.push(r);
    else if (rating === "interested" || rating === "neutral") interested.push(r);
    // not_interested → excluded
  }

  // Step 1: Build availability for must-eats
  const preAssigned = new Map<number, Restaurant[]>();
  const unlockedMustEats: Restaurant[] = [];

  for (const r of mustEats) {
    const availableDayIndices = days
      .map((d, i) => (r.closedDays.includes(d.getDay()) ? -1 : i))
      .filter((i) => i >= 0);

    if (availableDayIndices.length === 0) {
      warnings.push(`"${r.name}" is closed on all your selected days.`);
      continue;
    }

    if (availableDayIndices.length === 1) {
      const dayIdx = availableDayIndices[0]!;
      const existing = preAssigned.get(dayIdx) ?? [];
      existing.push(r);
      preAssigned.set(dayIdx, existing);
    } else {
      unlockedMustEats.push(r);
    }
  }

  // Step 2: Cluster everything (unlocked must-eats + interested)
  const allForClustering = [...unlockedMustEats, ...interested];
  const clusters = clusterByDay(
    allForClustering,
    days,
    preAssigned,
    prefs.maxPerDay
  );

  // Step 3: TSP each day
  const dayRoutes: DayRoute[] = [];
  let totalMustEatsCovered = 0;
  const mustEatIds = new Set(mustEats.map((r) => r.id));

  for (let d = 0; d < days.length; d++) {
    const day = days[d]!;
    const dayRestaurants = clusters[d]!.restaurants;
    if (dayRestaurants.length === 0) {
      dayRoutes.push({
        date: day,
        stops: [],
        totalDriveMinutes: 0,
        routeGeometry: null,
      });
      continue;
    }

    // Enforce min per day warning
    if (dayRestaurants.length < prefs.minPerDay) {
      warnings.push(
        `${formatDay(day)} has ${dayRestaurants.length} stop(s), below your minimum of ${prefs.minPerDay}.`
      );
    }

    totalMustEatsCovered += dayRestaurants.filter((r) =>
      mustEatIds.has(r.id)
    ).length;

    const ordered = solveNearestNeighborTSP(userLoc, dayRestaurants);

    // Build stops with haversine estimates
    const stops: RouteStop[] = ordered.map((r, i) => {
      const prev: LatLng =
        i === 0 ? userLoc : { lat: ordered[i - 1]!.lat, lng: ordered[i - 1]!.lng };
      const dist = haversineDistance(prev, { lat: r.lat, lng: r.lng });
      return {
        restaurant: r,
        order: i + 1,
        driveMinutesFromPrevious: estimateDriveMinutes(dist),
        distanceMilesFromPrevious: Math.round(dist * 10) / 10,
      };
    });

    let routeGeometry: GeoJSON.LineString | null = null;
    let totalDriveMinutes = stops.reduce(
      (sum, s) => sum + s.driveMinutesFromPrevious,
      0
    );

    // Fetch real route if enabled
    if (fetchRealRoutes) {
      const waypoints: LatLng[] = [
        userLoc,
        ...ordered.map((r) => ({ lat: r.lat, lng: r.lng })),
        userLoc,
      ];

      try {
        const osrmRoute = await fetchDrivingRoute(waypoints);
        if (osrmRoute) {
          routeGeometry = osrmRoute.geometry;
          totalDriveMinutes = Math.round(osrmRoute.durationSeconds / 60);

          // Update per-leg durations from OSRM
          osrmRoute.legs.forEach((leg, i) => {
            const stop = stops[i];
            if (stop) {
              stop.driveMinutesFromPrevious = Math.round(leg.durationSeconds / 60);
              stop.distanceMilesFromPrevious =
                Math.round((leg.distanceMeters / 1609.34) * 10) / 10;
            }
          });
        }
      } catch {
        // Fall back to haversine estimates silently
      }
    }

    dayRoutes.push({
      date: day,
      stops,
      totalDriveMinutes: Math.round(totalDriveMinutes),
      routeGeometry,
    });
  }

  return {
    days: dayRoutes,
    totalDriveMinutes: dayRoutes.reduce(
      (sum, d) => sum + d.totalDriveMinutes,
      0
    ),
    totalRestaurants: dayRoutes.reduce((sum, d) => sum + d.stops.length, 0),
    mustEatsCovered: totalMustEatsCovered,
    mustEatsTotal: mustEats.length,
    warnings,
  };
}

/** Rough estimate: average 25 mph city driving. */
function estimateDriveMinutes(miles: number): number {
  return Math.round((miles / 25) * 60);
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
