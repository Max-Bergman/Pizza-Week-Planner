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
import { planRestaurantVisitOrder } from "./tsp";
import { fetchDrivingRoute } from "./routing";
import { resolveDayRoutingPrefs } from "./planningContext";

/**
 * Main route planning orchestrator.
 *
 * 1. Fill day capacity by priority: must_eat -> interested -> neutral.
 * 2. Must-eat is always included when capacity allows (with warning if impossible).
 * 3. Interested picks are assigned by nearest day start / existing assigned stops.
 * 4. Neutral picks fill remaining space by minimal add-on route distance.
 * 5. Per day: NN + 2-opt from that day’s start; optionally OSRM for map and drive times.
 */
export async function planRoutes(
  restaurants: Restaurant[],
  ratings: RatingsMap,
  prefs: UserPreferences,
  fetchRealRoutes = true
): Promise<RoutePlan> {
  const warnings: string[] = [];
  const days = prefs.selectedDays;
  const dayCount = days.length;
  const maxPerDayByIdx = days.map((d) => resolveDayRoutingPrefs(prefs, d).maxStops);
  const totalCapacity = maxPerDayByIdx.reduce((sum, n) => sum + n, 0);

  // Partition by rating
  const mustEats: Restaurant[] = [];
  const interested: Restaurant[] = [];
  const neutral: Restaurant[] = [];

  for (const r of restaurants) {
    const rating = ratings.get(r.id) ?? "neutral";
    if (rating === "must_eat") mustEats.push(r);
    else if (rating === "interested") interested.push(r);
    else if (rating === "neutral") neutral.push(r);
    // not_interested → excluded
  }

  // Resolve day starts and containers
  const dayStarts: LatLng[] = days.map((d) => {
    const r = resolveDayRoutingPrefs(prefs, d);
    const loc = r.location ?? prefs.location;
    if (!loc) {
      warnings.push(
        `Missing start location for ${formatDay(d)} — using your primary address if set.`
      );
      return prefs.location ?? { lat: 45.52, lng: -122.68 };
    }
    return loc;
  });
  const perDayLists: Restaurant[][] = Array.from({ length: dayCount }, () => []);
  const dayIdSets = perDayLists.map(() => new Set<string>());
  const dayHasCapacity = (dayIdx: number) => perDayLists[dayIdx]!.length < maxPerDayByIdx[dayIdx]!;
  const placeOnDay = (dayIdx: number, r: Restaurant) => {
    if (dayIdSets[dayIdx]!.has(r.id)) return false;
    if (!dayHasCapacity(dayIdx)) return false;
    perDayLists[dayIdx]!.push(r);
    dayIdSets[dayIdx]!.add(r.id);
    return true;
  };

  // Step 1: place must-eat first (always preferred unless impossible due closure/capacity)
  if (mustEats.length > totalCapacity) {
    warnings.push(
      `You marked ${mustEats.length} must-eat spots, but your weekly stop capacity is ${totalCapacity}. Not all must-eats can fit.`
    );
  }
  const mustEatByFlex = [...mustEats]
    .map((r) => ({
      restaurant: r,
      openDays: days
        .map((d, i) => (r.closedDays.includes(d.getDay()) ? -1 : i))
        .filter((i) => i >= 0),
    }))
    .sort((a, b) => a.openDays.length - b.openDays.length);

  for (const item of mustEatByFlex) {
    const { restaurant: r, openDays } = item;
    if (openDays.length === 0) {
      warnings.push(`"${r.name}" is closed on all your selected days.`);
      continue;
    }
    const candidateDays = openDays.filter((i) => dayHasCapacity(i));
    if (candidateDays.length === 0) {
      warnings.push(`Could not fit must-eat "${r.name}" within your day stop limits.`);
      continue;
    }
    let bestDay = candidateDays[0]!;
    let bestScore = Infinity;
    for (const dayIdx of candidateDays) {
      const anchor = nearestDistanceToAssignedOrStart(r, dayIdx, dayStarts, perDayLists);
      // Slightly prefer balancing across days.
      const score = anchor + perDayLists[dayIdx]!.length * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestDay = dayIdx;
      }
    }
    placeOnDay(bestDay, r);
  }

  // Step 2: fill with interested by strongest global proximity first.
  // This avoids input-order bias when interested count exceeds available slots.
  const interestedPool = [...interested];
  while (interestedPool.length > 0) {
    let bestInterestedIndex = -1;
    let bestDay = -1;
    let bestDistance = Infinity;
    let bestLoad = Infinity;

    for (let i = 0; i < interestedPool.length; i++) {
      const r = interestedPool[i]!;
      for (let d = 0; d < dayCount; d++) {
        if (!dayHasCapacity(d)) continue;
        const day = days[d]!;
        if (r.closedDays.includes(day.getDay())) continue;
        if (dayIdSets[d]!.has(r.id)) continue;

        const dist = nearestDistanceToAssignedOrStart(r, d, dayStarts, perDayLists);
        const load = perDayLists[d]!.length;
        if (
          dist < bestDistance ||
          (dist === bestDistance && load < bestLoad)
        ) {
          bestDistance = dist;
          bestLoad = load;
          bestDay = d;
          bestInterestedIndex = i;
        }
      }
    }

    if (bestInterestedIndex < 0 || bestDay < 0) break;
    const picked = interestedPool.splice(bestInterestedIndex, 1)[0]!;
    placeOnDay(bestDay, picked);
  }

  // Step 3: fill remaining with neutral by minimal add-on route distance
  const neutralPool = [...neutral];
  while (neutralPool.length > 0) {
    let bestNeutralIndex = -1;
    let bestDay = -1;
    let bestDelta = Infinity;

    for (let nIdx = 0; nIdx < neutralPool.length; nIdx++) {
      const r = neutralPool[nIdx]!;
      for (let d = 0; d < dayCount; d++) {
        if (!dayHasCapacity(d)) continue;
        const day = days[d]!;
        if (r.closedDays.includes(day.getDay())) continue;
        const dayRestaurants = perDayLists[d]!;
        if (dayIdSets[d]!.has(r.id)) continue;
        const delta = estimateRouteAddOnDistance(dayStarts[d]!, dayRestaurants, r);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestDay = d;
          bestNeutralIndex = nIdx;
        }
      }
    }

    if (bestNeutralIndex < 0 || bestDay < 0) break;
    const picked = neutralPool.splice(bestNeutralIndex, 1)[0]!;
    placeOnDay(bestDay, picked);
  }

  // Step 3: Order stops per day + OSRM
  const dayRoutes: DayRoute[] = [];
  let totalMustEatsCovered = 0;
  const mustEatIds = new Set(mustEats.map((r) => r.id));

  for (let d = 0; d < days.length; d++) {
    const day = days[d]!;
    const dayRestaurants = perDayLists[d]!;
    const dayUserLoc = dayStarts[d]!;
    if (dayRestaurants.length === 0) {
      dayRoutes.push({
        date: day,
        routeStart: dayUserLoc,
        stops: [],
        totalDriveMinutes: 0,
        routeGeometry: null,
      });
      continue;
    }

    const dayBounds = resolveDayRoutingPrefs(prefs, day);
    if (dayRestaurants.length < dayBounds.minStops) {
      warnings.push(
        `${formatDay(day)} has ${dayRestaurants.length} stop(s), below your minimum of ${dayBounds.minStops} for that day.`
      );
    }

    totalMustEatsCovered += dayRestaurants.filter((r) =>
      mustEatIds.has(r.id)
    ).length;

    const ordered = planRestaurantVisitOrder(dayUserLoc, dayRestaurants);

    // Build stops with haversine estimates
    const stops: RouteStop[] = ordered.map((r, i) => {
      const prev: LatLng =
        i === 0
          ? dayUserLoc
          : { lat: ordered[i - 1]!.lat, lng: ordered[i - 1]!.lng };
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
        dayUserLoc,
        ...ordered.map((r) => ({ lat: r.lat, lng: r.lng })),
        dayUserLoc,
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
      routeStart: dayUserLoc,
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

function nearestDistanceToAssignedOrStart(
  r: Restaurant,
  dayIdx: number,
  dayStarts: LatLng[],
  perDayLists: Restaurant[][]
): number {
  const p = { lat: r.lat, lng: r.lng };
  let best = haversineDistance(dayStarts[dayIdx]!, p);
  for (const existing of perDayLists[dayIdx]!) {
    const d = haversineDistance({ lat: existing.lat, lng: existing.lng }, p);
    if (d < best) best = d;
  }
  return best;
}

function estimateRouteAddOnDistance(
  dayStart: LatLng,
  dayRestaurants: Restaurant[],
  candidate: Restaurant
): number {
  const c = { lat: candidate.lat, lng: candidate.lng };
  if (dayRestaurants.length === 0) {
    // start -> candidate -> start
    return haversineDistance(dayStart, c) * 2;
  }
  const ordered = planRestaurantVisitOrder(dayStart, dayRestaurants);
  let bestDelta = Infinity;
  for (let insertIdx = 0; insertIdx <= ordered.length; insertIdx++) {
    const prev =
      insertIdx === 0
        ? dayStart
        : { lat: ordered[insertIdx - 1]!.lat, lng: ordered[insertIdx - 1]!.lng };
    const next =
      insertIdx === ordered.length
        ? dayStart
        : { lat: ordered[insertIdx]!.lat, lng: ordered[insertIdx]!.lng };
    const delta =
      haversineDistance(prev, c) +
      haversineDistance(c, next) -
      haversineDistance(prev, next);
    if (delta < bestDelta) bestDelta = delta;
  }
  return bestDelta;
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
