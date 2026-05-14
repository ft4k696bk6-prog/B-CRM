create or replace function public.set_lead_updated_at()
returns trigger
as $$
begin
  new.updated_at := now();
  return new;
end;
$$
language plpgsql;

create or replace function public.insert_lead_history(
  p_lead_id uuid,
  p_action_type text,
  p_description text,
  p_old_value jsonb default null,
  p_new_value jsonb default null
)
returns void
as $$
begin
  insert into public.lead_history (
    lead_id,
    user_id,
    action_type,
    description,
    old_value,
    new_value
  )
  values (
    p_lead_id,
    auth.uid(),
    p_action_type,
    p_description,
    p_old_value,
    p_new_value
  );
end;
$$
language plpgsql
security definer
set search_path = public;

create or replace function public.log_lead_insert()
returns trigger
as $$
begin
  perform public.insert_lead_history(
    new.id,
    'lead_created',
    'Lead dodany do bazy.',
    null,
    to_jsonb(new)
  );

  return new;
end;
$$
language plpgsql
security definer
set search_path = public;
