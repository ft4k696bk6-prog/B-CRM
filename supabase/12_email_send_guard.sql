-- Email send idempotency and targeting guardrails.
-- Bots must claim a dedupe key before sending; duplicate claims are rejected atomically.

create extension if not exists "pgcrypto";

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
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
    )
  );

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
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
  );

do $$
begin
  if to_regclass('public.calendar_events') is not null then
    alter table public.calendar_events
      drop constraint if exists calendar_events_owner_role_check;

    alter table public.calendar_events
      add constraint calendar_events_owner_role_check check (
        owner_role in (
          'owner',
          'admin',
          'kierownik',
          'menadzer',
          'handlowiec',
          'finance',
          'viewer',
          'ksiegowosc',
          'logistyk',
          'monter'
        )
      );
  end if;
end $$;

create or replace function public.is_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('kierownik', 'menadzer', 'manager');
$$
language sql
stable
security definer
set search_path = public;

create or replace function public.is_admin_or_menadzer()
returns boolean
as $$
  select public.current_user_role() in ('owner', 'admin', 'kierownik', 'menadzer', 'manager');
$$
language sql
stable
security definer
set search_path = public;

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

alter table public.offer_deliveries
  add column if not exists dedupe_key text,
  add column if not exists campaign_key text,
  add column if not exists template_key text,
  add column if not exists normalized_recipient_email text,
  add column if not exists provider_message_id text,
  add column if not exists failure_reason text,
  add column if not exists sent_at timestamptz,
  add column if not exists follow_up_eligible_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

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
