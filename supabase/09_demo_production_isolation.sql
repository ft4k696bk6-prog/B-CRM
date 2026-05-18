-- Hard separation between demo and production data.
-- Existing untagged data is treated as production.

alter table public.profiles
  add column if not exists crm_environment text not null default 'production';

alter table public.leads
  add column if not exists crm_environment text not null default 'production';

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  owner_id uuid references public.profiles(id) on delete cascade,
  owner_role text not null check (
    owner_role in ('owner', 'admin', 'menadzer', 'handlowiec', 'finance', 'viewer', 'ksiegowosc', 'logistyk', 'monter')
  ),
  visibility text not null default 'private' check (visibility in ('private', 'department', 'internal')),
  participant_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_date date not null,
  total_leads_worked integer default 0,
  total_activities integer default 0,
  calls_made integer default 0,
  meetings_scheduled integer default 0,
  contracts_signed integer default 0,
  resignations_recorded integer default 0,
  summary text,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  created_at timestamptz not null default now(),
  constraint daily_reports_unique_user_date unique (user_id, report_date)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  created_at timestamptz not null default now()
);

alter table if exists public.calendar_events
  add column if not exists crm_environment text not null default 'production';

alter table if exists public.daily_reports
  add column if not exists crm_environment text not null default 'production';

alter table if exists public.audit_events
  add column if not exists crm_environment text not null default 'production';

alter table public.profiles
  drop constraint if exists profiles_crm_environment_check,
  add constraint profiles_crm_environment_check check (crm_environment in ('production', 'demo'));

alter table public.leads
  drop constraint if exists leads_crm_environment_check,
  add constraint leads_crm_environment_check check (crm_environment in ('production', 'demo'));

alter table if exists public.calendar_events
  drop constraint if exists calendar_events_crm_environment_check,
  add constraint calendar_events_crm_environment_check check (crm_environment in ('production', 'demo'));

alter table if exists public.daily_reports
  drop constraint if exists daily_reports_crm_environment_check,
  add constraint daily_reports_crm_environment_check check (crm_environment in ('production', 'demo'));

alter table if exists public.audit_events
  drop constraint if exists audit_events_crm_environment_check,
  add constraint audit_events_crm_environment_check check (crm_environment in ('production', 'demo'));

update public.profiles
set crm_environment = case
  when lower(coalesce(email, '')) in (
    'demo@example.com',
    'demo-menadzer@example.com',
    'demo-handlowiec@example.com',
    'demo-ksiegowy@example.com',
    'demo-logistyk@example.com',
    'demo-monter@example.com'
  ) then 'demo'
  else 'production'
end;

update public.leads
set crm_environment = case
  when assigned_to in (select id from public.profiles where crm_environment = 'demo') then 'demo'
  else 'production'
end;

do $$
begin
  if to_regclass('public.calendar_events') is not null then
    update public.calendar_events
    set crm_environment = case
      when owner_id in (select id from public.profiles where crm_environment = 'demo')
        or created_by in (select id from public.profiles where crm_environment = 'demo')
      then 'demo'
      else 'production'
    end;
  end if;

  if to_regclass('public.daily_reports') is not null then
    update public.daily_reports
    set crm_environment = case
      when user_id in (select id from public.profiles where crm_environment = 'demo') then 'demo'
      else 'production'
    end;
  end if;

  if to_regclass('public.audit_events') is not null then
    update public.audit_events
    set crm_environment = case
      when actor_id in (select id from public.profiles where crm_environment = 'demo') then 'demo'
      else 'production'
    end;
  end if;
end $$;

create index if not exists profiles_crm_environment_idx on public.profiles(crm_environment);
create index if not exists leads_crm_environment_idx on public.leads(crm_environment, updated_at desc);

do $$
begin
  if to_regclass('public.calendar_events') is not null then
    create index if not exists calendar_events_crm_environment_idx
      on public.calendar_events(crm_environment, starts_at);
  end if;

  if to_regclass('public.daily_reports') is not null then
    create index if not exists daily_reports_crm_environment_idx
      on public.daily_reports(crm_environment, report_date desc);
  end if;

  if to_regclass('public.audit_events') is not null then
    create index if not exists audit_events_crm_environment_idx
      on public.audit_events(crm_environment, created_at desc);
  end if;
