alter table public.leads
  add column if not exists source_before_resubmission text;

create or replace function public.clear_form_resubmission_pending_on_activity()
returns trigger
language plpgsql
as $$
begin
  if new.activity_type <> 'form_resubmitted' then
    update public.leads
    set form_resubmission_pending = false,
        source = coalesce(source_before_resubmission, source),
        source_before_resubmission = null
    where id = new.lead_id
      and form_resubmission_pending = true;
  end if;
  return new;
end;
$$;
