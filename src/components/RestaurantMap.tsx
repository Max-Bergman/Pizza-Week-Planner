import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Restaurant, RatingsMap, LatLng, Rating } from "../types";

interface RestaurantMapProps {
  restaurants: Restaurant[];
  ratings: RatingsMap;
  center: LatLng;
  radiusMiles: number;
  highlightedId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const RATING_COLORS: Record<Rating, string> = {
  must_eat: "#DC2626",
  interested: "#EAB308",
  neutral: "#D97706",
  not_interested: "#9CA3AF",
};

function RecenterEffect({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [map, center.lat, center.lng]);
  return null;
}

export function RestaurantMap({
  restaurants,
  ratings,
  center,
  radiusMiles,
  highlightedId,
  onMarkerClick,
}: RestaurantMapProps) {
  const radiusMeters = radiusMiles * 1609.34;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <RecenterEffect center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Radius circle */}
      <Circle
        center={[center.lat, center.lng]}
        radius={radiusMeters}
        pathOptions={{ color: "#EA580C", fillColor: "#EA580C", fillOpacity: 0.05, weight: 1.5, dashArray: "4 4" }}
      />

      {/* Home marker */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={7}
        pathOptions={{ color: "#1D4ED8", fillColor: "#1D4ED8", fillOpacity: 1, weight: 2 }}
      >
        <Popup>Your starting location</Popup>
      </CircleMarker>

      {/* Restaurant markers */}
      {restaurants.map((r) => {
        const rating = ratings.get(r.id) ?? "neutral";
        const color = RATING_COLORS[rating];
        const isHighlighted = highlightedId === r.id;

        return (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={isHighlighted ? 10 : 7}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity:
                rating === "not_interested" ? 0.3 : rating === "neutral" ? 0.72 : 0.85,
              weight: isHighlighted ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onMarkerClick?.(r.id),
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{r.name}</p>
                <p className="text-orange-700">{r.special}</p>
                {r.website && (
                  <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs">
                    Website ↗
                  </a>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
