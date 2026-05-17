"use client";

import { useEffect } from "react";
import type { AppLanguage } from "@/lib/i18n";

const dictionary: Record<string, string> = {
  "Panel admina": "Admin dashboard",
  "Panel menadżera": "Manager dashboard",
  "Panel handlowca": "Sales dashboard",
  "Panel realizacji": "Operations panel",
  "Wszystkie leady, przypisania i bieżące statusy.": "All leads, assignments and current statuses.",
  "Leady zespołu, baza do rozdania i bieżące statusy.": "Team leads, lead pool and current statuses.",
  "Wszystkie": "All",
  "Nieprzypisane": "Unassigned",
  "Przypisane": "Assigned",
  "Spotkania": "Meetings",
  "Umowy": "Contracts",
  "Rezygnacje": "Resignations",
  "Bez akcji": "No action",
  "Eksport CSV": "Export CSV",
  "Odśwież": "Refresh",
  "Realizacja po umowie": "Post-contract operations",
  "Dokumenty, księgowość, logistyka, montaż i generator aneksu w jednym miejscu.": "Documents, accounting, logistics, installation and annex generation in one place.",
  "Otwórz realizację": "Open operations",
  "Wyniki zespołu": "Team results",
  "Leady, spotkania, umowy i ryzyka operacyjne.": "Leads, meetings, contracts and operational risks.",
  "Handlowiec": "Salesperson",
  "Leady": "Leads",
  "Zaległe call-backi": "Overdue call-backs",
  "Filtry i sortowanie": "Filters and sorting",
  "Pokaż filtry": "Show filters",
  "Ukryj filtry": "Hide filters",
  "Baza leadów": "Lead pool",
  "Zwrócone": "Returned",
  "Wyczyść": "Clear",
  "Dodane od": "Created from",
  "Dodane do": "Created to",
  "Modyfikacja od": "Updated from",
  "Modyfikacja do": "Updated to",
  "Otwarcie od": "Opened from",
  "Otwarcie do": "Opened to",
  "Kod pocztowy": "Postal code",
  "Województwo": "Voivodeship",
  "Powiat": "County",
  "Status": "Status",
  "Sortowanie": "Sorting",
  "Wszyscy": "All",
  "Masowe przypisanie": "Bulk assignment",
  "Wybierz handlowca": "Choose salesperson",
  "Przypisz": "Assign",
  "Co zrobić teraz": "What to do now",
  "Najpilniejsze leady do obsłużenia.": "Most urgent leads to handle.",
  "Brak pilnych zadań.": "No urgent tasks.",
  "Dzisiejsze spotkania": "Today's meetings",
  "Szybki filtr statusu": "Quick status filter",
  "Moje leady": "My leads",
  "Nowy lead": "New lead",
  "Ręczne dodanie kontaktu z własnego źródła, polecenia, B2B albo B2C.": "Manually add a contact from own source, referral, B2B or B2C.",
  "Dane kontaktowe": "Contact details",
  "Źródło": "Source",
  "Imię i nazwisko": "Full name",
  "Telefon": "Phone",
  "Adres": "Address",
  "Dodaj leada": "Add lead",
  "Wróć": "Back",
  "Dane umowy": "Contract data",
  "Operacyjny widok dla działów odpowiedzialnych za umowę, rozliczenie, kompletację i montaż. Dane można wprowadzić ręcznie, dodać plik umowy i zaprezentować na bezpiecznym zestawie demo.": "Operational view for teams responsible for the contract, settlement, logistics and installation. Data can be entered manually, a contract PDF can be added, and a safe demo set can be presented.",
  "Zalogowana rola": "Signed-in role",
  "Postęp realizacji": "Operations progress",
  "Wprowadź dane produkcyjne albo użyj danych demo do prezentacji.": "Enter production data or use demo data for presentation.",
  "Pokaż umowę demo": "Show demo contract",
  "Wprowadź dane demo": "Enter demo data",
  "Podgląd z formularza": "Preview from form",
  "Dodaj umowę PDF": "Add contract PDF",
  "Workflow działów": "Department workflow",
  "Kontrola etapów od sprzedaży do montażu.": "Control stages from sales to installation.",
  "Wykonane": "Done",
  "Do akcji": "Action needed",
  "Czeka": "Waiting",
  "Cofnij": "Undo",
  "Oznacz": "Mark",
  "Paczka księgowa": "Accounting package",
  "Dane rozliczeniowe przygotowane na podstawie aktualnej umowy.": "Settlement data prepared from the current contract.",
  "Przygotuj paczkę księgową": "Prepare accounting package",
  "Paczka gotowa": "Package ready",
  "Pobierz fakturę PDF": "Download invoice PDF",
  "KSeF": "KSeF",
  "Przygotowanie danych do wysyłki faktury ustrukturyzowanej.": "Preparing data for structured invoice submission.",
  "Wyślij do KSeF": "Send to KSeF",
  "Generator aneksu": "Annex generator",
  "Aneks generuje się jako PDF z danych aktualnej umowy i wskazanych zmian.": "The annex is generated as a PDF from the current contract data and selected changes.",
  "Pobierz aneks PDF": "Download annex PDF",
  "Tryb automatyczny": "Automatic mode",
  "Tryb ręczny": "Manual mode",
  "Data umowy": "Contract date",
  "Opiekun": "Account owner",
  "Sprzedawca": "Seller",
  "NIP sprzedawcy": "Seller tax ID",
  "Klient": "Client",
  "Miasto": "City",
  "Dokument tożsamości": "Identity document",
  "Liczba paneli": "Panel count",
  "Panele": "Panels",
  "Moc": "Power",
  "Moc instalacji": "Installation power",
  "Falownik": "Inverter",
  "Cena netto": "Net price",
  "Cena brutto": "Gross price",
  "Finansowanie": "Financing",
  "Rata": "Installment",
  "Termin montażu": "Installation date",
  "Uwagi magazynowe": "Warehouse notes",
  "Nabywca": "Buyer",
  "Kwota brutto": "Gross amount",
  "CRM przygotowuje dane faktury w strukturze wymaganej do dalszej obsługi KSeF. Produkcyjna wysyłka wymaga aktywnej integracji z kontem firmy i uprawnieniami księgowymi.": "CRM prepares invoice data in the structure required for KSeF processing. Production submission requires an active company integration and accounting permissions.",
  "Zmiana liczby paneli": "Panel count change",
  "Zmiana mocy instalacji": "Installation power change",
  "Zmiana ceny": "Price change",
  "Zmiana falownika": "Inverter change",
  "Zmiana finansowania": "Financing change",
  "Zmiana terminu montażu": "Installation date change",
  "Dane finansowania": "Financing data",
  "Menadżer": "Manager",
  "Księgowość": "Accounting",
  "Logistyka": "Logistics",
  "Monter": "Installer",
  "Akceptuje kompletność danych i przekazuje sprawę do realizacji.": "Approves data completeness and moves the case into delivery.",
  "Widzi moc, liczbę paneli, sprzęt, uwagi magazynowe i termin montażu.": "Sees power, panel count, equipment, warehouse notes and installation date.",
  "Pracuje na gotowym rekordzie z adresem, terminem i specyfikacją instalacji.": "Works from a ready record with address, date and installation specification.",
  "Pokaż finansowanie demo": "Show demo financing",
  "Ukryj finansowanie demo": "Hide demo financing",
  "Umowa demo": "Demo contract",
  "Podgląd otwiera się w osobnym oknie, bez automatycznego pobierania danych klienta.": "The preview opens in a separate modal without automatically downloading client data.",
  "Użytkownicy": "Users",
  "Konta, role i przypisania w CRM.": "Accounts, roles and assignments in CRM.",
  "Nowy użytkownik": "New user",
  "Hasło startowe": "Initial password",
  "Rola": "Role",
  "Dodaj": "Add",
  "Filtr roli": "Role filter",
  "Wszystkie role": "All roles",
  "Struktura zespołu": "Team structure",
  "Przypisanie handlowców do menadżerów.": "Salespeople assigned to managers.",
  "Brak przypisanych handlowców.": "No assigned salespeople.",
  "Bez menadżera": "No manager",
  "Utworzony": "Created",
  "Akcja": "Action",
  "Autozapis": "Autosave",
  "Usuń": "Delete",
  "Lead": "Lead",
  "Region": "Region",
  "Terminy": "Dates",
  "Dodany": "Created",
  "Bez źródła": "No source",
  "brak kodu": "no code",
  "Nieprzypisany": "Unassigned",
  "Brak leadów w tym widoku.": "No leads in this view.",
  "Zadzwoń": "Call",
  "Umowa": "Contract",
  "Brak numeru umowy": "No contract number",
  "Ostatnie otwarcie": "Last opened",
  "Modyfikacja": "Updated",
  "Call-back": "Call-back",
  "Spotkanie": "Meeting",
  "Numer umowy": "Contract number",
  "Notatka po spotkaniu": "Post-meeting note",
  "Status i terminy": "Status and dates",
  "Zapisz": "Save",
  "Zwrot": "Return",
  "Dane adresowe": "Address data",
  "Zapisz dane": "Save data",
  "Przypisanie": "Assignment",
  "Zapisz przypisanie": "Save assignment",
  "Komentarz": "Comment",
  "Dodaj komentarz": "Add comment",
  "Aktywności": "Activities",
  "Pliki": "Files",
  "Przypomnienia": "Reminders",
  "Historia leada": "Lead history",
  "Zamknij": "Close",
  "Dane w podglądzie": "Preview data",
  "Tryb": "Mode",
  "Wysłano": "Sent",
  "Payload repozytorium": "Repository payload",
  "Odpowiedź API": "API response",
  "Błędny numer": "Wrong number",
  "Nie odebrał": "No answer",
  "Do weryfikacji": "Needs verification",
  "Otwórz kartę leada": "Open lead card"
};

