export type SalesMaterial = {
  id: string;
  title: string;
  category: "presentation" | "knowledge" | "checklist" | "contract" | "technical";
  description: string;
  href: string;
  offlineReady: boolean;
};

export const salesMaterials: SalesMaterial[] = [
  {
    id: "client-presentation",
    title: "Prezentacja dla klienta",
    category: "presentation",
    description: "Ogólna prezentacja PV i magazynu energii bez cen, Pstryk oraz EMS/AI.",
    href: "/materials/b-crm-energy-prezentacja.pdf",
    offlineReady: true
  },
  {
    id: "meeting-checklist",
    title: "Checklista spotkania",
    category: "checklist",
    description: "Dane, które handlowiec musi zebrać przed ofertą i umową.",
    href: "/materials/checklista-spotkania.pdf",
    offlineReady: true
  },
  {
    id: "net-billing",
    title: "Net-billing prostym językiem",
    category: "knowledge",
    description: "Krótka karta wiedzy do rozmowy z klientem bez straszenia technikaliami.",
    href: "/materials/net-billing.pdf",
    offlineReady: true
  },
  {
    id: "storage-basics",
    title: "Magazyn energii: rozmowa z klientem",
    category: "knowledge",
    description: "Jak wyjaśnić po co jest magazyn, kiedy ma sens i co realnie zmienia.",
    href: "/materials/magazyn-energii.pdf",
    offlineReady: true
  },
  {
    id: "contract-gate",
    title: "Brama umowy",
    category: "contract",
    description: "Lista potwierdzeń handlowca, kierownika i admina przed puszczeniem procesu dalej.",
    href: "/materials/brama-umowy.pdf",
    offlineReady: true
  },
  {
    id: "equipment-fit",
    title: "Dobór sprzętu i kompatybilność",
    category: "technical",
    description: "Skrót zasad: LV/HV, CAN/RS485, BMS, firmware i kiedy pytać technika.",
    href: "/assistant",
    offlineReady: false
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
