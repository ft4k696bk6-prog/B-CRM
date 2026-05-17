# B-CRM

## Polski

B-CRM to webowy system CRM zaprojektowany dla firmy sprzedającej instalacje fotowoltaiczne, magazyny energii i rozwiązania energetyczne dla klientów indywidualnych. Aplikacja porządkuje cały proces pracy z leadem: od importu kontaktu, przez przypisanie do handlowca, po obsługę statusów, spotkań, callbacków, ofert i raportowania aktywności.

Projekt powstał jako praktyczny produkt operacyjny dla zespołu sprzedaży. Jego celem jest ograniczenie chaosu w obsłudze leadów, zapewnienie kontroli nad pracą handlowców i stworzenie jednego miejsca, w którym menadżer lub admin widzi aktualny stan sprzedaży.

### Jakie Problemy Rozwiązuje

- rozproszone leady bez jasnego właściciela,
- brak kontroli nad callbackami i spotkaniami,
- ręczne przypisywanie leadów bez widocznej struktury zespołu,
- trudność w sprawdzeniu pracy handlowców,
- brak spójnej historii działań na leadzie,
- powtarzalne przygotowywanie ofert bez stabilnego szablonu,
- brak prostego eksportu danych do raportów,
- ryzyko, że lead zostanie bez następnego kroku sprzedażowego.

### Najważniejsze Funkcje

- logowanie przez Supabase Auth,
- role użytkowników: Admin, Menadżer, Handlowiec,
- struktura zespołu: admin przypisuje handlowców do menadżerów,
- menadżer widzi tylko swój zespół, ich leady i bazę leadów do rozdania,
- admin widzi cały system i zarządza użytkownikami,
- handlowiec pracuje na swoich leadach,
- dashboard admina i menadżera z metrykami zespołu,
- ranking handlowców: leady, spotkania, umowy, zaległe callbacki i leady bez akcji,
- dashboard handlowca z sekcją „Co zrobić teraz”,
- automatyczne wskazanie leadów bez następnej akcji,
- import leadów z CSV,
- masowe przypisywanie leadów,
- eksport aktualnego widoku leadów do CSV,
- karta leada z historią, komentarzami, aktywnościami, plikami i przypomnieniami,
- statusy sprzedażowe z walidacją procesu,
- callbacki i spotkania w kalendarzu,
- kalkulator opłacalności PV i magazynu energii,
- kalkulator oferty z VAT, dodatkami, dotacją i finansowaniem,
- stabilny widok oferty do wydruku i zapisu PDF,
- ustawienia marż ofertowych.

### Model Ról

#### Admin

Admin zarządza całą aplikacją. Ma dostęp do wszystkich leadów, użytkowników, ustawień, importu CSV i pełnego dashboardu. Może tworzyć użytkowników, zmieniać role, przypisywać handlowców do menadżerów i eksportować dane.

#### Menadżer

Menadżer zarządza przypisanym zespołem handlowców. Widzi leady swoich handlowców oraz bazę leadów, którą może rozdzielać zespołowi. Ma dostęp do wyników zespołu, kalendarza, filtrów i masowego przypisywania leadów.

#### Handlowiec

Handlowiec widzi własne leady. Może zmieniać statusy, dodawać komentarze, ustawiać callbacki, umawiać spotkania i uzupełniać dane potrzebne do procesu sprzedaży.

### Widoki

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

### Stack Technologiczny

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Row Level Security
- Vercel

### Baza Danych

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
9. [`supabase/07_roles_permissions_security.sql`](./supabase/07_roles_permissions_security.sql)

Opcjonalne dane testowe:

- [`supabase/sample-data.sql`](./supabase/sample-data.sql)
- [`supabase/seed_demo_users.sql`](./supabase/seed_demo_users.sql)

### Zmienne Środowiskowe

Utwórz `.env.local` na podstawie `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_DEMO_MODE=false
```

`SUPABASE_SERVICE_ROLE_KEY` jest używany wyłącznie po stronie serwera do operacji administracyjnych.

### Uruchomienie Lokalne

```bash
npm install
npm run dev
```

Domyślny adres lokalny:

```txt
http://localhost:3000
```

### Weryfikacja

```bash
npm run typecheck
npm run build
```

### Import CSV

Wymagane kolumny:

```txt
full_name,phone,postal_code,source
```

Obsługiwane kolumny dodatkowe:

```txt
address,voivodeship,county
```

Przykład znajduje się w [`examples/leads.csv`](./examples/leads.csv).

### Oferta I PDF

Kalkulator oferty obsługuje trzy warianty:

- instalacja fotowoltaiczna,
- fotowoltaika z magazynem energii,
- sam magazyn energii z falownikiem.

Widok oferty ma osobne style do druku: stałą szerokość dokumentu, kontrolę podziału sekcji, przewidywalne marginesy i stabilny układ produktów oraz tabel. Dzięki temu oferta nadaje się do zapisania jako PDF bez rozjeżdżania layoutu.

### Deployment

Projekt jest przygotowany pod Vercel. Po połączeniu repozytorium należy ustawić zmienne środowiskowe oraz skonfigurować adres aplikacji w Supabase Auth jako Site URL i Redirect URL.

