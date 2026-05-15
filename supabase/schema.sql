create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'handlowiec',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'handlowiec', 'menadzer'))
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  postal_code text,
  phone text not null,
  address text,
  voivodeship text,
  county text,
  status text not null default 'Nowy',
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz,
  source text,
  resignation_reason text,
  callback_at timestamptz,
  meeting_at timestamptz,
  meeting_address text,
  meeting_note text,
  contract_number text,
  constraint leads_status_check check (
    status in (
      'Nowy',
      'Przypisany',
      'Call back',
      'Spotkanie',
      'Po spotkaniu',
      'Umowa',
      'Zwrot',
      'Rezygnacja',
      'Nie odebrał',
      'Błędny numer',
      'Do weryfikacji'
    )
  ),
  constraint leads_assigned_to_fkey
    foreign key (assigned_to)
    references public.profiles(id)
    on delete set null
);

create table if not exists public.lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  user_id uuid,
  action_type text not null,
  description text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now(),
  constraint lead_history_lead_id_fkey
    foreign key (lead_id)
    references public.leads(id)
    on delete cascade,
  constraint lead_history_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete set null
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_updated_at_idx on public.leads(updated_at desc);
create index if not exists leads_last_opened_at_idx on public.leads(last_opened_at desc);
create index if not exists leads_postal_code_idx on public.leads(postal_code);
create index if not exists leads_region_idx on public.leads(voivodeship, county);
create index if not exists lead_history_lead_id_idx on public.lead_history(lead_id, created_at desc);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
        full_name = excluded.full_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_lead_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'last_opened_at')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'last_opened_at') then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

create or replace function public.validate_sales_lead_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role_value text;
begin
  if auth.uid() is null then
    return new;
  end if;

  user_role_value := public.current_user_role();

  if user_role_value = 'admin' then
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

  if new.full_name is distinct from old.full_name
    or new.phone is distinct from old.phone
    or new.postal_code is distinct from old.postal_code
    or new.voivodeship is distinct from old.voivodeship
    or new.county is distinct from old.county
    or new.source is distinct from old.source then
    raise exception 'Handlowiec nie może zmieniać danych importowych leada.';
  end if;

  if new.status = 'Umowa' and old.status not in ('Spotkanie', 'Po spotkaniu', 'Umowa') then
    raise exception 'Umowę można oznaczyć dopiero po spotkaniu.';
  end if;

  if new.status = 'Umowa'
    and nullif(trim(coalesce(new.contract_number, '')), '') is null then
    raise exception 'Status Umowa wymaga numeru umowy.';
  end if;

  if new.status = 'Call back'
    and (old.status is distinct from new.status or old.callback_at is distinct from new.callback_at)
    and new.callback_at is null then
    raise exception 'Status Call back wymaga daty i godziny.';
  end if;

  if new.status = 'Spotkanie'
    and (
      old.status is distinct from new.status
      or old.meeting_at is distinct from new.meeting_at
      or old.meeting_address is distinct from new.meeting_address
      or old.address is distinct from new.address
    )
    and (new.meeting_at is null or nullif(trim(coalesce(new.meeting_address, new.address, '')), '') is null) then
    raise exception 'Status Spotkanie wymaga terminu i adresu klienta.';
  end if;

  if new.status = 'Po spotkaniu'
    and (
      old.status is distinct from new.status
      or old.meeting_note is distinct from new.meeting_note
    )
    and nullif(trim(coalesce(new.meeting_note, '')), '') is null then
    raise exception 'Status Po spotkaniu wymaga notatki.';
  end if;

  if new.status = 'Rezygnacja'
    and (
      old.status is distinct from new.status
      or old.resignation_reason is distinct from new.resignation_reason
    )
    and nullif(trim(coalesce(new.resignation_reason, '')), '') is null then
    raise exception 'Rezygnacja wymaga powodu.';
  end if;

  return new;
end;
$$;

