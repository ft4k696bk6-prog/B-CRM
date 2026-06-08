# B-CRM

B-CRM to firmowy CRM dla sprzedaży i realizacji OZE. Łączy pozyskiwanie leadów, pracę handlowca w terenie, kalkulacje, wysyłkę oferty, bramki umowy, magazyn, montaż i obsługę klienta po podpisaniu dokumentów.

Produkt jest projektowany pod zespoły podobne do Re-Energy System: szybka obsługa kontaktu, wygodna praca na telefonie, jasna kontrola kierownika i administratora oraz proces klienta spokojniejszy niż w typowym CRM.

## Zakres Produktu

- Role: `owner`, `admin`, `kierownik`, `handlowiec` oraz widoki finansów, księgowości, logistyki i montażu.
- Leady i klienci: statusy, komentarze, pliki, przypomnienia, historia aktywności i pula nieprzypisanych leadów.
- Import leadów: CSV/XLSX po eksporcie z Google Drive, deduplikacja po telefonie i e-mailu, zachowanie komentarzy w historii.
- Meta Lead Ads: webhook dla formularzy, nowe leady trafiają do wspólnej puli widocznej dla owner/admin/kierownik.
- Spotkanie handlowca: karta klienta, checklista, notatki, kalkulator, oferta i dalsze działania.
- Oferta: wysyłka maila, strona oferty, zdarzenia otwarcia, kliknięcia i pobrania PDF.
- Proces po umowie: klient, umowa, podpis online, bramki akceptacji, magazyn, montaż, zdjęcia i audyt.
- PWA: materiały sprzedażowe dostępne offline, dolna nawigacja na telefonie i linki `tel:` do szybkiego dzwonienia.
- Asystent techniczny: baza kompatybilności sprzętu i odpowiedzi tylko na podstawie dostępnych źródeł.

## Materiały

Materiały dla handlowca są w `public/materials/`:

- `b-crm-energy-prezentacja.pdf`
- `checklista-spotkania.pdf`
- `net-billing.pdf`
- `magazyn-energii.pdf`
- `brama-umowy.pdf`

Prezentacja klienta nie zawiera tematów Pstryk, EMS ani AI. To zostaje po stronie researchu właściciela.

## Technologia

- Next.js App Router
- React
- TypeScript
- Supabase Auth i PostgreSQL
- Tailwind CSS
- Vercel
- Vitest

## Struktura

- `app/` - ekrany CRM, strona oferty i API.
- `components/` - shell aplikacji, UI i komponenty procesu.
- `lib/` - role, uprawnienia, import, cennik, dokumenty, kompatybilność sprzętu i helpery.
- `public/materials/` - materiały offline dla PWA.
- `supabase/` - schema, RLS, migracje i SQL operacyjny.
- `docs/` - architektura, testy, decyzje i research.

## Uruchomienie

```bash
npm install
npm run dev
```

Adres lokalny:

```text
http://localhost:3000
```

Kontrola jakości:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Środowisko

Utwórz `.env.local` na podstawie `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_CALLER_ID=

RESEND_API_KEY=
OFFER_FROM_EMAIL=

META_LEAD_ADS_VERIFY_TOKEN=
META_PAGE_ACCESS_TOKEN=
META_LEAD_ADS_ACCESS_TOKEN=
META_GRAPH_VERSION=
META_APP_SECRET=
META_LEAD_ADS_SYNC_SECRET=
META_LEAD_ADS_SYNC_ENABLED=
META_LEAD_ADS_FORM_IDS=
META_LEAD_ADS_PAGE_IDS=
META_LEAD_ADS_MAX_PAGES=

CRON_SECRET=
GOOGLE_DRIVE_SYNC_SECRET=
GOOGLE_DRIVE_LEAD_SYNC_ENABLED=
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_LEAD_FILE_IDS=
GOOGLE_DRIVE_LEAD_FOLDER_ID=

OPENAI_API_KEY=
```

Klucze serwisowe, tokeny dostawców i dane prywatne zostają wyłącznie po stronie serwera. Dane klientów i leadów nie powinny trafiać do repozytorium.

## Baza Danych

SQL z `supabase/` uruchamiaj kolejno na osobnym projekcie Supabase dla tej wersji produktu. Najważniejsze migracje Energy V2:

- `supabase/11_bcrm_energy_v2.sql` - role, statusy, klienci, umowy, proces, magazyn, kompatybilność sprzętu, importy i powiadomienia.
- `supabase/12_email_send_guard.sql` - bezpieczna wysyłka ofert, blokada duplikatów i tracking doręczeń.
- `supabase/13_shared_lead_pool.sql` - wspólna pula nieprzypisanych leadów i kontrola widoczności dla handlowców.

Cel obciążeniowy to 250 tys. leadów. Widoki listowe pracują z paginacją i indeksami pod status, przypisanie, daty oraz klucze deduplikacji.

## Integracje

- Google Drive: import po eksporcie pliku do CSV/XLSX i wysyłce przez `/api/leads/import`.
- Meta Lead Ads: `/api/integrations/meta/leads`; leady wpadają do wspólnej puli bez przypisywania do handlowca.
- Oferty: `/api/offers/email` oraz `/oferty/[token]` do śledzenia otwarcia, kliknięć i pobrania PDF.
- Podpis online: model danych `signature_requests`; dostawca SMS/Autenti wymaga osobnej decyzji biznesowej i prawnej.

## Testy

Aktualne testy obejmują role, uprawnienia, stałe statusów, bezpieczną wysyłkę maili i normalizację importu leadów. Pełny release powinien przejść:

- lint, typecheck, testy jednostkowe i build produkcyjny,
- smoke test desktop/mobile/PWA,
- import próbny i import duplikatów,
- kontrolę dostępu dla ról,
- tracking oferty,
- odpowiedź asystenta dla brakujących danych sprzętu bez zgadywania.
