alter table public.leads
  add column if not exists last_form_submission_at timestamptz,
  add column if not exists form_submission_count integer not null default 0,
  add column if not exists attention_at timestamptz;

update public.leads
set attention_at = coalesce(assigned_at, created_at, now())
where attention_at is null;

alter table public.leads
  alter column attention_at set default now(),
  alter column attention_at set not null;

alter table public.leads
  drop constraint if exists leads_form_submission_count_check;

alter table public.leads
  add constraint leads_form_submission_count_check check (form_submission_count >= 0);

alter table public.lead_activities
  drop constraint if exists lead_activities_activity_type_check;

alter table public.lead_activities
  add constraint lead_activities_activity_type_check check (
    activity_type = any (array[
      'comment'::text,
      'status_change'::text,
      'callback_scheduled'::text,
      'meeting_scheduled'::text,
      'meeting_address_changed'::text,
      'contract_number_set'::text,
      'resignation_recorded'::text,
      'file_uploaded'::text,
      'file_deleted'::text,
      'assigned'::text,
      'unassigned'::text,
      'lead_created'::text,
      'call_logged'::text,
      'call_transcript'::text,
      'ai_call_summary'::text,
      'form_resubmitted'::text
    ])
  );

create index if not exists idx_leads_crm_attention_at
  on public.leads (crm_environment, attention_at desc);

create index if not exists idx_leads_crm_last_form_submission_at
  on public.leads (crm_environment, last_form_submission_at desc)
  where last_form_submission_at is not null;
