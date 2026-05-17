# Project Plan: B-CRM

## English

### Project Goal

I built a web CRM for a sales organization that sells photovoltaic installations, energy storage systems, and related energy products. I wanted the system to replace scattered lead files and manual follow-up tracking with one operational workspace for admins, managers, and sales representatives.

### Problem and Users

I planned this project around three user groups:

- Admins who need full control over users, leads, settings, imports, exports, and reporting.
- Managers who need to supervise their own team, assign leads, monitor activity, and prevent missed follow-ups.
- Sales representatives who need a focused daily workflow for their own leads, callbacks, meetings, offers, and notes.

The problem I wanted to solve was operational chaos: leads can be unassigned, callbacks can be missed, sales activity is hard to audit, and preparing offers repeatedly without a stable process wastes time.

### Functional Scope

I planned the project scope around:

- Supabase authentication and role-based access.
- Admin, manager, and sales representative dashboards.
- Lead import from CSV and manual lead creation.
- Bulk lead assignment and filtered lead export.
- Lead detail pages with comments, history, files, reminders, and sales status changes.
- Calendar views for meetings and callbacks.
- Sales workflow validation so leads do not move through the process without required data.
- Team hierarchy where admins assign sales representatives to managers.
- Sales ranking and operational metrics for leads, meetings, contracts, overdue callbacks, and leads without next action.
- PV, energy storage, and offer calculators.
- Print-ready offer layout for browser PDF export.
- Pricing and margin settings.

### Architecture and Technical Decisions

- I chose Next.js App Router with React and TypeScript for a full-stack web application.
- I chose Supabase Auth and Supabase Database so user identity, data storage, and access control live in one backend platform.
- I used Row Level Security and explicit permission helpers to protect role-specific data boundaries.
- I kept CRM domain logic in reusable `lib` modules for roles, permissions, pricing, dates, lead sources, validation, and document generation.
- I kept user-facing CRM screens as route-level App Router pages so each workflow has a clear URL and responsibility.
- I stored database setup in SQL migration files under `supabase/` so the application can be recreated and reviewed from source.
- I prepared the app for Vercel deployment with documented environment variables and deployment steps.

### Delivery Phases

1. Project foundation: Next.js app, Tailwind styling, Supabase client setup, environment configuration, and base layout.
2. Authentication and roles: login flow, profile model, admin/manager/sales representative permissions, and protected views.
3. Lead management: lead table, lead creation, lead detail view, status handling, comments, history, reminders, and files.
4. Sales operations: CSV import, bulk assignment, export, manager team hierarchy, and dashboards.
5. Scheduling: callback and meeting calendar with follow-up visibility.
6. Commercial tools: PV and storage profitability calculators, offer calculator, margin settings, and print/PDF-ready offer view.
7. Production hardening: RLS policies, legacy role handling, demo isolation, deployment docs, and type/build verification.

### What Has Been Delivered

In the repository I delivered a practical CRM slice. It includes role-specific dashboards, lead workflows, CSV import/export, team hierarchy, calendars, calculators, offer PDF support, Supabase migrations, sample data, demo users, and Vercel deployment documentation. The later commits also cover stabilization work around production deployment, manager hierarchy, role constraints, operations flows, and enterprise CRM flows.

### Acceptance Criteria

- Admin can manage users, roles, team structure, all leads, imports, exports, and settings.
- Manager can see and manage only their assigned team and relevant lead pool.
- Sales representative can work only on assigned leads and record next actions.
- Lead history preserves meaningful activity and follow-up context.
- CSV import accepts the documented columns and rejects invalid data safely.
- Dashboards reveal overdue callbacks and leads without next action.
- Offer output remains stable enough to print or save as PDF.
- Supabase policies prevent users from accessing data outside their role.

### Testing and Verification

- Run `npm run typecheck` to verify TypeScript correctness.
- Run `npm run build` to verify production build readiness.
- Verify Supabase migrations can be applied in documented order.
- Manually test login and navigation for Admin, Manager, and Sales Representative demo users.
- Test CSV import with `examples/leads.csv` and invalid CSV variants.
- Test lead assignment, status changes, reminders, calendar entries, and offer PDF export.

### What This Project Shows

This project shows that I can own a project end to end: domain modeling, role-based access, database design, operational workflows, data import/export, PDF-ready business documents, dashboards, and deployment readiness. It is not only a UI exercise; it connects business rules, security, and daily sales operations into one working system.

### Future Improvements

- Add automated end-to-end tests for role-specific workflows.
- Add email/SMS reminders for callbacks and meetings.
- Add richer analytics for conversion rates and sales funnel aging.
- Add external integrations for accounting, KSeF, CRM imports, or telephony.
- Add audit exports for management reporting.

---

## Polski

### Cel projektu

Zbudowałem webowy CRM dla firmy sprzedającej instalacje fotowoltaiczne, magazyny energii i powiązane rozwiązania energetyczne. System ma zastąpić rozproszone pliki z leadami i ręczne pilnowanie follow-upów jednym miejscem pracy dla admina, menadżera i handlowca.

### Problem i użytkownicy

Projekt zaplanowałem dla trzech grup użytkowników:

- Adminów, którzy potrzebują pełnej kontroli nad użytkownikami, leadami, ustawieniami, importem, eksportem i raportowaniem.
- Menadżerów, którzy muszą zarządzać swoim zespołem, przydzielać leady, monitorować aktywność i pilnować zaległych działań.
- Handlowców, którzy potrzebują prostego dziennego widoku własnych leadów, callbacków, spotkań, ofert i notatek.

