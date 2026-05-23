# Decyzje techniczne

## Decyzja: Supabase jako logowanie i baza danych

Kontekst: B-CRM potrzebuje logowania, kontroli dostępu według ról i bazy leadów opartej o PostgreSQL.

Decyzja: używamy Supabase Auth i Supabase PostgreSQL, a SQL trzymamy w katalogu `supabase/`.

Skutek: projekt da się szybko rozwijać i audytować, ale produkcja wymaga uważnego przeglądu RLS oraz pilnowania sekretów.

## Decyzja: role i uprawnienia w jednym miejscu

Kontekst: admin, kierownik, handlowiec i role operacyjne widzą inne dane oraz mają inne akcje.

Decyzja: normalizacja ról zostaje w `lib/roles.ts`, a sprawdzanie uprawnień w `lib/permissions.ts`.

Skutek: testy mogą sprawdzać dostęp bez renderowania całych ekranów. Ekrany aplikacji nadal powinny używać tych helperów konsekwentnie.

## Decyzja: Energy V2 jako produkt firmowy

Kontekst: Energy V2 jest CRM-em do prawdziwej pracy sprzedaży i realizacji, nie makietą pokazową.

Decyzja: dokumentacja produktu opisuje role, procesy, migracje, integracje i wymagania jakościowe.

Skutek: język pokazowy nie trafia do domyślnego UI ani publicznego README.
