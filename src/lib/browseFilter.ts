import type { DietaryTag, PizzaServing, Restaurant } from "../types";

export interface BrowseFilters {
  /**
   * If empty, show all serving types. Otherwise OR among chips:
   * - `slice` → slice-only or both
   * - `whole_pie` → whole-pie-only or both
   * - `both` → listings that explicitly offer both formats only
   */
  serving: PizzaServing[];
  /** If empty, no extra dietary filter. Otherwise restaurant must include every tag. */
  dietary: DietaryTag[];
}

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  serving: [],
  dietary: [],
};

/** Whether `restaurant` satisfies one browse chip for slice / whole / both. */
export function restaurantMatchesServingChip(
  pizzaServing: Restaurant["pizzaServing"],
  chip: PizzaServing
): boolean {
  if (chip === "slice") {
    return pizzaServing === "slice" || pizzaServing === "both";
  }
  if (chip === "whole_pie") {
    return pizzaServing === "whole_pie" || pizzaServing === "both";
  }
  if (chip === "both") {
    return pizzaServing === "both";
  }
  return false;
}

/**
 * Narrow the list from preferences-filtered restaurants (step 2 browse chips).
 */
export function applyBrowseFilters(
  restaurants: Restaurant[],
  browse: BrowseFilters
): Restaurant[] {
  return restaurants.filter((r) => {
    if (
      browse.serving.length > 0 &&
      !browse.serving.some((chip) => restaurantMatchesServingChip(r.pizzaServing, chip))
    ) {
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
