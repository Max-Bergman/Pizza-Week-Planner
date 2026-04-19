import type { Rating } from "../types";

export const RATING_COLORS: Record<Rating, string> = {
  must_eat: "#DC2626",
  interested: "#EAB308",
  neutral: "#D97706",
  not_interested: "#9CA3AF",
};

/** Fill opacity for map circle markers (matches browse map). */
export function ratingFillOpacity(rating: Rating): number {
  if (rating === "not_interested") return 0.3;
  if (rating === "neutral") return 0.72;
  return 0.85;
}

/** Text on top of RATING_COLORS fill for numbered route badges. */
export function ratingNumberTextColor(rating: Rating): string {
  return rating === "interested" ? "#111827" : "#ffffff";
}
