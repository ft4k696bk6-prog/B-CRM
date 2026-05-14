# B-CRM

Prosty CRM webowy dla firmy sprzedającej fotowoltaikę. Aplikacja ma dwa typy kont: admin i handlowiec. Admin widzi całą bazę leadów, a handlowiec tylko leady przypisane do siebie.

## Co jest gotowe

- logowanie przez Supabase Auth,
- role `admin` i `sales`,
- panel admina z licznikami, filtrami, sortowaniem i masowym przypisywaniem leadów,
- panel handlowca z leadami, callbackami, dzisiejszymi spotkaniami i zaległymi callbackami,
- karta leada z komentarzami, zmianą statusu, callbackiem, spotkaniem, zwrotem i rezygnacją,
- historia działań leada,
- import CSV z Google Sheets,
- podstawowe zabezpieczenia Supabase RLS,
- przykładowe dane testowe.

## 1. Przygotuj Supabase

1. Wejdź na [supabase.com](https://supabase.com) i utwórz nowy projekt.
2. Otwórz w Supabase zakładkę **SQL Editor**.
3. Wklej i uruchom zawartość pliku [supabase/01_tables.sql](/Users/kacperbernecki/Documents/Codex/2026-05-14/zbuduj-prosty-crm-webowy-dla-firmy/supabase/01_tables.sql).
4. Kliknij **New query**, a potem wklej i uruchom zawartość pliku [supabase/02_security_history.sql](/Users/kacperbernecki/Documents/Codex/2026-05-14/zbuduj-prosty-crm-webowy-dla-firmy/supabase/02_security_history.sql).
5. Wejdź w **Authentication -> Users** i utwórz pierwszego użytkownika admina.
6. W SQL Editor uruchom poniższe polecenie, podmieniając e-mail:

```sql
update public.profiles
set role = 'admin', full_name = 'Administrator'
where email = 'twoj-email@firma.pl';
```

7. Utwórz co najmniej jednego handlowca w panelu CRM albo ręcznie w Supabase.
8. Opcjonalnie uruchom przykładowe dane z pliku [supabase/sample-data.sql](/Users/kacperbernecki/Documents/Codex/2026-05-14/zbuduj-prosty-crm-webowy-dla-firmy/supabase/sample-data.sql).

## 2. Ustaw dane połączenia

W Supabase wejdź w **Project Settings -> API** i skopiuj:

- Project URL,
- anon public key,
- service_role key.

W folderze projektu skopiuj plik `.env.example` jako `.env.local` i wpisz wartości:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` jest potrzebny tylko po stronie serwera, do tworzenia użytkowników z panelu admina. W Vercel dodaj go jako zmienną środowiskową i nie publikuj go nigdzie w kodzie.

## 3. Uruchom lokalnie

Zainstaluj Node.js LTS, a potem w folderze projektu uruchom:

```bash
npm install
npm run dev
```

Aplikacja będzie dostępna pod adresem:

```text
http://localhost:3000
```

## 4. Import CSV

Plik CSV z Google Sheets musi mieć kolumny:

```text
full_name,phone,postal_code,source
```

Przykład jest w pliku [examples/leads.csv](/Users/kacperbernecki/Documents/Codex/2026-05-14/zbuduj-prosty-crm-webowy-dla-firmy/examples/leads.csv). Po imporcie leady trafiają jako nieprzypisane do bazy leadów admina.

Dodatkowe kolumny `address`, `voivodeship`, `county` są obsługiwane, ale nie są wymagane.

## 5. Publikacja na Vercel

1. Załóż konto na [vercel.com](https://vercel.com).
2. Podłącz repozytorium z projektem.
3. W ustawieniach projektu Vercel dodaj te same zmienne:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

4. Wdróż projekt. Vercel sam uruchomi budowanie Next.js.

## 6. Kod pocztowy, województwo i powiat

W MVP pola `województwo` i `powiat` są ręczne lub importowane z CSV. Automatyczne uzupełnianie po kodzie pocztowym w Polsce wymaga wiarygodnej bazy, np. TERYT/GUS albo płatnego API adresowego. Lepiej dodać to jako osobną integrację, niż zgadywać region po samym kodzie.

## 7. Co dodać później dla Meta Lead Ads

Do bezpośredniej integracji z Meta Lead Ads potrzebne będą:

- konto Meta Business i aplikacja w Meta Developers,
- dostęp do formularzy Lead Ads,
- token dostępu z odpowiednimi uprawnieniami,
- webhook odbierający nowe leady,
- endpoint w Next.js zapisujący leady do Supabase,
- mapowanie pól z formularzy Meta na `full_name`, `phone`, `postal_code`, `source`,
- deduplikacja leadów po telefonie lub telefonie + źródle,
- log błędów importu i ponawianie nieudanych zapisów.

Najprostszy kolejny krok to endpoint `/api/meta/webhook`, który odbierze webhook Meta, pobierze szczegóły leada z Graph API i zapisze go w tabeli `leads` jako nieprzypisanego.
