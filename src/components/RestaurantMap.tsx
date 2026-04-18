import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { Restaurant, RatingsMap, LatLng, Rating } from "../types";
import { centroid } from "../lib/geo";

export interface MapRadiusZone {
  center: LatLng;
  radiusMiles: number;
  label?: string;
}

interface RestaurantMapProps {
  restaurants: Restaurant[];
  ratings: RatingsMap;
  zones: MapRadiusZone[];
  highlightedId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const RATING_COLORS: Record<Rating, string> = {
  must_eat: "#DC2626",
  interested: "#EAB308",
  neutral: "#D97706",
  not_interested: "#9CA3AF",
};

const ZONE_STROKE = ["#EA580C", "#2563EB", "#7C3AED", "#DB2777", "#059669"];

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
  zones,
  highlightedId,
  onMarkerClick,
}: RestaurantMapProps) {
  const mapCenter = useMemo(() => {
    if (zones.length === 0) return { lat: 45.52, lng: -122.68 } as LatLng;
    if (zones.length === 1) return zones[0]!.center;
    return centroid(zones.map((z) => z.center));
  }, [zones]);

  return (
    <MapContainer
      center={[mapCenter.lat, mapCenter.lng]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <RecenterEffect center={mapCenter} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {zones.map((z, i) => {
        const stroke = ZONE_STROKE[i % ZONE_STROKE.length]!;
        const radiusMeters = z.radiusMiles * 1609.34;
        return (
          <Circle
            key={`z-${i}-${z.center.lat}-${z.center.lng}`}
            center={[z.center.lat, z.center.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: stroke,
              fillColor: stroke,
              fillOpacity: 0.04,
              weight: 1.5,
              dashArray: i === 0 ? "4 4" : "6 3",
            }}
          />
        );
      })}

      {zones.map((z, i) => (
        <CircleMarker
          key={`h-${i}-${z.center.lat}`}
          center={[z.center.lat, z.center.lng]}
          radius={6}
          pathOptions={{
            color: ZONE_STROKE[i % ZONE_STROKE.length]!,
            fillColor: ZONE_STROKE[i % ZONE_STROKE.length]!,
            fillOpacity: 0.95,
            weight: 2,
          }}
        >
          <Popup>
            {z.label ? (
              <span className="text-sm font-medium">{z.label}</span>
            ) : (
              <span className="text-sm">Day start</span>
            )}
          </Popup>
        </CircleMarker>
      ))}

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
                  <a
                    href={r.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-xs"
                  >
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
