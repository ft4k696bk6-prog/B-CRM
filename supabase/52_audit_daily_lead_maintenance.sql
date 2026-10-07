-- Preserve a complete lead history for automatic nightly returns and six-month pool aging.
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

  if not p_force and extract(hour from local_now) <> 22 then
    return jsonb_build_object('executed', false, 'reason', 'outside_22_warsaw', 'local_time', local_now);
  end if;

  with candidates as materialized (
    select
      l.id,
      l.status as old_status,
      l.assigned_to as old_assigned_to,
      l.callback_at as old_callback_at,
      l.meeting_at as old_meeting_at
    from public.leads l
    join public.profiles p on p.id = l.assigned_to
    where l.crm_environment = p_environment
      and p.crm_environment = p_environment
      and coalesce(p.auto_takeback_enabled, true) = true
      and coalesce(l.is_cold_pool, false) = false
      and l.status in ('Nowy', 'Nie odebrał', 'Przypisany', 'Zwrot', 'Błędny numer', 'Do weryfikacji')
    for update of l
  ), updated as (
    update public.leads l
    set status = 'Nowy',
        assigned_to = null,
        assigned_at = null,
        callback_at = null,
        meeting_at = null,
        meeting_address = null,
        last_opened_at = null
    from candidates c
    where l.id = c.id
    returning l.id, c.old_status, c.old_assigned_to, c.old_callback_at, c.old_meeting_at
  )
  insert into public.lead_history (
    lead_id, user_id, action_type, description, old_value, new_value
  )
  select
    u.id,
    null,
    'return',
    case
      when u.old_status = 'Nie odebrał' then 'Automatyczny zwrot o 22:00: Nie odebrał → Nowy.'
      else format('Automatyczny zwrot o 22:00: %s → Nowy.', u.old_status)
    end,
    jsonb_build_object(
      'status', u.old_status,
      'assigned_to', u.old_assigned_to,
      'callback_at', u.old_callback_at,
      'meeting_at', u.old_meeting_at
    ),
    jsonb_build_object(
      'status', 'Nowy',
      'assigned_to', null,
      'callback_at', null,
      'meeting_at', null,
      'automatic_takeback', true
    )
  from updated u;

  get diagnostics returned_count = row_count;

  with candidates as materialized (
    select
      l.id,
      l.status as old_status,
      l.assigned_to as old_assigned_to,
      l.is_cold_pool as old_is_cold_pool
    from public.leads l
    where l.crm_environment = p_environment
      and coalesce(l.is_cold_pool, false) = false
      and l.assigned_to is null
      and l.status not in ('Umowa', 'Rezygnacja')
      and (l.created_at at time zone 'Europe/Warsaw')::date <= (local_today - interval '6 months')::date
    for update
  ), updated as (
    update public.leads l
    set is_cold_pool = true,
        status = 'Nowy',
        assigned_to = null,
        assigned_at = null,
        callback_at = null,
        meeting_at = null,
        meeting_address = null,
        last_opened_at = null
    from candidates c
    where l.id = c.id
    returning l.id, c.old_status, c.old_assigned_to, c.old_is_cold_pool
  )
  insert into public.lead_history (
    lead_id, user_id, action_type, description, old_value, new_value
  )
  select
    u.id,
    null,
    'status_change',
    'Automatycznie przeniesiono do Bazy leadów po 6 miesiącach.',
    jsonb_build_object(
      'status', u.old_status,
      'assigned_to', u.old_assigned_to,
      'is_cold_pool', u.old_is_cold_pool
    ),
    jsonb_build_object(
      'status', 'Nowy',
      'assigned_to', null,
      'is_cold_pool', true,
      'aged_to_lead_pool', true
    )
  from updated u;

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

-- Initialize the six-calendar-month pool immediately for already-unassigned leads,
-- without running the nightly takeback early.
with candidates as materialized (
  select l.id, l.status as old_status, l.is_cold_pool as old_is_cold_pool
  from public.leads l
  where l.crm_environment = 'production'
    and coalesce(l.is_cold_pool, false) = false
    and l.assigned_to is null
    and l.status not in ('Umowa', 'Rezygnacja')
    and (l.created_at at time zone 'Europe/Warsaw')::date <= (((now() at time zone 'Europe/Warsaw')::date - interval '6 months')::date)
  for update
), updated as (
  update public.leads l
  set is_cold_pool = true,
      status = 'Nowy',
      assigned_at = null,
      callback_at = null,
      meeting_at = null,
      meeting_address = null,
      last_opened_at = null
  from candidates c
  where l.id = c.id
  returning l.id, c.old_status, c.old_is_cold_pool
)
insert into public.lead_history (lead_id, user_id, action_type, description, old_value, new_value)
select
  u.id,
  null,
  'status_change',
  'Automatycznie przeniesiono do Bazy leadów po 6 miesiącach.',
  jsonb_build_object('status', u.old_status, 'is_cold_pool', u.old_is_cold_pool),
  jsonb_build_object('status', 'Nowy', 'assigned_to', null, 'is_cold_pool', true, 'aged_to_lead_pool', true)
from updated u;
