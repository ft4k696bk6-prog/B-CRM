# B-CRM

AI-assisted CRM dla firmy sprzedającej fotowoltaikę. Projekt powstał jako praktyczna aplikacja biznesowa: import leadów z CSV, obsługa pracy handlowców, historia działań, statusy, callbacki, spotkania, kalendarz i kalkulatory ofertowe.

## Stack

- Next.js / React
- TypeScript
- Tailwind CSS
- Supabase Database
- Supabase Auth
- Supabase Row Level Security
- Vercel

## Najważniejsze funkcje

- logowanie przez Supabase Auth,
- role `admin` i `sales`,
- admin widzi wszystkie leady,
- handlowiec widzi tylko leady przypisane do siebie,
- import leadów z CSV z Google Sheets,
- masowe przypisywanie leadów do handlowca,
- karta leada z historią działań,
- statusy leadów jako czytelne kafelki,
- status `Umowa` dostępny po `Spotkanie` i wymagający numeru umowy,
- zwrot leada do bazy nieprzypisanej,
- rezygnacja z obowiązkowym powodem,
- callbacki i spotkania z terminami,
- kalendarz spotkań dla admina i handlowca,
- zależne pola `województwo -> powiat`,
- kalkulator opłacalności PV / magazynu energii,
- kalkulator ceny i oferty z VAT 8% / 23%, dodatkami i finansowaniem,
- podstawowe zabezpieczenia RLS w Supabase.

## Widoki

- `/login` - logowanie
- `/admin` - dashboard admina
- `/sales` - dashboard handlowca
- `/calendar` - kalendarz spotkań
- `/calculators` - kalkulatory PV i oferty
- `/admin/import` - import CSV
- `/admin/users` - tworzenie handlowców
- `/leads/[id]` - karta leada

## Baza danych

Pliki SQL są w folderze [`supabase`](./supabase).

Dla nowego projektu uruchom kolejno:

1. [`supabase/01_tables.sql`](./supabase/01_tables.sql)
2. [`supabase/02_security_history.sql`](./supabase/02_security_history.sql)
3. [`supabase/03a_contract_number.sql`](./supabase/03a_contract_number.sql)
4. [`supabase/03b_sales_path_guard.sql`](./supabase/03b_sales_path_guard.sql)

Opcjonalne dane testowe:

```sql
-- supabase/sample-data.sql
```

## Zmienne środowiskowe

Utwórz plik `.env.local` na podstawie `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` nie może trafić do publicznego repozytorium.

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Aplikacja lokalnie działa pod:

```txt
http://localhost:3000
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

## Deployment

Projekt jest przygotowany pod Vercel:

1. import repozytorium z GitHub,
2. ustawienie zmiennych środowiskowych,
3. deploy aplikacji Next.js,
4. ustawienie adresu Vercel w Supabase Auth jako Site URL / Redirect URL.

Szczegółowa instrukcja jest w [`INSTRUKCJA_CHMURA_VERCEL.md`](./INSTRUKCJA_CHMURA_VERCEL.md).

## Co można rozwinąć dalej

- eksport oferty do PDF,
- realne zdjęcia sprzętu w konfiguratorze oferty,
- integracja z Meta Lead Ads,
- mapa satelitarna i prosta wizualizacja paneli PV,
- AI do podsumowania historii leada i sugestii kolejnego kroku,
- automatyczne uzupełnianie regionu po kodzie pocztowym.

## Kalkulator oferty

Kalkulator pozwala przygotować ofertę dla klienta w trzech trybach:

- instalacja fotowoltaiczna,
- fotowoltaika z magazynem energii,
- sam magazyn energii z falownikiem.

Handlowiec wybiera liczbę modułów, wariant magazynu, dodatki, VAT, dotację i finansowanie. Widok oferty można wydrukować lub zapisać jako PDF.
