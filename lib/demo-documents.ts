export type DemoCustomerRecord = {
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

export const demoCreditData = {
  bank: "Bank Zielonej Energii",
  loanAmount: "39 237 PLN",
  ownPayment: "0 PLN",
  installment: "542 PLN",
  period: "120 miesięcy",
  decision: "Wstępna zgoda",
  scoring: "Bardzo dobry"
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
  "To jest gotowa symulacja procesu KSeF. Produkcyjna wysyłka wymaga podpięcia danych konkretnej firmy, certyfikatów oraz osobnej walidacji prawno-księgowej.";
