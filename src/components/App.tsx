import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type {
  AppStep,
  UserPreferences,
  RatingsMap,
  DietaryTag,
  Rating,
  Restaurant,
  RestaurantVisitPatch,
  VisitLogMap,
} from "../types";
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
import { clampVisitScore } from "../lib/visitLogHelpers";
import { getOrCreateDeviceId } from "../lib/deviceId";
import {
  fetchCommunityExcitementTop,
  fetchCommunityFavoriteTop,
  hasSentFavoritesLocally,
  isCommunityBackendConfigured,
  localTopFavoriteIds,
  localTopMustEatIds,
  submitCommunityFavorites,
} from "../lib/communityLeaderboard";
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
  const [visitLog, setVisitLog] = useState<VisitLogMap>(new Map());
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);
  const [lbExcitement, setLbExcitement] = useState<string[]>([]);
  const [lbFavorite, setLbFavorite] = useState<string[]>([]);

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

  const communityDeviceId = useMemo(() => getOrCreateDeviceId(), []);

  const localExcitementTop = useMemo(
    () => localTopMustEatIds(prefs, filtered, ratings),
    [prefs, filtered, ratings]
  );
  const localFavoriteTop = useMemo(() => localTopFavoriteIds(visitLog), [visitLog]);

  const excitementDisplayIds = useMemo(() => {
    if (isCommunityBackendConfigured() && lbExcitement.length > 0) return lbExcitement;
    return localExcitementTop;
  }, [lbExcitement, localExcitementTop]);

  const favoriteDisplayIds = useMemo(() => {
    const vis = new Set(visibleRestaurants.map((r) => r.id));
    const base =
      isCommunityBackendConfigured() && lbFavorite.length > 0 ? lbFavorite : localFavoriteTop;
    return base.filter((id) => vis.has(id));
  }, [lbFavorite, localFavoriteTop, visibleRestaurants]);

  const highlightSource = useMemo((): "community" | "local" => {
    if (isCommunityBackendConfigured() && (lbExcitement.length > 0 || lbFavorite.length > 0)) {
      return "community";
    }
    return "local";
  }, [lbExcitement.length, lbFavorite.length]);

  const refreshCommunityBoard = useCallback(async () => {
    if (!isCommunityBackendConfigured()) return;
    const [ex, fav] = await Promise.all([fetchCommunityExcitementTop(), fetchCommunityFavoriteTop()]);
    setLbExcitement(ex);
    setLbFavorite(fav);
  }, []);

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
        setVisitLog(new Map());
        hydrationDone.current = true;
        allowSave.current = true;
        return;
      }
    }

    const saved = loadPersistedState();
    if (saved) {
      setPrefs(saved.prefs);
      setRatings(new Map(Object.entries(saved.ratings)));
      setVisitLog(new Map(Object.entries(saved.visitLog)));
      setBrowseFilters(saved.browseFilters);
      if (saved.plan) setPlan(saved.plan);
      setStep(saved.step);
    }
    hydrationDone.current = true;
    allowSave.current = true;
  }, [restaurantsLoading, restaurants.length, setPlan]);

  useEffect(() => {
    if (restaurantsLoading) return;
    let cancelled = false;
    void (async () => {
      if (!isCommunityBackendConfigured()) {
        if (!cancelled) {
          setLbExcitement([]);
          setLbFavorite([]);
        }
        return;
      }
      try {
        const [ex, fav] = await Promise.all([fetchCommunityExcitementTop(), fetchCommunityFavoriteTop()]);
        if (!cancelled) {
          setLbExcitement(ex);
          setLbFavorite(fav);
        }
      } catch {
        if (!cancelled) {
          setLbExcitement([]);
          setLbFavorite([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantsLoading, restaurants.length]);

  useEffect(() => {
    if (!isCommunityBackendConfigured()) return;
    if (step !== 3) return;
    if (hasSentFavoritesLocally()) return;
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) return;
    const scores: Record<string, number> = {};
    visitLog.forEach((entry, id) => {
      if (entry.score !== undefined && Number.isFinite(entry.score)) {
        scores[id] = entry.score;
      }
    });
    if (Object.keys(scores).length === 0) return;
    const t = window.setTimeout(() => {
      void submitCommunityFavorites(deviceId, scores).then((ok) => {
        if (ok) void refreshCommunityBoard();
      });
    }, 5000);
    return () => window.clearTimeout(t);
  }, [step, visitLog, refreshCommunityBoard]);

  useEffect(() => {
    if (!allowSave.current || restaurantsLoading) return;
    const t = window.setTimeout(() => {
      savePersistedState({
        v: 3,
        step,
        prefs,
        ratings: Object.fromEntries(ratings),
        browseFilters,
        plan,
        visitLog: Object.fromEntries(visitLog),
      });
    }, 400);
    return () => clearTimeout(t);
  }, [step, prefs, ratings, visitLog, browseFilters, plan, restaurantsLoading]);

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

  const patchVisitLog = useCallback((id: string, patch: RestaurantVisitPatch) => {
    setVisitLog((prev) => {
      const next = new Map(prev);
      if (patch.visited === false) {
        next.delete(id);
        return next;
      }
      const prevE = next.get(id);
      const score =
        patch.score === null
          ? undefined
          : patch.score !== undefined
            ? clampVisitScore(patch.score)
            : prevE?.score;
      const review =
        patch.review === null
          ? undefined
          : patch.review !== undefined
            ? patch.review.slice(0, 2000) || undefined
            : prevE?.review;
      next.set(id, { visited: true, score, review });
      return next;
    });
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!plan) return;
    try {
      const { downloadRoutePlanPdf } = await import("../lib/routePlanExport");
      await downloadRoutePlanPdf(plan, visitLog, restaurants);
    } catch (e) {
      console.error(e);
      window.alert("Could not build the PDF. Try Print / PDF from your browser instead.");
    }
  }, [plan, visitLog, restaurants]);

  const handleDownloadPng = useCallback(async () => {
    if (!plan) return;
    try {
      const { downloadRoutePlanPng } = await import("../lib/routePlanExport");
      await downloadRoutePlanPng();
    } catch (e) {
      console.error(e);
      window.alert("Could not capture a PNG. Try Print / PDF or Download PDF instead.");
    }
  }, [plan]);

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
      window.alert(
        "This link would be too long for some browsers. Use Download PDF or Download PNG to share your route instead."
      );
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
            communityDeviceId={communityDeviceId}
            excitementTopIds={excitementDisplayIds}
            favoriteTopIds={favoriteDisplayIds}
            highlightSource={highlightSource}
            restaurantsForCommunitySubmit={filtered}
            onCommunityLeaderboardUpdated={refreshCommunityBoard}
          />
        )}
        {step === 3 && plan && (
          <RoutePlan
            plan={plan}
            filteredRestaurants={filtered}
            ratings={ratings}
            visitLog={visitLog}
            onPatchVisit={patchVisitLog}
            onDayStopsChange={handleDayStopsChange}
            onBack={() => setStep(2)}
            onPrint={handlePrint}
            onDownloadPdf={handleDownloadPdf}
            onDownloadPng={handleDownloadPng}
            onCopyShareLink={handleCopyShareLink}
          />
        )}
      </main>
    </div>
  );
}
