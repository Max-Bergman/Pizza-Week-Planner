import { useState, useCallback } from "react";
import type { Restaurant, UserPreferences, RatingsMap, RoutePlan } from "../types";
import { planRoutes } from "../lib/planner";

/**
 * Hook to trigger route planning and manage its loading/error/result state.
 */
export function useRoutePlanner() {
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePlan = useCallback(
    async (
      restaurants: Restaurant[],
      ratings: RatingsMap,
      prefs: UserPreferences
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await planRoutes(restaurants, ratings, prefs);
        setPlan(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Route planning failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearPlan = useCallback(() => setPlan(null), []);

  return { plan, setPlan, loading, error, generatePlan, clearPlan };
}
