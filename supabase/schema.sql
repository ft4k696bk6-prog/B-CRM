create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'handlowiec',
  manager_id uuid references public.profiles(id) on delete set null,
  crm_environment text not null default 'production',
  created_at timestamptz not null default now(),
  constraint profiles_crm_environment_check check (crm_environment in ('production', 'demo')),
  constraint profiles_role_check check (
    role in ('owner', 'admin', 'kierownik', 'handlowiec', 'menadzer', 'finance', 'viewer', 'ksiegowosc', 'logistyk', 'monter', 'sales', 'manager')
  )
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
  crm_environment text not null default 'production',
  constraint leads_crm_environment_check check (crm_environment in ('production', 'demo')),
  constraint leads_status_check check (
    status in (
      'Nowy',
      'Przypisany',
      'Call back',
      'Spotkanie',
      'Po spotkaniu',
      'Oferta wysłana',
      'Oferta zaakceptowana',
      'Podpis elektroniczny',
      'Umowa',
      'W realizacji',
      'Zrealizowany',
      'Zwrot',
      'Rezygnacja',
      'Nie odebrał',
      'Błędny numer',
      'Do weryfikacji',
      'Zimna baza'
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
create index if not exists profiles_manager_id_idx on public.profiles(manager_id);
create index if not exists profiles_crm_environment_idx on public.profiles(crm_environment);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_crm_environment_idx on public.leads(crm_environment, updated_at desc);
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
  if new.raw_user_meta_data ->> 'role' in (
    'owner',
    'admin',
    'kierownik',
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
    and source in ('własne', 'polecenie', 'B2B', 'B2C')
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

-- Click-to-call bridge, call history and AI summaries.
alter table public.profiles
  add column if not exists business_phone text;

create table if not exists public.lead_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  user_phone text not null,
  customer_phone text not null,
  status text not null default 'queued' check (
    status in (
      'queued',
      'ringing_user',
      'connecting_customer',
      'in_progress',
      'completed',
      'failed',
      'busy',
      'no_answer',
      'canceled',
      'demo_completed'
    )
  ),
  recording_consent boolean not null default false,
  webhook_token text not null unique,
  twilio_parent_call_sid text,
  twilio_child_call_sid text,
  twilio_recording_sid text,
  recording_url text,
  recording_duration_seconds integer,
  duration_seconds integer,
  transcript text,
  ai_summary text,
  ai_next_step text,
  note_saved_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_calls_lead_idx on public.lead_calls(lead_id, created_at desc);
create index if not exists lead_calls_user_idx on public.lead_calls(user_id, created_at desc);
create index if not exists lead_calls_scope_idx on public.lead_calls(crm_environment, created_at desc);
create index if not exists lead_calls_twilio_parent_idx on public.lead_calls(twilio_parent_call_sid);
create index if not exists lead_calls_twilio_child_idx on public.lead_calls(twilio_child_call_sid);

drop trigger if exists lead_calls_set_updated_at on public.lead_calls;
create trigger lead_calls_set_updated_at
  before update on public.lead_calls
  for each row execute function public.set_lead_updated_at();

alter table public.lead_calls enable row level security;

drop policy if exists lead_calls_select on public.lead_calls;
create policy lead_calls_select
  on public.lead_calls
  for select
  to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (
      public.is_admin()
      or user_id = auth.uid()
      or exists (
        select 1 from public.leads
        where leads.id = lead_calls.lead_id
          and leads.assigned_to = auth.uid()
          and public.can_access_crm_environment(leads.crm_environment)
      )
    )
  );

do $$
begin
  if to_regclass('public.lead_activities') is not null then
    alter table public.lead_activities
      drop constraint if exists lead_activities_activity_type_check;

    alter table public.lead_activities
      add constraint lead_activities_activity_type_check check (activity_type in (
        'comment',
        'status_change',
        'callback_scheduled',
        'meeting_scheduled',
        'meeting_address_changed',
        'contract_number_set',
        'resignation_recorded',
        'file_uploaded',
        'file_deleted',
        'assigned',
        'unassigned',
        'lead_created',
        'call_logged',
        'call_transcript',
        'ai_call_summary'
      ));
  end if;
end $$;

drop policy if exists lead_calls_insert on public.lead_calls;
create policy lead_calls_insert
  on public.lead_calls
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_crm_environment(crm_environment)
    and exists (
      select 1 from public.leads
      where leads.id = lead_calls.lead_id
        and public.can_access_crm_environment(leads.crm_environment)
        and (public.is_admin() or leads.assigned_to = auth.uid())
    )
  );

drop policy if exists lead_calls_update on public.lead_calls;
create policy lead_calls_update
  on public.lead_calls
  for update
  to authenticated
  using (
    public.can_access_crm_environment(crm_environment)
    and (
      public.is_admin()
      or user_id = auth.uid()
      or exists (
        select 1 from public.leads
        where leads.id = lead_calls.lead_id
          and leads.assigned_to = auth.uid()
          and public.can_access_crm_environment(leads.crm_environment)
      )
    )
  )
  with check (public.can_access_crm_environment(crm_environment));

create table if not exists public.email_suppression_list (
  id uuid primary key default gen_random_uuid(),
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  recipient_email text not null,
  normalized_recipient_email text not null,
  reason text not null check (reason in ('invalid_address', 'blocked_sector', 'manual')),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_suppression_email_not_blank check (length(trim(recipient_email)) > 0),
  constraint email_suppression_normalized_not_blank check (length(trim(normalized_recipient_email)) > 0)
);

create unique index if not exists email_suppression_unique_recipient_idx
  on public.email_suppression_list(crm_environment, normalized_recipient_email);
create index if not exists email_suppression_reason_idx
  on public.email_suppression_list(reason, created_at desc);

drop trigger if exists email_suppression_list_set_updated_at on public.email_suppression_list;
create trigger email_suppression_list_set_updated_at
  before update on public.email_suppression_list
  for each row execute function public.set_lead_updated_at();

alter table public.email_suppression_list enable row level security;

drop policy if exists email_suppression_select_admin on public.email_suppression_list;
create policy email_suppression_select_admin
  on public.email_suppression_list
  for select
  to authenticated
  using (public.is_admin());

create table if not exists public.email_send_locks (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  scope text not null,
  recipient_email text not null,
  normalized_recipient_email text not null,
  status text not null default 'claimed' check (
    status in ('claimed', 'sent', 'failed', 'skipped', 'bounced_invalid', 'suppressed')
  ),
  reason text check (reason in ('invalid_address', 'blocked_sector', 'manual')),
  claimed_by uuid references public.profiles(id) on delete set null,
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 1 check (attempt_count > 0),
  first_claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  sent_at timestamptz,
  follow_up_eligible_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint email_send_locks_dedupe_not_blank check (length(trim(dedupe_key)) > 0),
  constraint email_send_locks_recipient_not_blank check (length(trim(recipient_email)) > 0),
  constraint email_send_locks_normalized_not_blank check (length(trim(normalized_recipient_email)) > 0),
  constraint email_send_locks_scope_not_blank check (length(trim(scope)) > 0)
);

create unique index if not exists email_send_locks_dedupe_key_idx
  on public.email_send_locks(dedupe_key);
create index if not exists email_send_locks_recipient_idx
  on public.email_send_locks(crm_environment, normalized_recipient_email, first_claimed_at desc);
create index if not exists email_send_locks_status_idx
  on public.email_send_locks(status, last_seen_at desc);

drop trigger if exists email_send_locks_set_updated_at on public.email_send_locks;
create trigger email_send_locks_set_updated_at
  before update on public.email_send_locks
  for each row execute function public.set_lead_updated_at();

alter table public.email_send_locks enable row level security;

drop policy if exists email_send_locks_select_admin on public.email_send_locks;
create policy email_send_locks_select_admin
  on public.email_send_locks
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.suppress_email_recipient(
  p_recipient_email text,
  p_reason text,
  p_crm_environment text default 'production',
  p_source text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
as $$
declare
  clean_email text := lower(trim(coalesce(p_recipient_email, '')));
  clean_environment text := coalesce(nullif(trim(p_crm_environment), ''), 'production');
  suppression_id uuid;
begin
  if clean_email = '' or position('@' in clean_email) = 0 then
    raise exception 'Recipient email is required for suppression.';
  end if;

  if clean_environment not in ('production', 'demo') then
    raise exception 'Unsupported CRM environment: %', clean_environment;
  end if;

  if p_reason not in ('invalid_address', 'blocked_sector', 'manual') then
    raise exception 'Unsupported suppression reason: %', p_reason;
  end if;

  insert into public.email_suppression_list (
    crm_environment,
    recipient_email,
    normalized_recipient_email,
    reason,
    source,
    metadata
  )
  values (
    clean_environment,
    trim(p_recipient_email),
    clean_email,
    p_reason,
    p_source,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (crm_environment, normalized_recipient_email) do update
    set reason = excluded.reason,
        source = coalesce(excluded.source, public.email_suppression_list.source),
        metadata = public.email_suppression_list.metadata || excluded.metadata,
        updated_at = now()
  returning id into suppression_id;

  return suppression_id;
end;
$$
language plpgsql
security definer
set search_path = public;

create or replace function public.email_blocked_sector_reason(
  p_recipient_email text,
  p_context text default ''
)
returns text
as $$
declare
  clean_context text := lower(coalesce(p_recipient_email, '') || ' ' || coalesce(p_context, ''));
begin
  if clean_context ~ '(kancelaria|adwokat|radca|notariusz|komornik|legal|prawn|policja|komenda|prokuratura|s[ąa]d|stra[żz]|szko[łl]a|przedszkole|szpital|uczelnia|uniwersytet|kuratorium|zus|nfz|mops|ops|urz[aą]d|gmina|starostwo|powiat|ministerstwo|inspektorat|jednostka)' then
    return 'blocked_sector';
  end if;

  if lower(coalesce(p_recipient_email, '')) like '%.gov.pl'
    or lower(coalesce(p_recipient_email, '')) like '%@%.gov.pl'
    or lower(coalesce(p_recipient_email, '')) like '%@%.edu.pl'
    or lower(coalesce(p_recipient_email, '')) like '%policja.gov.pl'
    or lower(coalesce(p_recipient_email, '')) like '%prokuratura.gov.pl'
    or lower(coalesce(p_recipient_email, '')) like '%zus.pl'
    or lower(coalesce(p_recipient_email, '')) like '%nfz.gov.pl' then
    return 'blocked_sector';
  end if;

  return null;
end;
$$
language plpgsql
immutable
set search_path = public;

create or replace function public.claim_email_send(
  p_dedupe_key text,
  p_scope text,
  p_recipient_email text,
  p_crm_environment text default 'production',
  p_context text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns table(allowed boolean, lock_id uuid, lock_status text, attempt_count integer)
as $$
declare
  clean_key text := lower(trim(coalesce(p_dedupe_key, '')));
  clean_scope text := lower(trim(coalesce(p_scope, '')));
  clean_email text := lower(trim(coalesce(p_recipient_email, '')));
  clean_environment text := coalesce(nullif(trim(p_crm_environment), ''), 'production');
  block_reason text;
begin
  if clean_key = '' then
    raise exception 'Email send dedupe key is required.';
  end if;

  if clean_scope = '' then
    raise exception 'Email send scope is required.';
  end if;

  if clean_email = '' or position('@' in clean_email) = 0 then
    perform public.suppress_email_recipient(
      coalesce(nullif(trim(p_recipient_email), ''), 'invalid@invalid.local'),
      'invalid_address',
      clean_environment,
      clean_scope,
      p_metadata
    );

    return query select false, null::uuid, 'suppressed'::text, 0;
    return;
  end if;

  if clean_environment not in ('production', 'demo') then
    raise exception 'Unsupported CRM environment: %', clean_environment;
  end if;

  block_reason := public.email_blocked_sector_reason(clean_email, p_context);

  if block_reason is not null then
    perform public.suppress_email_recipient(clean_email, 'blocked_sector', clean_environment, clean_scope, p_metadata);
    return query select false, null::uuid, 'suppressed'::text, 0;
    return;
  end if;

  if exists (
    select 1
    from public.email_suppression_list
    where crm_environment = clean_environment
      and normalized_recipient_email = clean_email
  ) then
    return query select false, null::uuid, 'suppressed'::text, 0;
    return;
  end if;

  return query
  with inserted as (
    insert into public.email_send_locks (
      dedupe_key,
      crm_environment,
      scope,
      recipient_email,
      normalized_recipient_email,
      claimed_by,
      metadata
    )
    values (
      clean_key,
      clean_environment,
      clean_scope,
      trim(p_recipient_email),
      clean_email,
      auth.uid(),
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (dedupe_key) do nothing
    returning true as allowed, id as lock_id, status as lock_status, attempt_count
  ),
  duplicate as (
    update public.email_send_locks
    set attempt_count = public.email_send_locks.attempt_count + 1,
        last_seen_at = now(),
        metadata = public.email_send_locks.metadata
          || jsonb_build_object('last_duplicate_seen_at', now())
          || coalesce(p_metadata, '{}'::jsonb)
    where dedupe_key = clean_key
      and not exists (select 1 from inserted)
    returning false as allowed, id as lock_id, status as lock_status, attempt_count
  )
  select inserted.allowed, inserted.lock_id, inserted.lock_status, inserted.attempt_count from inserted
  union all
  select duplicate.allowed, duplicate.lock_id, duplicate.lock_status, duplicate.attempt_count from duplicate;
end;
$$
language plpgsql
security definer
set search_path = public;

create or replace function public.mark_email_send_status(
  p_dedupe_key text,
  p_status text,
  p_provider_message_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
as $$
declare
  clean_key text := lower(trim(coalesce(p_dedupe_key, '')));
  updated_count integer;
begin
  if clean_key = '' then
    raise exception 'Email send dedupe key is required.';
  end if;

  if p_status not in ('claimed', 'sent', 'failed', 'skipped', 'bounced_invalid', 'suppressed') then
    raise exception 'Unsupported email send status: %', p_status;
  end if;

  update public.email_send_locks
  set status = p_status,
      reason = case
        when p_status = 'bounced_invalid' then 'invalid_address'
        when p_status = 'suppressed' then coalesce(reason, 'manual')
        else reason
      end,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      sent_at = case when p_status = 'sent' and sent_at is null then now() else sent_at end,
      follow_up_eligible_at = case
        when p_status = 'sent' and follow_up_eligible_at is null then now() + interval '7 days'
        else follow_up_eligible_at
      end,
      metadata = public.email_send_locks.metadata || coalesce(p_metadata, '{}'::jsonb),
      last_seen_at = now()
  where dedupe_key = clean_key;

  get diagnostics updated_count = row_count;

  if p_status = 'bounced_invalid' and updated_count > 0 then
    perform public.suppress_email_recipient(
      recipient_email,
      'invalid_address',
      crm_environment,
      'bounce',
      coalesce(p_metadata, '{}'::jsonb)
    )
    from public.email_send_locks
    where dedupe_key = clean_key;
  end if;

  return updated_count > 0;
end;
$$
language plpgsql
security definer
set search_path = public;

create table if not exists public.offer_deliveries (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text,
  lead_id uuid references public.leads(id) on delete cascade,
  customer_id uuid,
  campaign_key text,
  template_key text,
  sent_by uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  normalized_recipient_email text not null,
  status text not null default 'queued' check (
    status in ('draft', 'queued', 'sent', 'opened', 'clicked', 'downloaded', 'failed', 'bounced_invalid', 'suppressed')
  ),
  public_token text not null default encode(gen_random_bytes(18), 'hex'),
  provider_message_id text,
  failure_reason text,
  crm_environment text not null default 'production' check (crm_environment in ('production', 'demo')),
  sent_at timestamptz,
  follow_up_eligible_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.normalize_offer_delivery()
returns trigger
as $$
declare
  target_key text;
begin
  new.normalized_recipient_email := lower(trim(coalesce(new.recipient_email, '')));

  if new.normalized_recipient_email = '' or position('@' in new.normalized_recipient_email) = 0 then
    new.status := 'suppressed';
    new.failure_reason := coalesce(new.failure_reason, 'invalid_address');
  end if;

  if public.email_blocked_sector_reason(new.normalized_recipient_email, coalesce(new.campaign_key, '') || ' ' || coalesce(new.template_key, '')) is not null then
    new.status := 'suppressed';
    new.failure_reason := coalesce(new.failure_reason, 'blocked_sector');
  end if;

  target_key := case
    when new.lead_id is not null then 'lead:' || new.lead_id::text
    when new.customer_id is not null then 'customer:' || new.customer_id::text
    else 'campaign:' || coalesce(nullif(lower(trim(new.campaign_key)), ''), 'none')
  end;

  if nullif(trim(coalesce(new.dedupe_key, '')), '') is null then
    new.dedupe_key := concat_ws(
      '|',
      'offer-delivery',
      'env:' || coalesce(new.crm_environment, 'production'),
      'recipient:' || new.normalized_recipient_email,
      target_key,
      'campaign:' || coalesce(nullif(lower(trim(new.campaign_key)), ''), 'none'),
      'template:' || coalesce(nullif(lower(trim(new.template_key)), ''), 'none')
    );
  else
    new.dedupe_key := lower(trim(new.dedupe_key));
  end if;

  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;

  if new.status = 'sent' and new.follow_up_eligible_at is null then
    new.follow_up_eligible_at := coalesce(new.sent_at, now()) + interval '7 days';
  end if;

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;

drop trigger if exists offer_deliveries_normalize on public.offer_deliveries;
create trigger offer_deliveries_normalize
  before insert or update on public.offer_deliveries
  for each row execute function public.normalize_offer_delivery();

drop trigger if exists offer_deliveries_set_updated_at on public.offer_deliveries;
create trigger offer_deliveries_set_updated_at
  before update on public.offer_deliveries
  for each row execute function public.set_lead_updated_at();

create unique index if not exists offer_deliveries_public_token_idx
  on public.offer_deliveries(public_token);
create unique index if not exists offer_deliveries_dedupe_active_idx
  on public.offer_deliveries(dedupe_key)
  where dedupe_key is not null and status <> 'failed';
create index if not exists offer_deliveries_recipient_idx
  on public.offer_deliveries(crm_environment, normalized_recipient_email, created_at desc);
create index if not exists offer_deliveries_follow_up_idx
  on public.offer_deliveries(follow_up_eligible_at)
  where status in ('sent', 'opened', 'clicked', 'downloaded') and follow_up_eligible_at is not null;

alter table public.offer_deliveries enable row level security;

drop policy if exists offer_deliveries_select_owner_or_admin on public.offer_deliveries;
create policy offer_deliveries_select_owner_or_admin
  on public.offer_deliveries
  for select
  to authenticated
  using (public.is_admin() or sent_by = auth.uid());

drop policy if exists offer_deliveries_insert_owner_or_admin on public.offer_deliveries;
create policy offer_deliveries_insert_owner_or_admin
  on public.offer_deliveries
  for insert
  to authenticated
  with check (public.is_admin() or sent_by = auth.uid());
