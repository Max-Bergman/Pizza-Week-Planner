import { useMemo, useRef } from "react";
import type { UserPreferences, DietaryTag } from "../types";
import { PIZZA_WEEK_GRID_DAYS } from "../constants/pizzaWeek";
import { normalizeSelectedDayDates } from "../lib/calendarDates";
import {
  mergeAdvancedIntoSimpleBaseline,
  prefsHasValidLocations,
  seedAdvancedDayPrefsFromSimple,
} from "../lib/planningContext";
import {
  applyGlobalStopsToSelectedDays,
  dayKeyLocal,
  setSimpleStopsBounds,
} from "../lib/stopsPrefs";
import { AddressWithGeocode } from "./AddressWithGeocode";

interface PreferencesFormProps {
  prefs: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
  onSubmit: () => void;
  matchCount: number;
}

const DIETARY_OPTIONS: { value: DietaryTag; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten_free", label: "Gluten Free" },
];

export function PreferencesForm({
  prefs,
  onChange,
  onSubmit,
  matchCount,
}: PreferencesFormProps) {
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const sortedSelectedDays = useMemo(
    () => [...prefs.selectedDays].sort((a, b) => a.getTime() - b.getTime()),
    [prefs.selectedDays]
  );

  const isDaySelected = (date: Date) =>
    prefs.selectedDays.some((d) => d.toDateString() === date.toDateString());

  const setPlanningMode = (mode: "simple" | "advanced") => {
    const base = prefsRef.current;
    if (mode === base.planningMode) return;
    if (mode === "advanced") {
      onChange({
        ...base,
        planningMode: "advanced",
        advancedDayPrefs: seedAdvancedDayPrefsFromSimple(base),
      });
    } else {
      onChange({
        ...base,
        planningMode: "simple",
        ...mergeAdvancedIntoSimpleBaseline(base),
      });
    }
  };

  const toggleDay = (date: Date) => {
    const base = prefsRef.current;
    const selected = base.selectedDays.some(
      (d) => d.toDateString() === date.toDateString()
    );
    const newDaysRaw = selected
      ? base.selectedDays.filter((d) => d.toDateString() !== date.toDateString())
      : [...base.selectedDays, date];
    const newDays = normalizeSelectedDayDates(newDaysRaw);

    let next: UserPreferences = { ...base, selectedDays: newDays };
    if (next.planningMode === "simple") {
      next = applyGlobalStopsToSelectedDays(
        next,
        next.simpleStops.min,
        next.simpleStops.max
      );
    } else if (!selected) {
      const key = dayKeyLocal(date);
      if (!next.advancedDayPrefs[key]) {
        next = {
          ...next,
          advancedDayPrefs: {
            ...next.advancedDayPrefs,
            [key]: {
              address: next.address,
              location: next.location,
              radiusMiles: next.radiusMiles,
              minStops: next.simpleStops.min,
              maxStops: next.simpleStops.max,
            },
          },
        };
      }
    }
    onChange(next);
  };

  const canSubmit = prefs.selectedDays.length > 0 && prefsHasValidLocations(prefs);

  const submitHint = !prefs.selectedDays.length
    ? "Select at least one day"
    : !prefsHasValidLocations(prefs)
      ? prefs.planningMode === "advanced"
        ? "Confirm an address (✓) for each selected day"
        : "Enter and confirm your address"
      : "";

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-8">
      {/* Planning style */}
      <section className="rounded-2xl border-2 border-orange-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-1">Planning style</p>
        <p className="text-xs text-gray-500 mb-3">
          <strong>Simple</strong> uses one start address, one radius, and the same min/max stops
          for every day you pick. <strong>Advanced</strong> lets you tune each day separately.
        </p>
        <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50 gap-1">
          <button
            type="button"
            onClick={() => setPlanningMode("simple")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              prefs.planningMode === "simple"
                ? "bg-white text-red-800 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setPlanningMode("advanced")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              prefs.planningMode === "advanced"
                ? "bg-white text-red-800 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Advanced
          </button>
        </div>
      </section>

      {/* Days first — applies to both modes */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-gray-700">Available days</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const base = prefsRef.current;
                const newDays = normalizeSelectedDayDates(
                  PIZZA_WEEK_GRID_DAYS.map((d) => d.date)
                );
                let next: UserPreferences = { ...base, selectedDays: newDays };
                if (next.planningMode === "simple") {
                  next = applyGlobalStopsToSelectedDays(
                    next,
                    next.simpleStops.min,
                    next.simpleStops.max
                  );
                } else {
                  const adv = { ...base.advancedDayPrefs };
                  for (const d of newDays) {
                    const k = dayKeyLocal(d);
                    if (!adv[k]) {
                      adv[k] = {
                        address: base.address,
                        location: base.location,
                        radiusMiles: base.radiusMiles,
                        minStops: base.simpleStops.min,
                        maxStops: base.simpleStops.max,
                      };
                    }
                  }
                  next = { ...next, advancedDayPrefs: adv };
                }
                onChange(next);
              }}
              className="text-xs text-orange-600 hover:underline"
            >
              All
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() =>
                onChange({ ...prefsRef.current, selectedDays: [] })
              }
              className="text-xs text-gray-400 hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {PIZZA_WEEK_GRID_DAYS.map(({ date, label, sublabel }) => {
            const selected = isDaySelected(date);
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => toggleDay(date)}
                className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-colors text-center ${
                  selected
                    ? "border-red-700 bg-red-700 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                }`}
              >
                <span className="text-xs font-bold">{label}</span>
                <span
                  className={`text-xs mt-0.5 ${selected ? "text-red-200" : "text-gray-400"}`}
                >
                  {sublabel}
                </span>
              </button>
            );
          })}
        </div>
        {prefs.selectedDays.length === 0 && (
          <p className="text-xs text-red-500 mt-2">Select at least one day.</p>
        )}
      </section>

      {prefs.planningMode === "simple" ? (
        <>
          <section>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="simple-address">
              Starting address
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Used for distance sorting, the map ring, and route planning for every selected day.
            </p>
            <AddressWithGeocode
              id="simple-address"
              address={prefs.address}
              location={prefs.location}
              onChange={({ address, location }) =>
                onChange({ ...prefsRef.current, address, location })
              }
              onConfirm={({ address, location }) =>
                onChange({ ...prefsRef.current, address, location })
              }
            />
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Max drive radius</label>
              <span className="text-sm font-bold text-orange-600">{prefs.radiusMiles} mi</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={prefs.radiusMiles}
              onChange={(e) =>
                onChange({
                  ...prefsRef.current,
                  radiusMiles: Number(e.target.value),
                })
              }
              className="w-full accent-red-700"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 mi</span>
              <span>20 mi</span>
            </div>
          </section>

          <section>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Stops per day
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Same minimum and maximum for every selected day.
            </p>
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Min</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      setSimpleStopsBounds(
                        prefsRef.current,
                        prefsRef.current.simpleStops.min - 1,
                        prefsRef.current.simpleStops.max
                      )
                    )
                  }
                  className="w-8 h-8 rounded-lg border-2 border-gray-200 text-gray-600 font-bold hover:border-orange-400"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold">{prefs.simpleStops.min}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      setSimpleStopsBounds(
                        prefsRef.current,
                        prefsRef.current.simpleStops.min + 1,
                        prefsRef.current.simpleStops.max
                      )
                    )
                  }
                  className="w-8 h-8 rounded-lg border-2 border-gray-200 text-gray-600 font-bold hover:border-orange-400"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Max</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      setSimpleStopsBounds(
                        prefsRef.current,
                        prefsRef.current.simpleStops.min,
                        prefsRef.current.simpleStops.max - 1
                      )
                    )
                  }
                  className="w-8 h-8 rounded-lg border-2 border-gray-200 text-gray-600 font-bold hover:border-orange-400"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold">{prefs.simpleStops.max}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      setSimpleStopsBounds(
                        prefsRef.current,
                        prefsRef.current.simpleStops.min,
                        prefsRef.current.simpleStops.max + 1
                      )
                    )
                  }
                  className="w-8 h-8 rounded-lg border-2 border-gray-200 text-gray-600 font-bold hover:border-orange-400"
                >
                  +
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="space-y-4">
          <p className="text-sm text-gray-600">
            Dietary filters apply to the whole list. Below, set <strong>start</strong>,{" "}
            <strong>radius</strong>, and <strong>stops</strong> for each day you selected.
          </p>
          {sortedSelectedDays.length === 0 ? (
            <p className="text-xs text-gray-500">Select days above to configure each one.</p>
          ) : (
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
              {sortedSelectedDays.map((date, dayIdx) => {
                const key = dayKeyLocal(date);
                const row = prefs.advancedDayPrefs[key];
                if (!row) {
                  return (
                    <p key={key} className="text-xs text-amber-700">
                      Missing settings for {key}. Toggle the day off and on to reset.
                    </p>
                  );
                }
                const prevDate = dayIdx > 0 ? sortedSelectedDays[dayIdx - 1]! : null;
                const prevKey = prevDate ? dayKeyLocal(prevDate) : null;
                const prevRow = prevKey ? prefs.advancedDayPrefs[prevKey] : undefined;

                const meta = PIZZA_WEEK_GRID_DAYS.find(
                  (x) => x.date.toDateString() === date.toDateString()
                );
                const title = meta
                  ? `${meta.label} · ${meta.sublabel}`
                  : date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                const patch = (partial: Partial<typeof row>) => {
                  const base = prefsRef.current;
                  const cur = base.advancedDayPrefs[key] ?? row;
                  onChange({
                    ...base,
                    advancedDayPrefs: {
                      ...base.advancedDayPrefs,
                      [key]: { ...cur, ...partial },
                    },
                  });
                };

                const copyFromDayAbove = () => {
                  if (!prevKey || !prevRow) return;
                  const base = prefsRef.current;
                  const source = base.advancedDayPrefs[prevKey];
                  if (!source) return;
                  onChange({
                    ...base,
                    advancedDayPrefs: {
                      ...base.advancedDayPrefs,
                      [key]: {
                        address: source.address,
                        location: source.location,
                        radiusMiles: source.radiusMiles,
                        minStops: source.minStops,
                        maxStops: source.maxStops,
                      },
                    },
                  });
                };

                return (
                  <div
                    key={key}
                    className="rounded-2xl border-2 border-orange-100 bg-white shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-orange-50/80 border-b border-orange-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{title}</span>
                      {dayIdx > 0 && prevRow && (
                        <button
                          type="button"
                          onClick={copyFromDayAbove}
                          className="text-xs font-medium text-orange-800 hover:text-orange-950 bg-white/80 border border-orange-200 rounded-lg px-2.5 py-1 shadow-sm"
                        >
                          Copy from day above
                        </button>
                      )}
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Start address
                        </label>
                        <AddressWithGeocode
                          id={`adv-addr-${key}`}
                          address={row.address}
                          location={row.location}
                          compact
                          onChange={({ address, location }) => patch({ address, location })}
                          onConfirm={({ address, location }) => patch({ address, location })}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-gray-600">Max drive radius</span>
                          <span className="font-bold text-orange-600">{row.radiusMiles} mi</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={20}
                          value={row.radiusMiles}
                          onChange={(e) =>
                            patch({ radiusMiles: Number(e.target.value) })
                          }
                          className="w-full accent-red-700"
                        />
                      </div>
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-8">Min</span>
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                minStops: Math.max(1, row.minStops - 1),
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 text-sm font-bold text-gray-600"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{row.minStops}</span>
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                minStops: Math.min(row.maxStops, row.minStops + 1),
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 text-sm font-bold text-gray-600"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-8">Max</span>
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                maxStops: Math.max(row.minStops, row.maxStops - 1),
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 text-sm font-bold text-gray-600"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{row.maxStops}</span>
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                maxStops: Math.min(15, row.maxStops + 1),
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 text-sm font-bold text-gray-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Dietary — shared */}
      <section>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Dietary preferences <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(({ value, label }) => {
            const active = prefs.dietaryFilters.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const base = prefsRef.current;
                  const has = base.dietaryFilters.includes(value);
                  onChange({
                    ...base,
                    dietaryFilters: has
                      ? base.dietaryFilters.filter((t) => t !== value)
                      : [...base.dietaryFilters, value],
                  });
                }}
                className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-green-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {prefs.dietaryFilters.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            Only showing restaurants whose special matches all selected tags.
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-4 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-lg shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!canSubmit
          ? submitHint || "Complete setup to continue"
          : `Find Pizza — ${matchCount} spot${matchCount !== 1 ? "s" : ""} in range`}
      </button>
    </div>
  );
}
