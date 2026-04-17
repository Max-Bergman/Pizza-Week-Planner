import { useState, useCallback, useMemo } from "react";
import type { AppStep, UserPreferences, RatingsMap, DietaryTag, Rating } from "../types";
import { useRestaurants } from "../hooks/useRestaurants";
import { useRoutePlanner } from "../hooks/useRoutePlanner";
import {
  applyBrowseFilters,
  EMPTY_BROWSE_FILTERS,
  type BrowseFilters,
} from "../lib/browseFilter";
import { filterRestaurants } from "../lib/filter";
import { Stepper } from "./Stepper";
import { PreferencesForm } from "./PreferencesForm";
import { RestaurantList } from "./RestaurantList";
import { RoutePlan } from "./RoutePlan";

const PIZZA_WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 3, 20 + i));

const DEFAULT_PREFS: UserPreferences = {
  selectedDays: [...PIZZA_WEEK_DAYS],
  address: "",
  location: null,
  radiusMiles: 10,
  dietaryFilters: [] as DietaryTag[],
  minPerDay: 2,
  maxPerDay: 5,
};

export function App() {
  const [step, setStep] = useState<AppStep>(1);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [ratings, setRatings] = useState<RatingsMap>(new Map());
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);

  const {
    restaurants,
    loading: restaurantsLoading,
    error: restaurantsError,
  } = useRestaurants();
  const { plan, loading: planLoading, generatePlan } = useRoutePlanner();

  const filtered = filterRestaurants(restaurants, prefs);

  const visibleRestaurants = useMemo(
    () => applyBrowseFilters(filtered, browseFilters),
    [filtered, browseFilters]
  );

  const handlePrefsSubmit = useCallback(() => {
    if (!prefs.location) return;
    const initialRatings = new Map<string, Rating>();
    filtered.forEach((r) => initialRatings.set(r.id, "neutral"));
    setRatings(initialRatings);
    setBrowseFilters(EMPTY_BROWSE_FILTERS);
    setStep(2);
  }, [prefs, filtered]);

  const handlePlanRoutes = useCallback(async () => {
    await generatePlan(visibleRestaurants, ratings, prefs);
    setStep(3);
  }, [visibleRestaurants, ratings, prefs, generatePlan]);

  if (restaurantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="text-center">
          <p className="text-5xl mb-3">🍕</p>
          <p className="text-xl text-orange-800 font-semibold">Loading pizza data…</p>
        </div>
      </div>
    );
  }

  if (restaurantsError || restaurants.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4">
        <div className="max-w-md text-center">
          <p className="text-5xl mb-3">🍕</p>
          <p className="text-lg font-semibold text-red-800">
            {restaurantsError
              ? "Could not load restaurant list."
              : "No restaurants found in data."}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {restaurantsError
              ? restaurantsError
              : "Run npm run scrape:pizza-week and ensure public/data/restaurants.json exists."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-red-700 text-white py-5 px-4 text-center shadow-md">
        <h1 className="text-3xl font-black tracking-tight">
          Portland Pizza Week 2026
        </h1>
        <p className="text-red-200 mt-1 text-sm">
          April 20–26 &middot; $4 slices &middot; {restaurants.length} specials from EverOut
        </p>
      </header>

      <Stepper currentStep={step} onStepClick={setStep} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {step === 1 && (
          <PreferencesForm
            prefs={prefs}
            onChange={setPrefs}
            onSubmit={handlePrefsSubmit}
            matchCount={filtered.length}
          />
        )}
        {step === 2 && (
          <RestaurantList
            restaurants={visibleRestaurants}
            totalInRange={filtered.length}
            browseFilters={browseFilters}
            onBrowseFiltersChange={setBrowseFilters}
            ratings={ratings}
            userLocation={prefs.location}
            radiusMiles={prefs.radiusMiles}
            onRatingChange={(id, rating) =>
              setRatings((prev) => new Map(prev).set(id, rating))
            }
            onPlanRoutes={handlePlanRoutes}
            loading={planLoading}
          />
        )}
        {step === 3 && plan && prefs.location && (
          <RoutePlan
            plan={plan}
            userLocation={prefs.location}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}
