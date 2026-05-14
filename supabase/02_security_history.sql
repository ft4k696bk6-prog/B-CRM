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

create or replace function public.handle_new_user()
returns trigger
as $$
declare
  requested_role text := 'sales';
begin
  if new.raw_user_meta_data ->> 'role' in ('admin', 'sales') then
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
        full_name = excluded.full_name;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_lead_updated_at()
returns trigger
as $$
begin
  new.updated_at := now();
  return new;
end;
$$
language plpgsql;

create or replace function public.insert_lead_history(
  p_lead_id uuid,
  p_action_type text,
  p_description text,
  p_old_value jsonb default null,
  p_new_value jsonb default null
)
returns void
as $$
begin
  insert into public.lead_history (
    lead_id,
    user_id,
    action_type,
    description,
    old_value,
    new_value
  )
  values (
    p_lead_id,
    auth.uid(),
    p_action_type,
    p_description,
    p_old_value,
    p_new_value
  );
end;
$$
language plpgsql
security definer
set search_path = public;

create or replace function public.log_lead_insert()
returns trigger
as $$
begin
  perform public.insert_lead_history(
    new.id,
    'lead_created',
    'Lead dodany do bazy.',
    null,
    to_jsonb(new)
  );

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

create or replace function public.log_lead_update()
returns trigger
as $$
begin
  if old.status is distinct from new.status then
    perform public.insert_lead_history(
      new.id,
      'status_change',
      'Status zmieniony z "' || old.status || '" na "' || new.status || '".',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    perform public.insert_lead_history(
      new.id,
      case when new.assigned_to is null then 'return' else 'assignment' end,
      case when new.assigned_to is null then 'Lead zwrócony do bazy leadów.' else 'Lead przypisany do handlowca.' end,
      jsonb_build_object('assigned_to', old.assigned_to),
      jsonb_build_object('assigned_to', new.assigned_to)
    );
  end if;

  if old.callback_at is distinct from new.callback_at then
    perform public.insert_lead_history(
      new.id,
      'callback_set',
      'Zmieniono termin callbacku.',
      jsonb_build_object('callback_at', old.callback_at),
      jsonb_build_object('callback_at', new.callback_at)
    );
  end if;

  if old.meeting_at is distinct from new.meeting_at then
    perform public.insert_lead_history(
      new.id,
      'meeting_set',
      'Zmieniono termin spotkania.',
      jsonb_build_object('meeting_at', old.meeting_at),
      jsonb_build_object('meeting_at', new.meeting_at)
    );
  end if;

  if old.meeting_address is distinct from new.meeting_address then
    perform public.insert_lead_history(
      new.id,
      'meeting_address',
      'Zmieniono adres spotkania.',
      jsonb_build_object('meeting_address', old.meeting_address),
      jsonb_build_object('meeting_address', new.meeting_address)
    );
  end if;

  if old.resignation_reason is distinct from new.resignation_reason then
    perform public.insert_lead_history(
      new.id,
      'resignation',
      'Zmieniono powód rezygnacji.',
      jsonb_build_object('resignation_reason', old.resignation_reason),
      jsonb_build_object('resignation_reason', new.resignation_reason)
    );
  end if;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_lead_updated_at();

drop trigger if exists leads_log_insert on public.leads;
create trigger leads_log_insert
  after insert on public.leads
  for each row execute function public.log_lead_insert();

drop trigger if exists leads_log_update on public.leads;
create trigger leads_log_update
  after update on public.leads
  for each row execute function public.log_lead_update();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_history enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

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
  using (public.is_admin() or assigned_to = auth.uid());

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin"
  on public.leads
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "leads_update_owner_or_admin" on public.leads;
create policy "leads_update_owner_or_admin"
  on public.leads
  for update
  to authenticated
  using (public.is_admin() or assigned_to = auth.uid())
  with check (
    public.is_admin()
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
    public.is_admin()
    or exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and leads.assigned_to = auth.uid()
    )
  );

drop policy if exists "lead_history_insert_comment" on public.lead_history;
create policy "lead_history_insert_comment"
  on public.lead_history
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and action_type = 'comment'
    and (
      public.is_admin()
      or exists (
        select 1 from public.leads
        where leads.id = lead_history.lead_id
          and leads.assigned_to = auth.uid()
      )
    )
  );
