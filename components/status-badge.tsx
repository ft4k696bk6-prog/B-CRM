"use client";

import { useState } from "react";
import { MapPinned } from "lucide-react";
import { usePathname } from "next/navigation";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/constants";
import { useLanguage } from "@/components/language-provider";
import { supabase } from "@/lib/supabase";
import type { LeadStatus } from "@/lib/types";

const STATUS_LABELS_EN: Record<LeadStatus, string> = {
  Nowy: "New",
  "Call back": "Call-back",
  Spotkanie: "Meeting",
  "Po spotkaniu": "After meeting",
  Umowa: "Contract",
  Rezygnacja: "Resignation",
  "Nie odebrał": "No answer"
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { language } = useLanguage();
  const pathname = usePathname();
  const [mapBusy, setMapBusy] = useState(false);
  const leadMatch = pathname.match(/^\/leads\/([^/]+)$/);
  const leadId = leadMatch?.[1] || "";

  const badge = (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_TONES[status]}`}
    >
      {language === "en" ? STATUS_LABELS_EN[status] : STATUS_LABELS[status]}
    </span>
  );

  async function showOnMap() {
    if (!leadId || mapBusy) return;
    setMapBusy(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/map/geocode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ leadId, kind: "lead" })
        });
      }
    } catch {
      // The focused map will show a clear message if the lead still cannot be located.
    } finally {
      window.top?.location.assign(`/map?lead=${encodeURIComponent(leadId)}`);
    }
  }

  if (!leadId) return badge;

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {badge}
      <button
        type="button"
        className="btn-secondary min-h-9 px-3 text-xs"
        onClick={() => void showOnMap()}
        disabled={mapBusy}
      >
        <MapPinned className="h-4 w-4" aria-hidden="true" />
        {mapBusy ? "Szukam na mapie…" : "Pokaż na mapie"}
      </button>
    </span>
  );
}