-- Production role and permission hardening for B-CRM.
-- Run after 06_manager_hierarchy.sql.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
      'owner',
      'admin',
      'handlowiec',
      'menadzer',
      'finance',
      'viewer',
      'ksiegowosc',
      'logistyk',
      'monter',
      'sales',
      'manager'
    )
  );

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id, created_at desc);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);
create index if not exists audit_events_type_idx on public.audit_events(event_type, created_at desc);

alter table public.audit_events enable row level security;

create or replace function public.current_user_role()
returns text
as $$
  select role from public.profiles where id = auth.uid();
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_owner()
returns boolean
as $$
  select public.current_user_role() = 'owner';
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_admin()
returns boolean
as $$
  select public.current_user_role() in ('owner', 'admin');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('menadzer', 'manager');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_readonly_backoffice()
returns boolean
as $$
  select public.current_user_role() in ('finance', 'viewer');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_admin_or_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('owner', 'admin', 'menadzer', 'manager');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_manager_salesperson(p_salesperson_id uuid)
returns boolean
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_salesperson_id
      and manager_id = auth.uid()
      and role in ('handlowiec', 'sales')
  );
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.can_manage_lead(p_assigned_to uuid)
returns boolean
as $$
  select
    public.is_admin()
    or (
      public.is_menadzer()
      and (
        p_assigned_to is null
        or public.is_manager_salesperson(p_assigned_to)
      )
    );
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.can_view_lead(p_assigned_to uuid)
returns boolean
as $$
  select public.can_manage_lead(p_assigned_to)
    or public.is_readonly_backoffice()
    or p_assigned_to = auth.uid();
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.log_audit_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default null
)
returns uuid
as $$
declare
  v_id uuid;
begin
  insert into public.audit_events (actor_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), p_event_type, p_entity_type, p_entity_id, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$
language plpgsql
security definer
set search_path = public;

drop policy if exists "audit_events_select_admin" on public.audit_events;
create policy "audit_events_select_admin"
  on public.audit_events
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "audit_events_insert_authenticated" on public.audit_events;
create policy "audit_events_insert_authenticated"
  on public.audit_events
  for insert
  to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_readonly_backoffice()
    or manager_id = auth.uid()
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "leads_select_owner_or_admin" on public.leads;
create policy "leads_select_owner_or_admin"
  on public.leads
  for select
  to authenticated
  using (public.can_view_lead(assigned_to));

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin"
  on public.leads
  for insert
  to authenticated
  with check (public.can_manage_lead(assigned_to));

drop policy if exists "leads_insert_sales_manual" on public.leads;
create policy "leads_insert_sales_manual"
  on public.leads
  for insert
  to authenticated
  with check (
    public.can_manage_lead(assigned_to)
    or (
      assigned_to = auth.uid()
      and source in ('własne', 'polecenie')
      and status in ('Nowy', 'Przypisany')
    )
  );

drop policy if exists "leads_update_owner_or_admin" on public.leads;
create policy "leads_update_owner_or_admin"
  on public.leads
  for update
  to authenticated
  using (
    public.can_manage_lead(assigned_to)
    or assigned_to = auth.uid()
  )
  with check (
    public.can_manage_lead(assigned_to)
    or assigned_to = auth.uid()
    or (assigned_to is null and status = 'Zwrot')
  );

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin"
  on public.leads
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "lead_history_select_owner_or_admin" on public.lead_history;
create policy "lead_history_select_owner_or_admin"
  on public.lead_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and public.can_view_lead(leads.assigned_to)
    )
  );

drop policy if exists "lead_history_insert_owner_or_admin" on public.lead_history;
create policy "lead_history_insert_owner_or_admin"
  on public.lead_history
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and (public.can_manage_lead(leads.assigned_to) or leads.assigned_to = auth.uid())
    )
  );

drop policy if exists "Users can view activities for their leads" on public.lead_activities;
create policy "Users can view activities for their leads" on public.lead_activities
  for select
  to authenticated
  using (
    exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id
        and public.can_view_lead(leads.assigned_to)
    )
  );

drop policy if exists "Users can create activities for their leads" on public.lead_activities;
create policy "Users can create activities for their leads" on public.lead_activities
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id
        and (public.can_manage_lead(leads.assigned_to) or leads.assigned_to = auth.uid())
    )
  );

drop policy if exists "Users can view files for their leads" on public.lead_files;
create policy "Users can view files for their leads" on public.lead_files
  for select
  to authenticated
  using (
    exists (
      select 1 from public.leads
      where leads.id = lead_files.lead_id
        and public.can_view_lead(leads.assigned_to)
    )
  );

drop policy if exists "Users can upload files to their leads" on public.lead_files;
create policy "Users can upload files to their leads" on public.lead_files
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_files.lead_id
        and (public.can_manage_lead(leads.assigned_to) or leads.assigned_to = auth.uid())
    )
  );

drop policy if exists "Users can delete files for editable leads" on public.lead_files;
create policy "Users can delete files for editable leads" on public.lead_files
  for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.leads
      where leads.id = lead_files.lead_id
        and public.can_manage_lead(leads.assigned_to)
    )
  );

drop policy if exists "Users can view reminders for their leads" on public.lead_reminders;
create policy "Users can view reminders for their leads" on public.lead_reminders
  for select
  to authenticated
  using (
    exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and public.can_view_lead(leads.assigned_to)
    )
  );

drop policy if exists "Users can create reminders for their leads" on public.lead_reminders;
create policy "Users can create reminders for their leads" on public.lead_reminders
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and (public.can_manage_lead(leads.assigned_to) or leads.assigned_to = auth.uid())
    )
  );

drop policy if exists "Users can update reminders for editable leads" on public.lead_reminders;
create policy "Users can update reminders for editable leads" on public.lead_reminders
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and public.can_manage_lead(leads.assigned_to)
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and public.can_manage_lead(leads.assigned_to)
    )
  );

drop policy if exists "Users can view own reports" on public.daily_reports;
create policy "Users can view own reports" on public.daily_reports
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_readonly_backoffice()
    or public.is_manager_salesperson(user_id)
  );

drop policy if exists "Users can create own reports" on public.daily_reports;
create policy "Users can create own reports" on public.daily_reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own reports" on public.daily_reports;
create policy "Users can update own reports" on public.daily_reports
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
