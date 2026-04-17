import { useState } from "react";
import type { DayRoute, LatLng } from "../types";
import { pizzaServingLabel } from "../lib/pizzaServing";
import { RouteMap } from "./RouteMap";

interface DayItineraryProps {
  day: DayRoute;
  userLocation: LatLng;
}

export function DayItinerary({ day, userLocation }: DayItineraryProps) {
  const [showMap, setShowMap] = useState(true);

  if (day.stops.length === 0) return null;

  const dayLabel = day.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalDist = day.stops.reduce((sum, s) => sum + s.distanceMilesFromPrevious, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
      {/* Day header */}
      <div className="flex justify-between items-center px-5 py-4 bg-red-700 text-white">
        <div>
          <h3 className="text-lg font-bold">{dayLabel}</h3>
          <p className="text-red-200 text-sm mt-0.5">
            {day.stops.length} stop{day.stops.length !== 1 ? "s" : ""} &middot;{" "}
            ~{day.totalDriveMinutes} min &middot; {totalDist.toFixed(1)} mi driving
          </p>
        </div>
        <button
          onClick={() => setShowMap((v) => !v)}
          className="text-red-100 hover:text-white text-sm underline"
        >
          {showMap ? "Hide map" : "Show map"}
        </button>
      </div>

      {/* Route map */}
      {showMap && (
        <div className="h-64 border-b border-orange-100">
          <RouteMap day={day} userLocation={userLocation} />
        </div>
      )}

      {/* Stop list */}
      <ol className="divide-y divide-orange-50">
        {day.stops.map((stop, idx) => (
          <li key={stop.restaurant.id} className="flex gap-3 px-5 py-4">
            {/* Step number */}
            <div className="flex flex-col items-center shrink-0">
              <span className="w-7 h-7 rounded-full bg-red-700 text-white flex items-center justify-center text-xs font-bold">
                {stop.order}
              </span>
              {idx < day.stops.length - 1 && (
                <div className="w-px flex-1 mt-1 bg-orange-200" style={{ minHeight: "12px" }} />
              )}
            </div>

            {/* Stop info */}
            <div className="flex-1 pb-1">
              <p className="font-bold text-gray-900 leading-tight">
                {stop.restaurant.name}
              </p>
              <p className="text-orange-700 text-sm font-medium mt-0.5">
                {stop.restaurant.special}
              </p>
              <p className="text-xs text-red-800/80 font-medium mt-1">
                {pizzaServingLabel(stop.restaurant.pizzaServing)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {stop.restaurant.description}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 items-center">
                <span className="flex items-center gap-1">
                  🚗 {stop.driveMinutesFromPrevious} min
                  {idx === 0 ? " from home" : ` from ${day.stops[idx - 1]?.restaurant.name ?? "prev"}`}
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

            {/* Price badge */}
            <div className="shrink-0 text-right text-xs">
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
                <div
                  className={
                    stop.restaurant.pizzaServing === "both" ? "mt-1.5" : ""
                  }
                >
                  <span className="text-sm font-bold text-green-700">
                    ${stop.restaurant.priceWhole}
                  </span>
                  <p className="text-gray-400">/ whole pie</p>
                </div>
              )}
            </div>
          </li>
        ))}

        {/* Return home footer */}
        <li className="flex gap-3 px-5 py-3 bg-orange-50">
          <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center shrink-0">
            <span className="text-blue-600 text-xs">⌂</span>
          </div>
          <p className="text-sm text-gray-600 self-center">Return home</p>
        </li>
      </ol>
    </div>
  );
}
