begin;

-- Row-level policies decide which profiles a user may see. Column privileges
-- additionally prevent salespeople and managers from reading internal margins.
revoke select on table public.profiles from authenticated;
grant select (
  id,
  email,
  full_name,
  role,
  manager_id,
  crm_environment,
  created_at,
  business_phone,
  can_view_lead_pool
) on table public.profiles to authenticated;

commit;
