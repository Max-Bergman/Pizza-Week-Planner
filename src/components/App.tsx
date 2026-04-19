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
  collectPlanRestaurantIds,
  fetchCommunityExcitementTop,
  fetchCommunityFavoriteTop,
  hasSentPlanSnapshotLocally,
  hasSentVisitSnapshotLocally,
  isCommunityBackendConfigured,
  submitCommunityPlanStops,
  submitCommunityVisitSnapshot,
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
  const [routeLocked, setRouteLocked] = useState(false);
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

  /** Ribbons only when Supabase is configured and the aggregate query returned ids. */
  const excitementDisplayIds = useMemo(() => {
    if (!isCommunityBackendConfigured() || lbExcitement.length === 0) return [];
    return lbExcitement;
  }, [lbExcitement]);

  const favoriteDisplayIds = useMemo(() => {
    if (!isCommunityBackendConfigured() || lbFavorite.length === 0) return [];
    const vis = new Set(visibleRestaurants.map((r) => r.id));
    return lbFavorite.filter((id) => vis.has(id));
  }, [lbFavorite, visibleRestaurants]);

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
        const shareStep = payload.step ?? 1;
        setStep(shareStep >= 3 ? 2 : shareStep);
        setPlan(null);
        setVisitLog(new Map());
        setRouteLocked(false);
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
      let restoredStep = saved.step;
      if ((restoredStep === 3 || restoredStep === 4) && !saved.plan) {
        restoredStep = 2;
        setRouteLocked(false);
      } else {
        setRouteLocked(saved.routeLocked ?? false);
      }
      setStep(restoredStep);
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
    if (step !== 4) return;
    if (hasSentVisitSnapshotLocally()) return;
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
      void submitCommunityVisitSnapshot(deviceId, scores).then((ok) => {
        if (ok) void refreshCommunityBoard();
      });
    }, 5000);
    return () => window.clearTimeout(t);
  }, [step, visitLog, refreshCommunityBoard]);

  useEffect(() => {
    if (!isCommunityBackendConfigured()) return;
    if (step !== 4 || !plan) return;
    if (hasSentPlanSnapshotLocally()) return;
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) return;
    const ids = collectPlanRestaurantIds(plan);
    if (ids.length === 0) return;
    const t = window.setTimeout(() => {
      void submitCommunityPlanStops(deviceId, ids).then((ok) => {
        if (ok) void refreshCommunityBoard();
      });
    }, 3500);
    return () => window.clearTimeout(t);
  }, [step, plan, refreshCommunityBoard]);

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
        routeLocked,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [step, prefs, ratings, visitLog, browseFilters, plan, routeLocked, restaurantsLoading]);

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
    setRouteLocked(false);
    setStep(3);
  }, [visibleRestaurants, ratings, prefs, generatePlan]);

  const handleDayStopsChange = useCallback(
    async (dayIndex: number, restaurantsInOrder: Restaurant[]) => {
      if (!plan) return;
      setRouteLocked(false);
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
    /** Very long URLs can still fail in some environments; PDF/PNG remain the fallback. */
    const maxHashChars = 60000;
    if (enc.length > maxHashChars) {
      window.alert(
        "This link would be too long for some browsers. Use Download PDF or Download PNG to share your route instead."
      );
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#share=${enc}`;

    const copyWithFallback = async () => {
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        try {
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return ok;
        } catch {
          return false;
        }
      }
    };

    void (async () => {
      const ok = await copyWithFallback();
      if (ok) {
        window.alert("Share link copied. Paste it to open the same preferences on another device.");
      } else {
        window.prompt("Copy this share link (Ctrl/Cmd+C):", url);
      }
    })();
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

      <Stepper
        currentStep={step}
        onStepClick={setStep}
        canOpenRouteEditor={Boolean(plan)}
        canOpenTrackFromBrowse={Boolean(plan) && routeLocked}
        className="print:hidden"
      />

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
            onCommunityLeaderboardUpdated={refreshCommunityBoard}
          />
        )}
        {(step === 3 || step === 4) && plan && (
          <RoutePlan
            plan={plan}
            filteredRestaurants={filtered}
            ratings={ratings}
            visitLog={visitLog}
            onPatchVisit={patchVisitLog}
            onDayStopsChange={handleDayStopsChange}
            routeEditing={step === 3}
            showVisitTracker={step === 4}
            showExports={step === 4}
            onLockRoute={step === 3 ? () => { setRouteLocked(true); setStep(4); } : undefined}
            lockRouteDisabled={plan.totalRestaurants === 0}
            onBack={step === 3 ? () => setStep(2) : () => setStep(3)}
            onBackToBrowse={step === 4 ? () => setStep(2) : undefined}
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
