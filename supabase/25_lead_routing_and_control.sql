create or replace function public.normalize_voivodeship_key(value text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      translate(lower(coalesce(value, '')), 'ąćęłńóśźż', 'acelnoszz'),
      '^(wojewodztwo|woj)[ .:-]*',
      ''
    )
  );
$$;

create table if not exists public.lead_routing_rules (
  id uuid primary key default gen_random_uuid(),
  crm_environment text not null,
  voivodeship text not null,
  voivodeship_key text generated always as (public.normalize_voivodeship_key(voivodeship)) stored,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weight integer not null check (weight between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crm_environment, voivodeship_key, profile_id)
);

create index if not exists lead_routing_rules_lookup_idx
  on public.lead_routing_rules (crm_environment, voivodeship_key, is_active, sort_order);

create table if not exists public.lead_routing_state (
  crm_environment text not null,
  voivodeship_key text not null,
  counter bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (crm_environment, voivodeship_key)
);

alter table public.lead_routing_rules enable row level security;
alter table public.lead_routing_state enable row level security;

create or replace function public.assign_lead_by_voivodeship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  region_key text;
  total_weight integer;
  route_counter bigint;
  slot integer;
  selected_profile uuid;
begin
  if new.assigned_to is not null or new.voivodeship is null or btrim(new.voivodeship) = '' then
    return new;
  end if;

  region_key := public.normalize_voivodeship_key(new.voivodeship);
  if region_key = '' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.crm_environment || ':routing:' || region_key));

  select coalesce(sum(r.weight), 0)::integer
    into total_weight
  from public.lead_routing_rules r
  join public.profiles p on p.id = r.profile_id
  where r.crm_environment = new.crm_environment
    and r.voivodeship_key = region_key
    and r.is_active = true
    and p.crm_environment = new.crm_environment
    and p.role in ('sales', 'handlowiec');

  if total_weight <= 0 then
    return new;
  end if;

  insert into public.lead_routing_state (crm_environment, voivodeship_key, counter)
  values (new.crm_environment, region_key, 0)
  on conflict (crm_environment, voivodeship_key) do nothing;

  select s.counter
    into route_counter
  from public.lead_routing_state s
  where s.crm_environment = new.crm_environment
    and s.voivodeship_key = region_key
  for update;

  slot := mod(route_counter, total_weight)::integer;

  select routed.profile_id
    into selected_profile
  from (
    select
      r.profile_id,
      sum(r.weight) over (order by r.sort_order, r.profile_id) as cumulative_weight
    from public.lead_routing_rules r
    join public.profiles p on p.id = r.profile_id
    where r.crm_environment = new.crm_environment
      and r.voivodeship_key = region_key
      and r.is_active = true
      and p.crm_environment = new.crm_environment
      and p.role in ('sales', 'handlowiec')
  ) routed
  where slot < routed.cumulative_weight
  order by routed.cumulative_weight
  limit 1;

  if selected_profile is not null then
    new.assigned_to := selected_profile;
    update public.lead_routing_state
      set counter = route_counter + 1,
          updated_at = now()
      where crm_environment = new.crm_environment
        and voivodeship_key = region_key;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_lead_by_voivodeship on public.leads;
create trigger trg_assign_lead_by_voivodeship
before insert on public.leads
for each row
execute function public.assign_lead_by_voivodeship();

comment on table public.lead_routing_rules is 'Weighted automatic lead assignment per voivodeship and CRM environment.';
comment on column public.lead_routing_rules.weight is 'Relative percentage weight. Admin API keeps active rules for a region at 100 total.';
