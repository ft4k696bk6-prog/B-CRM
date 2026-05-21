"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-DHTCYP2K2L";
  const googleTagId = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "GT-WKRWW82W";
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!measurementId) return;

    const queryString = searchParams.toString();
    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;
    let retry: ReturnType<typeof setTimeout> | undefined;

    function sendPageView() {
      if (typeof window.gtag !== "function") {
        retry = setTimeout(sendPageView, 100);
        return;
      }

      window.gtag("event", "page_view", {
        send_to: measurementId,
        page_title: document.title,
        page_location: window.location.href,
        page_path: pagePath
      });
    }

    sendPageView();

    return () => {
      if (retry) clearTimeout(retry);
    };
  }, [measurementId, pathname, searchParams]);

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
