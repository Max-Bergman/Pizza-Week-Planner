import type { DayRoute } from "../types";

function coord(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

/**
 * Driving directions for the day: start → each stop in order → return to start.
 * @see https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function googleMapsDayUrl(day: DayRoute): string | null {
  if (day.stops.length === 0) return null;
  const h = day.routeStart;
  const origin = coord(h.lat, h.lng);
  const destination = origin;
  const stops = day.stops.map((s) => coord(s.restaurant.lat, s.restaurant.lng));
  const waypoints = stops.join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    waypoints,
    destination,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Same itinerary in Apple Maps (repeated `daddr` adds via stops in practice on iOS / maps.apple.com).
 */
export function appleMapsDayUrl(day: DayRoute): string | null {
  if (day.stops.length === 0) return null;
  const h = day.routeStart;
  const q: string[] = ["dirflg=d", `saddr=${encodeURIComponent(coord(h.lat, h.lng))}`];
  for (const s of day.stops) {
    q.push(`daddr=${encodeURIComponent(coord(s.restaurant.lat, s.restaurant.lng))}`);
  }
  q.push(`daddr=${encodeURIComponent(coord(h.lat, h.lng))}`);
  return `https://maps.apple.com/?${q.join("&")}`;
}
