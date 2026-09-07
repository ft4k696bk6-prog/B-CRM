create or replace function public.assign_lead_by_voivodeship()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  region_key text;
  total_weight integer;
  route_counter bigint;
  slot integer;
  selected_profile uuid;
begin
  if new.assigned_to is not null or new.voivodeship is null or btrim(new.voivodeship) = '' then
    return new;
  end if;

  region_key := public.normalize_voivodeship_key(new.voivodeship);
  if region_key = '' then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.crm_environment || ':routing:' || region_key));

  select coalesce(sum(r.weight), 0)::integer into total_weight
  from public.lead_routing_rules r
  join public.profiles p on p.id = r.profile_id
  where r.crm_environment = new.crm_environment
    and r.voivodeship_key = region_key
    and r.is_active = true
    and p.crm_environment = new.crm_environment
    and p.role in ('sales', 'handlowiec', 'manager', 'menadzer');

  if total_weight <= 0 then return new; end if;

  insert into public.lead_routing_state (crm_environment, voivodeship_key, counter)
  values (new.crm_environment, region_key, 0)
  on conflict (crm_environment, voivodeship_key) do nothing;

  select s.counter into route_counter
  from public.lead_routing_state s
  where s.crm_environment = new.crm_environment
    and s.voivodeship_key = region_key
  for update;

  slot := mod(route_counter, total_weight)::integer;

  select routed.profile_id into selected_profile
  from (
    select r.profile_id,
      sum(r.weight) over (order by r.sort_order, r.profile_id) as cumulative_weight
    from public.lead_routing_rules r
    join public.profiles p on p.id = r.profile_id
    where r.crm_environment = new.crm_environment
      and r.voivodeship_key = region_key
      and r.is_active = true
      and p.crm_environment = new.crm_environment
      and p.role in ('sales', 'handlowiec', 'manager', 'menadzer')
  ) routed
  where slot < routed.cumulative_weight
  order by routed.cumulative_weight
  limit 1;

  if selected_profile is not null then
    new.assigned_to := selected_profile;
    update public.lead_routing_state
      set counter = route_counter + 1, updated_at = now()
      where crm_environment = new.crm_environment
        and voivodeship_key = region_key;
  end if;

  return new;
end;
$function$;
