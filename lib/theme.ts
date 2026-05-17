export const THEME_STORAGE_KEY = "bcrm-theme";

export const themePacks = [
  {
    id: "default",
    name: "Solar",
    description: "Jasny, energetyczny i neutralny biznesowo."
  },
  {
    id: "premium",
    name: "Premium",
    description: "Głębszy granat, złoty akcent i formalny charakter."
  },
  {
    id: "forest",
    name: "Forest",
    description: "Zieleń i chłodne tła dla firm z obszaru OZE."
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Stonowany, techniczny, bardziej kontrastowy."
  },
  {
    id: "berry",
    name: "Berry",
    description: "Nowoczesna, cieplejsza paleta dla pracy operacyjnej."
  }
] as const;

export type ThemeName = (typeof themePacks)[number]["id"];

export const defaultTheme: ThemeName = "default";

export function isThemeName(value: string): value is ThemeName {
  return themePacks.some((theme) => theme.id === value);
}
