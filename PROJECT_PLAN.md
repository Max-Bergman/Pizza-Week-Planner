# Portland Pizza Week Route Planner

## Prompt for Implementation

You are building a **Portland Pizza Week Route Planner** — a fully client-side web app (no backend) that helps users plan optimized driving routes across Portland's annual Pizza Week (April 20–26, 2026). The app should be simple, fast, beautiful, and mobile-friendly.

### Tech Stack (strict)

- **Vite + React 18 + TypeScript** (strict mode)
- **Tailwind CSS v4** for styling
- **Leaflet** via `react-leaflet` for maps (free, no API key needed for tiles)
- **OSRM public demo API** (`router.project-osrm.org`) for driving distance/duration between points
- **Nominatim** (OpenStreetMap) for geocoding the user's address (free, no key)
- No backend. All data is a static JSON file. All logic runs in the browser.
- Deploy-ready on Vercel/Netlify as a static site.

### Core Data Model

All restaurant data lives in `public/data/restaurants.json`. Each entry:

```json
{
  "id": "pizza-jerk",
  "name": "Pizza Jerk",
  "address": "5028 SE Division St, Portland, OR 97206",
  "lat": 45.5048,
  "lng": -122.6131,
  "special": "Pepperoni & Pickled Jalapeño",
  "description": "House red sauce, mozzarella, pepperoni, pickled jalapeños, hot honey drizzle",
  "dietaryTags": ["vegetarian"],
  "closedDays": [0],
  "priceSlice": 4,
  "priceWhole": 25,
  "website": "https://pizzajerkpdx.com",
  "imageUrl": ""
}
```

Notes:
- `closedDays` uses JS day-of-week numbers: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
- `dietaryTags` is an array of zero or more of: `"vegetarian"`, `"vegan"`, `"gluten_free"`.
- A restaurant with no dietary tags means the special is none of those.
- `imageUrl` is optional; leave empty string if unavailable.

---

## User Flow (3 Steps)

### Step 1: Preferences

A single-page form where the user sets:

| Input | Type | Details |
|-------|------|---------|
| Available days | Checkboxes | April 20 (Mon) through April 26 (Sun). Default: all checked. |
| Starting address | Text input | Geocoded to lat/lng via Nominatim. Show address suggestions. |
| Max radius | Slider | 1–20 miles from starting address. Default: 10. |
| Dietary needs | Checkboxes | Vegetarian, Vegan, Gluten Free. Default: none (show all). |
| Min spots per day | Number input | Default: 2. Range: 1–10. |
| Max spots per day | Number input | Default: 5. Range: 1–15. |

When the user clicks "Find Pizza", filter restaurants and advance to Step 2.

**Filtering rules:**
- Exclude restaurants outside the user's radius (haversine distance from their address).
- If any dietary boxes are checked, only show restaurants whose `dietaryTags` include ALL checked tags. If no dietary boxes are checked, show all restaurants.

### Step 2: Restaurant Browsing & Rating

Display a scrollable list of restaurant cards that passed the filter. Each card shows:
- Restaurant name
- Pizza special name + description
- Dietary tags (as small badges)
- Distance from user (in miles, one decimal)
- A 3-option segmented control: **Must Eat** | **Interested** | **Not Interested**
- Default state: **Interested**

Also show a map with all qualifying restaurants as markers. Color-code by the user's selection:
- 🔴 Must Eat = red marker
- 🟡 Interested = yellow marker  
- ⚫ Not Interested = gray marker (dimmed)

The user scrolls through, rates each one, then clicks "Plan My Routes".

### Step 3: Route Plan

Display a day-by-day itinerary:

For each day:
- Date and day-of-week header (e.g., "Monday, April 21")
- Ordered list of restaurants to visit, with:
  - Sequence number
  - Restaurant name and special
  - Estimated drive time from previous stop (or from home for first stop)
- A map showing that day's route as a polyline with numbered markers
- Total estimated driving time for the day