Problem, który chciałem rozwiązać, to chaos operacyjny: leady mogą zostać bez właściciela, callbacki mogą wypaść z procesu, aktywność sprzedażowa jest trudna do sprawdzenia, a powtarzalne przygotowywanie ofert bez stałego procesu zabiera czas.

### Zakres funkcjonalny

Zakres projektu rozpisałem na:

- Logowanie przez Supabase i dostęp zależny od roli.
- Dashboardy dla admina, menadżera i handlowca.
- Import leadów z CSV i ręczne dodawanie leadów.
- Masowe przypisywanie leadów i eksport przefiltrowanego widoku.
- Kartę leada z komentarzami, historią, plikami, przypomnieniami i zmianami statusu.
- Kalendarz spotkań i callbacków.
- Walidację procesu sprzedażowego, żeby lead nie przechodził dalej bez wymaganych danych.
- Hierarchię zespołu, w której admin przypisuje handlowców do menadżerów.
- Ranking i metryki sprzedażowe: leady, spotkania, umowy, zaległe callbacki i leady bez kolejnej akcji.
- Kalkulatory PV, magazynu energii i oferty.
- Widok oferty przygotowany do druku i zapisu jako PDF.
- Ustawienia cen i marż.

### Architektura i decyzje techniczne

- Next.js App Router, React i TypeScript jako podstawa aplikacji full-stack.
- Supabase Auth i Supabase Database, żeby tożsamość użytkownika, dane i kontrola dostępu były w jednym backendzie.
- Row Level Security oraz helpery uprawnień do ochrony danych zależnie od roli.
- Logika domenowa CRM w modułach `lib`: role, uprawnienia, pricing, daty, źródła leadów, walidacja i generowanie dokumentów.
- Widoki jako strony App Routera, żeby każdy proces miał czytelny adres i odpowiedzialność.
- Migracje SQL w folderze `supabase/`, dzięki czemu bazę można odtworzyć i przejrzeć z kodu.
- Przygotowanie do wdrożenia na Vercel z opisanymi zmiennymi środowiskowymi i instrukcją deploymentu.

### Etapy realizacji

1. Fundament projektu: aplikacja Next.js, Tailwind, klient Supabase, konfiguracja środowiska i layout.
2. Autoryzacja i role: logowanie, profil użytkownika, uprawnienia Admin/Menadżer/Handlowiec i chronione widoki.
3. Obsługa leadów: tabela, dodawanie, karta leada, statusy, komentarze, historia, przypomnienia i pliki.
4. Operacje sprzedażowe: import CSV, masowe przypisanie, eksport, hierarchia menadżerów i dashboardy.
5. Planowanie pracy: kalendarz callbacków i spotkań.
6. Narzędzia handlowe: kalkulatory PV/magazynu/oferty, marże i widok oferty do PDF.
7. Utwardzenie produkcyjne: polityki RLS, obsługa starych ról, izolacja demo, dokumentacja wdrożenia i weryfikacja typów/builda.

### Co zostało zrobione

W repozytorium dowiozłem praktyczny wycinek CRM. Są role i dashboardy, workflow leadów, import/eksport CSV, hierarchia zespołu, kalendarze, kalkulatory, obsługa oferty PDF, migracje Supabase, dane testowe, użytkownicy demo i instrukcja wdrożenia na Vercel. Późniejsze commity obejmują też stabilizację deploymentu, hierarchię menadżerów, ograniczenia ról, flow operacyjne i rozwój enterprise CRM.

### Kryteria akceptacji

- Admin zarządza użytkownikami, rolami, strukturą zespołu, wszystkimi leadami, importem, eksportem i ustawieniami.
- Menadżer widzi i zarządza tylko swoim zespołem oraz właściwą pulą leadów.
- Handlowiec pracuje tylko na przypisanych leadach i zapisuje kolejne akcje.
- Historia leada zachowuje istotne działania i kontekst follow-upów.
- Import CSV obsługuje udokumentowane kolumny i bezpiecznie odrzuca błędne dane.
- Dashboardy pokazują zaległe callbacki i leady bez kolejnej akcji.
- Oferta nadaje się do wydruku lub zapisu jako PDF bez rozjechanego layoutu.
- Polityki Supabase blokują dostęp do danych spoza roli użytkownika.

### Testowanie i weryfikacja

- Uruchomić `npm run typecheck` dla weryfikacji TypeScript.
- Uruchomić `npm run build` dla weryfikacji buildu produkcyjnego.
- Sprawdzić, czy migracje Supabase przechodzą w opisanej kolejności.
- Ręcznie przejść logowanie i nawigację dla użytkowników demo: Admin, Menadżer, Handlowiec.
- Przetestować import CSV na `examples/leads.csv` oraz błędnych wariantach.
- Sprawdzić przypisywanie leadów, statusy, przypomnienia, kalendarz i eksport oferty do PDF.

### Co pokazuje ten projekt

Tym projektem pokazuję pełne myślenie projektowe i techniczne: model domenowy, role i uprawnienia, bazę danych, proces operacyjny, import/eksport danych, dokumenty biznesowe gotowe do PDF, dashboardy i gotowość do wdrożenia. To nie jest tylko interfejs, ale połączenie reguł biznesowych, bezpieczeństwa i codziennej pracy sprzedaży w jeden system.

### Możliwe dalsze kroki

- Dodać testy end-to-end dla procesów zależnych od roli.
- Dodać przypomnienia e-mail/SMS dla callbacków i spotkań.
- Rozbudować analitykę konwersji i wieku leadów w lejku.
- Dodać integracje z księgowością, KSeF, importem CRM lub telefonią.
- Dodać eksporty audytowe dla raportowania zarządczego.
