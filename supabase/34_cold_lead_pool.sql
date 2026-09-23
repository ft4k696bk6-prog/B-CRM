-- Admin-only cold lead pool.
-- Cold leads stay in public.leads so they keep the normal CRM workflow after release,
-- but RLS hides them from every non-admin role until assignment.

alter table public.leads
  add column if not exists is_cold_pool boolean not null default false;

create index if not exists leads_cold_pool_idx
  on public.leads (crm_environment, created_at desc)
  where is_cold_pool = true;

create table if not exists public.cold_lead_pool (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  crm_environment text not null default 'production',
  pool_name text not null,
  source_file text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null
);

create index if not exists cold_lead_pool_active_idx
  on public.cold_lead_pool (crm_environment, pool_name, imported_at desc)
  where released_at is null;

alter table public.cold_lead_pool enable row level security;
revoke all on table public.cold_lead_pool from anon, authenticated;
grant all on table public.cold_lead_pool to service_role;

drop policy if exists leads_select_owner_or_admin on public.leads;
create policy leads_select_owner_or_admin
on public.leads
for select
to authenticated
using (
  public.can_access_crm_environment(crm_environment)
  and public.can_view_lead(assigned_to)
  and (public.is_admin() or not is_cold_pool)
);

create or replace function public.log_lead_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform public.insert_lead_history(
    new.id,
    'lead_created',
    'Lead dodany do bazy.',
    null,
    to_jsonb(new) - 'is_cold_pool'
  );

  return new;
end;
$$;

create or replace function public.assign_lead_by_voivodeship()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  region_key text;
  total_weight integer;
  route_counter bigint;
  slot integer;
  selected_profile uuid;
begin
  -- Cold-pool imports must remain unassigned until an admin explicitly releases them.
  if coalesce(new.is_cold_pool, false) then
    new.assigned_to := null;
    return new;
  end if;

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
    and p.role in ('sales', 'handlowiec', 'manager', 'menadzer');

  if total_weight <= 0 then return new; end if;

  insert into public.lead_routing_state (crm_environment, voivodeship_key, counter)
  values (new.crm_environment, region_key, 0)
  on conflict (crm_environment, voivodeship_key) do nothing;

  select s.counter into route_counter
  from public.lead_routing_state s
  where s.crm_environment = new.crm_environment
    and s.voivodeship_key = region_key
  for update;

  slot := mod(route_counter, total_weight)::integer;

  select routed.profile_id into selected_profile
  from (
    select r.profile_id,
      sum(r.weight) over (order by r.sort_order, r.profile_id) as cumulative_weight
    from public.lead_routing_rules r
    join public.profiles p on p.id = r.profile_id
    where r.crm_environment = new.crm_environment
      and r.voivodeship_key = region_key
      and r.is_active = true
      and p.crm_environment = new.crm_environment
      and p.role in ('sales', 'handlowiec', 'manager', 'menadzer')
  ) routed
  where slot < routed.cumulative_weight
  order by routed.cumulative_weight
  limit 1;

  if selected_profile is not null then
    new.assigned_to := selected_profile;
    update public.lead_routing_state
      set counter = route_counter + 1, updated_at = now()
      where crm_environment = new.crm_environment
        and voivodeship_key = region_key;
  end if;
  return new;
end;
$$;

create or replace function public.release_cold_leads(
  p_lead_ids uuid[],
  p_assigned_to uuid,
  p_released_by uuid,
  p_crm_environment text
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  if p_assigned_to is null then
    raise exception 'Cold leads require a salesperson assignment.';
  end if;

  update public.leads
  set assigned_to = p_assigned_to,
      is_cold_pool = false,
      status = 'Nowy',
      callback_at = null,
      meeting_at = null,
      meeting_address = null,
      meeting_note = null,
      resignation_reason = null,
      contract_number = null,
      last_opened_at = null
  where crm_environment = p_crm_environment
    and is_cold_pool = true
    and id = any(p_lead_ids);

  get diagnostics updated_count = row_count;

  update public.cold_lead_pool
  set released_at = now(),
      released_by = p_released_by
  where crm_environment = p_crm_environment
    and released_at is null
    and lead_id = any(p_lead_ids);

  return updated_count;
end;
$$;

revoke all on function public.release_cold_leads(uuid[], uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_cold_leads(uuid[], uuid, uuid, text) to service_role;