Szczegółowa instrukcja wdrożenia znajduje się w [`INSTRUKCJA_CHMURA_VERCEL.md`](./INSTRUKCJA_CHMURA_VERCEL.md).

---

## English

B-CRM is a web-based CRM system designed for a company selling photovoltaic installations, energy storage systems, and related energy solutions. The application organizes the full lead workflow: importing contacts, assigning them to sales representatives, managing statuses, scheduling callbacks and meetings, preparing offers, and monitoring sales activity.

The project was built as a practical operational product for a sales team. Its purpose is to reduce lead management chaos, give managers clear control over team work, and provide one place where the current sales pipeline can be reviewed and acted on.

### Problems It Solves

- leads scattered across files or tools without clear ownership,
- missed callbacks and meetings,
- manual lead assignment without team structure,
- limited visibility into sales representatives’ work,
- lack of a reliable activity history for each lead,
- repetitive offer preparation without a stable document layout,
- no quick way to export filtered lead data,
- leads being left without a defined next sales action.

### Key Features

- Supabase Auth login,
- user roles: Admin, Manager, Sales Representative,
- team hierarchy: admins assign sales representatives to managers,
- managers see only their own team, their team leads, and the unassigned lead pool,
- admins manage the whole system,
- sales representatives work on their assigned leads,
- admin and manager dashboard with team metrics,
- sales performance table: leads, meetings, contracts, overdue callbacks, and leads without next action,
- sales dashboard with a “What to do now” queue,
- automatic detection of leads without a next action,
- CSV lead import,
- bulk lead assignment,
- CSV export of the currently filtered lead view,
- lead details with history, comments, activities, files, and reminders,
- sales status validation,
- callback and meeting calendar,
- PV and energy storage profitability calculator,
- offer calculator with VAT, add-ons, subsidies, and financing,
- print-ready offer view for PDF export,
- offer margin settings.

### Role Model

#### Admin

The admin manages the full system. They can access all leads, users, settings, CSV import, dashboards, team structure, and data exports.

#### Manager

The manager supervises an assigned sales team. They can view their sales representatives, team leads, the unassigned lead pool, team performance, calendar, filters, and bulk assignment tools.

#### Sales Representative

The sales representative works on assigned leads. They can update statuses, add comments, schedule callbacks, book meetings, and maintain the data required during the sales process.

### Screens

- `/login` - login
- `/admin` - admin or manager dashboard
- `/sales` - sales representative dashboard
- `/calendar` - meetings and callbacks calendar
- `/calculators` - PV, energy storage, and offer calculators
- `/settings` - offer margin settings
- `/admin/import` - CSV lead import
- `/admin/users` - user and team structure management
- `/leads/new` - manual lead creation
- `/leads/[id]` - lead details

### Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Row Level Security
- Vercel

### Database

SQL files are located in [`supabase`](./supabase).

For a fresh setup, run migrations in this order:

1. [`supabase/01_tables.sql`](./supabase/01_tables.sql)
2. [`supabase/02_security_history.sql`](./supabase/02_security_history.sql)
3. [`supabase/03a_contract_number.sql`](./supabase/03a_contract_number.sql)
4. [`supabase/03b_sales_path_guard.sql`](./supabase/03b_sales_path_guard.sql)
5. [`supabase/04_activity_log.sql`](./supabase/04_activity_log.sql)
6. [`supabase/04_meeting_followup_manual_leads.sql`](./supabase/04_meeting_followup_manual_leads.sql)
7. [`supabase/05_roles_users_demo.sql`](./supabase/05_roles_users_demo.sql)
8. [`supabase/06_manager_hierarchy.sql`](./supabase/06_manager_hierarchy.sql)
9. [`supabase/07_roles_permissions_security.sql`](./supabase/07_roles_permissions_security.sql)

Optional test data:

- [`supabase/sample-data.sql`](./supabase/sample-data.sql)
- [`supabase/seed_demo_users.sql`](./supabase/seed_demo_users.sql)

### Environment Variables

Create `.env.local` from `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_DEMO_MODE=false
```

`SUPABASE_SERVICE_ROLE_KEY` is used only on the server side for administrative operations.

### Local Development

```bash
npm install
npm run dev
```

Default local URL:

```txt
http://localhost:3000
```

### Verification

```bash
npm run typecheck
npm run build
```

### CSV Import

Required columns:

```txt
full_name,phone,postal_code,source
```

Optional columns:

```txt
address,voivodeship,county
```

An example file is available in [`examples/leads.csv`](./examples/leads.csv).

### Offer And PDF

The offer calculator supports three modes:

- photovoltaic installation,
- photovoltaic installation with energy storage,
- standalone energy storage with inverter.

The offer view uses dedicated print styles: fixed document width, controlled section breaks, predictable margins, and stable product/table layout. This makes the offer suitable for saving as a PDF without layout shifts.

### Deployment

The project is prepared for Vercel. After connecting the repository, configure environment variables and set the deployed application URL in Supabase Auth as the Site URL and Redirect URL.

Detailed deployment instructions are available in [`INSTRUKCJA_CHMURA_VERCEL.md`](./INSTRUKCJA_CHMURA_VERCEL.md).
