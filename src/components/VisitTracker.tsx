import { useMemo, useState } from "react";
import type { Restaurant, RestaurantVisitEntry, RestaurantVisitPatch, VisitLogMap } from "../types";
import { clampVisitScore } from "../lib/visitLogHelpers";

interface VisitTrackerProps {
  planRestaurants: Restaurant[];
  extraRestaurants: Restaurant[];
  visitLog: VisitLogMap;
  onPatchVisit: (restaurantId: string, patch: RestaurantVisitPatch) => void;
}

function formatScore(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
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
  const visited = Boolean(entry);
  const scoreStr =
    entry?.score !== undefined && Number.isFinite(entry.score) ? formatScore(entry.score) : "";

  return (
    <li className="border border-orange-100 rounded-xl bg-white overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <label className="flex items-center gap-2 cursor-pointer shrink-0 pt-0.5">
          <input
            type="checkbox"
            checked={visited}
            onChange={(e) => {
              if (e.target.checked) onPatchVisit(r.id, { visited: true });
              else onPatchVisit(r.id, { visited: false });
            }}
            className="rounded border-gray-300 text-red-700 focus:ring-red-600"
          />
          <span className="text-sm font-semibold text-gray-900">Been there</span>
        </label>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-tight">{r.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{r.address}</p>
        </div>
      </div>

      {visited && (
        <div className="px-4 pb-4 pt-0 border-t border-orange-50 bg-orange-50/40 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wide">
                Rating (0–10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                inputMode="decimal"
                placeholder="e.g. 8.5"
                value={scoreStr}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || v === "-") {
                    onPatchVisit(r.id, { score: null });
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  onPatchVisit(r.id, { score: clampVisitScore(n) });
                }}
                className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
              />
            </label>
            {entry?.score !== undefined && (
              <span className="text-sm text-gray-600 pb-1">{formatScore(entry.score)} / 10</span>
            )}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wide">
              Review (optional)
            </span>
            <textarea
              rows={2}
              maxLength={2000}
              placeholder="Slice quality, vibe, wait time…"
              value={entry?.review ?? ""}
              onChange={(e) => onPatchVisit(r.id, { review: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white resize-y min-h-[64px]"
            />
          </label>
        </div>
      )}
    </li>
  );
}

export function VisitTracker({
  planRestaurants,
  extraRestaurants,
  visitLog,
  onPatchVisit,
}: VisitTrackerProps) {
  const [showExtras, setShowExtras] = useState(false);

  const planVisited = useMemo(() => {
    return planRestaurants.filter((r) => visitLog.has(r.id)).length;
  }, [planRestaurants, visitLog]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 mt-8">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Visit diary</h2>
          <p className="text-gray-500 text-sm mt-1">
            Mark spots you have tried, add a score out of 10, and jot a short review. Saved only on this device.
          </p>
        </div>
        {planRestaurants.length > 0 && (
          <p className="text-sm font-medium text-orange-800 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 shrink-0">
            {planVisited} / {planRestaurants.length} on your routes visited
          </p>
        )}
      </div>

      {planRestaurants.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4">
          No stops on your plan yet. Add restaurants to your days above, or expand the list below to track other
          spots in range.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {planRestaurants.map((r) => (
            <VisitRow key={r.id} r={r} entry={visitLog.get(r.id)} onPatchVisit={onPatchVisit} />
          ))}
        </ul>
      )}

      {extraRestaurants.length > 0 && (
        <div className="mt-6 pt-4 border-t border-orange-100">
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
    </section>
  );
}
