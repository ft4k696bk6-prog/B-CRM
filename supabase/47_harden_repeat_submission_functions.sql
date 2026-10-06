create or replace function public.prevent_duplicate_lead_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone_key is null or btrim(new.phone_key) = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.leads existing
    where existing.crm_environment = new.crm_environment
      and existing.phone_key = new.phone_key
  ) then
    raise exception 'Lead z tym numerem telefonu już istnieje w tym środowisku CRM.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function public.clear_form_resubmission_pending_on_activity()
returns trigger
language plpgsql
set search_path = public
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
