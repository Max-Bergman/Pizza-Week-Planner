import type { LatLng } from "../types";

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Haversine distance between two lat/lng points, in miles.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Check if a point is within a radius (miles) of a center point.
 */
export function isWithinRadius(
  point: LatLng,
  center: LatLng,
  radiusMiles: number
): boolean {
  return haversineDistance(point, center) <= radiusMiles;
}

/**
 * Compute the geographic centroid of a set of points.
 */
export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 0, lng: 0 };
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}
