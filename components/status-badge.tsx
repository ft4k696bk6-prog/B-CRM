"use client";

import Link from "next/link";
import { MapPinned } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/constants";
import { useLanguage } from "@/components/language-provider";
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
  const searchParams = useSearchParams();
  const leadMatch = pathname.match(/^\/leads\/([^/]+)$/);
  const leadId = leadMatch?.[1] || "";
  const embedded = searchParams.get("embedded") === "1";

  const badge = (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_TONES[status]}`}
    >
      {language === "en" ? STATUS_LABELS_EN[status] : STATUS_LABELS[status]}
    </span>
  );

  if (!leadId || embedded) return badge;

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {badge}
      <Link
        href={`/map?lead=${encodeURIComponent(leadId)}`}
        className="btn-secondary min-h-9 px-3 text-xs"
      >
        <MapPinned className="h-4 w-4" aria-hidden="true" />
        Pokaż na mapie
      </Link>
    </span>
  );
}