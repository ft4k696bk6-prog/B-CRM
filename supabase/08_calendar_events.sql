create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  owner_id uuid references public.profiles(id) on delete cascade,
  owner_role text not null check (owner_role in ('owner', 'admin', 'menadzer', 'handlowiec', 'finance', 'viewer', 'ksiegowosc', 'logistyk', 'monter')),
  visibility text not null default 'private' check (visibility in ('private', 'department', 'internal')),
  participant_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select
on public.calendar_events
for select
using (
  public.current_user_role() in ('owner', 'admin')
  or owner_id = auth.uid()
  or auth.uid() = any(participant_ids)
  or (
    public.current_user_role() = 'menadzer'
    and (
      owner_id in (select id from public.profiles where manager_id = auth.uid())
      or owner_id = auth.uid()
      or auth.uid() = any(participant_ids)
    )
  )
);

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert
on public.calendar_events
for insert
with check (
  owner_id = auth.uid()
  or public.current_user_role() in ('owner', 'admin', 'menadzer')
);

drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update
on public.calendar_events
for update
using (
  owner_id = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('owner', 'admin')
)
with check (
  owner_id = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('owner', 'admin')
);
