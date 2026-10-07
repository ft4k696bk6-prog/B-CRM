-- The repeat-submission function is trigger-only. Do not expose it as an RPC.
revoke all on function public.reactivate_resigned_lead_on_form_resubmission() from public, anon, authenticated;

-- Cover the new audit reference used by workflow settings.
create index if not exists crm_workflow_settings_updated_by_idx
  on public.crm_workflow_settings(updated_by)
  where updated_by is not null;
