# B-CRM

B-CRM to webowy system CRM przygotowany dla firmy sprzedającej instalacje fotowoltaiczne, magazyny energii i usługi powiązane. Aplikacja porządkuje pracę z leadami: od importu kontaktów, przez przypisywanie ich zespołowi sprzedaży, po obsługę statusów, spotkań, callbacków, ofert i raportowania aktywności.

Projekt został zbudowany jako praktyczny produkt SaaS: ma role użytkowników, zabezpieczenia na poziomie bazy danych, dashboardy operacyjne, kalkulator ofertowy oraz widok dokumentu oferty gotowy do wydruku lub zapisu jako PDF.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Row Level Security
- Vercel

## Najważniejsze Funkcje

- logowanie przez Supabase Auth,
- role użytkowników: Admin, Menadżer, Handlowiec,
- struktura zespołu: admin przypisuje handlowców do menadżerów,
- menadżer widzi swoich handlowców, ich leady i bazę leadów do rozdania,
- admin ma dostęp do całego systemu,
- handlowiec pracuje na swoich leadach,
- import leadów z pliku CSV,
- masowe przypisywanie leadów,
- filtrowanie i sortowanie leadów,
- karta leada z historią działań,
- komentarze, aktywności, pliki i przypomnienia,
- statusy sprzedażowe z walidacją procesu,
- callbacki i spotkania w kalendarzu,
- kalkulator opłacalności PV i magazynu energii,
- kalkulator oferty z VAT, dodatkami, dotacją i finansowaniem,
- stabilny widok oferty do wydruku i zapisu PDF,
- ustawienia marż ofertowych.

## Role I Uprawnienia

### Admin

Admin zarządza całą aplikacją. Widzi wszystkie leady, użytkowników, ustawienia, import CSV i pełny dashboard. Może tworzyć użytkowników, zmieniać role i przypisywać handlowców do menadżerów.

### Menadżer

Menadżer zarządza przypisanym zespołem handlowców. Widzi leady swoich handlowców oraz bazę leadów, którą może rozdzielać zespołowi. W kalendarzu i dashboardzie pracuje na danych swojego zespołu.

### Handlowiec

Handlowiec widzi głównie własne leady. Może zmieniać statusy, dodawać komentarze, ustawiać callbacki, spotkania i uzupełniać dane potrzebne do procesu sprzedaży.

## Widoki

- `/login` - logowanie
- `/admin` - dashboard admina lub menadżera
- `/sales` - dashboard handlowca
- `/calendar` - kalendarz spotkań i callbacków
- `/calculators` - kalkulatory PV, magazynu energii i oferty
- `/settings` - ustawienia marż ofertowych
- `/admin/import` - import leadów z CSV
- `/admin/users` - zarządzanie użytkownikami i strukturą zespołu
- `/leads/new` - ręczne dodanie leada
- `/leads/[id]` - karta leada

## Baza Danych

Pliki SQL znajdują się w folderze [`supabase`](./supabase).

Dla świeżej instalacji uruchom migracje kolejno:

1. [`supabase/01_tables.sql`](./supabase/01_tables.sql)
2. [`supabase/02_security_history.sql`](./supabase/02_security_history.sql)
3. [`supabase/03a_contract_number.sql`](./supabase/03a_contract_number.sql)
4. [`supabase/03b_sales_path_guard.sql`](./supabase/03b_sales_path_guard.sql)
5. [`supabase/04_activity_log.sql`](./supabase/04_activity_log.sql)
6. [`supabase/04_meeting_followup_manual_leads.sql`](./supabase/04_meeting_followup_manual_leads.sql)
7. [`supabase/05_roles_users_demo.sql`](./supabase/05_roles_users_demo.sql)
8. [`supabase/06_manager_hierarchy.sql`](./supabase/06_manager_hierarchy.sql)

Opcjonalne dane testowe:

- [`supabase/sample-data.sql`](./supabase/sample-data.sql)
- [`supabase/seed_demo_users.sql`](./supabase/seed_demo_users.sql)

## Zmienne Środowiskowe

Utwórz `.env.local` na podstawie `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` jest używany tylko po stronie serwera do tworzenia użytkowników i nie powinien być publikowany.

## Uruchomienie Lokalne

```bash
npm install
npm run dev
```

Domyślny adres lokalny:

```txt
http://localhost:3000
```

## Weryfikacja

Dostępne skrypty:

```bash
npm run typecheck
npm run build
```

## Import CSV

Wymagane kolumny:

```txt
full_name,phone,postal_code,source
```

Obsługiwane kolumny dodatkowe:

```txt
address,voivodeship,county
```

Przykład znajduje się w [`examples/leads.csv`](./examples/leads.csv).

## Kalkulator I Oferta PDF

Kalkulator oferty obsługuje trzy warianty:

- instalacja fotowoltaiczna,
- fotowoltaika z magazynem energii,
- sam magazyn energii z falownikiem.

Widok oferty ma osobne style do druku: stałą szerokość dokumentu, kontrolę podziału sekcji, przewidywalne marginesy i stabilny układ produktów oraz tabel. Dzięki temu oferta nadaje się do zapisania jako PDF bez rozjeżdżania layoutu.

## Deployment

Projekt jest przygotowany pod Vercel. Po połączeniu repozytorium należy ustawić zmienne środowiskowe oraz skonfigurować adres aplikacji w Supabase Auth jako Site URL i Redirect URL.

Szczegółowa instrukcja wdrożenia znajduje się w [`INSTRUKCJA_CHMURA_VERCEL.md`](./INSTRUKCJA_CHMURA_VERCEL.md).
