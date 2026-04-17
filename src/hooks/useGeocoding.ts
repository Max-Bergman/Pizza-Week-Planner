import { useState, useEffect, useRef } from "react";
import { geocodeAddress, type GeocodingResult } from "../lib/geocoding";

/**
 * Debounced geocoding hook. Returns suggestions as the user types.
 */
export function useGeocoding(query: string, debounceMs = 500) {
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await geocodeAddress(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutRef.current);
  }, [query, debounceMs]);

  return { results, loading };
}
