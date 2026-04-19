# Supabase setup (community metrics)

This app **does not require** Supabase. Without it (or before any data exists), **community highlight ribbons are hidden** on the browse list.

When configured, the browser sends **anonymous, one-time-per-device** snapshots to your Supabase project so you can see **global** rollups in `community_restaurant_aggregate`.

## 1. Create a project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. **New project** → pick org, name (e.g. `pizza-week-planner`), database password, region.
3. Wait until the project is **healthy**.

## 2. Run the SQL schema

1. In the Supabase dashboard: **SQL Editor** → **New query**.
2. Paste the full contents of [`supabase-community.sql`](./supabase-community.sql) in this repo.
3. Click **Run**. You should see “Success” with no errors.

This creates:

| Object | Purpose |
|--------|---------|
| `community_restaurant_aggregate` | Per restaurant: counts for **must_eat / interested / neutral / not_interested**, **visit score** sum & count, **planned route** appearances |
| `community_interest_device` | Ensures **one** interest snapshot per `device_id` |
| `community_visit_device` | Ensures **one** visit-score snapshot per `device_id` |
| `community_plan_device` | Ensures **one** “stops on my generated plan” snapshot per `device_id` |
| RPC `community_submit_interest_snapshot` | Accepts JSON map `restaurant_id → rating` |
| RPC `community_submit_visit_snapshot` | Accepts JSON map `restaurant_id → score` |
| RPC `community_submit_plan_stops` | Accepts array of restaurant ids on the user’s plan |

## 3. API keys for the web app

1. **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

The app only uses the **anon** key in the browser. RLS allows **read** on aggregates and **execute** on the RPCs; device tables are not readable from the client.

## 4. Configure Vite / Vercel

**Local dev:** create `.env.local` in the project root (see `.env.example`).

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

Restart `npm run dev`.

**Vercel:** **Settings → Environment Variables** → add the same two variables for **Production** (and Preview if you want).

Redeploy the site.

## 5. Verify

1. Open the app with env vars set.
2. Rate a few spots on step 2; wait ~5s.
3. In Supabase **Table Editor** → `community_restaurant_aggregate` → you should see rows with `must_eat_n`, etc., increasing as more browsers contribute.

## 6. Reading metrics

- **Table Editor** or SQL: query `community_restaurant_aggregate` for all columns.
- From code you can use `fetchCommunityRestaurantMetrics()` in `src/lib/communityLeaderboard.ts` (returns all rows for a future dashboard).

## Privacy notes

- Payloads are **aggregates**; the app does not send names or emails to Supabase (only restaurant ids and enums/scores you already have in the client).
- Each channel (interest / visit / plan) is **at most one successful submission per device id** (stored in `localStorage` after success). Clearing storage allows another submission—good enough for a fun leaderboard, not fraud-proof.
