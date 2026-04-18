/** Pizza Week 2026: Mon Apr 20 – Sun Apr 26 (local dates). */
export const PIZZA_WEEK_DAY_DATES: readonly Date[] = Array.from(
  { length: 7 },
  (_, i) => new Date(2026, 3, 20 + i)
);

export const PIZZA_WEEK_DAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export function pizzaWeekDayMeta(date: Date): {
  label: string;
  sublabel: string;
} | undefined {
  const idx = PIZZA_WEEK_DAY_DATES.findIndex(
    (d) => d.toDateString() === date.toDateString()
  );
  if (idx < 0) return undefined;
  const d = PIZZA_WEEK_DAY_DATES[idx]!;
  const sublabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { label: PIZZA_WEEK_DAY_LABELS[idx]!, sublabel };
}

/** Calendar grid for preferences UI. */
export const PIZZA_WEEK_GRID_DAYS = PIZZA_WEEK_DAY_DATES.map((date, i) => ({
  date,
  label: PIZZA_WEEK_DAY_LABELS[i]!,
  sublabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
}));
