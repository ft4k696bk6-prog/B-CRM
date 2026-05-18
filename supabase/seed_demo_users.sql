-- Idempotent demo seed for B-CRM.
-- It creates only crm_environment = 'demo' records and does not touch production data.
-- Existing deterministic IDs are updated, so the script can be run repeatedly.
-- Some demo-only corporate titles are resolved in the app by e-mail, while the stored
-- role remains compatible with older demo databases that store admin/manager/sales.

create extension if not exists pgcrypto;

with demo_users(id, email, password, full_name, role, manager_id) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com', 'demo-admin', 'Demo Admin', 'admin', null::uuid),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'demo-handlowiec', 'Piotr Zieliński', 'sales', '00000000-0000-0000-0000-00000000a003'::uuid),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'demo-menadzer', 'Magdalena Wójcik', 'manager', '00000000-0000-0000-0000-00000000a008'::uuid),
    ('00000000-0000-0000-0000-00000000a004'::uuid, 'demo-ksiegowy@example.com', 'demo-ksiegowy', 'Ewa Mazur', 'admin', '00000000-0000-0000-0000-00000000a016'::uuid),
    ('00000000-0000-0000-0000-00000000a005'::uuid, 'demo-logistyk@example.com', 'demo-logistyk', 'Tomasz Krawczyk', 'admin', '00000000-0000-0000-0000-00000000a016'::uuid),
    ('00000000-0000-0000-0000-00000000a006'::uuid, 'demo-monter@example.com', 'demo-monter', 'Marek Lewandowski', 'admin', '00000000-0000-0000-0000-00000000a005'::uuid),
    ('00000000-0000-0000-0000-00000000a007'::uuid, 'demo-owner@example.com', 'demo-2026', 'Katarzyna Biernacka', 'admin', null::uuid),
    ('00000000-0000-0000-0000-00000000a008'::uuid, 'demo-dyrektor-sprzedazy@example.com', 'demo-2026', 'Michał Sadowski', 'manager', '00000000-0000-0000-0000-00000000a007'::uuid),
    ('00000000-0000-0000-0000-00000000a009'::uuid, 'demo-regionalny-wschod@example.com', 'demo-2026', 'Anna Kozłowska', 'manager', '00000000-0000-0000-0000-00000000a008'::uuid),
    ('00000000-0000-0000-0000-00000000a010'::uuid, 'demo-kierownik-b2b@example.com', 'demo-2026', 'Robert Cieślak', 'manager', '00000000-0000-0000-0000-00000000a009'::uuid),
    ('00000000-0000-0000-0000-00000000a011'::uuid, 'demo-kierownik-b2c@example.com', 'demo-2026', 'Natalia Lis', 'manager', '00000000-0000-0000-0000-00000000a009'::uuid),
    ('00000000-0000-0000-0000-00000000a012'::uuid, 'demo-handlowiec-b2b@example.com', 'demo-2026', 'Grzegorz Kamiński', 'sales', '00000000-0000-0000-0000-00000000a010'::uuid),
    ('00000000-0000-0000-0000-00000000a013'::uuid, 'demo-handlowiec-b2c@example.com', 'demo-2026', 'Karolina Pawlak', 'sales', '00000000-0000-0000-0000-00000000a011'::uuid),
    ('00000000-0000-0000-0000-00000000a014'::uuid, 'demo-handlowiec-field@example.com', 'demo-2026', 'Adam Król', 'sales', '00000000-0000-0000-0000-00000000a003'::uuid),
    ('00000000-0000-0000-0000-00000000a015'::uuid, 'demo-finanse@example.com', 'demo-2026', 'Joanna Baran', 'admin', '00000000-0000-0000-0000-00000000a016'::uuid),
    ('00000000-0000-0000-0000-00000000a016'::uuid, 'demo-dyrektor-operacyjny@example.com', 'demo-2026', 'Paweł Rutkowski', 'manager', '00000000-0000-0000-0000-00000000a007'::uuid),
    ('00000000-0000-0000-0000-00000000a017'::uuid, 'demo-magazyn@example.com', 'demo-2026', 'Olga Wrona', 'admin', '00000000-0000-0000-0000-00000000a005'::uuid),
    ('00000000-0000-0000-0000-00000000a018'::uuid, 'demo-monter-2@example.com', 'demo-2026', 'Damian Zając', 'admin', '00000000-0000-0000-0000-00000000a005'::uuid),
    ('00000000-0000-0000-0000-00000000a019'::uuid, 'demo-audyt@example.com', 'demo-2026', 'Monika Czerwińska', 'admin', '00000000-0000-0000-0000-00000000a007'::uuid)
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
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

