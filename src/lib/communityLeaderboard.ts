import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Rating,
  Restaurant,
  RatingsMap,
  RoutePlan,
  UserPreferences,
  VisitLogMap,
} from "../types";
import { distanceFromNearestBrowseAnchor } from "./planningContext";

const SENT_INTEREST = "pizza-week-community-interest-sent";
const SENT_VISIT = "pizza-week-community-visit-sent";
const SENT_PLAN = "pizza-week-community-plan-sent";

export type CommunityRestaurantAggregateRow = {
  restaurant_id: string;
  must_eat_n: number;
  interested_n: number;
  neutral_n: number;
  not_interested_n: number;
  visit_score_sum: number;
  visit_score_n: number;
  planned_route_n: number;
  updated_at?: string;
};

export function isCommunityBackendConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key && typeof url === "string" && typeof key === "string");
}

async function getClient(): Promise<SupabaseClient | null> {
  if (!isCommunityBackendConfigured()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

export async function fetchCommunityExcitementTop(): Promise<string[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("community_restaurant_aggregate")
    .select("restaurant_id")
    .order("must_eat_n", { ascending: false })
    .limit(5);
  if (error || !data) return [];
  return data.map((r) => (r as { restaurant_id: string }).restaurant_id);
}

export async function fetchCommunityFavoriteTop(): Promise<string[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("community_restaurant_aggregate")
    .select("restaurant_id, visit_score_sum, visit_score_n");
  if (error || !data?.length) return [];
  type Row = { restaurant_id: string; visit_score_sum: number; visit_score_n: number };
  return (data as Row[])
    .filter((r) => r.visit_score_n > 0)
    .sort((a, b) => b.visit_score_sum / b.visit_score_n - a.visit_score_sum / a.visit_score_n)
    .slice(0, 5)
    .map((r) => r.restaurant_id);
}

/** Full per-restaurant rollups (for dashboards / exports). */
export async function fetchCommunityRestaurantMetrics(): Promise<CommunityRestaurantAggregateRow[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("community_restaurant_aggregate")
    .select(
      "restaurant_id, must_eat_n, interested_n, neutral_n, not_interested_n, visit_score_sum, visit_score_n, planned_route_n, updated_at"
    )
    .order("restaurant_id");
  if (error || !data) return [];
  return data as CommunityRestaurantAggregateRow[];
}

/** One snapshot per browser: every interest level you set, aggregated globally. */
export async function submitCommunityInterestSnapshot(
  deviceId: string,
  ratings: Record<string, Rating>
): Promise<boolean> {
  if (Object.keys(ratings).length === 0) return false;
  const sb = await getClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("community_submit_interest_snapshot", {
      p_device_id: deviceId,
      p_ratings: ratings,
    });
    if (error) {
      console.warn("community_submit_interest_snapshot", error);
      return false;
    }
    try {
      localStorage.setItem(SENT_INTEREST, "1");
    } catch {
      /* */
    }
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

/** One snapshot per browser: visit scores (0–10) from your diary. */
export async function submitCommunityVisitSnapshot(
  deviceId: string,
  scores: Record<string, number>
): Promise<boolean> {
  const keys = Object.keys(scores);
  if (!keys.length) return false;
  const sb = await getClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("community_submit_visit_snapshot", {
      p_device_id: deviceId,
      p_scores: scores,
    });
    if (error) {
      console.warn("community_submit_visit_snapshot", error);
      return false;
    }
    try {
      localStorage.setItem(SENT_VISIT, "1");
    } catch {
      /* */
    }
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

/** One snapshot per browser: restaurants that appeared on your generated plan. */
export async function submitCommunityPlanStops(deviceId: string, restaurantIds: string[]): Promise<boolean> {
  const unique = [...new Set(restaurantIds.filter(Boolean))];
  if (!unique.length) return false;
  const sb = await getClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("community_submit_plan_stops", {
      p_device_id: deviceId,
      p_restaurant_ids: unique,
    });
    if (error) {
      console.warn("community_submit_plan_stops", error);
      return false;
    }
    try {
      localStorage.setItem(SENT_PLAN, "1");
    } catch {
      /* */
    }
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export function collectPlanRestaurantIds(plan: RoutePlan): string[] {
  const ids: string[] = [];
  for (const day of plan.days) {
    for (const stop of day.stops) {
      ids.push(stop.restaurant.id);
    }
  }
  return [...new Set(ids)];
}

export function hasSentInterestSnapshotLocally(): boolean {
  try {
    return localStorage.getItem(SENT_INTEREST) === "1";
  } catch {
    return false;
  }
}

/** @deprecated use hasSentInterestSnapshotLocally */
export function hasSentExcitementLocally(): boolean {
  return hasSentInterestSnapshotLocally();
}

export function hasSentVisitSnapshotLocally(): boolean {
  try {
    return localStorage.getItem(SENT_VISIT) === "1";
  } catch {
    return false;
  }
}

/** @deprecated use hasSentVisitSnapshotLocally */
export function hasSentFavoritesLocally(): boolean {
  return hasSentVisitSnapshotLocally();
}

export function hasSentPlanSnapshotLocally(): boolean {
  try {
    return localStorage.getItem(SENT_PLAN) === "1";
  } catch {
    return false;
  }
}

/** Top 5 must-eat among in-range list, nearest anchors first (ties by distance). */
export function localTopMustEatIds(prefs: UserPreferences, filtered: Restaurant[], ratings: RatingsMap): string[] {
  const scored = filtered
    .filter((r) => ratings.get(r.id) === "must_eat")
    .map((r) => ({
      id: r.id,
      d: distanceFromNearestBrowseAnchor(prefs, { lat: r.lat, lng: r.lng }) ?? 1e9,
    }))
    .sort((a, b) => a.d - b.d);
  return scored.slice(0, 5).map((x) => x.id);
}

/** Top 5 visit scores among restaurants that appear in visit log with a numeric score. */
export function localTopFavoriteIds(visitLog: VisitLogMap): string[] {
  const rows = [...visitLog.entries()]
    .filter(([, v]) => v.score !== undefined && Number.isFinite(v.score))
    .map(([id, v]) => ({ id, s: v.score as number }))
    .sort((a, b) => b.s - a.s);
  return rows.slice(0, 5).map((r) => r.id);
}
