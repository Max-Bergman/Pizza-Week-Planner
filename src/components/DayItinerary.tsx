import { useState } from "react";
import type { DayRoute, Restaurant, RatingsMap } from "../types";
import { pizzaServingLabel } from "../lib/pizzaServing";
import { appleMapsDayUrl, googleMapsDayUrl } from "../lib/mapsDeepLinks";
import { RouteMap } from "./RouteMap";

interface DayItineraryProps {
  day: DayRoute;
  dayIndex: number;
  addCandidates: Restaurant[];
  ratings: RatingsMap;
  onChangeStops: (dayIndex: number, restaurantsInOrder: Restaurant[]) => void;
  routeEditing?: boolean;
}

export function DayItinerary({
  day,
  dayIndex,
  addCandidates,
  ratings,
  onChangeStops,
  routeEditing = true,
}: DayItineraryProps) {
  const [showMap, setShowMap] = useState(() => day.stops.length > 0);
  const [mapPickMode, setMapPickMode] = useState(false);

  const dayLabel = day.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const restaurants = day.stops.map((s) => s.restaurant);
  const onRouteIds = new Set(restaurants.map((r) => r.id));
  const addOptions = addCandidates.filter((r) => !onRouteIds.has(r.id));

  const totalDist = day.stops.reduce((sum, s) => sum + s.distanceMilesFromPrevious, 0);

  const pushNext = (next: Restaurant[]) => {
    onChangeStops(dayIndex, next);
  };

  const removeAt = (idx: number) => {
    pushNext(restaurants.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= restaurants.length) return;
    const copy = [...restaurants];
    [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
    pushNext(copy);
  };

  const addById = (id: string) => {
    const r = addCandidates.find((x) => x.id === id);
    if (!r || onRouteIds.has(r.id)) return;
    pushNext([...restaurants, r]);
  };

  const hasMapContent = day.stops.length > 0 || addOptions.length > 0;
  const mapVisible = routeEditing
    ? hasMapContent && (showMap || mapPickMode)
    : day.stops.length > 0 && showMap;

  const toggleShowMap = () => {
    setShowMap((prev) => {
      const next = !prev;
      if (!next) setMapPickMode(false);
      return next;
    });
  };

  const toggleMapPick = () => {
    setMapPickMode((prev) => {
      const next = !prev;
      if (next) setShowMap(true);
      return next;
    });
  };

  const handleMapPick = (restaurantId: string, action: "add" | "remove") => {
    if (!routeEditing) return;
    if (action === "add") {
      addById(restaurantId);
    } else {
      pushNext(restaurants.filter((r) => r.id !== restaurantId));
    }
  };

  const showMapToggleInHeader =
    (routeEditing && hasMapContent) || (!routeEditing && day.stops.length > 0);

  const googleUrl = googleMapsDayUrl(day);
  const appleUrl = appleMapsDayUrl(day);
  const showMapsLinks = Boolean(googleUrl && appleUrl);
  const showHeaderActions = showMapToggleInHeader || showMapsLinks;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
      <div className="flex flex-wrap justify-between items-start gap-3 px-5 py-4 bg-red-700 text-white">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{dayLabel}</h3>
          <p className="text-red-200 text-sm mt-0.5">
            {day.stops.length} stop{day.stops.length !== 1 ? "s" : ""}
            {day.stops.length > 0 && (
              <>
                {" "}
                &middot; ~{day.totalDriveMinutes} min &middot; {totalDist.toFixed(1)} mi driving
              </>
            )}
          </p>
        </div>
        {showHeaderActions && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {showMapToggleInHeader && (
              <button
                type="button"
                onClick={toggleShowMap}
                className="text-red-100 hover:text-white text-sm underline"
              >
                {showMap || mapPickMode ? "Hide map" : "Show map"}
              </button>
            )}
            {showMapsLinks && (
              <div className="flex flex-wrap justify-end gap-1.5">
                <a
                  href={googleUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
                >
                  Google Maps
                </a>
                <a
                  href={appleUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
                >
                  Apple Maps
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {mapVisible && (
        <div className="relative h-64 border-b border-orange-100 route-plan-leaflet-map">
          {mapPickMode && routeEditing && (
            <div className="absolute top-2 left-2 right-2 z-[500] pointer-events-none flex justify-center px-2">
              <p className="text-[11px] font-medium text-white/95 bg-black/55 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-white/10 max-w-md text-center leading-snug">
                Colors = your ratings · <span className="text-red-200"># + ring</span> = on route · tap others to
                add · tap # to remove · Done picking
              </p>
            </div>
          )}
          <RouteMap
            day={day}
            ratings={ratings}
            mapPickMode={routeEditing && mapPickMode}
            pickCandidates={addOptions}
            onStopPick={routeEditing ? handleMapPick : undefined}
          />
        </div>
      )}

      {routeEditing && (
        <div className="px-5 py-3 bg-orange-50/90 border-b border-orange-100 flex flex-wrap gap-3 items-center text-sm export-exclude">
          <span className="font-medium text-gray-700">Edit route</span>
          {hasMapContent && (
            <button
              type="button"
              onClick={toggleMapPick}
              aria-pressed={mapPickMode}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                mapPickMode
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-emerald-300/80 bg-white text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              <span className="text-[10px] opacity-90" aria-hidden>
                {mapPickMode ? "✓" : "◎"}
              </span>
              {mapPickMode ? "Done picking" : "Pick on map"}
            </button>
          )}
          {addOptions.length > 0 && (
            <label className="flex items-center gap-2 text-gray-600">
              <span className="text-xs">Add stop</span>
              <select
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addById(e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Choose restaurant…</option>
                {addOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {addOptions.length === 0 && day.stops.length > 0 && (
            <span className="text-xs text-gray-500">No more spots in range to add.</span>
          )}
        </div>
      )}

      {day.stops.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-500 text-sm">
          <p className="mb-3">No stops this day.</p>
          {routeEditing && addOptions.length > 0 && (
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white mx-auto block"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addById(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="">Add your first stop…</option>
              {addOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <ol className="divide-y divide-orange-50">
          {day.stops.map((stop, idx) => (
            <li key={stop.restaurant.id} className="flex gap-3 px-5 py-4">
              <div className="flex flex-col items-center shrink-0">
                <span className="w-7 h-7 rounded-full bg-red-700 text-white flex items-center justify-center text-xs font-bold">
                  {stop.order}
                </span>
                {idx < day.stops.length - 1 && (
                  <div
                    className="w-px flex-1 mt-1 bg-orange-200"
                    style={{ minHeight: "12px" }}
                  />
                )}
              </div>

              <div className="flex-1 pb-1 min-w-0">
                <p className="font-bold text-gray-900 leading-tight">{stop.restaurant.name}</p>
                <p className="text-orange-700 text-sm font-medium mt-0.5">
                  {stop.restaurant.special}
                </p>
                <p className="text-xs text-red-800/80 font-medium mt-1">
                  {pizzaServingLabel(stop.restaurant.pizzaServing)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{stop.restaurant.description}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 items-center">
                  <span className="flex items-center gap-1">
                    🚗 {stop.driveMinutesFromPrevious} min
                    {idx === 0
                      ? " from start"
                      : ` from ${day.stops[idx - 1]?.restaurant.name ?? "prev"}`}
                  </span>
                  <span>·</span>
                  <span>{stop.distanceMilesFromPrevious} mi</span>
                  {stop.restaurant.website && (
                    <>
                      <span>·</span>
                      <a
                        href={stop.restaurant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline"
                      >
                        Website ↗
                      </a>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{stop.restaurant.address}</p>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {routeEditing && (
                  <div className="flex gap-1 export-exclude">
                    <button
                      type="button"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                      className="px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white disabled:opacity-30 hover:border-orange-300"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={idx === day.stops.length - 1}
                      onClick={() => move(idx, 1)}
                      className="px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white disabled:opacity-30 hover:border-orange-300"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeAt(idx)}
                      className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="text-right text-xs">
                  {(stop.restaurant.pizzaServing === "slice" ||
                    stop.restaurant.pizzaServing === "both") && (
                    <div>
                      <span className="text-sm font-bold text-green-700">
                        ${stop.restaurant.priceSlice}
                      </span>
                      <p className="text-gray-400">/ slice</p>
                    </div>
                  )}
                  {(stop.restaurant.pizzaServing === "whole_pie" ||
                    stop.restaurant.pizzaServing === "both") && (
                    <div className={stop.restaurant.pizzaServing === "both" ? "mt-1.5" : ""}>
                      <span className="text-sm font-bold text-green-700">
                        ${stop.restaurant.priceWhole}
                      </span>
                      <p className="text-gray-400">/ whole pie</p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}

          <li className="flex gap-3 px-5 py-3 bg-orange-50">
            <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center shrink-0">
              <span className="text-blue-600 text-xs">⌂</span>
            </div>
            <p className="text-sm text-gray-600 self-center">Return to start</p>
          </li>
        </ol>
      )}
    </div>
  );
}
