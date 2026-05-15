import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B-CRM",
  description: "Prosty CRM dla firmy sprzedającej fotowoltaikę"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
