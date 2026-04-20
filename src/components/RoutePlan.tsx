import { useMemo } from "react";
import type {
  Restaurant,
  RoutePlan as RoutePlanType,
  RatingsMap,
  RestaurantVisitPatch,
  VisitLogMap,
} from "../types";
import { collectPlanRestaurants } from "../lib/visitLogHelpers";
import { DayItinerary } from "./DayItinerary";
import { VisitTracker } from "./VisitTracker";

interface RoutePlanProps {
  plan: RoutePlanType;
  filteredRestaurants: Restaurant[];
  ratings: RatingsMap;
  visitLog: VisitLogMap;
  onPatchVisit: (restaurantId: string, patch: RestaurantVisitPatch) => void;
  onDayStopsChange: (dayIndex: number, restaurants: Restaurant[]) => void;
  /** Step 3: reorder/add stops. Step 4: read-only itinerary. */
  routeEditing: boolean;
  /** Visit diary / journal (step 4). */
  showVisitTracker: boolean;
  /** Print, PDF, PNG, share (step 4). */
  showExports: boolean;
  /** Step 3 only — advances to tracker step. */
  onLockRoute?: () => void;
  lockRouteDisabled?: boolean;
  onBack: () => void;
  /** Optional second nav when following (e.g. back to browse). */
  onBackToBrowse?: () => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  onCopyShareLink: () => void;
}

export function RoutePlan({
  plan,
  filteredRestaurants,
  ratings,
  visitLog,
  onPatchVisit,
  onDayStopsChange,
  routeEditing,
  showVisitTracker,
  showExports,
  onLockRoute,
  lockRouteDisabled,
  onBack,
  onBackToBrowse,
  onPrint,
  onDownloadPdf,
  onDownloadPng,
  onCopyShareLink,
}: RoutePlanProps) {
  const hours = Math.floor(plan.totalDriveMinutes / 60);
  const mins = plan.totalDriveMinutes % 60;
  const driveLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  const planRestaurants = useMemo(() => collectPlanRestaurants(plan), [plan]);
  const planIds = useMemo(() => new Set(planRestaurants.map((r) => r.id)), [planRestaurants]);
  const extraRestaurants = useMemo(
    () =>
      filteredRestaurants
        .filter((r) => !planIds.has(r.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [filteredRestaurants, planIds]
  );

  const title = routeEditing ? "Edit your routes" : "Your routes";
  const subtitle = routeEditing
    ? "Reorder stops, add from your in-range list, or pick on the map. When you are happy with the plan, lock it in to track visits and export."
    : "Routes are locked. On each day, mark stops visited and add scores right under every restaurant, then export or open the day in Google Maps or Apple Maps on your phone.";

  return (
    <div id="route-plan-print-root">
      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-500 text-sm mt-1">
              April 20–26, 2026 &middot; $4 slices &middot; $25 whole pies
            </p>
            <p className="text-gray-600 text-sm mt-2 max-w-2xl leading-snug">{subtitle}</p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2 export-exclude">
            {routeEditing && onLockRoute && (
              <button
                type="button"
                disabled={lockRouteDisabled}
                onClick={onLockRoute}
                className="px-4 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold shadow hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save &amp; lock route →
              </button>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              {showExports && (
                <>
                  <button
                    type="button"
                    onClick={onPrint}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium hover:border-orange-300"
                  >
                    Print / PDF
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium hover:border-orange-300"
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPng}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium hover:border-orange-300"
                  >
                    Download PNG
                  </button>
                  <button
                    type="button"
                    onClick={onCopyShareLink}
                    className="px-3 py-2 rounded-xl border-2 border-orange-200 bg-orange-50 text-orange-900 text-sm font-medium hover:bg-orange-100"
                  >
                    Copy share link
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onBack}
                className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-medium hover:border-orange-300"
              >
                {routeEditing ? "← Back to browse" : "← Edit routes"}
              </button>
              {!routeEditing && onBackToBrowse && (
                <button
                  type="button"
                  onClick={onBackToBrowse}
                  className="px-3 py-2 rounded-xl border-2 border-transparent text-gray-600 text-sm font-medium hover:text-gray-900 underline-offset-2 hover:underline"
                >
                  Browse &amp; rate
                </button>
              )}
            </div>
          </div>
        </div>

        {routeEditing && (
          <p className="text-xs text-gray-500 mt-3 export-exclude">
            After you lock the route, each day shows <strong>Google Maps</strong> and <strong>Apple Maps</strong>{" "}
            links with stops in order (driving directions). Your edits still auto-save in this browser until you
            lock.
          </p>
        )}

        {!routeEditing && (
          <p className="text-xs text-gray-500 mt-3 export-exclude">
            Per day, use the <strong>Google Maps</strong> / <strong>Apple Maps</strong> buttons in each card to open
            a multi-stop route on your phone. Add to saved places or customize pins there if you like.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat
            value={plan.totalRestaurants.toString()}
            label="Total Stops"
            color="text-red-700"
          />
          <Stat value={driveLabel} label="Total Driving" color="text-orange-600" />
          <Stat
            value={`${plan.mustEatsCovered}/${plan.mustEatsTotal}`}
            label="Must-Eats Covered"
            color="text-green-700"
          />
          <Stat
            value={plan.days.filter((d) => d.stops.length > 0).length.toString()}
            label="Active Days"
            color="text-blue-600"
          />
        </div>
      </div>

      {plan.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-yellow-800 text-sm mb-1">⚠ A few things to note:</p>
          <ul className="space-y-1">
            {plan.warnings.map((w, i) => (
              <li key={i} className="text-sm text-yellow-700 list-disc list-inside">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {plan.days.map((day, dayIndex) => (
          <DayItinerary
            key={day.date.toISOString()}
            day={day}
            dayIndex={dayIndex}
            addCandidates={filteredRestaurants}
            ratings={ratings}
            onChangeStops={onDayStopsChange}
            routeEditing={routeEditing}
            visitLog={showVisitTracker ? visitLog : undefined}
            onPatchVisit={showVisitTracker ? onPatchVisit : undefined}
          />
        ))}
      </div>

      {routeEditing && onLockRoute && (
        <div className="mt-6 flex justify-end export-exclude">
          <button
            type="button"
            disabled={lockRouteDisabled}
            onClick={onLockRoute}
            className="px-4 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold shadow hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save &amp; lock route →
          </button>
        </div>
      )}

      {showVisitTracker && extraRestaurants.length > 0 && (
        <VisitTracker
          planRestaurants={planRestaurants}
          extraRestaurants={extraRestaurants}
          visitLog={visitLog}
          onPatchVisit={onPatchVisit}
          hidePlanStopsList
        />
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-orange-50 rounded-xl p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
