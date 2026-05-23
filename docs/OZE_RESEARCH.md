# OZE: research właścicielski

Stan na 2026-05-23. Ten dokument nie jest materiałem dla klienta i nie wchodzi do prezentacji handlowca. Pstryk, EMS/AI, spółdzielnie energetyczne i podpis SMS są tu opisane jako decyzje produktowe dla właściciela.

## Wniosek krótki

Największy potencjał sprzedażowy ma dziś połączenie: fotowoltaika + magazyn energii + jasne wyjaśnienie autokonsumpcji i net-billingu. Pstryk oraz dynamiczne ceny mogą być mocnym wyróżnikiem, ale najpierw powinny wejść jako research i kalkulator scenariuszy, nie jako obietnica w prezentacji. EMS/AI warto przygotować architektonicznie w CRM, lecz wdrażać dopiero po potwierdzeniu konkretnych urządzeń, integracji i odpowiedzialności za sterowanie.

## Pstryk i ceny dynamiczne

Pstryk buduje ofertę wokół rozliczania energii po cenach godzinowych, magazynu energii i automatyzacji zużycia. Publicznie pokazuje też scenariusze, w których klient łączy PV, magazyn i samochód elektryczny, a system przenosi zużycie na tańsze godziny.

Warto wdrożyć w CRM:

- pole "gotowość na taryfę dynamiczną" przy kliencie,
- kalkulator scenariuszy: standardowy net-billing, magazyn, magazyn z cenami dynamicznymi,
- osobną checklistę ryzyk: typ licznika, profil zużycia, gotowość klienta na zmienność cen, auto/ładowarka, pompa ciepła,
- tag leadów: `dynamiczne ceny`, `magazyn`, `EV`, `pompa ciepła`.

Nie wdrażać od razu:

- obietnic konkretnych oszczędności bez danych godzinowych klienta,
- automatycznego doradztwa taryfowego bez regulaminu, źródeł danych i odpowiedzialności,
- komunikacji w prezentacji klienta, dopóki właściciel nie zdecyduje, czy firma bierze ten kierunek sprzedażowo.

Koszt i kto płaci: po stronie CRM koszt to głównie praca developerska i ewentualne API danych cenowych. Po stronie klienta koszt zależy od sprzedawcy energii, taryfy, magazynu, licznika i urządzeń sterujących. W materiałach reklamowych można to wykorzystać jako "audyt gotowości domu na inteligentne rozliczanie energii", bez deklarowania gwarantowanych zysków.

Szansa pozyskania klientów: wysoka w grupie klientów z dużym zużyciem wieczorem, pompą ciepła, EV albo magazynem. Średnia u klientów, którzy chcą prostej faktury i nie akceptują zmienności cen.

## EMS / AI sterujące energią

EMS ma sens, gdy firma chce sprzedawać nie tylko instalację, ale sposób zarządzania energią w domu. AI może pomagać w predykcji produkcji, zużycia, cen i harmonogramu ładowania magazynu. Ryzyko jest takie, że "AI" bez konkretnych integracji będzie marketingiem bez pokrycia.

Warto wdrożyć w CRM:

- katalog urządzeń, które można sterować lub odczytywać,
- pola przy sprzęcie: protokół, chmura producenta, lokalne API, Modbus, licznik, magazyn, falownik,
- asystenta technicznego, który mówi "brak danych" zamiast zgadywać,
- kalkulator: ile energii można przenieść z wieczora na dzień lub z tanich godzin na drogie,
- raport po montażu: produkcja, zużycie, autokonsumpcja, eksport, import, cykle magazynu.

Nie wdrażać od razu:

- automatycznego sterowania falownikiem u klienta z poziomu CRM,
- rekomendacji technicznej bez źródła producenta,
- funkcji, która może pogorszyć gwarancję albo bezpieczeństwo instalacji.

Koszt i kto płaci: firma płaci za rozwój CRM i integracje. Klient płaci za hardware oraz usługę konfiguracji, jeśli zostanie sprzedana jako pakiet premium. Najpierw najlepiej zrobić wersję "doradca + kalkulator + raport", a dopiero później realne sterowanie.

Szansa pozyskania klientów: bardzo dobra dla segmentu premium i firm, które chcą kontroli kosztów. Dla masowego klienta detalicznego temat musi być opowiedziany prosto: "mniej energii oddajesz tanio, więcej zużywasz wtedy, kiedy ma to sens".

## Prosument zbiorowy, wirtualny i spółdzielnie energetyczne

To jest kierunek strategiczny, ale nie szybki moduł sprzedażowy. Prosument zbiorowy i wirtualny oraz spółdzielnie energetyczne wymagają większej pracy formalnej, rozliczeń i koordynacji wielu uczestników. Mogą jednak otworzyć sprzedaż do wspólnot, budynków wielolokalowych, gmin, rolnictwa i małych lokalnych społeczności.

Warto wdrożyć w CRM:

