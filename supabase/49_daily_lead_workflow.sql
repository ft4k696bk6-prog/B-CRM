-- Daily lead workflow: manual distribution by default, per-user nightly takeback,
-- six-calendar-month lead pool and one-time cleanup of legacy work.

alter table public.profiles
  add column if not exists auto_takeback_enabled boolean not null default true;

-- Aleksandra works independently in her region and is explicitly excluded
-- from nightly takeback unless an admin enables it later.
update public.profiles
set auto_takeback_enabled = false
where crm_environment = 'production'
  and lower(btrim(full_name)) = 'aleksandra jacyniuk';

create table if not exists public.crm_workflow_settings (
  crm_environment text primary key,
  auto_assignment_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.crm_workflow_settings enable row level security;
revoke all on table public.crm_workflow_settings from anon, authenticated;
grant all on table public.crm_workflow_settings to service_role;

insert into public.crm_workflow_settings (crm_environment, auto_assignment_enabled)
values ('production', false), ('demo', false)
on conflict (crm_environment) do nothing;

-- Automatic assignment remains configured but is globally disabled by default.
-- Existing routing rules stay intact, so enabling it again does not require
-- rebuilding province percentages.
create or replace function public.assign_lead_by_voivodeship()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  region_key text;
  total_weight integer;
  route_counter bigint;
  slot integer;
  selected_profile uuid;
  routing_enabled boolean := false;
begin
  if coalesce(new.is_cold_pool, false) then
    new.assigned_to := null;
    return new;
  end if;

  select coalesce(s.auto_assignment_enabled, false)
    into routing_enabled
  from public.crm_workflow_settings s
  where s.crm_environment = new.crm_environment;

  if not routing_enabled then
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

-- Unify the legacy "Zimna baza" status with the existing cold-pool mechanism.
-- The UI can now present one "Baza leadów" bucket based on is_cold_pool.
update public.leads
set status = 'Nowy',
    is_cold_pool = true,
    assigned_to = null,
    assigned_at = null,
    callback_at = null,
    meeting_at = null,
    meeting_address = null,
    last_opened_at = null
where status = 'Zimna baza';

-- One-time cleanup requested by the owner: meetings from dates before today
-- are moved to the admin pool as "Po spotkaniu". Today's meetings remain with
-- the salesperson and use the new normal resolution flow.
update public.leads
set status = 'Po spotkaniu',
    assigned_to = null,
    assigned_at = null,
    meeting_note = coalesce(nullif(btrim(meeting_note), ''), 'Migracja starego, nierozliczonego spotkania.'),
    last_opened_at = null
where crm_environment = 'production'
  and status = 'Spotkanie'
  and meeting_at is not null
  and (meeting_at at time zone 'Europe/Warsaw')::date < (now() at time zone 'Europe/Warsaw')::date;

create or replace function public.run_daily_lead_maintenance(
  p_environment text default 'production',
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  local_now timestamp;
  local_today date;
  returned_count integer := 0;
  aged_count integer := 0;
begin
  local_now := now() at time zone 'Europe/Warsaw';
  local_today := local_now::date;

  -- pg_cron calls this hourly. Only the 22:00 Europe/Warsaw run performs work,
  -- which keeps the schedule correct across DST changes.
  if not p_force and extract(hour from local_now) <> 22 then
    return jsonb_build_object('executed', false, 'reason', 'outside_22_warsaw', 'local_time', local_now);
  end if;

  -- Ordinary open leads are returned. Scheduled callbacks and meetings,
  -- including unresolved past meetings, are intentionally excluded.
  update public.leads l
  set status = 'Nowy',
      assigned_to = null,
      assigned_at = null,
      callback_at = null,
      meeting_at = null,
      meeting_address = null,
      last_opened_at = null
  from public.profiles p
  where l.assigned_to = p.id
    and l.crm_environment = p_environment
    and p.crm_environment = p_environment
    and coalesce(p.auto_takeback_enabled, true) = true
    and coalesce(l.is_cold_pool, false) = false
    and l.status in ('Nowy', 'Nie odebrał', 'Przypisany', 'Zwrot', 'Błędny numer', 'Do weryfikacji');

  get diagnostics returned_count = row_count;

  -- "Baza leadów": keep all existing cold-pool leads and automatically add
  -- unassigned, still-open leads on the date they become six calendar months old.
  -- A scheduled callback/meeting remains with its salesperson until that workflow
  -- is resolved; once returned, the age rule moves it into the lead pool.
  update public.leads l
  set is_cold_pool = true,
      status = 'Nowy',
      assigned_to = null,
      assigned_at = null,
      callback_at = null,
      meeting_at = null,
      meeting_address = null,
      last_opened_at = null
  where l.crm_environment = p_environment
    and coalesce(l.is_cold_pool, false) = false
    and l.assigned_to is null
    and l.status not in ('Umowa', 'Rezygnacja')
    and (l.created_at at time zone 'Europe/Warsaw')::date <= (local_today - interval '6 months')::date;

  get diagnostics aged_count = row_count;

  return jsonb_build_object(
    'executed', true,
    'environment', p_environment,
    'local_date', local_today,
    'returned', returned_count,
    'moved_to_lead_pool', aged_count
  );
end;
$$;

revoke all on function public.run_daily_lead_maintenance(text, boolean) from public, anon, authenticated;
grant execute on function public.run_daily_lead_maintenance(text, boolean) to service_role;

-- Replace an earlier job with the same name if this migration is reapplied.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'bcrm-daily-lead-maintenance' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'bcrm-daily-lead-maintenance',
  '0 * * * *',
  $$select public.run_daily_lead_maintenance('production', false);$$
);
