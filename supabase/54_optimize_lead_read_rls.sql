-- Fix slow PostgREST reads that were approaching the authenticated role's
-- statement timeout. The old SELECT policies repeatedly evaluated CRM role,
-- environment and manager-access functions for every row.

create extension if not exists pg_trgm with schema extensions;

create index if not exists lead_history_description_trgm_idx
  on public.lead_history using gin (description extensions.gin_trgm_ops);

create index if not exists lead_activities_description_trgm_idx
  on public.lead_activities using gin (description extensions.gin_trgm_ops);

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- Build a manager's salesperson scope once per statement instead of checking
-- the profiles hierarchy for every lead row.
create or replace function app_private.current_manager_salesperson_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where p.manager_id = auth.uid()
    and p.role in ('handlowiec', 'sales')
    and coalesce(p.crm_environment, 'production') = public.current_user_crm_environment();
$$;

revoke all on function app_private.current_manager_salesperson_ids() from public, anon;
grant execute on function app_private.current_manager_salesperson_ids() to authenticated;

-- Use scalar subqueries for request-wide values so Postgres evaluates them as
-- init plans rather than once per lead row.
drop policy if exists leads_select_owner_or_admin on public.leads;
create policy leads_select_owner_or_admin
on public.leads
for select
to authenticated
using (
  coalesce(crm_environment, 'production') = (select public.current_user_crm_environment())
  and (
    (select public.is_admin())
    or (
      is_cold_pool is false
      and (
        assigned_to = (select auth.uid())
        or (
          (select public.is_menadzer())
          and (
            assigned_to is null
            or assigned_to = any (app_private.current_manager_salesperson_ids())
          )
        )
      )
    )
  )
);

-- Build the visible lead-id set once, then filter history/activity rows against
-- that set. This avoids running the entire lead RLS chain for every history row.
drop policy if exists lead_history_select_owner_or_admin on public.lead_history;
create policy lead_history_select_owner_or_admin
on public.lead_history
for select
to authenticated
using (
  lead_id in (select id from public.leads)
);

drop policy if exists "Users can view activities for their leads" on public.lead_activities;
create policy "Users can view activities for their leads"
on public.lead_activities
for select
to authenticated
using (
  lead_id in (select id from public.leads)
);

-- Remove the temporary helper used during diagnosis if it exists.
drop function if exists app_private.can_view_lead_record(uuid);

analyze public.leads;
analyze public.lead_history;
analyze public.lead_activities;
