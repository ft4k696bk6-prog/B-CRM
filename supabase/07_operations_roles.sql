-- Adds post-contract operational roles used by the realization workflow.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in ('owner', 'admin', 'handlowiec', 'menadzer', 'finance', 'viewer', 'ksiegowosc', 'logistyk', 'monter', 'sales', 'manager')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := 'handlowiec';
begin
  if new.raw_user_meta_data ->> 'role' in (
    'admin',
    'handlowiec',
    'menadzer',
    'owner',
    'finance',
    'viewer',
    'ksiegowosc',
    'logistyk',
    'monter',
    'sales',
    'manager'
  ) then
    requested_role := new.raw_user_meta_data ->> 'role';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    requested_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;

  return new;
end;
$$;
