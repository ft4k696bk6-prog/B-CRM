# Architektura B-CRM

## Stack

- Next.js App Router, React i TypeScript.
- Tailwind CSS do responsywnego UI.
- Supabase Auth oraz PostgreSQL.
- Pliki SQL Supabase dla schematu, RLS, polityk, historii i migracji.
- Vercel jako wdrożenie aplikacji.

## Struktura aplikacji

- `app/` zawiera ekrany CRM i endpointy API.
- `components/` zawiera wspólne komponenty UI.
- `lib/` zawiera role, uprawnienia, stałe, cennik, import, dokumenty i konfigurację Supabase.
- `supabase/` zawiera schemat bazy, funkcje, polityki i migracje.
- `public/materials/` zawiera materiały sprzedażowe dostępne także offline.

## Przepływ danych

UI czyta i zapisuje dane przez klienta Supabase oraz wybrane endpointy Next.js. Endpointy są używane tam, gdzie potrzebna jest walidacja po stronie serwera, operacje admina albo integracja z zewnętrznym dostawcą.

Webhook Meta Lead Ads zapisuje nowe rekordy jako nieprzypisane leady produkcyjne. To jest wspólna pula leadów: owner, admin i kierownik widzą ją z roli, a handlowiec dopiero po włączeniu dostępu przez admina.

## Logowanie i role

Supabase Auth odpowiada za tożsamość. Role aplikacji są normalizowane w `lib/roles.ts`, a uprawnienia w `lib/permissions.ts`. Pliki SQL w `supabase/` opisują bazową warstwę bezpieczeństwa i RLS.

## Wdrożenie

Aplikacja działa na Vercel. URL Supabase, klucz anon i serwerowy service role key są ustawiane przez zmienne środowiskowe. Sekrety nie trafiają do repozytorium.

## Ryzyka

- Część ekranów jest duża i warto je dalej dzielić modułami.
- Testy end-to-end wymagają rozbudowy.
- Monitoring błędów i analityka powinny zostać dopięte przed większą skalą.
- Gęste tabele CRM wymagają dalszej pracy pod telefon.
