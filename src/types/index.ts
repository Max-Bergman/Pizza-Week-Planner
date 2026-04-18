// --- Core Data ---

/** From EverOut q-317 filter: by-the-slice, whole-pie, or both. */
export type PizzaServing = "slice" | "whole_pie" | "both";

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  special: string;
  description: string;
  dietaryTags: DietaryTag[];
  closedDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat
  /** Slice, whole pie, or both (Pizza Week listing). */
  pizzaServing: PizzaServing;
  priceSlice: number;
  priceWhole: number;
  website: string;
  imageUrl: string;
}

export type DietaryTag = "vegetarian" | "vegan" | "gluten_free";

export type Rating =
  | "must_eat"
  | "interested"
  | "neutral"
  | "not_interested";

// --- User Preferences ---

export interface DayStopsBounds {
  min: number;
  max: number;
}

/** Key: local calendar `YYYY-MM-DD` (see `dayKeyLocal`). Omitted keys use app defaults. */
export type StopsPerDayMap = Record<string, DayStopsBounds>;

export interface UserPreferences {
  selectedDays: Date[];
  address: string;
  location: LatLng | null;
  radiusMiles: number;
  dietaryFilters: DietaryTag[];
  /** Per selected calendar day; missing keys use defaults (min 2, max 5). */
  stopsPerDay: StopsPerDayMap;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// --- Route Planning ---

export interface RoutePlan {
  days: DayRoute[];
  totalDriveMinutes: number;
  totalRestaurants: number;
  mustEatsCovered: number;
  mustEatsTotal: number;
  warnings: string[];
}

export interface DayRoute {
  date: Date;
  stops: RouteStop[];
  totalDriveMinutes: number;
  routeGeometry: GeoJSON.LineString | null; // OSRM polyline for map display
}

export interface RouteStop {
  restaurant: Restaurant;
  order: number; // 1-indexed sequence in the day
  driveMinutesFromPrevious: number;
  distanceMilesFromPrevious: number;
}

// --- App State ---

export type AppStep = 1 | 2 | 3;

export type RatingsMap = Map<string, Rating>;
