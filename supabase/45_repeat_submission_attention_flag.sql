alter table public.leads
  add column if not exists form_resubmission_pending boolean not null default false;

create index if not exists idx_leads_pending_resubmission_attention
  on public.leads (crm_environment, attention_at desc)
  where form_resubmission_pending = true;

create or replace function public.clear_form_resubmission_pending_on_activity()
returns trigger
language plpgsql
as $$
begin
  if new.activity_type <> 'form_resubmitted' then
    update public.leads
    set form_resubmission_pending = false
    where id = new.lead_id
      and form_resubmission_pending = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_form_resubmission_pending_on_activity on public.lead_activities;
create trigger trg_clear_form_resubmission_pending_on_activity
after insert on public.lead_activities
for each row
execute function public.clear_form_resubmission_pending_on_activity();
