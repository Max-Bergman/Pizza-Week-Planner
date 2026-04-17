import type { Rating } from "../types";

interface RatingControlProps {
  value: Rating;
  onChange: (rating: Rating) => void;
}

const OPTIONS: { value: Rating; label: string; activeClass: string }[] = [
  { value: "must_eat", label: "Must eat", activeClass: "bg-red-600 text-white" },
  { value: "interested", label: "Interested", activeClass: "bg-yellow-500 text-white" },
  { value: "neutral", label: "Neutral", activeClass: "bg-amber-200 text-amber-950" },
  { value: "not_interested", label: "Skip", activeClass: "bg-gray-500 text-white" },
];

export function RatingControl({ value, onChange }: RatingControlProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg overflow-hidden border border-gray-200 p-1 bg-gray-50">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-md transition-colors ${
            value === opt.value ? opt.activeClass : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