with demo_users(id, email) as (
  values
    ('00000000-0000-0000-0000-00000000a001'::uuid, 'demo@example.com'),
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com'),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com'),
    ('00000000-0000-0000-0000-00000000a004'::uuid, 'demo-ksiegowy@example.com'),
    ('00000000-0000-0000-0000-00000000a005'::uuid, 'demo-logistyk@example.com'),
    ('00000000-0000-0000-0000-00000000a006'::uuid, 'demo-monter@example.com'),
    ('00000000-0000-0000-0000-00000000a007'::uuid, 'demo-owner@example.com'),
    ('00000000-0000-0000-0000-00000000a008'::uuid, 'demo-dyrektor-sprzedazy@example.com'),
    ('00000000-0000-0000-0000-00000000a009'::uuid, 'demo-regionalny-wschod@example.com'),
    ('00000000-0000-0000-0000-00000000a010'::uuid, 'demo-kierownik-b2b@example.com'),
    ('00000000-0000-0000-0000-00000000a011'::uuid, 'demo-kierownik-b2c@example.com'),
    ('00000000-0000-0000-0000-00000000a012'::uuid, 'demo-handlowiec-b2b@example.com'),
    ('00000000-0000-0000-0000-00000000a013'::uuid, 'demo-handlowiec-b2c@example.com'),
    ('00000000-0000-0000-0000-00000000a014'::uuid, 'demo-handlowiec-field@example.com'),
    ('00000000-0000-0000-0000-00000000a015'::uuid, 'demo-finanse@example.com'),
    ('00000000-0000-0000-0000-00000000a016'::uuid, 'demo-dyrektor-operacyjny@example.com'),
    ('00000000-0000-0000-0000-00000000a017'::uuid, 'demo-magazyn@example.com'),
    ('00000000-0000-0000-0000-00000000a018'::uuid, 'demo-monter-2@example.com'),
    ('00000000-0000-0000-0000-00000000a019'::uuid, 'demo-audyt@example.com')
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
    ('00000000-0000-0000-0000-00000000a002'::uuid, 'demo-handlowiec@example.com', 'Piotr Zieliński', 'sales', '00000000-0000-0000-0000-00000000a003'::uuid),
    ('00000000-0000-0000-0000-00000000a003'::uuid, 'demo-menadzer@example.com', 'Magdalena Wójcik', 'manager', '00000000-0000-0000-0000-00000000a008'::uuid),
    ('00000000-0000-0000-0000-00000000a004'::uuid, 'demo-ksiegowy@example.com', 'Ewa Mazur', 'admin', '00000000-0000-0000-0000-00000000a016'::uuid),
    ('00000000-0000-0000-0000-00000000a005'::uuid, 'demo-logistyk@example.com', 'Tomasz Krawczyk', 'admin', '00000000-0000-0000-0000-00000000a016'::uuid),
    ('00000000-0000-0000-0000-00000000a006'::uuid, 'demo-monter@example.com', 'Marek Lewandowski', 'admin', '00000000-0000-0000-0000-00000000a005'::uuid),
    ('00000000-0000-0000-0000-00000000a007'::uuid, 'demo-owner@example.com', 'Katarzyna Biernacka', 'admin', null::uuid),
    ('00000000-0000-0000-0000-00000000a008'::uuid, 'demo-dyrektor-sprzedazy@example.com', 'Michał Sadowski', 'manager', '00000000-0000-0000-0000-00000000a007'::uuid),
    ('00000000-0000-0000-0000-00000000a009'::uuid, 'demo-regionalny-wschod@example.com', 'Anna Kozłowska', 'manager', '00000000-0000-0000-0000-00000000a008'::uuid),
    ('00000000-0000-0000-0000-00000000a010'::uuid, 'demo-kierownik-b2b@example.com', 'Robert Cieślak', 'manager', '00000000-0000-0000-0000-00000000a009'::uuid),
    ('00000000-0000-0000-0000-00000000a011'::uuid, 'demo-kierownik-b2c@example.com', 'Natalia Lis', 'manager', '00000000-0000-0000-0000-00000000a009'::uuid),
    ('00000000-0000-0000-0000-00000000a012'::uuid, 'demo-handlowiec-b2b@example.com', 'Grzegorz Kamiński', 'sales', '00000000-0000-0000-0000-00000000a010'::uuid),
    ('00000000-0000-0000-0000-00000000a013'::uuid, 'demo-handlowiec-b2c@example.com', 'Karolina Pawlak', 'sales', '00000000-0000-0000-0000-00000000a011'::uuid),
    ('00000000-0000-0000-0000-00000000a014'::uuid, 'demo-handlowiec-field@example.com', 'Adam Król', 'sales', '00000000-0000-0000-0000-00000000a003'::uuid),
    ('00000000-0000-0000-0000-00000000a015'::uuid, 'demo-finanse@example.com', 'Joanna Baran', 'admin', '00000000-0000-0000-0000-00000000a016'::uuid),
    ('00000000-0000-0000-0000-00000000a016'::uuid, 'demo-dyrektor-operacyjny@example.com', 'Paweł Rutkowski', 'manager', '00000000-0000-0000-0000-00000000a007'::uuid),
    ('00000000-0000-0000-0000-00000000a017'::uuid, 'demo-magazyn@example.com', 'Olga Wrona', 'admin', '00000000-0000-0000-0000-00000000a005'::uuid),
    ('00000000-0000-0000-0000-00000000a018'::uuid, 'demo-monter-2@example.com', 'Damian Zając', 'admin', '00000000-0000-0000-0000-00000000a005'::uuid),
    ('00000000-0000-0000-0000-00000000a019'::uuid, 'demo-audyt@example.com', 'Monika Czerwińska', 'admin', '00000000-0000-0000-0000-00000000a007'::uuid)
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
  meeting_note,
  contract_number,
  crm_environment,
  created_at,
  updated_at,
  last_opened_at
)
values
  ('00000000-0000-0000-0000-00000000b001'::uuid, 'Jan Kowalski', '+48 600 700 800', '20-001', 'Lublin, ul. Energetyczna 12', 'lubelskie', 'lubelski', 'Umowa', '00000000-0000-0000-0000-00000000a002'::uuid, 'B2C', null, now() + interval '2 days 11 hours', 'Lublin, ul. Energetyczna 12', 'Komplet dokumentów, czeka na weryfikację menadżera.', 'BCRM/05/2026/017', 'demo', now() - interval '8 days', now() - interval '2 hours', now() - interval '45 minutes'),
  ('00000000-0000-0000-0000-00000000b002'::uuid, 'Marta Wiśniewska', '+48 501 220 330', '21-500', 'Rokitno 18', 'lubelskie', 'bialski', 'Umowa', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', null, now() + interval '4 days 9 hours', 'Rokitno 18', 'B2B, potrzebne potwierdzenie finansowania.', 'BCRM/05/2026/018', 'demo', now() - interval '7 days', now() - interval '3 hours', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000b003'::uuid, 'Paweł Rutkowski', '+48 503 118 990', '22-400', 'Sitaniec 42', 'lubelskie', 'zamojski', 'Umowa', '00000000-0000-0000-0000-00000000a013'::uuid, 'polecenie', null, now() + interval '5 days 14 hours', 'Sitaniec 42', 'Umowa podpisana papierowo, zdjęcia dachu w komplecie.', 'BCRM/05/2026/019', 'demo', now() - interval '6 days', now() - interval '4 hours', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000b004'::uuid, 'Agata Zielińska', '+48 508 551 004', '24-100', 'Końskowola, ul. Leśna 7', 'lubelskie', 'puławski', 'Umowa', '00000000-0000-0000-0000-00000000a014'::uuid, 'własne', null, now() + interval '7 days 10 hours', 'Końskowola, ul. Leśna 7', 'Logistyka ma przygotować magazyn pod montaż.', 'BCRM/05/2026/020', 'demo', now() - interval '9 days', now() - interval '6 hours', now() - interval '90 minutes'),
  ('00000000-0000-0000-0000-00000000b005'::uuid, 'GreenPack Sp. z o.o.', '+48 512 300 110', '23-400', 'Biłgoraj, ul. Przemysłowa 5', 'lubelskie', 'biłgorajski', 'Umowa', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', null, now() + interval '9 days 12 hours', 'Biłgoraj, ul. Przemysłowa 5', 'Faktura zaliczkowa gotowa do wystawienia.', 'BCRM/05/2026/021', 'demo', now() - interval '10 days', now() - interval '8 hours', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000b006'::uuid, 'Tomasz Bąk', '+48 515 101 202', '22-100', 'Rejowiec, ul. Kolejowa 9', 'lubelskie', 'chełmski', 'Umowa', '00000000-0000-0000-0000-00000000a002'::uuid, 'B2C', null, now() + interval '11 days 13 hours', 'Rejowiec, ul. Kolejowa 9', 'Aneks do zmiany terminu montażu.', 'BCRM/05/2026/022', 'demo', now() - interval '11 days', now() - interval '9 hours', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-00000000b007'::uuid, 'Anna Stępień', '+48 509 770 660', '21-010', 'Łęczna, ul. Polna 3', 'lubelskie', 'łęczyński', 'Spotkanie', '00000000-0000-0000-0000-00000000a013'::uuid, 'polecenie', null, now() + interval '1 day 16 hours', 'Łęczna, ul. Polna 3', 'Klientka prosi o wariant z magazynem energii.', null, 'demo', now() - interval '3 days', now() - interval '1 hour', now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-00000000b008'::uuid, 'Kamil Domański', '+48 501 333 222', '24-300', 'Opole Lubelskie, ul. Ogrodowa 11', 'lubelskie', 'opolski', 'Spotkanie', '00000000-0000-0000-0000-00000000a014'::uuid, 'B2C', null, now() + interval '2 days 15 hours', 'Opole Lubelskie, ul. Ogrodowa 11', 'Spotkanie po południu, obecna żona klienta.', null, 'demo', now() - interval '5 days', now() - interval '5 hours', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000b009'::uuid, 'Domex Hurtownia', '+48 514 888 010', '21-400', 'Łuków, ul. Handlowa 2', 'lubelskie', 'łukowski', 'Spotkanie', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', null, now() + interval '3 days 10 hours', 'Łuków, ul. Handlowa 2', 'Decyduje zarząd, oferta dla dwóch lokalizacji.', null, 'demo', now() - interval '4 days', now() - interval '7 hours', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000000b010'::uuid, 'Ewelina Krupa', '+48 516 920 100', '22-500', 'Hrubieszów, ul. Wspólna 8', 'lubelskie', 'hrubieszowski', 'Spotkanie', '00000000-0000-0000-0000-00000000a002'::uuid, 'własne', null, now() + interval '4 days 17 hours', 'Hrubieszów, ul. Wspólna 8', 'Klientka chce porównać ratę i gotówkę.', null, 'demo', now() - interval '2 days', now() - interval '30 minutes', now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-00000000b011'::uuid, 'Rafał Sobczak', '+48 502 444 770', '23-300', 'Janów Lubelski, ul. Akacjowa 6', 'lubelskie', 'janowski', 'Call back', '00000000-0000-0000-0000-00000000a013'::uuid, 'B2C', now() + interval '2 hours', null, null, 'Oddzwonić po pracy, klient ma fakturę za prąd.', null, 'demo', now() - interval '1 day', now() - interval '20 minutes', now() - interval '15 minutes'),
  ('00000000-0000-0000-0000-00000000b012'::uuid, 'Natalia Wróbel', '+48 517 321 456', '21-300', 'Radzyń Podlaski, ul. Cicha 4', 'lubelskie', 'radzyński', 'Call back', '00000000-0000-0000-0000-00000000a014'::uuid, 'polecenie', now() + interval '5 hours', null, null, 'Polecenie od klienta po montażu.', null, 'demo', now() - interval '2 days', now() - interval '1 hour', now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-00000000b013'::uuid, 'Meble Północ Sp. z o.o.', '+48 518 909 100', '21-200', 'Parczew, ul. Magazynowa 1', 'lubelskie', 'parczewski', 'Call back', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', now() + interval '1 day 3 hours', null, null, 'Potrzebują zgody wspólnika.', null, 'demo', now() - interval '6 days', now() - interval '1 day', now() - interval '10 hours'),
  ('00000000-0000-0000-0000-00000000b014'::uuid, 'Iwona Maj', '+48 519 660 440', '22-600', 'Tomaszów Lubelski, ul. Krótka 10', 'lubelskie', 'tomaszowski', 'Call back', '00000000-0000-0000-0000-00000000a002'::uuid, 'własne', now() - interval '1 hour', null, null, 'Zaległy call-back, warto podbić dziś.', null, 'demo', now() - interval '5 days', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000b015'::uuid, 'Łukasz Malec', '+48 530 100 222', '24-200', 'Bełżyce, ul. Topolowa 12', 'lubelskie', 'lubelski', 'Call back', '00000000-0000-0000-0000-00000000a013'::uuid, 'B2C', now() + interval '2 days 4 hours', null, null, 'Klient czeka na audyt dachu.', null, 'demo', now() - interval '4 days', now() - interval '5 hours', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000b016'::uuid, 'Renata Wysocka', '+48 531 441 552', '22-300', 'Krasnystaw, ul. Nadwieprzańska 15', 'lubelskie', 'krasnostawski', 'Po spotkaniu', '00000000-0000-0000-0000-00000000a014'::uuid, 'B2C', now() + interval '3 days 2 hours', null, null, 'Wysłać finalną konfigurację po akceptacji męża.', null, 'demo', now() - interval '9 days', now() - interval '1 day', now() - interval '12 hours'),
  ('00000000-0000-0000-0000-00000000b017'::uuid, 'Bartosz Górski', '+48 532 210 990', '21-560', 'Międzyrzec Podlaski, ul. Rzemieślnicza 20', 'lubelskie', 'bialski', 'Po spotkaniu', '00000000-0000-0000-0000-00000000a002'::uuid, 'polecenie', now() + interval '1 day 6 hours', null, null, 'Klient chce większy magazyn energii.', null, 'demo', now() - interval '8 days', now() - interval '2 days', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000b018'::uuid, 'Agro-Sad', '+48 533 333 111', '24-150', 'Nałęczów, ul. Gospodarcza 3', 'lubelskie', 'puławski', 'Po spotkaniu', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', now() + interval '6 hours', null, null, 'Po spotkaniu, oferta do dosłania przed 16:00.', null, 'demo', now() - interval '10 days', now() - interval '6 hours', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-00000000b019'::uuid, 'Sylwia Kaczmarek', '+48 534 770 221', '22-200', 'Włodawa, ul. Jeziorna 9', 'lubelskie', 'włodawski', 'Przypisany', '00000000-0000-0000-0000-00000000a013'::uuid, 'B2C', null, null, null, 'Nowy kontakt po kampanii, do pierwszego telefonu.', null, 'demo', now() - interval '1 day', now() - interval '1 day', null),
  ('00000000-0000-0000-0000-00000000b020'::uuid, 'Auto-Komfort', '+48 535 118 445', '08-500', 'Ryki, ul. Serwisowa 14', 'lubelskie', 'rycki', 'Przypisany', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', null, null, null, 'Lead B2B, sprawdzić zużycie energii.', null, 'demo', now() - interval '3 days', now() - interval '3 days', null),
  ('00000000-0000-0000-0000-00000000b021'::uuid, 'Wojciech Zając', '+48 536 789 321', '23-200', 'Kraśnik, ul. Sadowa 13', 'lubelskie', 'kraśnicki', 'Przypisany', '00000000-0000-0000-0000-00000000a014'::uuid, 'własne', null, null, null, 'Zostawiony przez formularz WWW.', null, 'demo', now() - interval '12 hours', now() - interval '12 hours', null),
  ('00000000-0000-0000-0000-00000000b022'::uuid, 'Justyna Sikora', '+48 537 908 222', '21-070', 'Cyców, ul. Szkolna 2', 'lubelskie', 'łęczyński', 'Nowy', null, 'B2C', null, null, null, 'Nieprzypisany lead z dzisiejszej kampanii.', null, 'demo', now() - interval '4 hours', now() - interval '4 hours', null),
  ('00000000-0000-0000-0000-00000000b023'::uuid, 'Przemysław Dudek', '+48 538 444 990', '21-080', 'Garbów, ul. Parkowa 19', 'lubelskie', 'lubelski', 'Nowy', null, 'polecenie', null, null, null, 'Polecenie bez przypisanego opiekuna.', null, 'demo', now() - interval '2 hours', now() - interval '2 hours', null),
  ('00000000-0000-0000-0000-00000000b024'::uuid, 'Magda Nowicka', '+48 539 330 110', '22-470', 'Zwierzyniec, ul. Roztoczańska 5', 'lubelskie', 'zamojski', 'Do weryfikacji', '00000000-0000-0000-0000-00000000a002'::uuid, 'B2C', null, null, null, 'Adres wymaga potwierdzenia, możliwa pomyłka w kodzie.', null, 'demo', now() - interval '7 days', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000b025'::uuid, 'Tech-Bud Wschód', '+48 540 100 222', '22-130', 'Siedliszcze, ul. Budowlana 8', 'lubelskie', 'chełmski', 'Do weryfikacji', '00000000-0000-0000-0000-00000000a012'::uuid, 'B2B', null, null, null, 'Wymagana weryfikacja NIP przed ofertą.', null, 'demo', now() - interval '6 days', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000b026'::uuid, 'Marcin Grabowski', '+48 541 222 333', '22-680', 'Lubycza Królewska, ul. Długa 31', 'lubelskie', 'tomaszowski', 'Nie odebrał', '00000000-0000-0000-0000-00000000a014'::uuid, 'własne', now() + interval '1 day 1 hour', null, null, 'Dwie próby kontaktu, zaplanowany kolejny telefon.', null, 'demo', now() - interval '3 days', now() - interval '16 hours', now() - interval '16 hours'),
  ('00000000-0000-0000-0000-00000000b027'::uuid, 'Dorota Wilk', '+48 542 111 445', '22-530', 'Mircze, ul. Polna 21', 'lubelskie', 'hrubieszowski', 'Nie odebrał', '00000000-0000-0000-0000-00000000a013'::uuid, 'B2C', now() + interval '4 hours', null, null, 'Oddzwonić po SMS.', null, 'demo', now() - interval '1 day', now() - interval '3 hours', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000b028'::uuid, 'Piotr Markowski', '+48 543 776 221', '24-220', 'Niedrzwica Duża, ul. Lipowa 4', 'lubelskie', 'lubelski', 'Błędny numer', '00000000-0000-0000-0000-00000000a002'::uuid, 'B2C', null, null, null, 'Numer zwraca błąd, potrzebna korekta danych.', null, 'demo', now() - interval '12 days', now() - interval '6 days', now() - interval '6 days'),
  ('00000000-0000-0000-0000-00000000b029'::uuid, 'Helena Czubak', '+48 544 991 002', '21-100', 'Lubartów, ul. Brzozowa 18', 'lubelskie', 'lubartowski', 'Rezygnacja', '00000000-0000-0000-0000-00000000a013'::uuid, 'polecenie', null, null, null, 'Rezygnacja po porównaniu ofert.', null, 'demo', now() - interval '14 days', now() - interval '3 days', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000b030'::uuid, 'Mariusz Wenta', '+48 545 700 001', '21-040', 'Świdnik, ul. Lotnicza 17', 'lubelskie', 'świdnicki', 'Zwrot', null, 'B2C', null, null, null, 'Zwrot do bazy po braku decyzji.', null, 'demo', now() - interval '18 days', now() - interval '9 days', now() - interval '9 days')
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
      meeting_note = excluded.meeting_note,
      contract_number = excluded.contract_number,
      crm_environment = excluded.crm_environment,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_opened_at = excluded.last_opened_at;

insert into public.calendar_events (
  id,
  title,
  description,
  starts_at,
  ends_at,
  owner_id,
  owner_role,
  visibility,
  participant_ids,
  created_by,
  crm_environment
)
values
  ('00000000-0000-0000-0000-00000000c001'::uuid, 'Weryfikacja umowy: Jan Kowalski', 'Menadżer sprawdza komplet PDF, zdjęcia dachu i dane z umowy.', now() + interval '3 hours', now() + interval '4 hours', '00000000-0000-0000-0000-00000000a003'::uuid, 'menadzer', 'department', array['00000000-0000-0000-0000-00000000a002'::uuid], '00000000-0000-0000-0000-00000000a003'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c002'::uuid, 'Akceptacja finansowania B2B', 'Finanse i księgowość potwierdzają warunki przed fakturą zaliczkową.', now() + interval '1 day 9 hours', now() + interval '1 day 10 hours', '00000000-0000-0000-0000-00000000a015'::uuid, 'finance', 'internal', array['00000000-0000-0000-0000-00000000a004'::uuid,'00000000-0000-0000-0000-00000000a012'::uuid], '00000000-0000-0000-0000-00000000a015'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c003'::uuid, 'Plan dostawy i PZ', 'Logistyka rezerwuje sprzęt do umów po akceptacji księgowości.', now() + interval '1 day 13 hours', now() + interval '1 day 14 hours', '00000000-0000-0000-0000-00000000a005'::uuid, 'logistyk', 'department', array['00000000-0000-0000-0000-00000000a017'::uuid], '00000000-0000-0000-0000-00000000a005'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c004'::uuid, 'Montaż: Tomasz Bąk', 'Ekipa potwierdza datę montażu i finalne WZ.', now() + interval '6 days 8 hours', now() + interval '6 days 15 hours', '00000000-0000-0000-0000-00000000a006'::uuid, 'monter', 'department', array['00000000-0000-0000-0000-00000000a018'::uuid], '00000000-0000-0000-0000-00000000a005'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c005'::uuid, 'Pipeline sprzedaży Wschód', 'Krótki przegląd spotkań, call-backów i umów do przekazania operacjom.', now() + interval '2 days 8 hours', now() + interval '2 days 9 hours', '00000000-0000-0000-0000-00000000a009'::uuid, 'menadzer', 'internal', array['00000000-0000-0000-0000-00000000a003'::uuid,'00000000-0000-0000-0000-00000000a010'::uuid,'00000000-0000-0000-0000-00000000a011'::uuid], '00000000-0000-0000-0000-00000000a009'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c006'::uuid, 'Przegląd zaległych call-backów', 'Menadżer ustala priorytety kontaktu na dziś.', now() + interval '5 hours', now() + interval '6 hours', '00000000-0000-0000-0000-00000000a003'::uuid, 'menadzer', 'department', array['00000000-0000-0000-0000-00000000a002'::uuid,'00000000-0000-0000-0000-00000000a014'::uuid], '00000000-0000-0000-0000-00000000a003'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c007'::uuid, 'KSeF i faktury zaliczkowe', 'Księgowość sprawdza paczki dla podpisanych umów.', now() + interval '2 days 11 hours', now() + interval '2 days 12 hours', '00000000-0000-0000-0000-00000000a004'::uuid, 'ksiegowosc', 'department', array['00000000-0000-0000-0000-00000000a015'::uuid], '00000000-0000-0000-0000-00000000a004'::uuid, 'demo'),
  ('00000000-0000-0000-0000-00000000c008'::uuid, 'Audyt procesu demo', 'Podgląd zarządczy ścieżki od umowy do montażu.', now() + interval '4 days 10 hours', now() + interval '4 days 11 hours', '00000000-0000-0000-0000-00000000a019'::uuid, 'viewer', 'internal', array['00000000-0000-0000-0000-00000000a007'::uuid], '00000000-0000-0000-0000-00000000a007'::uuid, 'demo')
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      owner_id = excluded.owner_id,
      owner_role = excluded.owner_role,
      visibility = excluded.visibility,
      participant_ids = excluded.participant_ids,
      created_by = excluded.created_by,
      crm_environment = excluded.crm_environment;
