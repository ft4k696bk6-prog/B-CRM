export type DemoCustomerRecord = {
  contractNumber: string;
  contractDate: string;
  sellerName: string;
  companyName: string;
  companyNip: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  pesel: string;
  identityDocument: string;
  installationPowerKw: string;
  panelsCount: string;
  inverterModel: string;
  netPrice: string;
  grossPrice: string;
  financing: string;
  creditInstallment: string;
  montageDate: string;
  warehouseNote: string;
};

export const demoContractData: DemoCustomerRecord = {
  contractNumber: "BCRM/05/2026/017",
  contractDate: "2026-05-17",
  sellerName: "Anna Nowak",
  companyName: "B-CRM Energy Sp. z o.o.",
  companyNip: "9480000000",
  clientName: "Jan Kowalski",
  phone: "600 700 800",
  email: "jan.kowalski@example.com",
  address: "ul. Słoneczna 14",
  city: "Radom",
  postalCode: "26-600",
  pesel: "90010112345",
  identityDocument: "ADA123456",
  installationPowerKw: "9.84",
  panelsCount: "24",
  inverterModel: "Deye SUN-10K-SG04LP3-EU",
  netPrice: "31 900 PLN",
  grossPrice: "39 237 PLN",
  financing: "Kredyt 100%",
  creditInstallment: "542 PLN / 120 mies.",
  montageDate: "2026-06-08",
  warehouseNote: "Konstrukcja na dachówkę, czarne ramy paneli."
};

export const contractFieldLabels: Record<keyof DemoCustomerRecord, string> = {
  contractNumber: "Numer umowy",
  contractDate: "Data umowy",
  sellerName: "Opiekun",
  companyName: "Sprzedawca",
  companyNip: "NIP sprzedawcy",
  clientName: "Klient",
  phone: "Telefon",
  email: "E-mail",
  address: "Adres",
  city: "Miasto",
  postalCode: "Kod pocztowy",
  pesel: "PESEL",
  identityDocument: "Dokument tożsamości",
  installationPowerKw: "Moc instalacji",
  panelsCount: "Liczba paneli",
  inverterModel: "Falownik",
  netPrice: "Cena netto",
  grossPrice: "Cena brutto",
  financing: "Finansowanie",
  creditInstallment: "Rata",
  montageDate: "Termin montażu",
  warehouseNote: "Uwagi magazynowe"
};

export const demoCreditData = {
  bank: "Bank Zielonej Energii",
  loanAmount: "39 237 PLN",
  ownPayment: "0 PLN",
  installment: "542 PLN",
  period: "120 miesięcy",
  decision: "Wstępna zgoda",
  scoring: "Bardzo dobry"
};

export const creditFieldLabels: Record<keyof typeof demoCreditData, string> = {
  bank: "Bank",
  loanAmount: "Kwota kredytu",
  ownPayment: "Wpłata własna",
  installment: "Rata",
  period: "Okres",
  decision: "Decyzja",
  scoring: "Scoring"
};

export const annexChangeOptions = [
  "Zmiana liczby paneli",
  "Zmiana mocy instalacji",
  "Zmiana ceny",
  "Zmiana falownika",
  "Zmiana finansowania",
  "Zmiana terminu montażu"
];

export const ksefDisclaimer =
  "CRM przygotowuje dane faktury w strukturze wymaganej do dalszej obsługi KSeF. Produkcyjna wysyłka wymaga aktywnej integracji z kontem firmy i uprawnieniami księgowymi.";
