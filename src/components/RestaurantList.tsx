import { useState, useMemo, useEffect } from "react";
import type { BrowseFilters } from "../lib/browseFilter";
import type { Restaurant, Rating, RatingsMap, UserPreferences } from "../types";
import { BrowseFiltersBar } from "./BrowseFiltersBar";
import { RestaurantCard } from "./RestaurantCard";
import { RestaurantMap } from "./RestaurantMap";
import {
  browseMapCenter,
  browseMapRadiusZones,
  distanceFromNearestBrowseAnchor,
} from "../lib/planningContext";
import {
  hasSentInterestSnapshotLocally,
  isCommunityBackendConfigured,
  submitCommunityInterestSnapshot,
} from "../lib/communityLeaderboard";

interface RestaurantListProps {
  prefs: UserPreferences;
  restaurants: Restaurant[];
  /** Count after step 1 prefs only (before browse filters). */
  totalInRange: number;
  browseFilters: BrowseFilters;
  onBrowseFiltersChange: (next: BrowseFilters) => void;
  ratings: RatingsMap;
  onRatingChange: (id: string, rating: Rating) => void;
  onPlanRoutes: () => void;
  loading: boolean;
  communityDeviceId: string | null;
  excitementTopIds: string[];
  favoriteTopIds: string[];
  highlightSource: "community" | "local";
  onCommunityLeaderboardUpdated?: () => void;
}

export function RestaurantList({
  prefs,
  restaurants,
  totalInRange,
  browseFilters,
  onBrowseFiltersChange,
  ratings,
  onRatingChange,
  onPlanRoutes,
  loading,
  communityDeviceId,
  excitementTopIds,
  favoriteTopIds,
  highlightSource,
  onCommunityLeaderboardUpdated,
}: RestaurantListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const excitementSet = useMemo(() => new Set(excitementTopIds), [excitementTopIds]);
  const favoriteSet = useMemo(() => new Set(favoriteTopIds), [favoriteTopIds]);

  useEffect(() => {
    if (!communityDeviceId) return;
    if (!isCommunityBackendConfigured() || hasSentInterestSnapshotLocally()) return;
    const payload: Record<string, Rating> = {};
    ratings.forEach((value, id) => {
      payload[id] = value;
    });
    if (Object.keys(payload).length === 0) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const ok = await submitCommunityInterestSnapshot(communityDeviceId, payload);
        if (ok) onCommunityLeaderboardUpdated?.();
      })();
    }, 4500);
    return () => window.clearTimeout(t);
  }, [communityDeviceId, ratings, onCommunityLeaderboardUpdated]);

  const mustEatCount = useMemo(
    () => restaurants.filter((r) => ratings.get(r.id) === "must_eat").length,
    [restaurants, ratings]
  );
  const interestedCount = useMemo(
    () => restaurants.filter((r) => ratings.get(r.id) === "interested").length,
    [restaurants, ratings]
  );
  const neutralCount = useMemo(
    () => restaurants.filter((r) => (ratings.get(r.id) ?? "neutral") === "neutral").length,
    [restaurants, ratings]
  );
  const skippedCount = useMemo(
    () => restaurants.filter((r) => ratings.get(r.id) === "not_interested").length,
    [restaurants, ratings]
  );

  const mapZones = useMemo(() => browseMapRadiusZones(prefs), [prefs]);
  const mapCenter = useMemo(() => browseMapCenter(prefs), [prefs]);

  const sorted = useMemo(() => {
    if (!mapCenter || mapZones.length === 0) return restaurants;
    const dist = (r: Restaurant) =>
      distanceFromNearestBrowseAnchor(prefs, { lat: r.lat, lng: r.lng }) ?? Infinity;
    return [...restaurants].sort((a, b) => dist(a) - dist(b));
  }, [restaurants, prefs, mapCenter, mapZones.length]);

  const plannable = useMemo(() => {
    return restaurants.filter((r) => {
      const v = ratings.get(r.id) ?? "neutral";
      return v === "must_eat" || v === "interested" || v === "neutral";
    }).length;
  }, [restaurants, ratings]);

  const browseActive =
    browseFilters.serving.length > 0 || browseFilters.dietary.length > 0;

  return (
    <div className="flex flex-col h-full">
      <BrowseFiltersBar value={browseFilters} onChange={onBrowseFiltersChange} />

      {isCommunityBackendConfigured() && (
        <p className="text-[11px] text-gray-500 mb-2 leading-snug">
          Community stats send your <strong>full interest map</strong> (must eat / interested / neutral / skip){" "}
          <strong>once per browser</strong> after a short pause—aggregated in Supabase, not for ads. Refreshing alone
          does not re-submit.
        </p>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4 bg-white rounded-xl border border-orange-100 shadow-sm p-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {browseActive && (
            <span className="text-xs text-gray-500 w-full sm:w-auto">
              Showing {restaurants.length} of {totalInRange} in range
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
            <strong>{mustEatCount}</strong> must eat
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
            <strong>{interestedCount}</strong> interested
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <strong>{neutralCount}</strong> neutral
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
            <strong>{skippedCount}</strong> skip
          </span>
        </div>
        <button
          onClick={onPlanRoutes}
          disabled={loading || plannable === 0 || restaurants.length === 0}
          className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Planning…
            </span>
          ) : (
            `Plan My Routes →`
          )}
        </button>
      </div>

      {/* Main split layout */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-3 order-2 md:order-1">
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">🍕</p>
              <p className="font-semibold">No restaurants match these filters.</p>
              <p className="text-sm mt-1">
                Clear slice/dietary chips above or widen your radius in step 1.
              </p>
            </div>
          ) : (
            sorted.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                rating={ratings.get(r.id) ?? "neutral"}
                userLocation={mapCenter}
                distanceMilesOverride={distanceFromNearestBrowseAnchor(prefs, {
                  lat: r.lat,
                  lng: r.lng,
                })}
                onRatingChange={(rating) => onRatingChange(r.id, rating)}
                highlighted={hoveredId === r.id}
                onHover={setHoveredId}
                bannerExcitement={excitementSet.has(r.id) ? highlightSource : null}
                bannerFavorite={favoriteSet.has(r.id) ? highlightSource : null}
              />
            ))
          )}
        </div>

        {mapCenter && mapZones.length > 0 && sorted.length > 0 && (
          <div className="order-1 md:order-2 md:w-96 md:shrink-0">
            <div className="md:sticky md:top-4 h-72 md:h-[calc(100vh-180px)] rounded-xl overflow-hidden shadow-sm border border-orange-100">
              <RestaurantMap
                restaurants={sorted}
                ratings={ratings}
                zones={mapZones}
                highlightedId={hoveredId}
                onMarkerClick={setHoveredId}
              />
            </div>
            {prefs.planningMode === "advanced" && mapZones.length > 1 && (
              <p className="text-xs text-gray-500 mt-2 px-1">
                Each colored ring is that day&apos;s start point and search radius.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
