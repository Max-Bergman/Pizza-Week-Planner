-- Optional community leaderboards for Pizza Week Planner.
-- Run in Supabase SQL editor, then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel/hosting.

-- --- Excitement (one snapshot of must-eat list per device_id, ever) ---
create table if not exists public.community_excitement_tally (
  restaurant_id text primary key,
  votes int not null default 0
);

create table if not exists public.community_excitement_device (
  device_id text primary key,
  submitted_at timestamptz not null default now()
);

create or replace function public.community_submit_excitement(p_device_id text, p_restaurant_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.community_excitement_device where device_id = p_device_id) then
    return;
  end if;
  insert into public.community_excitement_device (device_id) values (p_device_id);
  insert into public.community_excitement_tally (restaurant_id, votes)
  select x, 1
  from unnest(p_restaurant_ids) as x
  on conflict (restaurant_id) do update
    set votes = public.community_excitement_tally.votes + excluded.votes;
end;
$$;

-- --- Favorites from visit scores (one snapshot per device_id, ever) ---
create table if not exists public.community_favorite_sum (
  restaurant_id text primary key,
  sum_score double precision not null default 0,
  score_count int not null default 0
);

create table if not exists public.community_favorite_device (
  device_id text primary key,
  submitted_at timestamptz not null default now()
);

create or replace function public.community_submit_favorites(p_device_id text, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if exists (select 1 from public.community_favorite_device where device_id = p_device_id) then
    return;
  end if;
  insert into public.community_favorite_device (device_id) values (p_device_id);
  for rec in select * from jsonb_each_text(p_scores)
  loop
    insert into public.community_favorite_sum (restaurant_id, sum_score, score_count)
    values (rec.key, rec.value::double precision, 1)
    on conflict (restaurant_id) do update
      set sum_score = public.community_favorite_sum.sum_score + excluded.sum_score,
          score_count = public.community_favorite_sum.score_count + excluded.score_count;
  end loop;
end;
$$;

alter table public.community_excitement_tally enable row level security;
alter table public.community_favorite_sum enable row level security;
alter table public.community_excitement_device enable row level security;
alter table public.community_favorite_device enable row level security;

drop policy if exists "public read excitement tally" on public.community_excitement_tally;
create policy "public read excitement tally" on public.community_excitement_tally for select using (true);

drop policy if exists "public read favorite sum" on public.community_favorite_sum;
create policy "public read favorite sum" on public.community_favorite_sum for select using (true);

drop policy if exists "no direct excitement device" on public.community_excitement_device;
create policy "no direct excitement device" on public.community_excitement_device for all using (false);

drop policy if exists "no direct favorite device" on public.community_favorite_device;
create policy "no direct favorite device" on public.community_favorite_device for all using (false);

grant usage on schema public to anon, authenticated;
grant select on public.community_excitement_tally to anon, authenticated;
grant select on public.community_favorite_sum to anon, authenticated;
grant execute on function public.community_submit_excitement(text, text[]) to anon, authenticated;
grant execute on function public.community_submit_favorites(text, jsonb) to anon, authenticated;
