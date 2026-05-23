# B-CRM Energy V2: plan researchu

Ten dokument opisuje zakres researchu dla B-CRM Energy V2. Nie jest specyfikacją wdrożenia i nie zmienia działania aplikacji bez osobnej decyzji.

Celem jest sprawdzenie integracji i procesów przydatnych dla firmy OZE: import z Google Drive, Meta Lead Ads, podpis online z SMS, PWA offline i asystent kompatybilności sprzętu.

## Zasady

- W dokumentacji używamy tylko publicznych źródeł i zanonimizowanych przykładów.
- Do repozytorium nie trafiają dane klientów, numery telefonów, adresy, PESEL/NIP, wartości umów ani prywatna treść plików z Drive.
- API, uprawnienia i ceny dostawców traktujemy jako założenia do potwierdzenia przed wdrożeniem.
- Każdy lead, plik, zgoda i podpis musi mieć źródło, użytkownika oraz czas zdarzenia.
- Najpierw robimy mały test procesu, dopiero potem trwały kod produkcyjny.

## Google Drive

Cel: bezpiecznie wciągać pliki, które zespół już trzyma na Dysku.

Do potwierdzenia:

- model zgód OAuth, zakresy, odświeżanie tokenów i odpinanie konta,
- import z wybranego folderu, dysku współdzielonego albo ręcznego wyboru pliku,
- bezpieczne metadane: ID pliku, nazwa, typ, rozmiar, daty, checksum i folder,
- typy plików na start: PDF, DOCX, XLSX, CSV i zdjęcia,
- deduplikacja po ID pliku, checksumie i znormalizowanej nazwie,
- status importu: oczekuje, zaimportowany, pominięty, błąd, zarchiwizowany,
- audyt: kto podpiął Drive, kto zaimportował plik i do jakiego rekordu.

Pierwsza wersja może zostać przy imporcie CSV/XLSX z panelu admina, bo to jest najtańsza i najbezpieczniejsza ścieżka.

## Meta Lead Ads

Cel: formularze z Facebooka mają wpadać do CRM bez ręcznego przepisywania i bez gubienia zgody marketingowej.

Do potwierdzenia:

- aplikacja Meta, strona, uprawnienia i ewentualny review,
- webhook jako główny kanał i polling jako awaryjny backfill,
- mapowanie pól: imię, telefon, e-mail, region, produkt, treść zgody, kampania, zestaw reklam, reklama, formularz,
- idempotencja po Meta lead ID,
- retry po opóźnionych webhookach,
- zapis kampanii i formularza dla raportów.

Aktualna decyzja produktu: nowe leady trafiają do wspólnej puli, bez przypisywania do handlowców i bez automatycznej wysyłki maili.

## Podpis online i SMS

Cel: przenieść proces od zaakceptowanej oferty do umowy bez ręcznego kopiowania statusów.

Do potwierdzenia:

- dostawca podpisu, dostęp API, środowiska i limity,
- tworzenie paczki dokumentów, nadawca, odbiorcy, kolejność i wymagane pola,
- czy SMS jest autoryzacją podpisu, dodatkową weryfikacją, czy częścią konkretnego planu,
- statusy: utworzona, wysłana, otwarta, podpisana, odrzucona, wygasła, zakończona,
- pobranie i archiwizacja dokumentu po zakończeniu,
- poziom podpisu wymagany dla danego typu umowy.

Pierwszy etap w CRM: model danych i statusy. Prawdziwa wysyłka umów dopiero po decyzji prawnej i kosztowej.

## PWA i praca offline

Cel: telefon ma działać szybko w terenie, również przy słabym internecie.

Kandydaci do offline:

- ostatnio otwarte materiały i prezentacje,
- podstawowe dane ostatnio otwartego klienta, jeśli polityka firmy na to pozwala,
- szkice notatek i komentarzy,
- kolejka zmian statusu z widocznym stanem synchronizacji,
- jasny komunikat offline zamiast pustej strony.

Blokujemy offline:

- podpisywanie umów,
- wysyłkę prawdziwej oferty,
- importy plików,
- akcje admina.

## Asystent sprzętowy

Cel: handlowiec może zapytać, czy dany falownik i magazyn energii mają sens techniczny.

Źródła:

- oficjalne PDF producentów,
- instrukcje instalacji,
- katalog produktów firmy,
- zanonimizowane przykłady ofert.

Zasady bezpieczeństwa:

- asystent nie zgaduje,
- przy braku danych mówi, czego brakuje,
- odpowiedź pokazuje napięcie, BMS, komunikację, serię falownika, firmware i ryzyko,
- decyzja techniczna może wymagać akceptacji specjalisty.

## Kolejność

1. Domknąć import leadów i pulę leadów.
2. Podpiąć Meta webhook i sprawdzić prawdziwy formularz.
3. Utrzymać materiały offline w PWA.
4. Rozszerzyć bazę kompatybilności sprzętu.
5. Przygotować pilotaż podpisu online.
6. Dopiero potem decydować o Pstryk, EMS/AI i projektach grupowych.
