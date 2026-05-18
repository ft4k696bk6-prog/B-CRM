-- Optional demo accounts for Supabase Auth.
-- Login aliases in the UI map to these emails:
-- demo / demo-admin -> demo@example.com
-- demo-menadzer / demo-menadzer -> demo-menadzer@example.com
-- demo-handlowiec / demo-handlowiec -> demo-handlowiec@example.com
-- demo-ksiegowy / demo-ksiegowy -> demo-ksiegowy@example.com
-- demo-logistyk / demo-logistyk -> demo-logistyk@example.com
-- demo-monter / demo-monter -> demo-monter@example.com
--
-- Run only in demo/staging projects, not on a production database with real users.

create extension if not exists pgcrypto;

with demo_users(id, email, password, full_name, role) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'demo-admin', 'Demo Admin', 'admin'),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'demo-menadzer', 'Demo Menadżer', 'menadzer'),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'demo-handlowiec', 'Demo Handlowiec', 'handlowiec'),
    ('00000000-0000-0000-0000-00000000a004'::uuid, 'demo-ksiegowy@example.com', 'demo-ksiegowy', 'Demo Księgowy', 'ksiegowosc'),
    ('00000000-0000-0000-0000-00000000a005'::uuid, 'demo-logistyk@example.com', 'demo-logistyk', 'Demo Logistyk', 'logistyk'),
    ('00000000-0000-0000-0000-00000000a006'::uuid, 'demo-monter@example.com', 'demo-monter', 'Demo Monter', 'monter')
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
  crypt(password, gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', role, 'crm_environment', 'demo'),
  jsonb_build_object('full_name', full_name, 'role', role, 'crm_environment', 'demo'),
  now(),
  now()
from demo_users
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

with demo_users(id, email, full_name, role) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'Demo Admin', 'admin'),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'Demo Menadżer', 'menadzer'),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'Demo Handlowiec', 'handlowiec'),
    ('00000000-0000-0000-0000-00000000a004'::uuid, 'demo-ksiegowy@example.com', 'Demo Księgowy', 'ksiegowosc'),
    ('00000000-0000-0000-0000-00000000a005'::uuid, 'demo-logistyk@example.com', 'Demo Logistyk', 'logistyk'),
    ('00000000-0000-0000-0000-00000000a006'::uuid, 'demo-monter@example.com', 'Demo Monter', 'monter')
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

with demo_users(id, email, full_name, role, manager_id) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'Demo Admin', 'admin', null::uuid),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'Demo Menadżer', 'menadzer', null::uuid),
    (
      '00000000-0000-0000-0000-00000000a002'::uuid,
      'demo-handlowiec@example.com',
      'Demo Handlowiec',
      'handlowiec',
      '00000000-0000-0000-0000-00000000a003'::uuid
    ),
    ('00000000-0000-0000-0000-00000000a004'::uuid, 'demo-ksiegowy@example.com', 'Demo Księgowy', 'ksiegowosc', null::uuid),
    ('00000000-0000-0000-0000-00000000a005'::uuid, 'demo-logistyk@example.com', 'Demo Logistyk', 'logistyk', null::uuid),
    ('00000000-0000-0000-0000-00000000a006'::uuid, 'demo-monter@example.com', 'Demo Monter', 'monter', null::uuid)
)
insert into public.profiles (id, email, full_name, role, manager_id, crm_environment)
select id, email, full_name, role, manager_id, 'demo'
from demo_users
on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      manager_id = excluded.manager_id,
      crm_environment = excluded.crm_environment;

insert into public.leads (
  id,
  full_name,
  phone,
  postal_code,
  address,
  voivodeship,
  county,
  status,
  assigned_to,
  source,
  callback_at,
  meeting_at,
  meeting_address,
  contract_number,
  crm_environment
)
values
  (
    '00000000-0000-0000-0000-00000000b001'::uuid,
    'Demo Klient - umowa',
    '+48 500 100 100',
    '20-001',
    'Lublin, ul. Energetyczna 12',
    'lubelskie',
    'lubelski',
    'Umowa',
    '00000000-0000-0000-0000-00000000a002'::uuid,
    'B2C',
    null,
    date_trunc('day', now()) + interval '11 hours',
    'Lublin, ul. Energetyczna 12',
    'DEMO/2026/001',
    'demo'
  ),
  (
    '00000000-0000-0000-0000-00000000b002'::uuid,
    'Demo Klient - call-back',
    '+48 500 200 200',
    '21-500',
    null,
    'lubelskie',
    'bialski',
    'Call back',
    '00000000-0000-0000-0000-00000000a002'::uuid,
    'B2B',
    now() + interval '2 hours',
    null,
    null,
    null,
    'demo'
  ),
  (
    '00000000-0000-0000-0000-00000000b003'::uuid,
    'Demo Klient - spotkanie',
    '+48 500 300 300',
    '22-400',
    'Zamość, ul. Testowa 4',
    'lubelskie',
    'zamojski',
    'Spotkanie',
    '00000000-0000-0000-0000-00000000a002'::uuid,
    'polecenie',
    null,
    date_trunc('day', now()) + interval '15 hours',
    'Zamość, ul. Testowa 4',
    null,
    'demo'
  )
on conflict (id) do update
  set full_name = excluded.full_name,
      phone = excluded.phone,
      postal_code = excluded.postal_code,
      address = excluded.address,
      voivodeship = excluded.voivodeship,
      county = excluded.county,
      status = excluded.status,
      assigned_to = excluded.assigned_to,
      source = excluded.source,
      callback_at = excluded.callback_at,
      meeting_at = excluded.meeting_at,
      meeting_address = excluded.meeting_address,
      contract_number = excluded.contract_number,
      crm_environment = excluded.crm_environment;
