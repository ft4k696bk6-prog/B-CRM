-- Adds post-contract operational roles used by the realization workflow.
-- Run after 06_manager_hierarchy.sql.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
      'admin',
      'handlowiec',
      'menadzer',
      'ksiegowosc',
      'logistyk',
      'monter',
      'sales',
      'manager',
      'accounting',
      'logistics',
      'installer'
    )
  );

create or replace function public.is_operations_role()
returns boolean
as $$
  select public.current_user_role() in (
    'admin',
    'menadzer',
    'manager',
    'ksiegowosc',
    'accounting',
    'logistyk',
    'logistics',
    'monter',
    'installer'
  );
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
  if new.raw_user_meta_data ->> 'role' in (
    'admin',
    'handlowiec',
    'menadzer',
    'ksiegowosc',
    'logistyk',
    'monter'
  ) then
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
  using (
    id = auth.uid()
    or public.is_admin_or_menadzer()
    or public.is_operations_role()
  );

drop policy if exists "leads_select_owner_or_admin" on public.leads;
create policy "leads_select_owner_or_admin"
  on public.leads
  for select
  to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or public.is_manager_salesperson(assigned_to)
    or (
      public.is_operations_role()
      and status = 'Umowa'
    )
  );

drop policy if exists "lead_history_select_owner_or_admin" on public.lead_history;
create policy "lead_history_select_owner_or_admin"
  on public.lead_history
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_operations_role()
    or exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and (
          leads.assigned_to = auth.uid()
          or public.is_manager_salesperson(leads.assigned_to)
        )
    )
  );

drop policy if exists "Users can view files for their leads" on public.lead_files;
create policy "Users can view files for their leads" on public.lead_files
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin_or_menadzer())
    or (select public.is_operations_role())
  );
