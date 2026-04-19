import type { ReactNode } from "react";
import type { RestaurantVisitEntry, RestaurantVisitPatch } from "../types";
import { clampVisitScore } from "../lib/visitLogHelpers";

function formatScore(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export interface VisitStopControlsProps {
  restaurantId: string;
  entry: RestaurantVisitEntry | undefined;
  onPatchVisit: (id: string, patch: RestaurantVisitPatch) => void;
  /** Renders beside the checkbox (visit list rows). */
  sideTitle?: ReactNode;
  /** Checkbox label when no sideTitle (inline under a route stop). */
  visitLabel?: string;
}

export function VisitStopControls({
  restaurantId,
  entry,
  onPatchVisit,
  sideTitle,
  visitLabel = sideTitle ? "Been there" : "Visited",
}: VisitStopControlsProps) {
  const visited = Boolean(entry);
  const scoreStr =
    entry?.score !== undefined && Number.isFinite(entry.score) ? formatScore(entry.score) : "";

  const visitedBlock = visited && (
    <div
      className={
        sideTitle
          ? "px-4 pb-4 pt-0 border-t border-orange-50 bg-orange-50/40 space-y-3"
          : "mt-2 space-y-2 rounded-xl bg-orange-50/50 border border-orange-100/80 p-3"
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wide">
            Score (0–10)
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
                onPatchVisit(restaurantId, { score: null });
                return;
              }
              const n = Number(v);
              if (!Number.isFinite(n)) return;
              onPatchVisit(restaurantId, { score: clampVisitScore(n) });
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
          onChange={(e) => onPatchVisit(restaurantId, { review: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white resize-y min-h-[64px]"
        />
      </label>
    </div>
  );

  return (
    <div className="export-exclude">
      <div
        className={`flex flex-wrap gap-3 ${sideTitle ? "p-4 items-start" : "items-center"}`}
      >
        <label className="flex items-center gap-2 cursor-pointer shrink-0 pt-0.5">
          <input
            type="checkbox"
            checked={visited}
            onChange={(e) => {
              if (e.target.checked) onPatchVisit(restaurantId, { visited: true });
              else onPatchVisit(restaurantId, { visited: false });
            }}
            className="rounded border-gray-300 text-red-700 focus:ring-red-600"
          />
          <span className="text-sm font-semibold text-gray-900">{visitLabel}</span>
        </label>
        {sideTitle && <div className="flex-1 min-w-0">{sideTitle}</div>}
      </div>
      {visitedBlock}
    </div>
  );
}
