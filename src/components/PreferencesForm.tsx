import { useState, useRef, useEffect, useMemo } from "react";
import type { UserPreferences, DietaryTag } from "../types";
import { useGeocoding } from "../hooks/useGeocoding";
import { getStopsBounds, setStopsForDay } from "../lib/stopsPrefs";

interface PreferencesFormProps {
  prefs: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
  onSubmit: () => void;
  matchCount: number;
}

const PIZZA_WEEK_DAYS = [
  { date: new Date(2026, 3, 20), label: "Mon", sublabel: "Apr 20" },
  { date: new Date(2026, 3, 21), label: "Tue", sublabel: "Apr 21" },
  { date: new Date(2026, 3, 22), label: "Wed", sublabel: "Apr 22" },
  { date: new Date(2026, 3, 23), label: "Thu", sublabel: "Apr 23" },
  { date: new Date(2026, 3, 24), label: "Fri", sublabel: "Apr 24" },
  { date: new Date(2026, 3, 25), label: "Sat", sublabel: "Apr 25" },
  { date: new Date(2026, 3, 26), label: "Sun", sublabel: "Apr 26" },
];

const DIETARY_OPTIONS: { value: DietaryTag; label: string; color: string }[] = [
  { value: "vegetarian", label: "Vegetarian", color: "green" },
  { value: "vegan", label: "Vegan", color: "emerald" },
  { value: "gluten_free", label: "Gluten Free", color: "amber" },
];