end $$;

create or replace function public.current_user_crm_environment()
returns text
as $$
  select coalesce(
    (select crm_environment from public.profiles where id = auth.uid()),
    'production'
  );
$$
language sql
stable
security definer
set search_path = public;

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
      and crm_environment = public.current_user_crm_environment()
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

create or replace function public.can_access_crm_environment(p_crm_environment text)
returns boolean
as $$
  select coalesce(p_crm_environment, 'production') = public.current_user_crm_environment();
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.assignee_matches_crm_environment(
  p_assigned_to uuid,
  p_crm_environment text
)
returns boolean
as $$
  select p_assigned_to is null
    or exists (
      select 1
      from public.profiles
      where id = p_assigned_to
        and crm_environment = coalesce(p_crm_environment, 'production')
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
  requested_environment text := 'production';
begin
  if new.raw_user_meta_data ->> 'role' in (
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
  ) then
    requested_role := new.raw_user_meta_data ->> 'role';
  end if;

  if lower(coalesce(new.email, '')) in (
    'demo@example.com',
    'demo-menadzer@example.com',
    'demo-handlowiec@example.com',
    'demo-ksiegowy@example.com',
    'demo-logistyk@example.com',
    'demo-monter@example.com'
  ) or new.raw_user_meta_data ->> 'crm_environment' = 'demo' then
    requested_environment := 'demo';
  end if;

  insert into public.profiles (id, email, full_name, role, crm_environment)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    requested_role,
    requested_environment
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        crm_environment = excluded.crm_environment;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

do $$
begin
  if to_regclass('public.audit_events') is not null then
    execute 'drop policy if exists "audit_events_select_admin" on public.audit_events';
    execute $policy$
      create policy "audit_events_select_admin"
        on public.audit_events
        for select
        to authenticated
        using (public.is_admin() and public.can_access_crm_environment(crm_environment))
    $policy$;

    execute 'drop policy if exists "audit_events_insert_authenticated" on public.audit_events';
    execute $policy$
      create policy "audit_events_insert_authenticated"
        on public.audit_events
        for insert
        to authenticated
        with check (
          public.can_access_crm_environment(crm_environment)
          and (actor_id = auth.uid() or public.is_admin())
        )
    $policy$;
  end if;
end $$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or (
      public.can_access_crm_environment(crm_environment)
      and (
        public.is_admin()
        or public.is_readonly_backoffice()
        or manager_id = auth.uid()
      )
    )
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin() and public.can_access_crm_environment(crm_environment))
  with check (public.is_admin() and public.can_access_crm_environment(crm_environment));

drop policy if exists "leads_select_owner_or_admin" on public.leads;
create policy "leads_select_owner_or_admin"
  on public.leads
  for select
  to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and public.can_view_lead(assigned_to)
  );

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin"
  on public.leads
  for insert
  to authenticated
  with check (
    public.can_access_crm_environment(crm_environment)
    and public.assignee_matches_crm_environment(assigned_to, crm_environment)
    and public.can_manage_lead(assigned_to)
  );

drop policy if exists "leads_insert_sales_manual" on public.leads;
create policy "leads_insert_sales_manual"
  on public.leads
  for insert
  to authenticated
  with check (
    public.can_access_crm_environment(crm_environment)
    and public.assignee_matches_crm_environment(assigned_to, crm_environment)
    and (
      public.can_manage_lead(assigned_to)
      or (
        assigned_to = auth.uid()
        and source in ('własne', 'polecenie', 'B2B', 'B2C')
        and status in ('Nowy', 'Przypisany')
      )
    )
  );

drop policy if exists "leads_update_owner_or_admin" on public.leads;
create policy "leads_update_owner_or_admin"
  on public.leads
  for update
  to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (
      public.can_manage_lead(assigned_to)
      or assigned_to = auth.uid()
    )
  )
  with check (
    public.can_access_crm_environment(crm_environment)
    and public.assignee_matches_crm_environment(assigned_to, crm_environment)
    and (
      public.can_manage_lead(assigned_to)
      or assigned_to = auth.uid()
      or (assigned_to is null and status = 'Zwrot')
    )
  );

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin"
  on public.leads
  for delete
  to authenticated
  using (public.is_admin() and public.can_access_crm_environment(crm_environment));

