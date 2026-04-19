import type { SupabaseClient } from "@supabase/supabase-js";
import type { Restaurant, RatingsMap, UserPreferences, VisitLogMap } from "../types";
import { distanceFromNearestBrowseAnchor } from "./planningContext";

const SENT_EXCITEMENT = "pizza-week-community-excitement-sent";
const SENT_FAVORITES = "pizza-week-community-favorites-sent";

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
    .from("community_excitement_tally")
    .select("restaurant_id")
    .order("votes", { ascending: false })
    .limit(5);
  if (error || !data) return [];
  return data.map((r) => (r as { restaurant_id: string }).restaurant_id);
}

export async function fetchCommunityFavoriteTop(): Promise<string[]> {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb.from("community_favorite_sum").select("restaurant_id, sum_score, score_count");
  if (error || !data?.length) return [];
  type Row = { restaurant_id: string; sum_score: number; score_count: number };
  return (data as Row[])
    .filter((r) => r.score_count > 0)
    .sort((a, b) => b.sum_score / b.score_count - a.sum_score / a.score_count)
    .slice(0, 5)
    .map((r) => r.restaurant_id);
}

export async function submitCommunityExcitement(deviceId: string, restaurantIds: string[]): Promise<boolean> {
  if (!restaurantIds.length) return false;
  const sb = await getClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("community_submit_excitement", {
      p_device_id: deviceId,
      p_restaurant_ids: restaurantIds,
    });
    if (error) {
      console.warn("community_submit_excitement", error);
      return false;
    }
    try {
      localStorage.setItem(SENT_EXCITEMENT, "1");
    } catch {
      /* */
    }
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export async function submitCommunityFavorites(
  deviceId: string,
  scores: Record<string, number>
): Promise<boolean> {
  const keys = Object.keys(scores);
  if (!keys.length) return false;
  const sb = await getClient();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("community_submit_favorites", {
      p_device_id: deviceId,
      p_scores: scores,
    });
    if (error) {
      console.warn("community_submit_favorites", error);
      return false;
    }
    try {
      localStorage.setItem(SENT_FAVORITES, "1");
    } catch {
      /* */
    }
    return true;
  } catch (e) {
    console.warn(e);
    return false;
  }
}

export function hasSentExcitementLocally(): boolean {
  try {
    return localStorage.getItem(SENT_EXCITEMENT) === "1";
  } catch {
    return false;
  }
}

export function hasSentFavoritesLocally(): boolean {
  try {
    return localStorage.getItem(SENT_FAVORITES) === "1";
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
