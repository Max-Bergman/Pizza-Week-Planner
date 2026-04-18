import type { Restaurant, Rating, LatLng } from "../types";
import { haversineDistance } from "../lib/geo";
import { pizzaServingLabel } from "../lib/pizzaServing";
import { RatingControl } from "./RatingControl";

interface RestaurantCardProps {
  restaurant: Restaurant;
  rating: Rating;
  userLocation: LatLng | null;
  /** When set, shown instead of distance from `userLocation`. */
  distanceMilesOverride?: number | null;
  onRatingChange: (rating: Rating) => void;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DIETARY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  vegetarian: { bg: "bg-green-100", text: "text-green-800", label: "Vegetarian" },
  vegan: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Vegan" },
  gluten_free: { bg: "bg-amber-100", text: "text-amber-800", label: "Gluten Free" },
};

export function RestaurantCard({
  restaurant,
  rating,
  userLocation,
  distanceMilesOverride,
  onRatingChange,
  highlighted = false,
  onHover,
}: RestaurantCardProps) {
  const distance =
    distanceMilesOverride !== undefined && distanceMilesOverride !== null
      ? distanceMilesOverride
      : userLocation
        ? haversineDistance(userLocation, { lat: restaurant.lat, lng: restaurant.lng })
        : null;

  const closedText =
    restaurant.closedDays.length > 0
      ? `Closed ${restaurant.closedDays.map((d) => DAY_NAMES[d]).join(", ")}`
      : null;

  return (
    <div
      className={`bg-white rounded-xl border-2 p-4 transition-all ${
        highlighted
          ? "border-orange-400 shadow-md"
          : rating === "not_interested"
            ? "border-gray-100 opacity-60"
            : rating === "neutral"
              ? "border-amber-100/80 opacity-[0.97] shadow-sm"
              : "border-orange-100 shadow-sm hover:shadow-md"
      }`}
      onMouseEnter={() => onHover?.(restaurant.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {restaurant.imageUrl ? (
        <div className="flex gap-3 mb-3">
          <img
            src={restaurant.imageUrl}
            alt=""
            className="w-20 h-20 rounded-lg object-cover shrink-0 border border-orange-100"
            loading="lazy"
          />
          <p className="text-xs text-gray-500 leading-snug self-center">
            {restaurant.address}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-2">{restaurant.address}</p>
      )}

      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-base text-gray-900 leading-tight">
            {restaurant.name}
          </h3>
          <p className="text-orange-700 font-semibold text-sm mt-0.5">
            {restaurant.special}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {distance !== null && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {distance.toFixed(1)} mi
            </span>
          )}
          {restaurant.website && (
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              website ↗
            </a>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-2 leading-relaxed">
        {restaurant.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {restaurant.dietaryTags.map((tag) => {
          const style = DIETARY_STYLES[tag];
          if (!style) return null;
          return (
            <span
              key={tag}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}
            >
              {style.label}
            </span>
          );
        })}
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-800 font-medium border border-red-100">
          {pizzaServingLabel(restaurant.pizzaServing)}
        </span>
        {closedText && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {closedText}
          </span>
        )}
      </div>

      <div className="mt-3">
        <RatingControl value={rating} onChange={onRatingChange} />
      </div>
    </div>
  );
}