Also show a summary:
- Total restaurants across all days
- Total estimated drive time across all days
- Number of "Must Eat" spots covered vs total marked

The user should be able to manually swap restaurants between days or remove them, then re-optimize.

---

## Route Planning Algorithm

### Overview

The route planner solves a constrained clustering + TSP problem. Keep it simple — this is at most ~60 restaurants across ~7 days, so brute-force-friendly approaches are fine.

### Algorithm Steps

```
INPUT:
  - restaurants: filtered list, each tagged "must_eat" or "interested" (exclude "not_interested")
  - days: array of selected dates
  - userLocation: { lat, lng }
  - minPerDay, maxPerDay: number constraints
  - closedDays per restaurant

STEP 1: BUILD AVAILABILITY MAP
  For each restaurant, compute which of the user's selected days it is open.
  If a "must_eat" restaurant has zero available days → warn the user.

STEP 2: LOCK CONSTRAINED MUST-EATS
  Sort must-eat restaurants by number of available days (ascending).
  Restaurants available on only 1 day get locked to that day first.
  Then 2-day availability, etc.
  Respect maxPerDay — if a day is full, skip to next available day.

STEP 3: GEOGRAPHIC CLUSTERING
  Collect all remaining unassigned restaurants (must-eats not yet placed + all interested).
  Use simple geographic clustering:
    - Compute centroid of each day's already-assigned restaurants (from Step 2).
    - For days with no assignments yet, seed centroids using k-means initialization on remaining restaurants.
    - Assign each remaining restaurant to the nearest day-centroid whose day it's open on and hasn't hit maxPerDay.
    - Recompute centroids. Repeat 3-5 iterations.

STEP 4: ENFORCE MINIMUMS
  If any day has fewer than minPerDay, steal the nearest "interested" restaurant from an adjacent day (geographically nearest that is also open on the target day).
  If still under minimum, that's okay — warn the user.

STEP 5: INTRA-DAY ROUTE OPTIMIZATION (TSP)
  For each day's restaurant set:
    - Start at user's home.
    - Use nearest-neighbor heuristic: always go to the closest unvisited restaurant.
    - End at user's home (round trip).
    - Use haversine distance for the heuristic (fast, no API calls).
    - Once order is determined, fetch actual driving routes from OSRM for display.

OUTPUT:
  Array of { day, orderedRestaurants[], totalDriveTimeMinutes, routeGeometry }
```

### Distance Helpers

- **Haversine**: Use for all filtering (radius check) and for the TSP heuristic. It's fast and doesn't need API calls.
- **OSRM**: Use only for final route display — fetch the actual driving polyline and duration. Use the OSRM `route` endpoint with waypoints.

```
GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2};...?overview=full&geometries=geojson
```

Rate limit OSRM calls. The public API has no key but is rate-limited. Cache results.

---

## UI/UX Design Guidelines

