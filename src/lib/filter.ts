import type { Restaurant, UserPreferences, DietaryTag } from "../types";
import { isWithinRadius } from "./geo";

/**
 * Filter restaurants based on user preferences (radius + dietary).
 * Does NOT filter by day/closure — that happens during route planning.
 */
export function filterRestaurants(
  restaurants: Restaurant[],
  prefs: UserPreferences
): Restaurant[] {
  return restaurants.filter((r) => {
    if (!prefs.location) return true;

    if (!isWithinRadius({ lat: r.lat, lng: r.lng }, prefs.location, prefs.radiusMiles)) {
      return false;
    }

    if (!matchesDietary(r.dietaryTags, prefs.dietaryFilters)) {
      return false;
    }

    return true;
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
