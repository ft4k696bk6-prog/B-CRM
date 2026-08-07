-- Indeksy odpowiadające najczęstszym widokom CRM. Wszystkie polecenia są
-- idempotentne i mogą być bezpiecznie uruchomione ponownie.
create index if not exists leads_environment_assignee_created_idx
  on public.leads (crm_environment, assigned_to, created_at desc);

create index if not exists leads_environment_status_created_idx
  on public.leads (crm_environment, status, created_at desc);

create index if not exists leads_environment_callback_idx
  on public.leads (crm_environment, assigned_to, callback_at)
  where callback_at is not null;

create index if not exists leads_environment_meeting_idx
  on public.leads (crm_environment, assigned_to, meeting_at)
  where meeting_at is not null;

create index if not exists contracts_environment_installation_idx
  on public.contracts (crm_environment, installation_at)
  where installation_at is not null;

create index if not exists contracts_environment_creator_updated_idx
  on public.contracts (crm_environment, created_by, updated_at desc);
