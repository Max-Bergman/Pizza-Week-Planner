import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import type { DayRoute, LatLng } from "../types";

interface RouteMapProps {
  day: DayRoute;
  userLocation: LatLng;
}

function FitBoundsEffect({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, bounds]);
  return null;
}

function makeNumberedIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#B91C1C;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${n}</div>`,
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

export function RouteMap({ day, userLocation }: RouteMapProps) {
  const allPoints: [number, number][] = [
    [userLocation.lat, userLocation.lng],
    ...day.stops.map((s) => [s.restaurant.lat, s.restaurant.lng] as [number, number]),
  ];

  const bounds = L.latLngBounds(allPoints);

  // Fallback polyline through all stops (start → stops → home)
  const fallbackPositions: [number, number][] = [
    [userLocation.lat, userLocation.lng],
    ...day.stops.map((s) => [s.restaurant.lat, s.restaurant.lng] as [number, number]),
    [userLocation.lat, userLocation.lng],
  ];

  // Convert OSRM GeoJSON coordinates from [lng, lat] → [lat, lng]
  const routePositions = day.routeGeometry
    ? (day.routeGeometry.coordinates as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      )
    : null;

  return (
    <MapContainer
      center={[userLocation.lat, userLocation.lng]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <FitBoundsEffect bounds={bounds} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route line */}
      {routePositions ? (
        <Polyline
          positions={routePositions}
          pathOptions={{ color: "#B91C1C", weight: 3, opacity: 0.75 }}
        />
      ) : (
        <Polyline
          positions={fallbackPositions}
          pathOptions={{ color: "#B91C1C", weight: 2, opacity: 0.5, dashArray: "6 4" }}
        />
      )}

      {/* Home marker */}
      <Marker position={[userLocation.lat, userLocation.lng]} icon={homeIcon} />

      {/* Numbered stop markers */}
      {day.stops.map((stop) => (
        <Marker
          key={stop.restaurant.id}
          position={[stop.restaurant.lat, stop.restaurant.lng]}
          icon={makeNumberedIcon(stop.order)}
        />
      ))}
    </MapContainer>
  );
}
