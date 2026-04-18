import type { LatLng, Restaurant } from "../types";
import { totalNNDepotTourMiles } from "./tsp";

/**
 * Local search on day assignments to reduce sum of per-day NN depot-tour miles.
 * Respects locked restaurant IDs (single-day must-eats), closed days, and per-day max.
 */
export function optimizeAssignmentsForGlobalDriving(
  dayStarts: LatLng[],
  days: Date[],
  assignments: Restaurant[][],
  lockedIds: ReadonlySet<string>,
  maxPerDay: number[],
  iterations = 3500
): void {
  const k = assignments.length;
  if (k === 0) return;

  const dayOfWeek = (dayIdx: number) => days[dayIdx]!.getDay();

  const canBeOnDay = (r: Restaurant, dayIdx: number) =>
    !r.closedDays.includes(dayOfWeek(dayIdx));

  let bestScore = totalNNDepotTourMiles(dayStarts, assignments);

  for (let iter = 0; iter < iterations; iter++) {
    const moveOrSwap = Math.random() < 0.55 ? "move" : "swap";

    if (moveOrSwap === "move") {
      tryRandomMove(
        dayStarts,
        assignments,
        lockedIds,
        maxPerDay,
        canBeOnDay,
        (newScore) => {
          if (newScore < bestScore - 1e-9) {
            bestScore = newScore;
            return true;
          }
          return false;
        }
      );
    } else {
      tryRandomSwap(
        dayStarts,
        assignments,
        lockedIds,
        canBeOnDay,
        (newScore) => {
          if (newScore < bestScore - 1e-9) {
            bestScore = newScore;
            return true;
          }
          return false;
        }
      );
    }
  }
}

function tryRandomMove(
  dayStarts: LatLng[],
  assignments: Restaurant[][],
  lockedIds: ReadonlySet<string>,
  maxPerDay: number[],
  canBeOnDay: (r: Restaurant, dayIdx: number) => boolean,
  accept: (score: number) => boolean
): void {
  const k = assignments.length;
  const movable: { r: Restaurant; from: number; pos: number }[] = [];
  for (let d = 0; d < k; d++) {
    const arr = assignments[d]!;
    for (let pos = 0; pos < arr.length; pos++) {
      const r = arr[pos]!;
      if (!lockedIds.has(r.id)) movable.push({ r, from: d, pos });
    }
  }
  if (movable.length === 0) return;

  const pick = movable[Math.floor(Math.random() * movable.length)]!;
  const { r, from, pos } = pick;

  const targets = shuffle(
    Array.from({ length: k }, (_, i) => i).filter((i) => i !== from)
  );
  for (const to of targets) {
    if (!canBeOnDay(r, to)) continue;
    if (assignments[to]!.length >= maxPerDay[to]!) continue;

    const fromArr = assignments[from]!;
    const toArr = assignments[to]!;
    fromArr.splice(pos, 1);
    toArr.push(r);

    const score = totalNNDepotTourMiles(dayStarts, assignments);
    if (accept(score)) return;

    toArr.pop();
    fromArr.splice(pos, 0, r);
  }
}

function tryRandomSwap(
  dayStarts: LatLng[],
  assignments: Restaurant[][],
  lockedIds: ReadonlySet<string>,
  canBeOnDay: (r: Restaurant, dayIdx: number) => boolean,
  accept: (score: number) => boolean
): void {
  const k = assignments.length;
  if (k < 2) return;

  const from = Math.floor(Math.random() * k);
  let to = Math.floor(Math.random() * k);
  if (to === from) to = (to + 1) % k;

  const a = assignments[from]!;
  const b = assignments[to]!;
  if (a.length === 0 || b.length === 0) return;

  const ia = Math.floor(Math.random() * a.length);
  const ib = Math.floor(Math.random() * b.length);
  const r1 = a[ia]!;
  const r2 = b[ib]!;

  if (lockedIds.has(r1.id) || lockedIds.has(r2.id)) return;
  if (!canBeOnDay(r1, to) || !canBeOnDay(r2, from)) return;

  a[ia] = r2;
  b[ib] = r1;

  const score = totalNNDepotTourMiles(dayStarts, assignments);
  if (accept(score)) return;

  a[ia] = r1;
  b[ib] = r2;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