drop policy if exists "lead_history_select_owner_or_admin" on public.lead_history;
create policy "lead_history_select_owner_or_admin"
  on public.lead_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and public.can_access_crm_environment(leads.crm_environment)
        and public.can_view_lead(leads.assigned_to)
    )
  );

drop policy if exists "lead_history_insert_owner_or_admin" on public.lead_history;
drop policy if exists "lead_history_insert_comment" on public.lead_history;
create policy "lead_history_insert_owner_or_admin"
  on public.lead_history
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
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
        and public.can_access_crm_environment(leads.crm_environment)
        and public.can_manage_lead(leads.assigned_to)
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.leads
      where leads.id = lead_reminders.lead_id
        and public.can_access_crm_environment(leads.crm_environment)
        and public.can_manage_lead(leads.assigned_to)
    )
  );

do $$
begin
  if to_regclass('public.daily_reports') is not null then
    execute 'drop policy if exists "Users can view own reports" on public.daily_reports';
    execute $policy$
      create policy "Users can view own reports" on public.daily_reports
        for select
        to authenticated
        using (
          public.can_access_crm_environment(crm_environment)
          and (
            user_id = auth.uid()
            or public.is_admin()
            or public.is_readonly_backoffice()
            or public.is_manager_salesperson(user_id)
          )
        )
    $policy$;

    execute 'drop policy if exists "Users can create own reports" on public.daily_reports';
    execute $policy$
      create policy "Users can create own reports" on public.daily_reports
        for insert
        to authenticated
        with check (
          user_id = auth.uid()
          and public.can_access_crm_environment(crm_environment)
        )
    $policy$;

    execute 'drop policy if exists "Users can update own reports" on public.daily_reports';
    execute $policy$
      create policy "Users can update own reports" on public.daily_reports
        for update
        to authenticated
        using (
          user_id = auth.uid()
          and public.can_access_crm_environment(crm_environment)
        )
        with check (
          user_id = auth.uid()
          and public.can_access_crm_environment(crm_environment)
        )
    $policy$;
  end if;

  if to_regclass('public.calendar_events') is not null then
    execute 'drop policy if exists calendar_events_select on public.calendar_events';
    execute $policy$
      create policy calendar_events_select
      on public.calendar_events
      for select
      using (
        public.can_access_crm_environment(crm_environment)
        and (
          public.current_user_role() in ('owner', 'admin')
          or owner_id = auth.uid()
          or auth.uid() = any(participant_ids)
          or (
            public.current_user_role() = 'menadzer'
            and (
              owner_id in (
                select id from public.profiles
                where manager_id = auth.uid()
                  and crm_environment = public.current_user_crm_environment()
              )
              or owner_id = auth.uid()
              or auth.uid() = any(participant_ids)
            )
          )
        )
      )
    $policy$;

    execute 'drop policy if exists calendar_events_insert on public.calendar_events';
    execute $policy$
      create policy calendar_events_insert
      on public.calendar_events
      for insert
      with check (
        public.can_access_crm_environment(crm_environment)
        and (
          owner_id = auth.uid()
          or public.current_user_role() in ('owner', 'admin', 'menadzer')
        )
      )
    $policy$;

    execute 'drop policy if exists calendar_events_update on public.calendar_events';
    execute $policy$
      create policy calendar_events_update
      on public.calendar_events
      for update
      using (
        public.can_access_crm_environment(crm_environment)
        and (
          owner_id = auth.uid()
          or created_by = auth.uid()
          or public.current_user_role() in ('owner', 'admin')
        )
      )
      with check (
        public.can_access_crm_environment(crm_environment)
        and (
          owner_id = auth.uid()
          or created_by = auth.uid()
          or public.current_user_role() in ('owner', 'admin')
        )
      )
    $policy$;
  end if;
end $$;
