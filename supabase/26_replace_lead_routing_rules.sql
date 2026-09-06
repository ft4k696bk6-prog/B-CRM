create or replace function public.replace_lead_routing_rules(
  p_environment text,
  p_voivodeship text,
  p_assignments jsonb,
  p_created_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  region_key text;
  item jsonb;
  profile_uuid uuid;
  rule_weight integer;
  position_index integer := 0;
begin
  region_key := public.normalize_voivodeship_key(p_voivodeship);
  if region_key = '' then
    raise exception 'Niepoprawne województwo.';
  end if;

  delete from public.lead_routing_rules
  where crm_environment = p_environment
    and voivodeship_key = region_key;

  for item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb))
  loop
    profile_uuid := (item->>'profileId')::uuid;
    rule_weight := (item->>'weight')::integer;

    insert into public.lead_routing_rules (
      crm_environment,
      voivodeship,
      profile_id,
      weight,
      sort_order,
      is_active,
      created_by,
      updated_at
    ) values (
      p_environment,
      p_voivodeship,
      profile_uuid,
      rule_weight,
      position_index,
      true,
      p_created_by,
      now()
    );

    position_index := position_index + 1;
  end loop;

  insert into public.lead_routing_state (crm_environment, voivodeship_key, counter, updated_at)
  values (p_environment, region_key, 0, now())
  on conflict (crm_environment, voivodeship_key)
  do update set counter = 0, updated_at = now();
end;
$$;

revoke all on function public.replace_lead_routing_rules(text,text,jsonb,uuid) from public;
revoke all on function public.replace_lead_routing_rules(text,text,jsonb,uuid) from anon;
revoke all on function public.replace_lead_routing_rules(text,text,jsonb,uuid) from authenticated;
grant execute on function public.replace_lead_routing_rules(text,text,jsonb,uuid) to service_role;
