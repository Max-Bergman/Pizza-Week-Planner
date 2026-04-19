import { useMemo, useState } from "react";
import type { Restaurant, RestaurantVisitEntry, RestaurantVisitPatch, VisitLogMap } from "../types";
import { VisitStopControls } from "./VisitStopControls";

interface VisitTrackerProps {
  planRestaurants: Restaurant[];
  extraRestaurants: Restaurant[];
  visitLog: VisitLogMap;
  onPatchVisit: (restaurantId: string, patch: RestaurantVisitPatch) => void;
  /** When true, route stops are tracked on each day card; this section is only extras. */
  hidePlanStopsList?: boolean;
}

function VisitRow({
  r,
  entry,
  onPatchVisit,
}: {
  r: Restaurant;
  entry: RestaurantVisitEntry | undefined;
  onPatchVisit: (id: string, patch: RestaurantVisitPatch) => void;
}) {
  return (
    <li className="border border-orange-100 rounded-xl bg-white overflow-hidden">
      <VisitStopControls
        restaurantId={r.id}
        entry={entry}
        onPatchVisit={onPatchVisit}
        sideTitle={
          <>
            <p className="font-bold text-gray-900 leading-tight">{r.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{r.address}</p>
          </>
        }
      />
    </li>
  );
}

export function VisitTracker({
  planRestaurants,
  extraRestaurants,
  visitLog,
  onPatchVisit,
  hidePlanStopsList = false,
}: VisitTrackerProps) {
  const [showExtras, setShowExtras] = useState(false);

  const planVisited = useMemo(() => {
    return planRestaurants.filter((r) => visitLog.has(r.id)).length;
  }, [planRestaurants, visitLog]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 mt-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {hidePlanStopsList ? "More places to track" : "Visit diary"}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {hidePlanStopsList
              ? "Your route stops are on each day above. Here you can still log other in-range spots you hit off-route."
              : "Mark spots you have tried, add a score out of 10, and jot a short review. Saved only on this device."}
          </p>
        </div>
        {planRestaurants.length > 0 && (
          <p className="text-sm font-medium text-orange-800 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 shrink-0">
            {planVisited} / {planRestaurants.length} route stops visited
          </p>
        )}
      </div>

      {!hidePlanStopsList && planRestaurants.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">
          No stops on your plan yet. Add restaurants to your days above, or expand the list below to track other
          spots in range.
        </p>
      )}

      {!hidePlanStopsList && planRestaurants.length > 0 && (
        <ul className="mt-4 space-y-3">
          {planRestaurants.map((r) => (
            <VisitRow key={r.id} r={r} entry={visitLog.get(r.id)} onPatchVisit={onPatchVisit} />
          ))}
        </ul>
      )}

      {extraRestaurants.length > 0 && (
        <div className={`${!hidePlanStopsList ? "mt-6 pt-4 border-t border-orange-100" : "mt-4"}`}>
          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="text-sm font-semibold text-red-800 hover:text-red-950 underline-offset-2 hover:underline"
          >
            {showExtras ? "Hide" : "Show"} other restaurants in your area ({extraRestaurants.length})
          </button>
          {showExtras && (
            <ul className="mt-3 space-y-3">
              {extraRestaurants.map((r) => (
                <VisitRow key={r.id} r={r} entry={visitLog.get(r.id)} onPatchVisit={onPatchVisit} />
              ))}
            </ul>
          )}
        </div>
      )}

      {hidePlanStopsList && extraRestaurants.length === 0 && (
        <p className="text-sm text-gray-500 mt-3">No other in-range restaurants to list here.</p>
      )}
    </section>
  );
}
