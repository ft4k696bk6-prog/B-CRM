import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/components/language-provider";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "B-CRM Energy",
  description: "CRM Energy dla sprzedaży, procesu klienta, magazynu i montażu.",
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
    title: "B-CRM Energy"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl">
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <PwaRegister />
            {children}
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
