export type AppLanguage = "pl" | "en";

export const LANGUAGE_STORAGE_KEY = "bcrm-language";

export const languageOptions: Array<{ value: AppLanguage; label: string }> = [
  { value: "pl", label: "PL" }
];

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "pl";
}

export const copy = {
  pl: {
    loginSubtitle: "Logowanie do panelu",
    email: "E-mail",
    password: "Hasło",
    signIn: "Zaloguj",
    signingIn: "Logowanie",
    supabaseMissing: "Brakuje danych Supabase w pliku .env.local.",
    loginError: "Nie udało się zalogować. Sprawdź e-mail i hasło.",
    panelPrefix: "Panel",
    navDashboard: "Panel",
    navTeamDashboard: "Panel zespołu",
    navMyLeads: "Moje leady",
    navSales: "Sprzedaż / Leady",
    navOperations: "Umowy i proces",
    navFinance: "Finanse",
    navAccounting: "Księgowość",
    navEquipment: "Sprzęt i magazyn",
    navLogistics: "Logistyka",
    navInstallation: "Montaż",
    navNewLead: "Nowy lead",
    navCalendar: "Kalendarz",
    navCalculators: "Kalkulatory",
    navMaterials: "Skarbnica wiedzy",
    navAssistant: "Asystent",
    navSettings: "Ustawienia",
    navImport: "Import CSV",
    navUsers: "Użytkownicy",
    navGroupMain: "Główne",
    navGroupSales: "Sprzedaż",
    navGroupOperations: "Proces",
    navGroupCompany: "Firma",
    menu: "Menu",
    signOut: "Wyloguj",
    returnLeads: "Zwrot leadów",
    returnLeadsTitle: "Zwróć leady bez call-backu i spotkania",
    returnLeadsConfirm:
      "Zwrócić wszystkie leady bez zaplanowanego call-backu i spotkania? Leady ze statusem Call-back i Spotkanie zostaną u Ciebie."
  }
} as const;
