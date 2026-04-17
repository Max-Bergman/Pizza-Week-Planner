import type { LatLng } from "../types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export interface GeocodingResult {
  displayName: string;
  location: LatLng;
}

/**
 * Geocode an address string to lat/lng using Nominatim.
 * Respects Nominatim usage policy: include a User-Agent, max 1 req/sec.
 */
export async function geocodeAddress(
  query: string
): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "us",
    viewbox: "-123.0,45.3,-122.3,45.7", // Portland metro bounding box
    bounded: "1",
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { "User-Agent": "PortlandPizzaWeekPlanner/1.0" },
  });

  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);

  const data = await response.json();
  return data.map((item: { display_name: string; lat: string; lon: string }) => ({
    displayName: item.display_name,
    location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
  }));
}
