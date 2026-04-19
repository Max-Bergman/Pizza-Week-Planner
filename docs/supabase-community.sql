-- Pizza Week Planner — community metrics (Supabase)
-- Run the whole script in: Supabase Dashboard → SQL Editor → New query → Run
-- Then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your host (e.g. Vercel) or .env.local

-- ========= Legacy cleanup (safe if first install) =========
drop function if exists public.community_submit_excitement(text, text[]);
drop function if exists public.community_submit_favorites(text, jsonb);
drop table if exists public.community_excitement_tally cascade;
drop table if exists public.community_excitement_device cascade;
drop table if exists public.community_favorite_sum cascade;
drop table if exists public.community_favorite_device cascade;

-- ========= One row per restaurant: all rollups =========
create table if not exists public.community_restaurant_aggregate (
  restaurant_id text primary key,
  must_eat_n int not null default 0,
  interested_n int not null default 0,
  neutral_n int not null default 0,
  not_interested_n int not null default 0,
  visit_score_sum double precision not null default 0,
  visit_score_n int not null default 0,
  planned_route_n int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists community_restaurant_aggregate_must_eat_idx
  on public.community_restaurant_aggregate (must_eat_n desc);

create index if not exists community_restaurant_aggregate_visit_avg_idx
  on public.community_restaurant_aggregate ((visit_score_sum / nullif(visit_score_n, 0)) desc nulls last);

-- ========= At most one contribution per device per “channel” =========
create table if not exists public.community_interest_device (
  device_id text primary key,
  submitted_at timestamptz not null default now()
);

create table if not exists public.community_visit_device (
  device_id text primary key,
  submitted_at timestamptz not null default now()
);

create table if not exists public.community_plan_device (
  device_id text primary key,
  submitted_at timestamptz not null default now()
);

-- ========= 1) Interest snapshot: full rating map once per device =========
create or replace function public.community_submit_interest_snapshot(p_device_id text, p_ratings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v text;
  me int;
  inn int;
  neu int;
  ni int;
begin
  begin
    insert into public.community_interest_device (device_id) values (p_device_id);
  exception
    when unique_violation then
      return;
  end;

  for rec in select * from jsonb_each_text(p_ratings)
  loop
    v := lower(rec.value);
    if v not in ('must_eat', 'interested', 'neutral', 'not_interested') then
      continue;
    end if;
    me := (v = 'must_eat')::int;
    inn := (v = 'interested')::int;
    neu := (v = 'neutral')::int;
    ni := (v = 'not_interested')::int;

    insert into public.community_restaurant_aggregate as a (
      restaurant_id, must_eat_n, interested_n, neutral_n, not_interested_n
    )
    values (rec.key, me, inn, neu, ni)
    on conflict (restaurant_id) do update set
      must_eat_n = public.community_restaurant_aggregate.must_eat_n + excluded.must_eat_n,
      interested_n = public.community_restaurant_aggregate.interested_n + excluded.interested_n,
      neutral_n = public.community_restaurant_aggregate.neutral_n + excluded.neutral_n,
      not_interested_n = public.community_restaurant_aggregate.not_interested_n + excluded.not_interested_n,
      updated_at = now();
  end loop;
end;
$$;

-- ========= 2) Visit diary scores: one snapshot per device =========
create or replace function public.community_submit_visit_snapshot(p_device_id text, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  sc double precision;
begin
  begin
    insert into public.community_visit_device (device_id) values (p_device_id);
  exception
    when unique_violation then
      return;
  end;

  for rec in select * from jsonb_each_text(p_scores)
  loop
    begin
      sc := rec.value::double precision;
    exception
      when others then
        continue;
    end;
    if sc is null or sc <> sc then
      continue;
    end if;

    insert into public.community_restaurant_aggregate as a (restaurant_id, visit_score_sum, visit_score_n)
    values (rec.key, sc, 1)
    on conflict (restaurant_id) do update set
      visit_score_sum = public.community_restaurant_aggregate.visit_score_sum + excluded.visit_score_sum,
      visit_score_n = public.community_restaurant_aggregate.visit_score_n + excluded.visit_score_n,
      updated_at = now();
  end loop;
end;
$$;

-- ========= 3) Planned routes: unique stops on generated plan, once per device =========
create or replace function public.community_submit_plan_stops(p_device_id text, p_restaurant_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid text;
begin
  begin
    insert into public.community_plan_device (device_id) values (p_device_id);
  exception
    when unique_violation then
      return;
  end;

  foreach rid in array p_restaurant_ids
  loop
    if rid is null or length(trim(rid)) = 0 then
      continue;
    end if;
    insert into public.community_restaurant_aggregate as a (restaurant_id, planned_route_n)
    values (rid, 1)
    on conflict (restaurant_id) do update set
      planned_route_n = public.community_restaurant_aggregate.planned_route_n + excluded.planned_route_n,
      updated_at = now();
  end loop;
end;
$$;

-- ========= RLS: public read aggregates, no direct device writes =========
alter table public.community_restaurant_aggregate enable row level security;
alter table public.community_interest_device enable row level security;
alter table public.community_visit_device enable row level security;
alter table public.community_plan_device enable row level security;

drop policy if exists "read aggregate" on public.community_restaurant_aggregate;
create policy "read aggregate" on public.community_restaurant_aggregate for select using (true);

drop policy if exists "block interest device" on public.community_interest_device;
create policy "block interest device" on public.community_interest_device for all using (false);

drop policy if exists "block visit device" on public.community_visit_device;
create policy "block visit device" on public.community_visit_device for all using (false);

drop policy if exists "block plan device" on public.community_plan_device;
create policy "block plan device" on public.community_plan_device for all using (false);

grant usage on schema public to anon, authenticated;
grant select on public.community_restaurant_aggregate to anon, authenticated;
grant execute on function public.community_submit_interest_snapshot(text, jsonb) to anon, authenticated;
grant execute on function public.community_submit_visit_snapshot(text, jsonb) to anon, authenticated;
grant execute on function public.community_submit_plan_stops(text, text[]) to anon, authenticated;

-- Optional: open Supabase Table Editor → community_restaurant_aggregate to explore all columns.
