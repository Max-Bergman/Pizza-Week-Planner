import type { Restaurant, UserPreferences, DietaryTag } from "../types";
import { isWithinRadius } from "./geo";
import { resolveDayRoutingPrefs } from "./planningContext";

/**
 * Filter restaurants based on user preferences (radius + dietary).
 * Simple: one home + radius. Advanced: in range of any selected day's home + radius.
 * Does NOT filter by day/closure — that happens during route planning.
 */
export function filterRestaurants(
  restaurants: Restaurant[],
  prefs: UserPreferences
): Restaurant[] {
  return restaurants.filter((r) => {
    const p = { lat: r.lat, lng: r.lng };

    if (!matchesDietary(r.dietaryTags, prefs.dietaryFilters)) {
      return false;
    }

    if (prefs.planningMode === "simple") {
      if (!prefs.location) return true;
      return isWithinRadius(p, prefs.location, prefs.radiusMiles);
    }

    for (const d of prefs.selectedDays) {
      const ctx = resolveDayRoutingPrefs(prefs, d);
      if (ctx.location && isWithinRadius(p, ctx.location, ctx.radiusMiles)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * A restaurant matches dietary filters if it has ALL the tags the user requires.
 * If the user has no filters, everything matches.
 */
function matchesDietary(
  restaurantTags: DietaryTag[],
  requiredTags: DietaryTag[]
): boolean {
  if (requiredTags.length === 0) return true;
  return requiredTags.every((tag) => restaurantTags.includes(tag));
}