create or replace function public.insert_lead_history(
  p_lead_id uuid,
  p_action_type text,
  p_description text,
  p_old_value jsonb default null,
  p_new_value jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
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
$$;

create or replace function public.log_lead_insert()
returns trigger
language plpgsql
security definer
set search_path = public
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
$$;

create or replace function public.log_lead_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignee_name text;
  old_meeting_address text;
  new_meeting_address text;
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
    if new.assigned_to is null then
      perform public.insert_lead_history(
        new.id,
        case when new.status = 'Zwrot' then 'return' else 'assignment' end,
        case when new.status = 'Zwrot' then 'Lead zwrócony do bazy leadów.' else 'Usunięto przypisanie leada.' end,
        jsonb_build_object('assigned_to', old.assigned_to),
        jsonb_build_object('assigned_to', new.assigned_to)
      );
    else
      select full_name into assignee_name from public.profiles where id = new.assigned_to;

      perform public.insert_lead_history(
        new.id,
        'assignment',
        'Lead przypisany do: ' || coalesce(assignee_name, new.assigned_to::text) || '.',
        jsonb_build_object('assigned_to', old.assigned_to),
        jsonb_build_object('assigned_to', new.assigned_to)
      );
    end if;
  end if;

  if old.callback_at is distinct from new.callback_at then
    perform public.insert_lead_history(
      new.id,
      'callback_set',
      case
        when new.callback_at is null then 'Usunięto callback.'
        else 'Ustawiono callback: ' || to_char(new.callback_at, 'YYYY-MM-DD HH24:MI') || '.'
      end,
      jsonb_build_object('callback_at', old.callback_at),
      jsonb_build_object('callback_at', new.callback_at)
    );
  end if;

  if old.meeting_at is distinct from new.meeting_at then
    perform public.insert_lead_history(
      new.id,
      'meeting_set',
      case
        when new.meeting_at is null then 'Usunięto spotkanie.'
        else 'Ustawiono spotkanie: ' || to_char(new.meeting_at, 'YYYY-MM-DD HH24:MI') || '.'
      end,
      jsonb_build_object('meeting_at', old.meeting_at),
      jsonb_build_object('meeting_at', new.meeting_at)
    );
  end if;

  old_meeting_address := coalesce(old.meeting_address, old.address, '');
  new_meeting_address := coalesce(new.meeting_address, new.address, '');

  if old_meeting_address is distinct from new_meeting_address and new.status = 'Spotkanie' then
    perform public.insert_lead_history(
      new.id,
      'meeting_address',
      'Wpisano adres spotkania: ' || new_meeting_address || '.',
      jsonb_build_object('address', old_meeting_address),
      jsonb_build_object('address', new_meeting_address)
    );
  end if;

  if old.meeting_note is distinct from new.meeting_note
    and nullif(trim(coalesce(new.meeting_note, '')), '') is not null then
    perform public.insert_lead_history(
      new.id,
      'meeting_note',
      'Notatka po spotkaniu: ' || new.meeting_note,
      jsonb_build_object('meeting_note', old.meeting_note),
      jsonb_build_object('meeting_note', new.meeting_note)
    );
  end if;

  if old.resignation_reason is distinct from new.resignation_reason
    and nullif(trim(coalesce(new.resignation_reason, '')), '') is not null then
    perform public.insert_lead_history(
      new.id,
      'resignation',
      'Powód rezygnacji: ' || new.resignation_reason,
      jsonb_build_object('resignation_reason', old.resignation_reason),
      jsonb_build_object('resignation_reason', new.resignation_reason)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists leads_validate_sales_update on public.leads;
create trigger leads_validate_sales_update
  before update on public.leads
  for each row execute function public.validate_sales_lead_update();

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

drop policy if exists "leads_insert_sales_manual" on public.leads;
create policy "leads_insert_sales_manual"
  on public.leads
  for insert
  to authenticated
  with check (
    public.is_admin()
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
