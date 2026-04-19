import type { DayRoute, LatLng, Restaurant, RouteStop } from "../types";
import { haversineDistance } from "./geo";
import { fetchDrivingRoute } from "./routing";

function estimateDriveMinutes(miles: number): number {
  return Math.round((miles / 25) * 60);
}

/**
 * Rebuild one day's route from an explicit restaurant order (user edits).
 * Re-runs OSRM when `fetchRealRoutes` is true.
 */
export async function rebuildDayRouteFromStops(
  date: Date,
  routeStart: LatLng,
  restaurantsInOrder: Restaurant[],
  fetchRealRoutes: boolean
): Promise<DayRoute> {
  if (restaurantsInOrder.length === 0) {
    return {
      date,
      routeStart,
      stops: [],
      totalDriveMinutes: 0,
      routeGeometry: null,
    };
  }

  const stops: RouteStop[] = restaurantsInOrder.map((r, i) => {
    const prev: LatLng =
      i === 0
        ? routeStart
        : {
            lat: restaurantsInOrder[i - 1]!.lat,
            lng: restaurantsInOrder[i - 1]!.lng,
          };
    const dist = haversineDistance(prev, { lat: r.lat, lng: r.lng });
    return {
      restaurant: r,
      order: i + 1,
      driveMinutesFromPrevious: estimateDriveMinutes(dist),
      distanceMilesFromPrevious: Math.round(dist * 10) / 10,
    };
  });

  let routeGeometry: GeoJSON.LineString | null = null;
  let totalDriveMinutes = stops.reduce((sum, s) => sum + s.driveMinutesFromPrevious, 0);

  if (fetchRealRoutes) {
    const waypoints: LatLng[] = [
      routeStart,
      ...restaurantsInOrder.map((r) => ({ lat: r.lat, lng: r.lng })),
      routeStart,
    ];
    try {
      const osrmRoute = await fetchDrivingRoute(waypoints);
      if (osrmRoute) {
        routeGeometry = osrmRoute.geometry;
        totalDriveMinutes = Math.round(osrmRoute.durationSeconds / 60);
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
      /* keep haversine */
    }
  }

  return {
    date,
    routeStart,
    stops,
    totalDriveMinutes: Math.round(totalDriveMinutes),
    routeGeometry,
  };
}

export function aggregateRoutePlanTotals(
  days: DayRoute[],
  mustEatIds: Set<string>
): {
  totalDriveMinutes: number;
  totalRestaurants: number;
  mustEatsCovered: number;
  mustEatsTotal: number;
} {
  let mustEatsCovered = 0;
  for (const d of days) {
    for (const s of d.stops) {
      if (mustEatIds.has(s.restaurant.id)) mustEatsCovered++;
    }
  }
  return {
    totalDriveMinutes: days.reduce((sum, d) => sum + d.totalDriveMinutes, 0),
    totalRestaurants: days.reduce((sum, d) => sum + d.stops.length, 0),
    mustEatsCovered,
    mustEatsTotal: mustEatIds.size,
  };
}