- typ klienta: dom, firma, wspólnota, rolnictwo, gmina, grupa odbiorców,
- osobny pipeline "projekt grupowy",
- checklistę dokumentów: właściciele, punkty poboru energii, PPE, zgody, operator, warunki przyłączenia,
- kalkulator podziału korzyści pomiędzy uczestników,
- miejsce na dokumenty formalne i wersje uzgodnień.

Nie wdrażać od razu:

- obiecywania gotowych spółdzielni bez partnera prawnego,
- automatycznych rozliczeń między uczestnikami bez audytu księgowego,
- komunikacji masowej, zanim powstanie jeden wzorcowy projekt pilotażowy.

Koszt i kto płaci: koszt analizy i dokumentów zwykle po stronie inwestora lub grupy inwestorów. Firma może zarabiać na audycie, projekcie, instalacji i obsłudze. Marketingowo to dobre jako "program dla wspólnot i lokalnych społeczności", ale wymaga mocnego zaplecza formalnego.

Szansa pozyskania klientów: średnia krótkoterminowo, wysoka strategicznie. Najpierw zrobić 1-2 pilotaże z partnerem prawnym, potem budować produkt.

## Podpis online kodem SMS

Model "handlowiec wypełnia dane, system generuje dokument, klient dostaje link/SMS, potwierdza kodem" jest realny operacyjnie. Trzeba jednak oddzielić wygodę procesu od poziomu podpisu elektronicznego.

Najważniejsze rozróżnienie:

- kwalifikowany podpis elektroniczny jest równoważny podpisowi własnoręcznemu,
- zwykły podpis elektroniczny lub akceptacja kodem SMS może być wystarczająca dla wielu procesów, ale zależy od rodzaju dokumentu, wymogów formy i ryzyka sporu,
- przed wdrożeniem umów sprzedażowych trzeba potwierdzić ścieżkę z prawnikiem i dostawcą podpisu.

Warto wdrożyć w CRM już teraz:

- tabelę `signature_requests`,
- statusy: przygotowana, wysłana, otwarta, podpisana, odrzucona, wygasła,
- zapis numeru telefonu, odbiorcy, dokumentu, czasu wysyłki i callbacków dostawcy,
- bramkę admina: bez kompletu PPE, licznika, danych klienta i zgód proces nie idzie dalej,
- eksport paczki dokumentów po podpisaniu.

Nie wdrażać bez decyzji:

- automatycznego wysyłania prawdziwych umów,
- podpisu SMS jako jedynego dowodu dla wszystkich typów dokumentów,
- integracji płatnej z Autenti lub innym dostawcą bez potwierdzenia kosztów.

Koszt i kto płaci: firma płaci za konto/API dostawcy i użycie podpisów. Koszt można wkalkulować w marżę wdrożenia albo traktować jako koszt operacyjny. W CRM musi być blokada, żeby handlowiec nie wysłał umowy bez akceptacji wymaganych pól.

## Rekomendowana kolejność

1. Utrzymać prezentację klienta czystą: PV, magazyn, net-billing, realizacje, proces i zaufanie.
2. W CRM mieć zakładkę właścicielską "Nowe modele OZE" z Pstryk, EMS/AI i projektami grupowymi.
3. Dodać kalkulator gotowości klienta na magazyn i dynamiczne rozliczenia, ale bez obietnic.
4. Rozwinąć asystenta technicznego o oficjalne listy kompatybilności producentów.
5. Zrobić pilotaż podpisu online na jednym typie dokumentu po akceptacji prawnej.
6. Dopiero po pilotażu zdecydować, czy komunikować Pstryk/EMS/AI w sprzedaży.

## Źródła do decyzji

- Pstryk: `https://pstryk.pl/`
- Pstryk, przykład PV + magazyn + ceny dynamiczne: `https://pstryk.pl/blog/12-tys-zl-oszczednosci-w-rok-u-klienta-pstryk-ktory-polaczyl-ceny-dynamiczne-z-fotowoltaika-magazynem-energii-i-samochodem-elektrycznym`
- Ceny dynamiczne Enea: `https://www.enea.pl/ceny-dynamiczne`
- Prosument wirtualny, gov.pl: `https://www.gov.pl/web/klimat/prosument-wirtualny`
- Prosument zbiorowy, gov.pl: `https://www.gov.pl/web/rozwoj-technologia/pierwszy-prosument-zbiorowy-juz-czerpie-korzysci`
- Spółdzielnie energetyczne, gov.pl: `https://www.gov.pl/web/rolnictwo/minister-stefan-krajewski-spoldzielnie-energetyczne-to-przyszlosc-i-niezaleznosc-polskiej-wsi`
- Autenti SMS: `https://autenti.com/en/features/authorization-using-sms-code`
- Autenti, typy podpisów: `https://help.autenti.com/en/knowledge/what-are-the-types-of-electronic-signatures`
- Autenti, legalność użycia: `https://help.autenti.com/en/knowledge/is-it-legal-to-use-autenti`
