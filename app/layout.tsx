import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@/components/google-analytics";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl">
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
