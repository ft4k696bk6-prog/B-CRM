export const THEME_STORAGE_KEY = "bcrm-appearance";

export const themePacks = [
  {
    id: "system",
    name: "Systemowy",
    description: "Automatycznie dopasowuje jasny lub ciemny wygląd do ustawień urządzenia."
  },
  {
    id: "light",
    name: "Jasny",
    description: "Zawsze używa jasnego wyglądu CRM."
  },
  {
    id: "dark",
    name: "Ciemny",
    description: "Zawsze używa ciemnego wyglądu CRM."
  }
] as const;

export type ThemeName = (typeof themePacks)[number]["id"];

export const defaultTheme: ThemeName = "system";

export function isThemeName(value: string): value is ThemeName {
  return themePacks.some((theme) => theme.id === value);
}

export function userThemeStorageKey(userId: string) {
  return `${THEME_STORAGE_KEY}:${userId}`;
}
