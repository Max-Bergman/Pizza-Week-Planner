import type { DayAdvancedPrefs, LatLng, UserPreferences } from "../types";
import { PIZZA_WEEK_DAY_DATES } from "../constants/pizzaWeek";
import { haversineDistance } from "./geo";
import { dayKeyLocal, getStopsBounds } from "./stopsPrefs";

export interface ResolvedDayRouting {
  address: string;
  location: LatLng | null;
  radiusMiles: number;
  minStops: number;
  maxStops: number;
}

export function resolveDayRoutingPrefs(
  prefs: UserPreferences,
  date: Date
): ResolvedDayRouting {
  if (prefs.planningMode === "simple") {
    const b = getStopsBounds(prefs.stopsPerDay, date);
    return {
      address: prefs.address,
      location: prefs.location,
      radiusMiles: prefs.radiusMiles,
      minStops: b.min,
      maxStops: b.max,
    };
  }
  const key = dayKeyLocal(date);
  const adv = prefs.advancedDayPrefs[key];
  if (adv) {
    return {
      address: adv.address,
      location: adv.location,
      radiusMiles: adv.radiusMiles,
      minStops: adv.minStops,
      maxStops: adv.maxStops,
    };
  }
  const b = getStopsBounds(prefs.stopsPerDay, date);
  return {
    address: prefs.address,
    location: prefs.location,
    radiusMiles: prefs.radiusMiles,
    minStops: b.min,
    maxStops: b.max,
  };
}

export function prefsHasValidLocations(prefs: UserPreferences): boolean {
  if (prefs.selectedDays.length === 0) return false;
  if (prefs.planningMode === "simple") return !!prefs.location;
  return prefs.selectedDays.every((d) => {
    const key = dayKeyLocal(d);
    const adv = prefs.advancedDayPrefs[key];
    return !!adv?.location;
  });
}

/** Map circles for browse step: one zone in simple mode, one per selected day in advanced. */
export function browseMapRadiusZones(prefs: UserPreferences): {
  center: LatLng;
  radiusMiles: number;
  label: string;
}[] {
  if (prefs.planningMode === "simple") {
    if (!prefs.location) return [];
    return [{ center: prefs.location, radiusMiles: prefs.radiusMiles, label: "Your radius" }];
  }
  const sorted = [...prefs.selectedDays].sort((a, b) => a.getTime() - b.getTime());
  const zones: { center: LatLng; radiusMiles: number; label: string }[] = [];
  for (const d of sorted) {
    const r = resolveDayRoutingPrefs(prefs, d);
    if (!r.location) continue;
    const meta = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    zones.push({
      center: r.location,
      radiusMiles: r.radiusMiles,
      label: meta,
    });
  }
  return zones;
}

/** Map center: single home or centroid of zone centers. */
export function browseMapCenter(prefs: UserPreferences): LatLng | null {
  const zones = browseMapRadiusZones(prefs);
  if (zones.length === 0) return prefs.location;
  if (zones.length === 1) return zones[0]!.center;
  const sum = zones.reduce(
    (acc, z) => ({ lat: acc.lat + z.center.lat, lng: acc.lng + z.center.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / zones.length, lng: sum.lng / zones.length };
}

export function distanceFromNearestBrowseAnchor(
  prefs: UserPreferences,
  point: LatLng
): number | null {
  const zones = browseMapRadiusZones(prefs);
  if (zones.length === 0) return null;
  let best = Infinity;
  for (const z of zones) {
    const d = haversineDistance(point, z.center);
    if (d < best) best = d;
  }
  return best;
}

export function seedAdvancedDayPrefsFromSimple(
  prefs: UserPreferences
): Record<string, DayAdvancedPrefs> {
  const next: Record<string, DayAdvancedPrefs> = { ...prefs.advancedDayPrefs };
  for (const date of PIZZA_WEEK_DAY_DATES) {
    const key = dayKeyLocal(date);
    if (next[key]) continue;
    const b = prefs.simpleStops;
    next[key] = {
      address: prefs.address,
      location: prefs.location,
      radiusMiles: prefs.radiusMiles,
      minStops: b.min,
      maxStops: b.max,
    };
  }
  return next;
}

export function mergeAdvancedIntoSimpleBaseline(prefs: UserPreferences): Pick<
  UserPreferences,
  "address" | "location" | "radiusMiles" | "stopsPerDay" | "simpleStops"
> {
  const sorted = [...prefs.selectedDays].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const stopsPerDay: UserPreferences["stopsPerDay"] = { ...prefs.stopsPerDay };
  for (const date of PIZZA_WEEK_DAY_DATES) {
    const key = dayKeyLocal(date);
    const adv = prefs.advancedDayPrefs[key];
    if (adv) {
      stopsPerDay[key] = { min: adv.minStops, max: adv.maxStops };
    }
  }
  let simpleStops = prefs.simpleStops;
  if (first) {
    const fk = dayKeyLocal(first);
    const fa = prefs.advancedDayPrefs[fk];
    if (fa) {
      simpleStops = { min: fa.minStops, max: fa.maxStops };
    }
  }
  if (!first) {
    return {
      address: prefs.address,
      location: prefs.location,
      radiusMiles: prefs.radiusMiles,
      stopsPerDay,
      simpleStops,
    };
  }
  const key = dayKeyLocal(first);
  const adv = prefs.advancedDayPrefs[key];
  if (adv?.location) {
    return {
      address: adv.address,
      location: adv.location,
      radiusMiles: adv.radiusMiles,
      stopsPerDay,
      simpleStops,
    };
  }
  return {
    address: prefs.address,
    location: prefs.location,
    radiusMiles: prefs.radiusMiles,
    stopsPerDay,
    simpleStops,
  };
}
