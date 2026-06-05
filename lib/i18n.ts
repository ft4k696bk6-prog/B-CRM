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
    loginSubtitle: "Logowanie do B-CRM",
    email: "E-mail",
    password: "Hasło",
    signIn: "Zaloguj",
    signingIn: "Logowanie",
    supabaseMissing: "Panel chwilowo nie jest gotowy do logowania. Skontaktuj się z administratorem.",
    loginError: "Nie udało się zalogować. Sprawdź e-mail i hasło.",
    panelPrefix: "Panel",
    navDashboard: "Panel",
    navTeamDashboard: "Panel zespołu",
    navMyLeads: "Moje leady",
    navNewLead: "Nowy lead",
    navCalendar: "Kalendarz",
    navCalculators: "Kalkulatory",
    navMaterials: "Skarbnica wiedzy",
    navSettings: "Ustawienia",
    navUsers: "Użytkownicy",
    navGroupMain: "Główne",
    navGroupSales: "Sprzedaż",
    navGroupCompany: "Firma",
    menu: "Menu",
    signOut: "Wyloguj",
    returnLeads: "Zwrot leadów",
    returnLeadsTitle: "Zwróć leady bez oddzwonienia i spotkania",
    returnLeadsConfirm:
      "Zwrócić wszystkie leady bez zaplanowanego oddzwonienia i spotkania? Leady ze statusem Oddzwonienie i Spotkanie zostaną u Ciebie."
  }
} as const;
