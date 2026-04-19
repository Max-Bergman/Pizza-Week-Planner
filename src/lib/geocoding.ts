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
function mapNominatimResults(data: unknown[]): GeocodingResult[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const item = raw as { display_name: string; lat: string; lon: string };
    return {
      displayName: item.display_name,
      location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
    };
  });
}

async function nominatimSearch(params: URLSearchParams): Promise<GeocodingResult[]> {
  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { "User-Agent": "PortlandPizzaWeekPlanner/1.0" },
  });
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
  const data = (await response.json()) as unknown[];
  return mapNominatimResults(data);
}

/**
 * Geocode with Portland-biased search first, then a looser US fallback if nothing matches.
 */
export async function geocodeAddress(
  query: string
): Promise<GeocodingResult[]> {
  const tight = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "8",
    countrycodes: "us",
    viewbox: "-123.2,45.35,-122.25,45.65",
    bounded: "1",
  });

  try {
    const tightResults = await nominatimSearch(tight);
    if (tightResults.length > 0) return tightResults;
  } catch {
    /* fall through */
  }

  const loose = new URLSearchParams({
    q: `${query}, Portland OR`,
    format: "json",
    addressdetails: "1",
    limit: "8",
    countrycodes: "us",
  });

  return nominatimSearch(loose);
}
