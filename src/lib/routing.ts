import type { LatLng } from "../types";

const OSRM_BASE = "https://router.project-osrm.org";

export interface OSRMRoute {
  durationSeconds: number;
  distanceMeters: number;
  geometry: GeoJSON.LineString;
  legs: { durationSeconds: number; distanceMeters: number }[];
}

/**
 * Fetch a driving route through an ordered list of waypoints from OSRM.
 * Returns the full route geometry and per-leg durations.
 */
export async function fetchDrivingRoute(
  waypoints: LatLng[]
): Promise<OSRMRoute | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) return null;

  const route = data.routes[0];
  return {
    durationSeconds: route.duration,
    distanceMeters: route.distance,
    geometry: route.geometry,
    legs: route.legs.map((leg: { duration: number; distance: number }) => ({
      durationSeconds: leg.duration,
      distanceMeters: leg.distance,
    })),
  };
}