### Visual Style
- Clean, modern, card-based design
- Pizza-themed warm color palette: deep red (#B91C1C), warm orange (#EA580C), cream/off-white (#FFF7ED) background
- Rounded corners, subtle shadows
- Large touch targets for mobile use
- System font stack (no custom fonts needed)

### Layout
- Single-page app with 3 "steps" — use a stepper/progress indicator at the top
- Step 1 (Preferences): centered form, max-width 600px
- Step 2 (Browse): split view on desktop (list left, map right), stacked on mobile (list above map)
- Step 3 (Routes): tab per day, or vertical scroll with day sections

### Responsiveness
- Mobile-first. Must work well on phones (people will use this while out getting pizza).
- Breakpoints: mobile (<768px), desktop (>=768px)
- Map should be at least 300px tall on mobile

### Interactions
- Segmented controls for Must Eat / Interested / Not Interested should be tactile and clear
- Map markers should be clickable → scroll to/highlight the corresponding card
- Route map should show numbered markers matching the itinerary order

---

## File Structure

```
portland-pizza-week/
├── public/
│   └── data/
│       └── restaurants.json          # Static restaurant data (see mock data below)
├── src/
│   ├── types/
│   │   └── index.ts                  # All TypeScript interfaces/types
│   ├── lib/
│   │   ├── geo.ts                    # Haversine distance, coordinate utils
│   │   ├── geocoding.ts              # Nominatim address → lat/lng
│   │   ├── routing.ts                # OSRM route fetching
│   │   ├── filter.ts                 # Restaurant filtering (radius, dietary)
│   │   ├── cluster.ts                # Geographic clustering for day assignment
│   │   ├── tsp.ts                    # Nearest-neighbor TSP solver
│   │   └── planner.ts               # Main orchestration: calls cluster + tsp
│   ├── hooks/
│   │   ├── useRestaurants.ts         # Fetch and cache restaurant data
│   │   ├── useGeocoding.ts           # Debounced address geocoding
│   │   └── useRoutePlanner.ts        # Run planner, manage route state
│   ├── components/
│   │   ├── App.tsx                   # Root component, step management
│   │   ├── Stepper.tsx               # Progress indicator (Step 1/2/3)
│   │   ├── PreferencesForm.tsx       # Step 1: all preference inputs
│   │   ├── RestaurantList.tsx        # Step 2: scrollable card list
│   │   ├── RestaurantCard.tsx        # Individual restaurant card
│   │   ├── RatingControl.tsx         # Must Eat / Interested / Not Interested toggle
│   │   ├── RestaurantMap.tsx         # Leaflet map for browsing (Step 2)
│   │   ├── RoutePlan.tsx             # Step 3: full route display
│   │   ├── DayItinerary.tsx          # Single day's route + map
│   │   └── RouteMap.tsx              # Leaflet map for a day's route (Step 3)
│   ├── main.tsx                      # Vite entry point
│   └── index.css                     # Tailwind imports + any global styles
├── index.html                        # Vite HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

---

## Key Implementation Notes

1. **No state management library needed.** Use React `useState` + prop drilling, or at most `useContext` for the preferences/ratings state that's shared across steps. The app is small enough that Redux/Zustand are overkill.

2. **Restaurant ratings state**: Store as a `Map<string, "must_eat" | "interested" | "not_interested">` keyed by restaurant ID. Default all to `"interested"`.

3. **OSRM rate limiting**: The public OSRM demo server is rate-limited. Batch waypoints into single route requests (one per day) rather than making pairwise calls. Add a small delay between day-route fetches.

4. **Nominatim usage policy**: Include a `User-Agent` header. Limit to 1 request per second. Use a debounce of 500ms+ on the address input.

5. **Leaflet CSS**: Must import `leaflet/dist/leaflet.css` in `main.tsx` or `index.css`. Without it, tiles render but controls break.

6. **Leaflet marker icons**: Default Leaflet marker icons break with bundlers. Use `leaflet-defaulticon-compatibility` package or inline SVG markers.

7. **Keep the algorithm simple.** Nearest-neighbor TSP is O(n²) and perfectly fine for ≤15 stops per day. Don't over-engineer with 2-opt or genetic algorithms unless the basic version feels bad.

8. **Error handling**: Gracefully handle geocoding failures (show "address not found"), OSRM failures (fall back to straight-line route display), and edge cases (no restaurants match filters → show friendly message).

---

## What To Build First (Implementation Order)

1. **Scaffold**: Vite + React + TypeScript + Tailwind + Leaflet. Get a blank page rendering.
2. **Types**: Define all interfaces in `types/index.ts`.
3. **Mock data**: Load `restaurants.json`, render a basic list.
4. **Step 1 (Preferences)**: Build the form. Wire up geocoding.
5. **Step 2 (Browse)**: Restaurant cards with rating controls. Map with markers.
6. **Filtering**: Connect preferences to filter the restaurant list.
7. **Step 3 (Route Plan)**: Implement clustering → TSP → display.
8. **OSRM integration**: Fetch real driving routes for display.
9. **Polish**: Animations, responsive tweaks, edge case handling.
