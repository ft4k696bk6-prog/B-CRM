-- Real click-to-call bridge, call history and AI notes.
-- Keeps demo and production separated through crm_environment.

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

update public.profiles
set business_phone = case lower(coalesce(email, ''))
  when 'demo@example.com' then '+48600100100'
  when 'demo-menadzer@example.com' then '+48600100101'
  when 'demo-handlowiec@example.com' then '+48600100102'
  when 'demo-ksiegowy@example.com' then '+48600100103'
  when 'demo-logistyk@example.com' then '+48600100104'
  when 'demo-monter@example.com' then '+48600100105'
  else business_phone
end
where crm_environment = 'demo';
