-- A genuine new form submission from a client who previously resigned should
-- reopen the existing record instead of creating a duplicate or leaving it closed.
create or replace function public.reactivate_resigned_lead_on_form_resubmission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  historical boolean := false;
begin
  if new.activity_type <> 'form_resubmitted' then
    return new;
  end if;

  historical := coalesce((new.metadata ->> 'historical_backfill')::boolean, false);
  if historical then
    return new;
  end if;

  update public.leads
  set status = 'Nowy',
      assigned_to = null,
      assigned_at = null,
      callback_at = null,
      meeting_at = null,
      meeting_address = null,
      meeting_note = null,
      resignation_reason = null,
      contract_number = null,
      is_cold_pool = false,
      last_opened_at = null,
      attention_at = greatest(coalesce(attention_at, new.created_at), new.created_at)
  where id = new.lead_id
    and status = 'Rezygnacja';

  return new;
end;
$$;

drop trigger if exists trg_reactivate_resigned_lead_on_form_resubmission on public.lead_activities;
create trigger trg_reactivate_resigned_lead_on_form_resubmission
after insert on public.lead_activities
for each row
execute function public.reactivate_resigned_lead_on_form_resubmission();
