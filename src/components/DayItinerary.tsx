import { useState } from "react";
import type { DayRoute, Restaurant } from "../types";
import { pizzaServingLabel } from "../lib/pizzaServing";
import { RouteMap } from "./RouteMap";

interface DayItineraryProps {
  day: DayRoute;
  dayIndex: number;
  addCandidates: Restaurant[];
  onChangeStops: (dayIndex: number, restaurantsInOrder: Restaurant[]) => void;
  routeEditing?: boolean;
}

export function DayItinerary({
  day,
  dayIndex,
  addCandidates,
  onChangeStops,
  routeEditing = true,
}: DayItineraryProps) {
  const [showMap, setShowMap] = useState(true);

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
      <div className="flex justify-between items-center px-5 py-4 bg-red-700 text-white">
        <div>
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
        {day.stops.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="text-red-100 hover:text-white text-sm underline"
          >
            {showMap ? "Hide map" : "Show map"}
          </button>
        )}
      </div>

      {day.stops.length > 0 && showMap && (
        <div className="h-64 border-b border-orange-100">
          <RouteMap day={day} />
        </div>
      )}

      {routeEditing && (
        <div className="px-5 py-3 bg-orange-50/90 border-b border-orange-100 flex flex-wrap gap-3 items-center text-sm">
          <span className="font-medium text-gray-700">Edit route</span>
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
                  <div className="flex gap-1">
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
