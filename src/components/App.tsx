import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { AppStep, UserPreferences, RatingsMap, DietaryTag, Rating, Restaurant } from "../types";
import { useRestaurants } from "../hooks/useRestaurants";
import { useRoutePlanner } from "../hooks/useRoutePlanner";
import {
  applyBrowseFilters,
  EMPTY_BROWSE_FILTERS,
  type BrowseFilters,
} from "../lib/browseFilter";
import { filterRestaurants } from "../lib/filter";
import { prefsHasValidLocations } from "../lib/planningContext";
import { PIZZA_WEEK_DAY_DATES } from "../constants/pizzaWeek";
import { normalizeSelectedDayDates } from "../lib/calendarDates";
import {
  loadPersistedState,
  savePersistedState,
  rehydrateUserPreferences,
} from "../lib/persistState";
import { encodeSharePayload, decodeSharePayload } from "../lib/shareState";
import {
  aggregateRoutePlanTotals,
  rebuildDayRouteFromStops,
} from "../lib/routeRebuild";
import { Stepper } from "./Stepper";
import { PreferencesForm } from "./PreferencesForm";
import { RestaurantList } from "./RestaurantList";
import { RoutePlan } from "./RoutePlan";

const DEFAULT_PREFS: UserPreferences = {
  planningMode: "simple",
  selectedDays: normalizeSelectedDayDates([...PIZZA_WEEK_DAY_DATES]),
  address: "",
  location: null,
  radiusMiles: 10,
  dietaryFilters: [] as DietaryTag[],
  stopsPerDay: {},
  simpleStops: { min: 2, max: 5 },
  advancedDayPrefs: {},
};

export function App() {
  const [step, setStep] = useState<AppStep>(1);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [ratings, setRatings] = useState<RatingsMap>(new Map());
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);

  const hydrationDone = useRef(false);
  const allowSave = useRef(false);

  const {
    restaurants,
    loading: restaurantsLoading,
    error: restaurantsError,
  } = useRestaurants();
  const { plan, setPlan, loading: planLoading, generatePlan } = useRoutePlanner();

  const filtered = filterRestaurants(restaurants, prefs);

  const visibleRestaurants = useMemo(
    () => applyBrowseFilters(filtered, browseFilters),
    [filtered, browseFilters]
  );

  const mustEatIds = useMemo(() => {
    const s = new Set<string>();
    ratings.forEach((r, id) => {
      if (r === "must_eat") s.add(id);
    });
    return s;
  }, [ratings]);

  useEffect(() => {
    if (hydrationDone.current || restaurantsLoading || restaurants.length === 0) return;

    const rawHash = window.location.hash;
    if (rawHash.startsWith("#share=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      const payload = decodeSharePayload(rawHash.slice(7));
      if (payload) {
        setPrefs(rehydrateUserPreferences(payload.prefs));
        setRatings(new Map(Object.entries(payload.ratings)));
        setBrowseFilters(payload.browseFilters ?? EMPTY_BROWSE_FILTERS);
        setStep(payload.step ?? 1);
        setPlan(null);
        hydrationDone.current = true;
        allowSave.current = true;
        return;
      }
    }

    const saved = loadPersistedState();
    if (saved) {
      setPrefs(saved.prefs);
      setRatings(new Map(Object.entries(saved.ratings)));
      setBrowseFilters(saved.browseFilters);
      if (saved.plan) setPlan(saved.plan);
      setStep(saved.step);
    }
    hydrationDone.current = true;
    allowSave.current = true;
  }, [restaurantsLoading, restaurants.length]);

  useEffect(() => {
    if (!allowSave.current || restaurantsLoading) return;
    const t = window.setTimeout(() => {
      savePersistedState({
        v: 2,
        step,
        prefs,
        ratings: Object.fromEntries(ratings),
        browseFilters,
        plan,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [step, prefs, ratings, browseFilters, plan, restaurantsLoading]);

  const handlePrefsSubmit = useCallback(() => {
    if (!prefsHasValidLocations(prefs)) return;
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

  const handleDayStopsChange = useCallback(
    async (dayIndex: number, restaurantsInOrder: Restaurant[]) => {
      if (!plan) return;
      const day = plan.days[dayIndex]!;
      const updated = await rebuildDayRouteFromStops(
        day.date,
        day.routeStart,
        restaurantsInOrder,
        true
      );
      const days = plan.days.map((d, i) => (i === dayIndex ? updated : d));
      const agg = aggregateRoutePlanTotals(days, mustEatIds);
      setPlan({
        ...plan,
        days,
        totalDriveMinutes: agg.totalDriveMinutes,
        totalRestaurants: agg.totalRestaurants,
        mustEatsCovered: agg.mustEatsCovered,
        mustEatsTotal: agg.mustEatsTotal,
      });
    },
    [plan, mustEatIds, setPlan]
  );

  const handleDownloadJson = useCallback(() => {
    const data = {
      v: 2,
      exportedAt: new Date().toISOString(),
      prefs,
      ratings: Object.fromEntries(ratings),
      browseFilters,
      plan,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pizza-week-routes.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [prefs, ratings, browseFilters, plan]);

  const handleCopyShareLink = useCallback(() => {
    const payload = {
      v: 2 as const,
      prefs,
      ratings: Object.fromEntries(ratings),
      browseFilters,
      step,
    };
    const enc = encodeSharePayload(payload);
    if (enc.length > 4000) {
      window.alert("This link would be too long for some browsers. Use Download JSON instead.");
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#share=${enc}`;
    void navigator.clipboard.writeText(url);
    window.alert("Share link copied. Paste it to open the same preferences on another device.");
  }, [prefs, ratings, browseFilters, step]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
      <header className="bg-red-700 text-white py-5 px-4 text-center shadow-md print:hidden">
        <h1 className="text-3xl font-black tracking-tight">Portland Pizza Week 2026</h1>
        <p className="text-red-200 mt-1 text-sm">
          April 20–26 &middot; $4 slices &middot; $25 pies &middot;{" "}
          {restaurants.length} specials organized by Portland Mercury
        </p>
      </header>

      <Stepper currentStep={step} onStepClick={setStep} className="print:hidden" />

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
            prefs={prefs}
            restaurants={visibleRestaurants}
            totalInRange={filtered.length}
            browseFilters={browseFilters}
            onBrowseFiltersChange={setBrowseFilters}
            ratings={ratings}
            onRatingChange={(id, rating) =>
              setRatings((prev) => new Map(prev).set(id, rating))
            }
            onPlanRoutes={handlePlanRoutes}
            loading={planLoading}
          />
        )}
        {step === 3 && plan && (
          <RoutePlan
            plan={plan}
            filteredRestaurants={filtered}
            onDayStopsChange={handleDayStopsChange}
            onBack={() => setStep(2)}
            onPrint={handlePrint}
            onDownloadJson={handleDownloadJson}
            onCopyShareLink={handleCopyShareLink}
          />
        )}
      </main>
    </div>
  );
}
