import { useState, useRef, useEffect } from "react";
import type { LatLng } from "../types";
import { useGeocoding } from "../hooks/useGeocoding";

interface AddressWithGeocodeProps {
  id: string;
  address: string;
  location: LatLng | null;
  onChange: (next: { address: string; location: LatLng | null }) => void;
  onConfirm: (next: { address: string; location: LatLng }) => void;
  placeholder?: string;
  compact?: boolean;
}

/**
 * Address field with Nominatim suggestions; shows confirmed state when `location` is set.
 */
export function AddressWithGeocode({
  id,
  address,
  location,
  onChange,
  onConfirm,
  placeholder = "Street, Portland, OR",
  compact = false,
}: AddressWithGeocodeProps) {
  const [draft, setDraft] = useState(address);
  const [confirmed, setConfirmed] = useState(!!location);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(address);
    setConfirmed(!!location);
  }, [address, location]);

  const query = confirmed ? "" : draft;
  const { results: suggestions, loading } = useGeocoding(query);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (
        listRef.current?.contains(e.target as Node) ||
        inputRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const pick = (displayName: string, loc: LatLng) => {
    const shortName = displayName.split(",").slice(0, 3).join(",").trim();
    setDraft(shortName);
    setConfirmed(true);
    setOpen(false);
    onConfirm({ address: shortName, location: loc });
  };

  const pad = compact ? "px-3 py-2 text-sm" : "px-4 py-3 text-sm";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          setConfirmed(false);
          setOpen(true);
          onChange({ address: v, location: null });
        }}
        onFocus={() => !confirmed && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full rounded-xl border-2 focus:outline-none transition-colors ${pad} ${
          confirmed
            ? "border-green-500 bg-green-50"
            : "border-gray-200 focus:border-orange-400 bg-white"
        }`}
      />
      {confirmed && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-lg pointer-events-none">
          ✓
        </span>
      )}
      {loading && !confirmed && (
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 text-xs">…</span>
      )}

      {open && suggestions.length > 0 && !confirmed && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-52 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s.displayName, s.location)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className="font-medium text-gray-900">
                {s.displayName.split(",")[0]}
              </span>
              <span className="text-gray-500">
                {", "}
                {s.displayName.split(",").slice(1, 3).join(",")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
