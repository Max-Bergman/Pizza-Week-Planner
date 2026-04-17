import { useState, useEffect } from "react";
import type { Restaurant } from "../types";

/**
 * Fetch restaurant data from the static JSON file.
 */
export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/restaurants.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load restaurant data");
        return res.json();
      })
      .then((raw: Restaurant[]) => {
        const data = raw.map((r) => ({
          ...r,
          pizzaServing: r.pizzaServing ?? "both",
        }));
        setRestaurants(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { restaurants, loading, error };
}
