import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@/components/google-analytics";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import "./mobile-ux.css";
import "./ui-polish.css";
import "./appearance.css";

export const metadata: Metadata = {
  title: "B-CRM",
  description: "CRM sprzedażowo-operacyjny dla firm OZE",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/bcrm-icon.svg", type: "image/svg+xml" },
      { url: "/icons/bcrm-icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "B-CRM"
  }
};

const appearanceScript = `
  try {
    var saved = window.localStorage.getItem("bcrm-appearance");
    var theme = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.resolvedTheme =
      theme === "system" ? (systemDark ? "dark" : "light") : theme;
  } catch {
    var fallbackDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = "system";
    document.documentElement.dataset.resolvedTheme = fallbackDark ? "dark" : "light";
  }
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LanguageProvider>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
