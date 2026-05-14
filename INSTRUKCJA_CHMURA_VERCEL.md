# B-CRM: wrzucenie aplikacji do chmury

Najprostsza i najwygodniejsza wersja na przyszłość:

1. Kod aplikacji trzymamy na GitHubie.
2. Vercel pobiera kod z GitHuba i uruchamia aplikację.
3. Supabase zostaje bazą danych i logowaniem.

## 1. GitHub

Załóż konto lub zaloguj się na GitHubie.

Najłatwiej użyć aplikacji GitHub Desktop:

1. Otwórz GitHub Desktop.
2. Wybierz `File` -> `Add Local Repository`.
3. Wskaż folder projektu `zbuduj-prosty-crm-webowy-dla-firmy`.
4. Jeśli GitHub Desktop zapyta, utwórz repozytorium.
5. Kliknij `Publish repository`.
6. Ustaw repozytorium jako `Private`.

Plik `.env.local` z kluczami nie powinien trafić na GitHuba. Jest już wpisany w `.gitignore`.

## 2. Vercel

1. Wejdź na https://vercel.com.
2. Zaloguj się przez GitHub.
3. Kliknij `Add New` -> `Project`.
4. Wybierz repozytorium z B-CRM.
5. Vercel powinien sam wykryć `Next.js`.
6. Przed kliknięciem `Deploy` dodaj zmienne środowiskowe.

## 3. Zmienne środowiskowe w Vercel

Dodaj dokładnie te trzy nazwy:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Wartości weź z Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`: adres projektu Supabase, np. `https://twoj-projekt.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `Project Settings` -> `API Keys` -> `Publishable key`
- `SUPABASE_SERVICE_ROLE_KEY`: `Project Settings` -> `API Keys` -> `Secret key`

Nie używaj adresu zakończonego `/rest/v1/`. Do aplikacji potrzebny jest główny adres projektu `.supabase.co`.

## 4. Supabase Auth po wdrożeniu

Po deployu Vercel pokaże adres aplikacji, np.:

```txt
https://b-crm.vercel.app
```

W Supabase ustaw:

1. `Authentication` -> `URL Configuration`.
2. `Site URL`: adres z Vercel.
3. `Redirect URLs`: dodaj adres z Vercel z końcówką `/**`, np. `https://b-crm.vercel.app/**`.
4. Dla pracy lokalnej możesz zostawić też `http://localhost:3000/**`.

## 5. Test

1. Wejdź w adres z Vercel.
2. Zaloguj się jako admin.
3. Sprawdź listę leadów.
4. Zaloguj się jako handlowiec.
5. Otwórz leada i przetestuj statusy.

## Ważne bezpieczeństwo

Przed prawdziwym użyciem firmowym warto wymienić stary `Secret key` w Supabase, bo jeden klucz został wcześniej wklejony w czacie. Nowy klucz wpisz potem w Vercel w `SUPABASE_SERVICE_ROLE_KEY` i zrób ponowny deploy.

