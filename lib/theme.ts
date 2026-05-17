export type ThemeId = "default" | "energy" | "premium" | "minimal" | "dark";

export type ThemeOption = {
  id: ThemeId;
  name: string;
  description: string;
  swatches: [string, string];
};

export const THEME_STORAGE_KEY = "bcrm-theme";

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "default",
    name: "B-CRM",
    description: "Niebieski i grafit",
    swatches: ["#172033", "#2d7dd2"]
  },
  {
    id: "energy",
    name: "Energia",
    description: "Grafit i zieleń",
    swatches: ["#17332b", "#2f9d75"]
  },
  {
    id: "premium",
    name: "Premium",
    description: "Granat i złoto",
    swatches: ["#111c3a", "#c58b1b"]
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Stal i błękit",
    swatches: ["#233142", "#567c9d"]
  },
  {
    id: "dark",
    name: "Dark",
    description: "Ciemny panel i mięta",
    swatches: ["#101820", "#4fd1a5"]
  }
];

export function isThemeId(value: string | null): value is ThemeId {
  return THEME_OPTIONS.some((theme) => theme.id === value);
}

export function applyTheme(themeId: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeId;
}
