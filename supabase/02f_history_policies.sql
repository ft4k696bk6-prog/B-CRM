drop policy if exists "lead_history_select_owner_or_admin" on public.lead_history;
create policy "lead_history_select_owner_or_admin"
  on public.lead_history
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads
      where leads.id = lead_history.lead_id
        and leads.assigned_to = auth.uid()
    )
  );

drop policy if exists "lead_history_insert_comment" on public.lead_history;
create policy "lead_history_insert_comment"
  on public.lead_history
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and action_type = 'comment'
    and (
      public.is_admin()
      or exists (
        select 1 from public.leads
        where leads.id = lead_history.lead_id
          and leads.assigned_to = auth.uid()
      )
    )
  );
