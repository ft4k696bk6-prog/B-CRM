export type SalesMaterial = {
  id: string;
  title: string;
  category: "presentation" | "catalog" | "contract" | "credit";
  description: string;
  href: string;
  offlineReady: boolean;
};

export const salesMaterials: SalesMaterial[] = [
  {
    id: "client-presentation",
    title: "Prezentacja Re-Energy System",
    category: "presentation",
    description: "Aktualna prezentacja do rozmowy z klientem i pokazania oferty firmy.",
    href: "/materials/prezentacja-re-energy-system.pdf",
    offlineReady: true
  },
  {
    id: "pv-contract",
    title: "Umowa na fotowoltaikę",
    category: "contract",
    description: "Wzór umowy dla klienta, dostępny do pobrania z poziomu CRM.",
    href: "/materials/umowa-na-fotowoltaike.pdf",
    offlineReady: true
  },
  {
    id: "credit-application",
    title: "Wniosek kredytowy",
    category: "credit",
    description: "Dokument finansowania dla klienta, gdy oferta przechodzi w kredyt.",
    href: "/materials/wniosek-kredytowy.pdf",
    offlineReady: true
  },
  {
    id: "deye-1f",
    title: "Karta katalogowa Deye 1F",
    category: "catalog",
    description: "Karta falownika hybrydowego jednofazowego Deye.",
    href: "/materials/karta-deye-1f-hybryda.pdf",
    offlineReady: true
  },
  {
    id: "deye-3f",
    title: "Karta katalogowa Deye 3F",
    category: "catalog",
    description: "Karta falownika hybrydowego trójfazowego Deye.",
    href: "/materials/karta-deye-3f-hybryda.pdf",
    offlineReady: true
  },
  {
    id: "kon-tec-mana-5",
    title: "Kon-TEC MANA 5",
    category: "catalog",
    description: "Karta katalogowa magazynu energii Kon-TEC MANA 5.",
    href: "/materials/karta-kon-tec-mana-5.pdf",
    offlineReady: true
  },
  {
    id: "kon-tec-mana-10",
    title: "Kon-TEC MANA 10",
    category: "catalog",
    description: "Karta katalogowa magazynu energii Kon-TEC MANA 10.",
    href: "/materials/karta-kon-tec-mana-10.pdf",
    offlineReady: true
  },
  {
    id: "kon-tec-mana-16",
    title: "Kon-TEC MANA 16",
    category: "catalog",
    description: "Karta katalogowa magazynu energii Kon-TEC MANA 16.",
    href: "/materials/karta-kon-tec-mana-16.pdf",
    offlineReady: true
  },
  {
    id: "ja-solar-500w",
    title: "Karta katalogowa JA Solar 500 W",
    category: "catalog",
    description: "Karta modułu JA Solar używanego w kalkulatorze oferty.",
    href: "/materials/karta-ja-solar-500w.pdf",
    offlineReady: true
  },
  {
    id: "felicity-fla48280",
    title: "Felicity FLA48280TG2-EU",
    category: "catalog",
    description: "Karta katalogowa magazynu energii Felicity.",
    href: "/materials/karta-felicity-fla48280tg2-eu.pdf",
    offlineReady: true
  },
  {
    id: "felicity-fla48460",
    title: "Felicity FLA48460TG2-EU",
    category: "catalog",
    description: "Karta katalogowa magazynu energii Felicity.",
    href: "/materials/karta-felicity-fla48460tg2-eu.pdf",
    offlineReady: true
  }
];

export const meetingChecklist = [
  "Potwierdź imię, nazwisko, telefon i e-mail klienta.",
  "Potwierdź adres montażu, kod pocztowy, województwo i powiat.",
  "Zbierz numer PPE, numer licznika i informację o właścicielu licznika.",
  "Zapisz aktualny rachunek, zużycie roczne i taryfę.",
  "Ustal moc instalacji, magazyn, wariant montażu i łączną długość kabla.",
  "Dodaj notatkę po spotkaniu albo nagraj komentarz głosowy.",
  "Wyślij ofertę na e-mail klienta z CRM i sprawdź zdarzenia otwarcia/pobrania.",
  "Przekaż umowę do kierownika dopiero po kompletnej checkliście."
];

export const managerGateChecklist = [
  "Dane klienta są kompletne i spójne z rozmową.",
  "Adres montażu, PPE i numer licznika są wpisane.",
  "Dobór sprzętu nie ma czerwonej flagi kompatybilności.",
  "Cena, marża i finansowanie są zatwierdzone.",
  "Oferta została wysłana klientowi i ma ślad zdarzeń.",
  "Dokumenty wymagane do umowy są w plikach klienta."
];
