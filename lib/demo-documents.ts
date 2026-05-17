export type DemoDocumentType = "contract" | "credit";

export type ExtractedDocumentData = {
  type: DemoDocumentType;
  title: string;
  sourceName: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  pesel: string;
  contractNumber: string;
  installationPowerKw: number;
  panelCount: number;
  panelPowerWp: number;
  grossPrice: number;
  financing: "Kredyt" | "Gotówka" | "Kredyt z wkładem własnym";
  ownContribution: number;
  creditAmount: number;
  notes: string[];
};

export type AnnexDraftInput = {
  clientName: string;
  contractNumber: string;
  panelCount: number;
  installationPowerKw: number;
  grossPrice: number;
  financing: string;
  manualText: string;
};

export type InvoiceDraftInput = {
  buyerName: string;
  buyerAddress: string;
  contractNumber: string;
  grossPrice: number;
};

export const DEMO_DOCUMENTS: Record<DemoDocumentType, ExtractedDocumentData> = {
  contract: {
    type: "contract",
    title: "Umowa PV",
    sourceName: "Umowa na fotowoltaikę.pdf",
    clientName: "Jan Nowak",
    phone: "501 202 303",
    email: "jan.nowak@example.com",
    address: "ul. Słoneczna 14, 20-001 Lublin",
    postalCode: "20-001",
    pesel: "900101*****",
    contractNumber: "B/2026/041",
    installationPowerKw: 7.5,
    panelCount: 15,
    panelPowerWp: 500,
    grossPrice: 42900,
    financing: "Kredyt",
    ownContribution: 0,
    creditAmount: 42900,
    notes: [
      "Wykryto umowę dostawy i montażu instalacji fotowoltaicznej.",
      "Dane klienta są propozycją do zatwierdzenia przed przekazaniem dalej.",
      "Kwota i forma finansowania mogą zasilić fakturę oraz aneks."
    ]
  },
  credit: {
    type: "credit",
    title: "Wniosek kredytowy",
    sourceName: "WNIOSEK KREDYTOWY.pdf",
    clientName: "Jan Nowak",
    phone: "501 202 303",
    email: "jan.nowak@example.com",
    address: "ul. Słoneczna 14, 20-001 Lublin",
    postalCode: "20-001",
    pesel: "900101*****",
    contractNumber: "B/2026/041",
    installationPowerKw: 7.5,
    panelCount: 15,
    panelPowerWp: 500,
    grossPrice: 42900,
    financing: "Kredyt z wkładem własnym",
    ownContribution: 5900,
    creditAmount: 37000,
    notes: [
      "Wykryto dane wymagane do obsługi finansowania.",
      "Wniosek nie zastępuje decyzji banku ani weryfikacji księgowej.",
      "Dane finansowania mogą automatycznie uzupełnić aneks."
    ]
  }
};

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2
  }).format(value);
}

export function buildInvoiceDraft(input: InvoiceDraftInput) {
  const net = Math.round((input.grossPrice / 1.08) * 100) / 100;
  const vat = Math.round((input.grossPrice - net) * 100) / 100;

  return {
    number: `FV/${new Date().getFullYear()}/${input.contractNumber.replaceAll("/", "-")}`,
    issueDate: new Date().toISOString().slice(0, 10),
    sellerName: "B-CRM Demo Sp. z o.o.",
    sellerAddress: "ul. Energetyczna 12, 20-001 Lublin",
    sellerNip: "946-000-00-00",
    buyerName: input.buyerName,
    buyerAddress: input.buyerAddress,
    itemName: `Instalacja fotowoltaiczna - umowa ${input.contractNumber}`,
    net,
    vat,
    gross: input.grossPrice
  };
}

export function buildAnnexText(input: AnnexDraftInput) {
  const automaticText = [
    `ANEKS do umowy ${input.contractNumber}`,
    "",
    `Strony potwierdzają zmianę parametrów realizacji dla klienta ${input.clientName}.`,
    `Nowa liczba modułów: ${input.panelCount}.`,
    `Nowa moc instalacji: ${input.installationPowerKw.toFixed(2)} kWp.`,
    `Nowe wynagrodzenie brutto: ${formatMoney(input.grossPrice)}.`,
    `Forma finansowania: ${input.financing}.`,
    "",
    "Pozostałe postanowienia umowy pozostają bez zmian."
  ].join("\n");

  return input.manualText.trim() || automaticText;
}
