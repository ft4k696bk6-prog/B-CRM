alter table public.leads
  add column if not exists map_lat double precision,
  add column if not exists map_lng double precision,
  add column if not exists map_geocoded_at timestamptz,
  add column if not exists map_geocode_query text,
  add column if not exists meeting_map_lat double precision,
  add column if not exists meeting_map_lng double precision,
  add column if not exists meeting_map_geocoded_at timestamptz,
  add column if not exists meeting_map_geocode_query text;

create table if not exists public.map_geocode_cache (
  query_key text primary key,
  query_text text not null,
  lat double precision not null,
  lng double precision not null,
  source text not null default 'nominatim',
  created_at timestamptz not null default now()
);

alter table public.map_geocode_cache enable row level security;

create index if not exists leads_assigned_map_idx
  on public.leads (assigned_to, crm_environment)
  where map_lat is not null and map_lng is not null;

create index if not exists leads_meeting_map_idx
  on public.leads (assigned_to, meeting_at)
  where meeting_at is not null;
