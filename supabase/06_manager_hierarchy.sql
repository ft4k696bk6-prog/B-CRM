-- Team hierarchy for manager-led sales work.
-- Adds profiles.manager_id and limits manager visibility to assigned salespeople.

alter table public.profiles
  add column if not exists manager_id uuid;

alter table public.profiles
  drop constraint if exists profiles_manager_id_fkey;

alter table public.profiles
  add constraint profiles_manager_id_fkey
  foreign key (manager_id)
  references public.profiles(id)
  on delete set null;

create index if not exists profiles_manager_id_idx on public.profiles(manager_id);

update public.profiles
set manager_id = null
where role not in ('handlowiec', 'sales');

create or replace function public.current_user_role()
returns text
as $$
  select role from public.profiles where id = auth.uid();
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_admin()
returns boolean
as $$
  select public.current_user_role() = 'admin';
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

create or replace function public.is_admin_or_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('admin', 'menadzer', 'manager');
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

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
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
  using (
    public.can_manage_lead(assigned_to)
    or assigned_to = auth.uid()
  );

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
      and source in ('własne', 'polecenie', 'B2B', 'B2C')
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
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
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
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can view activities for their leads" on public.lead_activities;
create policy "Users can view activities for their leads" on public.lead_activities
  for select using (
    exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can create activities for their leads" on public.lead_activities;
create policy "Users can create activities for their leads" on public.lead_activities
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can view files for their leads" on public.lead_files;
create policy "Users can view files for their leads" on public.lead_files
  for select using (
    exists (
      select 1 from public.leads
      where leads.id = lead_files.lead_id
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can upload files to their leads" on public.lead_files;
create policy "Users can upload files to their leads" on public.lead_files
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_files.lead_id
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can view reminders for their leads" on public.lead_reminders;
create policy "Users can view reminders for their leads" on public.lead_reminders
  for select using (
    exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can create reminders for their leads" on public.lead_reminders;
create policy "Users can create reminders for their leads" on public.lead_reminders
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and (
          public.can_manage_lead(leads.assigned_to)
          or leads.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "Users can view own reports" on public.daily_reports;
create policy "Users can view own reports" on public.daily_reports
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_manager_salesperson(user_id)
  );
