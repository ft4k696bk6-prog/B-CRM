# B-CRM: opis wdrożenia

## Problem

Firmy OZE potrzebują jednego miejsca do kontroli leadów, właściciela kontaktu, statusów, oddzwonień, spotkań, ofert, sprawdzeń technicznych, plików i następnego kroku z klientem.

## Cel

B-CRM porządkuje proces od pozyskania leada do realizacji. Każda rola widzi tylko to, co jest potrzebne do pracy: właściciel i admin kontrolują całość, kierownik pilnuje zespołu, handlowiec prowadzi kontakt, a role operacyjne przejmują temat po umowie.

## Role

- Właściciel/admin: użytkownicy, role, importy, struktura zespołu, ustawienia i globalna widoczność leadów.
- Kierownik: pula leadów, przypisania, wyniki zespołu i bramki umów.
- Handlowiec: przypisane leady, statusy, komentarze, callbacki, spotkania i oferty.
- Role operacyjne: finanse, księgowość, logistyka i montaż z węższym dostępem.

## Funkcje

- Logowanie i ochrona ekranów.
- Uprawnienia oparte o role.
- Panel wyników i widoki operacyjne.
- Zarządzanie leadami, klientami i statusami.
- Komentarze, oddzwonienia, spotkania i historia aktywności.
- Import CSV/XLSX przygotowany pod pliki z Google Drive.
- Wysyłka oferty, tracking i materiały PDF.
- Materiały sprzedażowe offline w PWA.
- Asystent kompatybilności sprzętu.
- Panel admina do użytkowników i dostępu do puli leadów.

## Technologia

React, TypeScript, Next.js, Supabase, PostgreSQL, Tailwind CSS i Vercel.

## Decyzje

- Supabase łączy logowanie, PostgreSQL, RLS i szybkie wdrożenie.
- Logika ról jest w `lib/roles.ts`, a uprawnienia w `lib/permissions.ts`.
- Dane trzymamy w tabelach PostgreSQL z katalogu `supabase/`.
- Ekrany są podzielone na admina, sprzedaż, kalendarz, kalkulatory, import, użytkowników i szczegóły leada.
- Najważniejsze ryzyka produkcyjne to monitoring, dalsze testy end-to-end i przegląd RLS przed większą skalą.

## Następne kroki

- Rozbudować testy end-to-end.
- Dodać monitoring i alerty produkcyjne.
- Dalej dzielić największe ekrany na moduły domenowe.
- Rozwinąć mobilne widoki tabel i list.
- Przejść dodatkowy przegląd bezpieczeństwa RLS.

## Linki

- GitHub: `https://github.com/ft4k696bk6-prog/B-CRM`
- README: `../README.md`
- Zrzuty ekranów: `docs/screenshots/`
