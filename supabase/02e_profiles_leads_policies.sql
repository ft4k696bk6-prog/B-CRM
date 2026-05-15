drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "leads_select_owner_or_admin" on public.leads;
create policy "leads_select_owner_or_admin"
  on public.leads
  for select
  to authenticated
  using (public.is_admin() or assigned_to = auth.uid());

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin"
  on public.leads
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "leads_insert_sales_manual" on public.leads;
create policy "leads_insert_sales_manual"
  on public.leads
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      assigned_to = auth.uid()
      and source in ('własne', 'polecenie')
      and status in ('Nowy', 'Przypisany')
    )
  );

drop policy if exists "leads_update_owner_or_admin" on public.leads;
create policy "leads_update_owner_or_admin"
  on public.leads
  for update
  to authenticated
  using (public.is_admin() or assigned_to = auth.uid())
  with check (
    public.is_admin()
    or assigned_to = auth.uid()
    or (assigned_to is null and status = 'Zwrot')
  );

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin"
  on public.leads
  for delete
  to authenticated
  using (public.is_admin());
