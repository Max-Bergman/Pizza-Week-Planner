import type { BrowseFilters } from "../lib/browseFilter";
import type { DietaryTag, PizzaServing } from "../types";

interface BrowseFiltersBarProps {
  value: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
}

const SERVING: { value: PizzaServing; label: string }[] = [
  { value: "slice", label: "Slice" },
  { value: "whole_pie", label: "Whole pie" },
  { value: "both", label: "Both" },
];

const DIETARY: { value: DietaryTag; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten_free", label: "Gluten-free" },
];

function toggleServing(current: PizzaServing[], v: PizzaServing): PizzaServing[] {
  return current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
}

function toggleDietary(current: DietaryTag[], v: DietaryTag): DietaryTag[] {
  return current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
}

export function BrowseFiltersBar({ value, onChange }: BrowseFiltersBarProps) {
  const servingActive = value.serving.length > 0;
  const dietaryActive = value.dietary.length > 0;

  return (
    <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-3 mb-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
        Narrow this list
      </p>
      <p className="text-xs text-gray-500 -mt-2">
        Optional. Doesn’t change your address or radius from step 1. Only spots that
        stay visible here are included when you plan routes.
      </p>

      <div>
        <p className="text-xs text-gray-600 mb-1.5">Slice / whole pie</p>
        <div className="flex flex-wrap gap-1.5">
          {SERVING.map(({ value: v, label }) => {
            const on = value.serving.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange({ ...value, serving: toggleServing(value.serving, v) })
                }
                className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                  on
                    ? "border-red-700 bg-red-700 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                }`}
              >
                {label}
              </button>
            );
          })}
          {servingActive && (
            <button
              type="button"
              onClick={() => onChange({ ...value, serving: [] })}
              className="text-xs text-orange-600 hover:underline px-1"
            >
              Clear
            </button>
          )}
        </div>
        {!servingActive && (
          <p className="text-xs text-gray-400 mt-1">Showing all serving types.</p>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-600 mb-1.5">Dietary (must match all selected)</p>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY.map(({ value: v, label }) => {
            const on = value.dietary.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange({ ...value, dietary: toggleDietary(value.dietary, v) })
                }
                className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                  on
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-green-300"
                }`}
              >
                {label}
              </button>
            );
          })}
          {dietaryActive && (
            <button
              type="button"
              onClick={() => onChange({ ...value, dietary: [] })}
              className="text-xs text-orange-600 hover:underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
