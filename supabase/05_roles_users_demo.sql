-- Adds the Polish CRM roles used by the app and manager-safe RLS.
-- Run after previous migrations.

update public.profiles set role = 'handlowiec' where role = 'sales';
update public.profiles set role = 'menadzer' where role = 'manager';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'handlowiec', 'menadzer'));

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
  select public.current_user_role() = 'menadzer';
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_admin_or_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('admin', 'menadzer');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.handle_new_user()
returns trigger
as $$
declare
  requested_role text := 'handlowiec';
begin
  if new.raw_user_meta_data ->> 'role' in ('admin', 'handlowiec', 'menadzer') then
    requested_role := new.raw_user_meta_data ->> 'role';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    requested_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin_or_menadzer());

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
  using (public.is_admin_or_menadzer() or assigned_to = auth.uid());

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin"
  on public.leads
  for insert
  to authenticated
  with check (public.is_admin_or_menadzer());

drop policy if exists "leads_insert_sales_manual" on public.leads;
create policy "leads_insert_sales_manual"
  on public.leads
  for insert
  to authenticated
  with check (
    public.is_admin_or_menadzer()
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
  using (public.is_admin_or_menadzer() or assigned_to = auth.uid())
  with check (
    public.is_admin_or_menadzer()
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
    public.is_admin_or_menadzer()
    or exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and leads.assigned_to = auth.uid()
    )
  );

drop policy if exists "lead_history_insert_owner_or_admin" on public.lead_history;
create policy "lead_history_insert_owner_or_admin"
  on public.lead_history
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_admin_or_menadzer()
      or exists (
        select 1 from public.leads
        where leads.id = lead_history.lead_id
          and leads.assigned_to = auth.uid()
      )
    )
  );

drop policy if exists "Users can view activities for their leads" on public.lead_activities;
create policy "Users can view activities for their leads" on public.lead_activities
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin_or_menadzer())
  );

drop policy if exists "Users can create activities for their leads" on public.lead_activities;
create policy "Users can create activities for their leads" on public.lead_activities
  for insert with check (
    user_id = auth.uid()
    and (
      (select assigned_to from public.leads where id = lead_id) = auth.uid()
      or (select public.is_admin_or_menadzer())
    )
  );

drop policy if exists "Users can view files for their leads" on public.lead_files;
create policy "Users can view files for their leads" on public.lead_files
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin_or_menadzer())
  );

drop policy if exists "Users can upload files to their leads" on public.lead_files;
create policy "Users can upload files to their leads" on public.lead_files
  for insert with check (
    uploaded_by = auth.uid()
    and (
      (select assigned_to from public.leads where id = lead_id) = auth.uid()
      or (select public.is_admin_or_menadzer())
    )
  );

drop policy if exists "Users can view reminders for their leads" on public.lead_reminders;
create policy "Users can view reminders for their leads" on public.lead_reminders
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin_or_menadzer())
  );

drop policy if exists "Users can create reminders for their leads" on public.lead_reminders;
create policy "Users can create reminders for their leads" on public.lead_reminders
  for insert with check (
    created_by = auth.uid()
    and (
      (select assigned_to from public.leads where id = lead_id) = auth.uid()
      or (select public.is_admin_or_menadzer())
    )
  );

drop policy if exists "Users can view own reports" on public.daily_reports;
create policy "Users can view own reports" on public.daily_reports
  for select using (
    user_id = auth.uid()
    or (select public.is_admin_or_menadzer())
  );

create or replace function public.validate_sales_lead_path()
returns trigger
as $$
begin
  if auth.uid() is null or public.is_admin_or_menadzer() then
    return new;
  end if;

  if (to_jsonb(new) - 'updated_at' - 'last_opened_at')
     = (to_jsonb(old) - 'updated_at' - 'last_opened_at') then
    return new;
  end if;

  if old.assigned_to is distinct from auth.uid() then
    raise exception 'Handlowiec może edytować tylko swoje leady.';
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    if not (new.assigned_to is null and new.status = 'Zwrot') then
      raise exception 'Handlowiec nie może przypisywać leadów.';
    end if;
  end if;

  if new.status = 'Umowa' and old.status not in ('Spotkanie', 'Po spotkaniu', 'Umowa') then
    raise exception 'Umowę można oznaczyć dopiero po spotkaniu.';
  end if;

  if new.status = 'Umowa'
    and nullif(trim(coalesce(new.contract_number, '')), '') is null then
    raise exception 'Status Umowa wymaga numeru umowy.';
  end if;

  if new.status = 'Spotkanie'
    and (new.meeting_at is null or nullif(trim(coalesce(new.meeting_address, new.address, '')), '') is null) then
    raise exception 'Status Spotkanie wymaga terminu i adresu klienta.';
  end if;

  if new.status = 'Po spotkaniu'
    and nullif(trim(coalesce(new.meeting_note, '')), '') is null then
    raise exception 'Status Po spotkaniu wymaga notatki.';
  end if;

  if new.status = 'Call back' and new.callback_at is null then
    raise exception 'Status Call back wymaga daty i godziny.';
  end if;

  if new.status = 'Rezygnacja'
    and nullif(trim(coalesce(new.resignation_reason, '')), '') is null then
    raise exception 'Rezygnacja wymaga powodu.';
  end if;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;
