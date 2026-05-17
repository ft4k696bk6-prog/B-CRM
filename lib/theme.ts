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
    description: "Głębszy granat, złoty akcent i bardziej executive vibe."
  },
  {
    id: "forest",
    name: "Forest",
    description: "Zieleń i chłodne tła pod firmy nastawione na eco."
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Stonowany, techniczny, bardziej kontrastowy."
  },
  {
    id: "berry",
    name: "Berry",
    description: "Nowocześniejsza, cieplejsza paleta dla portfolio."
  }
] as const;

export type ThemeName = (typeof themePacks)[number]["id"];

export const defaultTheme: ThemeName = "default";

export function isThemeName(value: string): value is ThemeName {
  return themePacks.some((theme) => theme.id === value);
}
