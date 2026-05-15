-- Create comprehensive activity log table with file uploads support
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  user_id uuid,
  activity_type text not null,
  title text not null,
  description text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint lead_activities_lead_id_fkey
    foreign key (lead_id)
    references public.leads(id)
    on delete cascade,
  constraint lead_activities_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete set null,
  constraint lead_activities_activity_type_check check (activity_type in (
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
    'lead_created'
  ))
);

-- Create file uploads table
create table if not exists public.lead_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  uploaded_by uuid,
  file_name text not null,
  file_path text not null,
  file_size integer,
  mime_type text,
  description text,
  created_at timestamptz not null default now(),
  constraint lead_files_lead_id_fkey
    foreign key (lead_id)
    references public.leads(id)
    on delete cascade,
  constraint lead_files_uploaded_by_fkey
    foreign key (uploaded_by)
    references public.profiles(id)
    on delete set null
);

-- Create reminders/alerts table
create table if not exists public.lead_reminders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  created_by uuid,
  reminder_type text not null,
  title text not null,
  description text,
  reminder_at timestamptz not null,
  is_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lead_reminders_lead_id_fkey
    foreign key (lead_id)
    references public.leads(id)
    on delete cascade,
  constraint lead_reminders_created_by_fkey
    foreign key (created_by)
    references public.profiles(id)
    on delete set null,
  constraint lead_reminders_type_check check (reminder_type in (
    'callback',
    'meeting',
    'followup',
    'custom'
  ))
);

-- Create daily activity reports table
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  report_date date not null,
  total_leads_worked integer default 0,
  total_activities integer default 0,
  calls_made integer default 0,
  meetings_scheduled integer default 0,
  contracts_signed integer default 0,
  resignations_recorded integer default 0,
  summary text,
  created_at timestamptz not null default now(),
  constraint daily_reports_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete cascade,
  constraint daily_reports_unique_user_date unique (user_id, report_date)
);

-- Update profiles table to add manager role
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'sales', 'manager'));

-- Create indexes for performance
create index if not exists lead_activities_lead_id_idx on public.lead_activities(lead_id, created_at desc);
create index if not exists lead_activities_user_id_idx on public.lead_activities(user_id);
create index if not exists lead_activities_activity_type_idx on public.lead_activities(activity_type);
create index if not exists lead_files_lead_id_idx on public.lead_files(lead_id);
create index if not exists lead_reminders_lead_id_idx on public.lead_reminders(lead_id);
create index if not exists lead_reminders_reminder_at_idx on public.lead_reminders(reminder_at);
create index if not exists lead_reminders_is_completed_idx on public.lead_reminders(is_completed);
create index if not exists daily_reports_user_date_idx on public.daily_reports(user_id, report_date desc);

-- Function to log activity automatically
create or replace function public.log_lead_activity(
  p_lead_id uuid,
  p_user_id uuid,
  p_activity_type text,
  p_title text,
  p_description text default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
begin
  insert into public.lead_activities (
    lead_id,
    user_id,
    activity_type,
    title,
    description,
    old_value,
    new_value,
    metadata
  ) values (
    p_lead_id,
    p_user_id,
    p_activity_type,
    p_title,
    p_description,
    p_old_value,
    p_new_value,
    p_metadata
  )
  returning id into v_activity_id;
  
  return v_activity_id;
end;
$$;

-- Enable RLS
alter table public.lead_activities enable row level security;
alter table public.lead_files enable row level security;
alter table public.lead_reminders enable row level security;
alter table public.daily_reports enable row level security;

-- RLS Policies for lead_activities
create policy "Users can view activities for their leads" on public.lead_activities
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin())
  );

create policy "Users can create activities for their leads" on public.lead_activities
  for insert with check (
    user_id = auth.uid()
    and (
      (select assigned_to from public.leads where id = lead_id) = auth.uid()
      or (select public.is_admin())
    )
  );

-- RLS Policies for lead_files
create policy "Users can view files for their leads" on public.lead_files
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin())
  );

create policy "Users can upload files to their leads" on public.lead_files
  for insert with check (
    uploaded_by = auth.uid()
    and (
      (select assigned_to from public.leads where id = lead_id) = auth.uid()
      or (select public.is_admin())
    )
  );

-- RLS Policies for lead_reminders
create policy "Users can view reminders for their leads" on public.lead_reminders
  for select using (
    (select assigned_to from public.leads where id = lead_id) = auth.uid()
    or (select public.is_admin())
  );

create policy "Users can create reminders for their leads" on public.lead_reminders
  for insert with check (
    created_by = auth.uid()
    and (
      (select assigned_to from public.leads where id = lead_id) = auth.uid()
      or (select public.is_admin())
    )
  );

-- RLS Policies for daily_reports
create policy "Users can view own reports" on public.daily_reports
  for select using (
    user_id = auth.uid()
    or (select public.is_admin())
  );

create policy "Users can create own reports" on public.daily_reports
  for insert with check (
    user_id = auth.uid()
  );