const originalText = new WeakMap<Text, string>();

function translateText(value: string, language: AppLanguage) {
  if (language === "pl") return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const trimmed = value.trim();
  if (!trimmed) return value;
  const activeFilters = trimmed.match(/^Aktywne filtry: (\d+)$/);
  if (activeFilters) return `${leading}Active filters: ${activeFilters[1]}${trailing}`;
  const selectedLeads = trimmed.match(/^Zaznaczone leady: (\d+)$/);
  if (selectedLeads) return `${leading}Selected leads: ${selectedLeads[1]}${trailing}`;
  const records = trimmed.match(/^(\d+) rekordów$/);
  if (records) return `${leading}${records[1]} records${trailing}`;
  const selectLead = trimmed.match(/^Zaznacz (.+)$/);
  if (selectLead) return `${leading}Select ${selectLead[1]}${trailing}`;
  return dictionary[trimmed] ? `${leading}${dictionary[trimmed]}${trailing}` : value;
}

function translateNode(node: Text, language: AppLanguage) {
  if (!originalText.has(node)) originalText.set(node, node.nodeValue || "");
  const original = originalText.get(node) || "";
  if (language === "pl") {
    if (node.nodeValue !== original) node.nodeValue = original;
    return;
  }
  const translated = translateText(original, language);
  if (translated === original) return;
  if (node.nodeValue !== translated) node.nodeValue = translated;
}

function shouldSkip(parent: Node | null) {
  if (!(parent instanceof HTMLElement)) return true;
  return ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName);
}

function walk(root: Node, language: AppLanguage) {
  if (root instanceof Text) {
    if (!shouldSkip(root.parentNode)) translateNode(root, language);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!shouldSkip(node.parentNode)) translateNode(node as Text, language);
    node = walker.nextNode();
  }
}

export function AutoTranslator({ language }: { language: AppLanguage }) {
  useEffect(() => {
    walk(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => walk(node, language));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
