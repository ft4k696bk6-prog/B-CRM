import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "B-CRM",
  description: "Prosty CRM dla firmy sprzedającej fotowoltaikę",
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
