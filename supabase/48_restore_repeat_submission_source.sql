update public.leads
set source = source_before_resubmission,
    source_before_resubmission = null
where source = 'Ponowne zgłoszenie'
  and source_before_resubmission is not null;

create or replace function public.clear_form_resubmission_pending_on_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.activity_type <> 'form_resubmitted' then
    update public.leads
    set form_resubmission_pending = false,
        source_before_resubmission = null
    where id = new.lead_id
      and form_resubmission_pending = true;
  end if;
  return new;
end;
$$;
