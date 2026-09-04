export type KnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  content: string;
  source_url: string | null;
  updated_at: string;
  built_in?: boolean;
};

const UPDATED_AT = "2026-06-01T00:00:00.000Z";

export const BUILT_IN_KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: "built-in-sales-first-contact",
    title: "Pierwszy kontakt i kwalifikacja klienta",
    category: "Sprzedaż",
    content: "Potwierdź dane kontaktowe, adres inwestycji, rodzaj dachu, zużycie energii i oczekiwany termin. Zapisz ustalenia w CRM oraz umów kolejny konkretny krok.",
    source_url: null,
    updated_at: UPDATED_AT,
    built_in: true,
  },
  {
    id: "built-in-contract-checklist",
    title: "Checklista kompletnej umowy",
    category: "Umowy",
    content: "Przed wysłaniem sprawdź dane klienta, adres, numer i datę umowy, finansowanie, konfigurację instalacji, kwotę brutto, podpisy oraz komplet wymaganych załączników.",
    source_url: null,
    updated_at: UPDATED_AT,
    built_in: true,
  },
  {
    id: "built-in-fulfilment-handoff",
    title: "Przekazanie umowy do realizacji",
    category: "Realizacja",
    content: "Zweryfikuj kompletność umowy, potwierdź zakres techniczny i finansowanie, a następnie przekaż zlecenie do zamówienia sprzętu. Każdą zmianę etapu uzupełnij krótką notatką, jeśli wymaga wyjaśnienia.",
    source_url: null,
    updated_at: UPDATED_AT,
    built_in: true,
  },
  {
    id: "built-in-installation-prep",
    title: "Przygotowanie i potwierdzenie montażu",
    category: "Montaż",
    content: "Przed umówieniem terminu potwierdź dostępność sprzętu, ekipę, adres, kontakt do klienta i warunki techniczne. Dzień przed montażem potwierdź termin z klientem i ekipą.",
    source_url: null,
    updated_at: UPDATED_AT,
    built_in: true,
  },
  {
    id: "built-in-settlement-checklist",
    title: "Checklista rozliczenia realizacji",
    category: "Rozliczenia",
    content: "Przed oznaczeniem realizacji jako rozliczonej sprawdź protokół odbioru, dokumentację zdjęciową, faktury, płatności, dokumenty finansowania i wymagane zgłoszenia.",
    source_url: null,
    updated_at: UPDATED_AT,
    built_in: true,
  },
  {
    id: "built-in-data-security",
    title: "Bezpieczna praca z danymi klienta",
    category: "Bezpieczeństwo",
    content: "Korzystaj wyłącznie z kont firmowych, nie pobieraj dokumentów klienta na prywatne urządzenia, nie udostępniaj linków publicznie i nadawaj dostęp tylko osobom uczestniczącym w realizacji.",
    source_url: null,
    updated_at: UPDATED_AT,
    built_in: true,
  },
];

export function filterKnowledge(articles: KnowledgeArticle[], search = "", category = "") {
  const normalizedSearch = search.trim().toLocaleLowerCase("pl-PL");
  return articles.filter((article) => {
    if (category && article.category !== category) return false;
    if (!normalizedSearch) return true;
    return [article.title, article.content, article.category]
      .join(" ")
      .toLocaleLowerCase("pl-PL")
      .includes(normalizedSearch);
  });
}

export function knowledgeCategories(articles: KnowledgeArticle[]) {
  return [...new Set(articles.map((article) => article.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pl"),
  );
}
