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
