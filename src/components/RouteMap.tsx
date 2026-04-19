import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { DayRoute, Restaurant, RatingsMap, Rating } from "../types";
import { RATING_COLORS, ratingFillOpacity, ratingNumberTextColor } from "../lib/ratingColors";

interface RouteMapProps {
  day: DayRoute;
  /** User ratings — pins use these colors (browse map palette). */
  ratings: RatingsMap;
  /** When true, tap numbered stops to remove; tap rating-colored pins to add. */
  mapPickMode?: boolean;
  /** Restaurants in range not currently on this day’s route (shown when mapPickMode). */
  pickCandidates?: Restaurant[];
  onStopPick?: (restaurantId: string, action: "add" | "remove") => void;
}

function FitBoundsEffect({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, bounds]);
  return null;
}

function makeNumberedIcon(n: number, pickMode: boolean, rating: Rating) {
  const fill = RATING_COLORS[rating];
  const text = ratingNumberTextColor(rating);
  const cursor = pickMode ? "cursor-pointer" : "";
  // White + brand-red rings mark “on this day’s route” vs unrouted candidates.
  const ring =
    pickMode
      ? "0 0 0 2px #ffffff, 0 0 0 5px #B91C1C, 0 3px 10px rgba(0,0,0,0.45)"
      : "0 0 0 2px #ffffff, 0 0 0 4px #B91C1C, 0 2px 8px rgba(0,0,0,0.38)";
  return L.divIcon({
    className: cursor,
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${fill};color:${text};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid rgba(255,255,255,0.95);box-shadow:${ring}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const homeIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:50%;background:#1D4ED8;color:white;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)">⌂</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export function RouteMap({
  day,
  ratings,
  mapPickMode = false,
  pickCandidates = [],
  onStopPick,
}: RouteMapProps) {
  const home = day.routeStart;
  const pickActive = mapPickMode && !!onStopPick;

  const boundsPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [[home.lat, home.lng]];
    for (const s of day.stops) {
      pts.push([s.restaurant.lat, s.restaurant.lng]);
    }
    if (pickActive) {
      for (const r of pickCandidates) {
        pts.push([r.lat, r.lng]);
      }
    }
    return pts;
  }, [home, day.stops, pickActive, pickCandidates]);

  const bounds = useMemo(() => {
    if (boundsPoints.length === 0) {
      return L.latLngBounds([home.lat - 0.03, home.lng - 0.03], [home.lat + 0.03, home.lng + 0.03]);
    }
    if (boundsPoints.length === 1) {
      const [lat, lng] = boundsPoints[0]!;
      return L.latLngBounds([lat - 0.04, lng - 0.04], [lat + 0.04, lng + 0.04]);
    }
    return L.latLngBounds(boundsPoints);
  }, [boundsPoints, home.lat, home.lng]);

  const fallbackPositions: [number, number][] = [
    [home.lat, home.lng],
    ...day.stops.map((s) => [s.restaurant.lat, s.restaurant.lng] as [number, number]),
    [home.lat, home.lng],
  ];

  const routePositions = day.routeGeometry
    ? (day.routeGeometry.coordinates as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      )
    : null;

  const lineOpacity = pickActive ? 0.45 : 0.75;
  const lineWeight = pickActive ? 2 : 3;

  return (
    <MapContainer
      center={[home.lat, home.lng]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={pickActive}
      className={pickActive ? "ring-2 ring-emerald-400/80 ring-inset z-0" : ""}
    >
      <FitBoundsEffect bounds={bounds} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {routePositions ? (
        <Polyline
          positions={routePositions}
          pathOptions={{ color: "#B91C1C", weight: lineWeight, opacity: lineOpacity }}
        />
      ) : (
        <Polyline
          positions={fallbackPositions}
          pathOptions={{
            color: "#B91C1C",
            weight: lineWeight,
            opacity: pickActive ? 0.35 : 0.5,
            dashArray: "6 4",
          }}
        />
      )}

      <Marker position={[home.lat, home.lng]} icon={homeIcon} />

      {pickActive &&
        pickCandidates.map((r) => {
          const rating = ratings.get(r.id) ?? "neutral";
          const color = RATING_COLORS[rating];
          return (
            <CircleMarker
              key={`pick-${r.id}`}
              center={[r.lat, r.lng]}
              radius={9}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: ratingFillOpacity(rating),
                weight: 2.5,
                className: "cursor-pointer",
              }}
              eventHandlers={{
                click: () => onStopPick?.(r.id, "add"),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-600 mt-1">Tap to add · color = your rating</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      {day.stops.map((stop) => (
        <Marker
          key={stop.restaurant.id}
          position={[stop.restaurant.lat, stop.restaurant.lng]}
          zIndexOffset={400}
          icon={makeNumberedIcon(stop.order, pickActive, ratings.get(stop.restaurant.id) ?? "neutral")}
          eventHandlers={
            pickActive
              ? {
                  click: (e) => {
                    e.originalEvent?.stopPropagation?.();
                    onStopPick?.(stop.restaurant.id, "remove");
                  },
                }
              : undefined
          }
        >
          {pickActive && (
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{stop.restaurant.name}</p>
                <p className="text-xs text-red-700 mt-1">Stop #{stop.order} — tap marker to remove</p>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
