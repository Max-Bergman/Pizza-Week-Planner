import type { PizzaServing } from "../types";

export function pizzaServingLabel(s: PizzaServing | undefined): string {
  switch (s) {
    case "slice":
      return "Slice only";
    case "whole_pie":
      return "Whole pie only";
    case "both":
      return "Slice & whole pie";
    default:
      return "Slice & whole pie";
  }
}
