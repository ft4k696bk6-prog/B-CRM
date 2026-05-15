-- Optional demo accounts for Supabase Auth.
-- Login aliases in the UI map to these emails:
-- demo / demo -> demo@example.com
-- demo-handlowiec / demo -> demo-handlowiec@example.com
-- demo-menadzer / demo -> demo-menadzer@example.com
--
-- Run only in demo/staging projects, not on a production database with real users.

create extension if not exists pgcrypto;

with demo_users(id, email, full_name, role) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'Demo Admin', 'admin'),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'Demo Handlowiec', 'handlowiec'),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'Demo Menadżer', 'menadzer')
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('demo', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'role', role),
  now(),
  now()
from demo_users
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

with demo_users(id, email, full_name, role) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'Demo Admin', 'admin'),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'Demo Handlowiec', 'handlowiec'),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'Demo Menadżer', 'menadzer')
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  id,
  id::text,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from demo_users
on conflict (provider, provider_id) do update
  set identity_data = excluded.identity_data,
      updated_at = now();

with demo_users(id, email, full_name, role) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'Demo Admin', 'admin'),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'Demo Handlowiec', 'handlowiec'),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'Demo Menadżer', 'menadzer')
)
insert into public.profiles (id, email, full_name, role)
select id, email, full_name, role
from demo_users
on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role;
