"use client";

import { useEffect } from "react";

type OfferEventTrackerProps = {
  token: string;
};

function track(token: string, event: "visited" | "clicked" | "downloaded", href?: string) {
  const payload = JSON.stringify({ token, event, href: href || window.location.href });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/offers/events", new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch("/api/offers/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
}

export function OfferEventTracker({ token }: OfferEventTrackerProps) {
  useEffect(() => {
    track(token, "visited");
  }, [token]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-offer-track]") : null;
      if (!target) return;

      const eventType = target.dataset.offerTrack === "downloaded" ? "downloaded" : "clicked";
      track(token, eventType, target.href);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [token]);

  return null;
}
