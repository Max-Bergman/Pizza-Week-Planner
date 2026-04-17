import type { DietaryTag, PizzaServing, Restaurant } from "../types";

export interface BrowseFilters {
  /** If empty, show all serving types. Otherwise restaurant must match one of these. */
  serving: PizzaServing[];
  /** If empty, no extra dietary filter. Otherwise restaurant must include every tag. */
  dietary: DietaryTag[];
}

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  serving: [],
  dietary: [],
};

/**
 * Narrow the list from preferences-filtered restaurants (step 2 browse chips).
 */
export function applyBrowseFilters(
  restaurants: Restaurant[],
  browse: BrowseFilters
): Restaurant[] {
  return restaurants.filter((r) => {
    if (browse.serving.length > 0 && !browse.serving.includes(r.pizzaServing)) {
      return false;
    }
    if (
      browse.dietary.length > 0 &&
      !browse.dietary.every((tag) => r.dietaryTags.includes(tag))
    ) {
      return false;
    }
    return true;
  });
}
