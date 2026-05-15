do $$
declare
  seller uuid;
begin
  select id into seller
  from public.profiles
  where role = 'handlowiec'
  order by created_at asc
  limit 1;

  insert into public.leads (
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
    resignation_reason
  )
  values
    (
      'Anna Kowalska',
      '+48 501 100 200',
      '30-001',
      null,
      'małopolskie',
      'Kraków',
      'Nowy',
      null,
      'Google Sheets',
      null,
      null,
      null,
      null
    ),
    (
      'Piotr Zieliński',
      '+48 502 200 300',
      '40-014',
      null,
      'śląskie',
      'Katowice',
      case when seller is null then 'Nowy' else 'Przypisany' end,
      seller,
      'Meta Lead Ads',
      null,
      null,
      null,
      null
    ),
    (
      'Maria Nowak',
      '+48 503 300 400',
      '80-001',
      null,
      'pomorskie',
      'Gdańsk',
      case when seller is null then 'Nowy' else 'Call back' end,
      seller,
      'Google Sheets',
      now() - interval '2 hours',
      null,
      null,
      null
    ),
    (
      'Tomasz Wójcik',
      '+48 504 400 500',
      '61-001',
      'Poznań, ul. Słoneczna 12',
      'wielkopolskie',
      'Poznań',
      case when seller is null then 'Nowy' else 'Spotkanie' end,
      seller,
      'Google Sheets',
      null,
      date_trunc('day', now()) + interval '14 hours',
      'Poznań, ul. Słoneczna 12',
      null
    ),
    (
      'Karolina Wiśniewska',
      '+48 505 500 600',
      '00-001',
      null,
      'mazowieckie',
      'Warszawa',
      'Rezygnacja',
      null,
      'Google Sheets',
      null,
      null,
      null,
      'Klient ma już podpisaną umowę z inną firmą.'
    );
end $$;