export function PreferencesForm({
  prefs,
  onChange,
  onSubmit,
  matchCount,
}: PreferencesFormProps) {
  const [inputValue, setInputValue] = useState(prefs.address);
  const [locationConfirmed, setLocationConfirmed] = useState(!!prefs.location);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const geocodeQuery = locationConfirmed ? "" : inputValue;
  const { results: suggestions, loading: geocodingLoading } = useGeocoding(geocodeQuery);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDaySelected = (date: Date) =>
    prefs.selectedDays.some((d) => d.toDateString() === date.toDateString());

  const toggleDay = (date: Date) => {
    const selected = isDaySelected(date);
    const newDays = selected
      ? prefs.selectedDays.filter((d) => d.toDateString() !== date.toDateString())
      : [...prefs.selectedDays, date].sort((a, b) => a.getTime() - b.getTime());
    onChange({ ...prefs, selectedDays: newDays });
  };

  const handleAddressChange = (val: string) => {
    setInputValue(val);
    setLocationConfirmed(false);
    setShowSuggestions(true);
    onChange({ ...prefs, address: val, location: null });
  };

  const handleSuggestionSelect = (result: { displayName: string; location: { lat: number; lng: number } }) => {
    const shortName = result.displayName.split(",").slice(0, 3).join(",").trim();
    setInputValue(shortName);
    setLocationConfirmed(true);
    setShowSuggestions(false);
    onChange({ ...prefs, address: shortName, location: result.location });
  };

  const toggleDietary = (tag: DietaryTag) => {
    const has = prefs.dietaryFilters.includes(tag);
    onChange({
      ...prefs,
      dietaryFilters: has
        ? prefs.dietaryFilters.filter((t) => t !== tag)
        : [...prefs.dietaryFilters, tag],
    });
  };

  const canSubmit = !!prefs.location && prefs.selectedDays.length > 0;

  const sortedSelectedDays = useMemo(
    () => [...prefs.selectedDays].sort((a, b) => a.getTime() - b.getTime()),
    [prefs.selectedDays]
  );

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-8">
      {/* Address */}
      <section>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Your Starting Address
        </label>
        <p className="text-xs text-gray-500 mb-2">
          We'll filter to restaurants within your drive radius.
        </p>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => !locationConfirmed && setShowSuggestions(true)}
            placeholder="1234 SE Division St, Portland, OR"
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors ${
              locationConfirmed
                ? "border-green-500 bg-green-50"
                : "border-gray-200 focus:border-orange-400 bg-white"
            }`}
          />
          {locationConfirmed && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-lg">
              ✓
            </span>
          )}
          {geocodingLoading && !locationConfirmed && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              …
            </span>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionSelect(s)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="font-medium text-gray-900">
                    {s.displayName.split(",")[0]}
                  </span>
                  <span className="text-gray-500">
                    {", "}
                    {s.displayName.split(",").slice(1, 3).join(",")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Drive Radius */}
      <section>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-gray-700">
            Max Drive Radius
          </label>
          <span className="text-sm font-bold text-orange-600">
            {prefs.radiusMiles} miles
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={prefs.radiusMiles}
          onChange={(e) =>
            onChange({ ...prefs, radiusMiles: Number(e.target.value) })
          }
          className="w-full accent-red-700"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 mi</span>
          <span>20 mi</span>
        </div>
      </section>

      {/* Days */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-gray-700">
            Available Days
          </label>
          <div className="flex gap-2">
            <button
              onClick={() =>
                onChange({
                  ...prefs,
                  selectedDays: PIZZA_WEEK_DAYS.map((d) => d.date),
                })
              }
              className="text-xs text-orange-600 hover:underline"
            >
              All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => onChange({ ...prefs, selectedDays: [] })}
              className="text-xs text-gray-400 hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {PIZZA_WEEK_DAYS.map(({ date, label, sublabel }) => {
            const selected = isDaySelected(date);
            return (
              <button
                key={date.toISOString()}
                onClick={() => toggleDay(date)}
                className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-colors text-center ${
                  selected
                    ? "border-red-700 bg-red-700 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                }`}
              >
                <span className="text-xs font-bold">{label}</span>
                <span className={`text-xs mt-0.5 ${selected ? "text-red-200" : "text-gray-400"}`}>
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

      {/* Dietary */}
      <section>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Dietary Preferences{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(({ value, label }) => {
            const active = prefs.dietaryFilters.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleDietary(value)}
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

      {/* Stops per day (per calendar day) */}
      <section>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Stops per day
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Set min and max for each day you selected (defaults 2–5 until you change a day).
        </p>
        {sortedSelectedDays.length === 0 ? (
          <p className="text-xs text-gray-500">Select at least one day above.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {sortedSelectedDays.map((date) => {
              const bounds = getStopsBounds(prefs.stopsPerDay, date);
              const meta = PIZZA_WEEK_DAYS.find(
                (x) => x.date.toDateString() === date.toDateString()
              );
              const dayTitle = meta
                ? `${meta.label} · ${meta.sublabel}`
                : date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
              return (
                <div
                  key={date.toISOString()}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2"
                >
                  <span className="text-sm font-semibold text-gray-800 min-w-[5.5rem]">
                    {dayTitle}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Min</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          setStopsForDay(prefs, date, { min: bounds.min - 1 })
                        )
                      }
                      className="w-7 h-7 rounded-lg border-2 border-gray-200 text-gray-600 text-sm font-bold hover:border-orange-400 transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-gray-900">
                      {bounds.min}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          setStopsForDay(prefs, date, { min: bounds.min + 1 })
                        )
                      }
                      className="w-7 h-7 rounded-lg border-2 border-gray-200 text-gray-600 text-sm font-bold hover:border-orange-400 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Max</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          setStopsForDay(prefs, date, { max: bounds.max - 1 })
                        )
                      }
                      className="w-7 h-7 rounded-lg border-2 border-gray-200 text-gray-600 text-sm font-bold hover:border-orange-400 transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-gray-900">
                      {bounds.max}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          setStopsForDay(prefs, date, { max: bounds.max + 1 })
                        )
                      }
                      className="w-7 h-7 rounded-lg border-2 border-gray-200 text-gray-600 text-sm font-bold hover:border-orange-400 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-4 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-lg shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!prefs.location
          ? "Enter your address to continue"
          : `Find Pizza — ${matchCount} spot${matchCount !== 1 ? "s" : ""} in range`}
      </button>
    </div>
  );
}
