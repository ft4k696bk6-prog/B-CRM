-- Keep cold-base identity private to the CRM owner only.
drop policy if exists leads_select_owner_or_admin on public.leads;

create policy leads_select_owner_or_admin
on public.leads
for select
to authenticated
using (
  public.can_access_crm_environment(crm_environment)
  and public.can_view_lead(assigned_to)
  and (public.is_owner() or not is_cold_pool)
);
