export type AppLanguage = "pl" | "en";

export const LANGUAGE_STORAGE_KEY = "bcrm-language";

export const languageOptions: Array<{ value: AppLanguage; label: string }> = [
  { value: "pl", label: "PL" },
  { value: "en", label: "EN" }
];

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "pl" || value === "en";
}

export const copy = {
  pl: {
    loginSubtitle: "Logowanie do panelu",
    email: "E-mail",
    password: "Hasło",
    signIn: "Zaloguj",
    signingIn: "Logowanie",
    demoIntro: "Demo: kliknij wybraną rolę albo wpisz alias, np. demo-handlowiec, z hasłem demo.",
    showDemo: "Wypróbuj demo",
    hideDemo: "Ukryj demo",
    supabaseMissing: "Brakuje danych Supabase w pliku .env.local.",
    loginError: "Nie udało się zalogować. Sprawdź e-mail i hasło.",
    fullAccess: "Pełny podgląd CRM",
    managerDemo: "Zespół i akceptacje",
    salespersonDemo: "Leady i umowy",
    accountingDemo: "Dokumenty i rozliczenia",
    logisticsDemo: "Kompletacja i zamówienia",
    installerDemo: "Montaż i realizacja",
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
  },
  en: {
    loginSubtitle: "Sign in to the workspace",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in",
    demoIntro: "Demo: choose a role or enter an alias, for example demo-handlowiec, with password demo.",
    showDemo: "Try demo",
    hideDemo: "Hide demo",
    supabaseMissing: "Supabase configuration is missing in .env.local.",
    loginError: "Sign-in failed. Check the email and password.",
    fullAccess: "Full CRM access",
    managerDemo: "Team and approvals",
    salespersonDemo: "Leads and contracts",
    accountingDemo: "Documents and settlements",
    logisticsDemo: "Picking and orders",
    installerDemo: "Installation workflow",
    panelPrefix: "Workspace",
    navDashboard: "Dashboard",
    navTeamDashboard: "Team dashboard",
    navMyLeads: "My leads",
    navSales: "Sales / Leads",
    navOperations: "Contracts and process",
    navFinance: "Finance",
    navAccounting: "Accounting",
    navEquipment: "Equipment and warehouse",
    navLogistics: "Logistics",
    navInstallation: "Installation",
    navNewLead: "New lead",
    navCalendar: "Calendar",
    navCalculators: "Calculators",
    navSettings: "Settings",
    navImport: "CSV import",
    navUsers: "Users",
    navGroupMain: "Main",
    navGroupSales: "Sales",
    navGroupOperations: "Process",
    navGroupCompany: "Company",
    menu: "Menu",
    signOut: "Sign out",
    returnLeads: "Return leads",
    returnLeadsTitle: "Return leads without callback or meeting",
    returnLeadsConfirm:
      "Return all leads without a scheduled callback or meeting? Leads in Callback and Meeting statuses will stay assigned to you."
  }
} as const;
