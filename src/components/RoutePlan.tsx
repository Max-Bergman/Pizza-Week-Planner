import type { Restaurant, RoutePlan as RoutePlanType } from "../types";
import { DayItinerary } from "./DayItinerary";

interface RoutePlanProps {
  plan: RoutePlanType;
  filteredRestaurants: Restaurant[];
  onDayStopsChange: (dayIndex: number, restaurants: Restaurant[]) => void;
  onBack: () => void;
  onPrint: () => void;
  onDownloadJson: () => void;
  onCopyShareLink: () => void;
}

export function RoutePlan({
  plan,
  filteredRestaurants,
  onDayStopsChange,
  onBack,
  onPrint,
  onDownloadJson,
  onCopyShareLink,
}: RoutePlanProps) {
  const hours = Math.floor(plan.totalDriveMinutes / 60);
  const mins = plan.totalDriveMinutes % 60;
  const driveLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  return (
    <div id="route-plan-print-root">
      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Pizza Routes</h2>
            <p className="text-gray-500 text-sm mt-1">
              April 20–26, 2026 &middot; $4 per slice
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPrint}
              className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium hover:border-orange-300"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onDownloadJson}
              className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium hover:border-orange-300"
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={onCopyShareLink}
              className="px-3 py-2 rounded-xl border-2 border-orange-200 bg-orange-50 text-orange-900 text-sm font-medium hover:bg-orange-100"
            >
              Copy share link
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-medium hover:border-orange-300"
            >
              ← Back
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Edit: reorder with arrows, remove with ✕, or add stops from your in-range list. Changes save in this
          browser automatically.
        </p>

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
            onChangeStops={onDayStopsChange}
          />
        ))}
      </div>
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
